// ============================================================
// COMPUTE MARKET — calcolo condiviso tra dispositivi, senza fiducia cieca
// ============================================================
// L'idea: un telefono fermo in carica, un tablet appoggiato sul tavolo e il
// portatile di un amico nel gruppo spese sono, insieme, molta più potenza di
// quella che ha il dispositivo che ha in mano l'utente. Momentum può usarla
// per i calcoli pesanti (Monte Carlo delle strategie, backtest storici) e
// restituire in secondi ciò che su un telefono richiederebbe minuti.
//
// Ma "calcolo distribuito" in un'app finanziaria è una frase pericolosa, e qui
// vale con DUE vincoli non negoziabili, entrambi imposti dal codice e non
// dalla buona volontà:
//
//  1. SI CONDIVIDE SOLO CIÒ CHE NON È DI NESSUNO.
//     Far calcolare a un altro dispositivo qualcosa sui TUOI dati significa
//     che i tuoi dati escono: vietato, senza eccezioni e senza opzioni.
//     Passano solo i carichi il cui input è PUBBLICO (rendimenti di mercato,
//     serie storiche) o GIÀ CONDIVISO per costruzione (i saldi di un gruppo
//     spese, che i membri del gruppo hanno già tutti). `assertShareable` è il
//     cancello: un carico non in elenco non parte, e l'errore è esplicito.
//
//  2. CHI CALCOLA PER TE NON PUÒ MENTIRTI.
//     Un peer potrebbe restituire numeri inventati — più veloce che calcolarli,
//     e su una proiezione finanziaria sarebbe grave. Qui ogni unità di lavoro è
//     DETERMINISTICA (stesso seme → stesso risultato, bit per bit), quindi si
//     può verificare: una parte delle unità viene assegnata in DOPPIO a due
//     dispositivi indipendenti e i risultati confrontati per hash. Chi non
//     coincide perde reputazione — la stessa reputazione che lo esclude anche
//     dal voto nell'apprendimento federato (update-ledger.js). I due sistemi si
//     rinforzano a vicenda.
//
// Terzo principio, di rispetto: nessun dispositivo viene usato se sta
// consumando batteria sotto una soglia. Rubare autonomia al telefono di
// qualcuno per un calcolo che poteva aspettare è esattamente ciò che rende
// odiose le app che lo fanno.
//
// Funzioni PURE (nessun DOM, nessuna rete, tempo e casualità iniettabili).
'use strict';

import { expectedValue, stragglerDeadline, SOGLIA_CONSEGNA } from './compute-reliability.js';

// ── Cancello: cosa si può distribuire, e cosa no ──
// Elenco chiuso e motivato. Aggiungere una voce qui è una decisione di
// privacy, non un dettaglio tecnico — per questo ognuna porta il perché.
export const SHAREABLE_WORKLOADS = {
  'montecarlo-strategie': {
    perche: 'Gira su rendimenti di mercato pubblici. Nessun dato personale nell\'input.',
    inputPubblico: true,
  },
  'backtest-storico': {
    perche: 'Serie storiche pubbliche di indici e settori. Nessun dato personale nell\'input.',
    inputPubblico: true,
  },
  'settlement-gruppo': {
    perche: 'Opera su saldi che i membri del gruppo hanno già tutti: non esce nulla di nuovo.',
    inputPubblico: false,
    soloDentroIlGruppo: true,
  },
};

// I carichi che qualcuno potrebbe essere tentato di distribuire e che NON si
// distribuiscono mai. Elencati apposta: un rifiuto motivato vale più di un
// silenzio, e impedisce che "tanto è solo un aggregato" si insinui domani.
export const NEVER_SHAREABLE = {
  'previsione-cassa': 'Input = i tuoi movimenti reali. Resta sul tuo dispositivo.',
  'categorizzazione': 'Input = le descrizioni delle tue spese. Resta sul tuo dispositivo.',
  'grafo-causale': 'Input = le tue serie di spesa per categoria. Resta sul tuo dispositivo.',
  'calcolo-fiscale': 'Input = i tuoi redditi e le tue fatture. Resta sul tuo dispositivo.',
};

export function assertShareable(kind) {
  if (NEVER_SHAREABLE[kind]) {
    throw new Error(`"${kind}" non si distribuisce mai: ${NEVER_SHAREABLE[kind]}`);
  }
  const spec = SHAREABLE_WORKLOADS[kind];
  if (!spec) {
    throw new Error(`"${kind}" non è nell'elenco dei carichi distribuibili: per sicurezza non parte.`);
  }
  return spec;
}

// ── Capacità di un dispositivo: da segnali VERI, non da una stima ──
// I segnali arrivano da chi chiama (Battery Status API, hardwareConcurrency,
// visibilità della pagina). Dove un segnale non esiste — la Battery API non
// c'è su Safari/iOS — si dichiara `null` e si applica un default prudente,
// invece di fingere di saperlo.
export function deviceCapability({
  cores = 2, charging = null, batteryLevel = null, screenOn = true, thermalThrottled = false,
} = {}) {
  const motivi = [];

  if (thermalThrottled) return { score: 0, disponibile: false, motivi: ['il dispositivo è già caldo'] };

  // Sotto il 40% e non in carica: non si tocca. L'autonomia di chi ci presta
  // il dispositivo vale più di qualche secondo di calcolo in meno.
  if (charging === false && Number.isFinite(batteryLevel) && batteryLevel < 0.4) {
    return { score: 0, disponibile: false, motivi: ['a batteria, sotto il 40%'] };
  }

  let score = Math.max(1, Math.min(16, Number(cores) || 2));
  if (charging === true) { score *= 2; motivi.push('in carica'); }
  else if (charging === null) { motivi.push('stato batteria sconosciuto: prudenza'); score *= 0.75; }
  if (!screenOn) { score *= 0.5; motivi.push('schermo spento: potrebbe essere sospeso a breve'); }

  return { score: Math.round(score * 100) / 100, disponibile: score > 0, motivi };
}

// ── Divisione del lavoro ──
// Ogni unità è definita da (workloadId, indice, seme): deterministica per
// costruzione. Chiunque la calcoli deve ottenere lo STESSO risultato — è la
// proprietà su cui si regge tutta la verifica.
export function makeWorkUnits(workloadId, totalUnits, { seedBase = 1 } = {}) {
  return Array.from({ length: totalUnits }, (_, i) => ({
    workloadId,
    index: i,
    seed: (seedBase + i * 2654435761) >>> 0, // costante di Knuth: semi ben distanziati
  }));
}

// Assegna le unità ai dispositivi in proporzione alla capacità, e ne duplica
// una quota per la verifica. `verifyRatio` è la percentuale di unità date a
// DUE dispositivi diversi: più è alta, più costa e più è difficile mentire.
// Con un solo dispositivo disponibile non c'è nulla da verificare (e nulla da
// distribuire): si torna al calcolo locale, dichiarandolo.
// `reliability` (stato di compute-reliability.js) è OPZIONALE: senza, il peso
// resta la potenza grezza — è il comportamento storico e va lasciato intatto
// per chi non tiene lo storico. Con lo stato, il peso diventa **potenza ×
// probabilità che il risultato torni indietro**, che è la domanda vera: un
// portatile modesto attaccato alla corrente vale più di un telefono veloce al
// 12%, e a peso-potenza vinceva il telefono.
export function assignWork(units, peers, { verifyRatio = 0.2, randomFn = Math.random, reliability = null, now = Date.now() } = {}) {
  const utilizzabili = (peers || []).filter((p) => p.capability?.disponibile && p.capability.score > 0);

  // Il peso di ciascun dispositivo, e il perché — serve anche a spiegarlo.
  const pesi = new Map();
  const previsioni = [];
  for (const p of utilizzabili) {
    if (!reliability) { pesi.set(p.peerId, p.capability.score); continue; }
    const ev = expectedValue(reliability, p, { now });
    pesi.set(p.peerId, ev.odds.p >= SOGLIA_CONSEGNA ? ev.valore : 0);
    previsioni.push({ peerId: p.peerId, potenza: ev.score, valore: ev.valore, probabilita: ev.odds.p, motivo: ev.odds.motivo });
  }
  // Chi ha valore atteso nullo non è "lento": è uno che con ogni probabilità
  // non consegnerà. Dargli unità significa aspettarlo per niente.
  const disponibili = utilizzabili.filter((p) => pesi.get(p.peerId) > 0);
  const esclusi = utilizzabili.filter((p) => !(pesi.get(p.peerId) > 0)).map((p) => p.peerId);

  if (disponibili.length < 2) {
    return {
      assegnazioni: new Map(), locali: [...units], verifiche: [], scadenze: new Map(), previsioni, esclusi,
      motivo: reliability && utilizzabili.length >= 2
        ? 'meno di due dispositivi da cui aspettarsi davvero un risultato: calcolo locale'
        : 'meno di due dispositivi utilizzabili: calcolo locale',
    };
  }

  const totalePeso = disponibili.reduce((s, p) => s + pesi.get(p.peerId), 0);
  const assegnazioni = new Map(disponibili.map((p) => [p.peerId, []]));

  // Distribuzione proporzionale, deterministica nell'ordine (i dispositivi da
  // cui ci si aspetta di più ricevono per primi, così un eventuale straggler
  // pesa meno).
  const ordinati = [...disponibili].sort((a, b) => pesi.get(b.peerId) - pesi.get(a.peerId));
  let i = 0;
  for (const unit of units) {
    // Selezione proporzionale: si avanza lungo la lista in base al peso.
    let scelto = ordinati[i % ordinati.length];
    let acc = 0;
    const target = ((i + 0.5) / units.length) * totalePeso;
    for (const p of ordinati) { acc += pesi.get(p.peerId); if (acc >= target) { scelto = p; break; } }
    assegnazioni.get(scelto.peerId).push(unit);
    i++;
  }

  // Verifica: una quota delle unità viene data a un SECONDO dispositivo,
  // diverso dal primo. Chi mente non sa quali unità sono duplicate.
  // BUG REALE trovato dai test: `Math.max(1, …)` forzava una verifica anche
  // con verifyRatio a zero, duplicando un'unità e facendo tornare 101 risultati
  // su 100 unità. Verifica zero è una scelta legittima (solo i propri
  // dispositivi, di cui ci si fida): va rispettata, non corretta d'ufficio.
  const verifiche = [];
  const quante = verifyRatio > 0 ? Math.max(1, Math.round(units.length * verifyRatio)) : 0;
  for (let n = 0; n < quante; n++) {
    const unit = units[Math.floor(randomFn() * units.length)];
    if (!unit) continue;
    const primo = [...assegnazioni.entries()].find(([, list]) => list.includes(unit))?.[0];
    const altri = ordinati.filter((p) => p.peerId !== primo);
    if (!altri.length) continue;
    const secondo = altri[Math.floor(randomFn() * altri.length)];
    assegnazioni.get(secondo.peerId).push(unit);
    verifiche.push({ unit, peerA: primo, peerB: secondo.peerId });
  }

  // QUANDO SMETTERE DI ASPETTARE, per ciascun dispositivo e in base a quanto
  // gli abbiamo dato. Senza una scadenza, un dispositivo che sparisce non fa
  // fallire il calcolo: lo fa restare a metà per sempre, che è peggio perché
  // non lo si può nemmeno dire all'utente.
  const scadenze = new Map();
  if (reliability) {
    for (const [peerId, list] of assegnazioni) {
      if (!list.length) continue;
      scadenze.set(peerId, stragglerDeadline(reliability, peerId, { unita: list.length, now }));
    }
  }

  return { assegnazioni, locali: [], verifiche, scadenze, previsioni, esclusi, motivo: null };
}

// ── Verifica dei risultati ──
// Hash deterministico di un risultato numerico: due dispositivi che hanno
// calcolato la stessa unità onestamente devono produrre lo stesso hash.
export function resultHash(value) {
  const s = JSON.stringify(value, (_k, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h >>> 0).toString(36);
}

// Confronta le unità duplicate. Restituisce chi ha mentito (o sbagliato) e le
// unità che vanno RICALCOLATE localmente — mai un risultato accettato "in
// dubbio". Onestà: da un disaccordo a due non si sa CHI dei due ha torto,
// quindi si sospettano entrambi e si ricalcola in casa. Con tre repliche si
// potrebbe votare, ma costerebbe di più: la scelta è dichiarata, non nascosta.
export function verifyResults(verifiche, risultatiPerPeer) {
  const sospetti = new Map();
  const daRicalcolare = [];
  let concordi = 0;

  for (const { unit, peerA, peerB } of verifiche || []) {
    const a = risultatiPerPeer?.[peerA]?.[unit.index];
    const b = risultatiPerPeer?.[peerB]?.[unit.index];
    if (a === undefined || b === undefined) continue; // uno dei due non ha risposto: è un ritardatario, non un bugiardo
    if (resultHash(a) === resultHash(b)) { concordi++; continue; }
    for (const p of [peerA, peerB]) sospetti.set(p, (sospetti.get(p) || 0) + 1);
    daRicalcolare.push(unit);
  }

  return {
    concordi,
    discordi: daRicalcolare.length,
    sospetti: [...sospetti.entries()].map(([peerId, volte]) => ({ peerId, volte })),
    daRicalcolare,
    // Se anche UNA sola verifica è fallita, l'intero risultato non è
    // affidabile: meglio ricalcolare che consegnare una proiezione sbagliata.
    affidabile: daRicalcolare.length === 0,
  };
}

// Raccoglie i risultati in un unico array ordinato per indice. Le unità
// mancanti (dispositivo che non ha risposto) vengono elencate, mai riempite
// con un valore inventato o con uno zero.
export function collectResults(units, risultatiPerPeer) {
  const out = new Array(units.length).fill(undefined);
  for (const perUnit of Object.values(risultatiPerPeer || {})) {
    for (const [idx, val] of Object.entries(perUnit || {})) {
      const i = Number(idx);
      if (Number.isInteger(i) && i >= 0 && i < out.length && out[i] === undefined) out[i] = val;
    }
  }
  const mancanti = out.map((v, i) => (v === undefined ? i : -1)).filter((i) => i >= 0);
  return { risultati: out, mancanti, completo: mancanti.length === 0 };
}

// ── Il piano complessivo, pronto da mostrare ──
// Restituisce cosa succederà e perché, in parole che si possono anche
// mostrare all'utente: un calcolo distribuito che non si può spiegare non
// andrebbe fatto.
export function planComputation({ kind, totalUnits, peers, self, verifyRatio = 0.2, randomFn = Math.random, reliability = null, now = Date.now() }) {
  const spec = assertShareable(kind); // lancia se non è distribuibile: il cancello viene PRIMA di tutto
  const units = makeWorkUnits(kind, totalUnits);
  const candidati = (peers || []).map((p) => ({ ...p, capability: p.capability || deviceCapability(p.signals) }));
  const { assegnazioni, locali, verifiche, scadenze, previsioni, esclusi, motivo } = assignWork(units, candidati, { verifyRatio, randomFn, reliability, now });

  const partecipanti = [...assegnazioni.entries()].map(([peerId, list]) => ({ peerId, unita: list.length }));
  const capacitaSelf = self ? deviceCapability(self) : null;

  return {
    kind, spec, units, assegnazioni, verifiche, scadenze, previsioni, esclusi,
    // Le unità in volo con la loro scadenza: è la lista che `unitsToReassign`
    // legge per capire cosa riassegnare senza aspettare all'infinito.
    inFlight: [...assegnazioni.entries()].flatMap(([peerId, list]) =>
      list.map((unit) => ({ unit, peerId, scadeA: scadenze.get(peerId)?.scadeA || null }))),
    localiDaCalcolare: locali,
    distribuito: partecipanti.length > 0,
    partecipanti,
    capacitaSelf,
    spiegazione: partecipanti.length
      ? `Il calcolo viene diviso tra ${partecipanti.length} dispositivi. ${verifiche.length} parti sono calcolate due volte da dispositivi diversi per controllare che tornino uguali. ${spec.perche}`
      : `Calcolo fatto qui: ${motivo || 'nessun altro dispositivo disponibile'}.`,
  };
}
