// ============================================================
// ANYTIME EXPERIMENT — l'esperimento che puoi guardare ogni giorno
// ============================================================
// Il problema, che è insieme matematico e di prodotto:
//
// Nessuna app di finanza personale verifica mai se il suo consiglio ha
// funzionato PER TE. Ti dice "taglia i ristoranti" e poi non torna più
// sull'argomento. Il motivo non è pigrizia: è che farlo bene è difficile, e
// farlo male è peggio che non farlo.
//
// Perché è difficile: se proponi una prova di due settimane e la persona
// controlla il risultato ogni giorno — e lo farà — un test statistico classico
// SI ROMPE. Il p-value è valido solo se lo guardi UNA volta, alla fine, sul
// campione che avevi dichiarato prima. Guardarlo ogni giorno e fermarsi quando
// diventa favorevole ("optional stopping") gonfia i falsi positivi in modo
// drammatico: da un 5% dichiarato si arriva facilmente al 30-40% misurato.
// È lo stesso errore per cui una quantità enorme di risultati pubblicati non
// si replica, ed è esattamente ciò che farebbe un'app che mostra un p-value
// aggiornato in tempo reale.
//
// La soluzione corretta esiste ed è recente: **inferenza valida in ogni
// istante** (anytime-valid), costruita su martingale di test — processi di
// "capitale scommesso" — e sulla disuguaglianza di Ville. In sostanza: si
// scommette contro l'ipotesi che non sia cambiato nulla. Il capitale accumulato
// è la prova. Ville garantisce che, se davvero non è cambiato nulla, la
// probabilità che il capitale superi 1/α IN QUALUNQUE MOMENTO resta ≤ α.
// Quindi la persona può guardare quando vuole, fermarsi quando vuole, e la
// garanzia regge. Riferimenti: Ville (1939) per la disuguaglianza, e la linea
// di lavoro su e-values e confidence sequences (Ramdas, Howard,
// Waudby-Smith e altri, 2020-2023) per i processi di scommessa qui usati.
//
// Cosa ne esce, in parole da mostrare a chiunque:
//   "Guarda quando vuoi. Ti dico io quando ne so abbastanza per rispondere."
//
// Funzioni PURE, nessun DOM, nessuna rete, casualità e tempo iniettabili.
'use strict';

// Il capitale parte da 1 e non può mai diventare negativo: è una scommessa in
// cui non si può perdere più di quanto si ha. Questa è la proprietà che rende
// valida la garanzia di Ville.
const CAPITALE_INIZIALE = 1;

// ── Normalizzazione ──
// La matematica delle scommesse richiede osservazioni in [0,1]. Si dichiara
// l'intervallo plausibile e si normalizza. Un valore fuori intervallo NON
// viene schiacciato in silenzio: schiacciarlo falserebbe la garanzia, quindi
// si segnala e si allarga l'intervallo, dichiarandolo.
export function normalizeObservations(values, { lo, hi } = {}) {
  const vals = (values || []).map(Number).filter(Number.isFinite);
  if (!vals.length) return { x: [], lo: 0, hi: 1, allargato: false };

  let min = Number.isFinite(lo) ? lo : Math.min(...vals);
  let max = Number.isFinite(hi) ? hi : Math.max(...vals);
  let allargato = false;
  if (vals.some((v) => v < min || v > max)) {
    min = Math.min(min, ...vals);
    max = Math.max(max, ...vals);
    allargato = true;
  }
  const range = max - min;
  if (range <= 0) return { x: vals.map(() => 0.5), lo: min, hi: max, allargato, degenere: true };
  return { x: vals.map((v) => (v - min) / range), lo: min, hi: max, allargato, degenere: false };
}

// ── Il processo di capitale ──
// K_t = Π (1 + λ_i · (x_i − m)), con λ_i scelto usando SOLO il passato
// (predicibile). È questa predicibilità che rende K una martingala sotto
// l'ipotesi nulla, e quindi che fa valere la garanzia in ogni istante.
//
// La scelta di λ è la "strategia di scommessa": non influisce sulla VALIDITÀ
// (che vale per qualunque λ predicibile), solo sulla POTENZA — quanto in
// fretta ci si accorge di un cambiamento vero. Qui si usa una taratura sulla
// varianza osservata finora, limitata per non rischiare tutto il capitale su
// una sola osservazione.
export function capitalProcess(x, m, { alpha = 0.05, direzione = 1, cap = 0.5 } = {}) {
  const storia = [];
  let K = CAPITALE_INIZIALE;
  let somma = 0, sommaQ = 0, n = 0;
  let maxK = K;

  const soglia = 1 / alpha;
  let primoSuperamento = null;

  for (let i = 0; i < x.length; i++) {
    // λ predicibile: calcolato PRIMA di vedere x[i], solo dal passato.
    const muPrec = n > 0 ? somma / n : 0.5;
    const varPrec = n > 1 ? Math.max(1e-4, sommaQ / n - muPrec * muPrec) : 0.25;
    const lambdaGrezzo = Math.sqrt((2 * Math.log(soglia)) / Math.max(1, varPrec * (i + 1) * Math.log(i + 2)));
    // Il limite garantisce 1 + λ(x−m) > 0 sempre: il capitale non può azzerarsi
    // per una singola osservazione, che è ciò che rende il processo utilizzabile.
    const limite = Math.min(cap, 0.99 / Math.max(m, 1 - m, 1e-6));
    const lambda = direzione * Math.min(lambdaGrezzo, limite);

    K *= (1 + lambda * (x[i] - m));
    if (!(K > 0) || !Number.isFinite(K)) K = 1e-12; // salvaguardia numerica, mai un capitale negativo
    if (K > maxK) maxK = K;
    if (primoSuperamento === null && K >= soglia) primoSuperamento = i + 1;

    n++; somma += x[i]; sommaQ += x[i] * x[i];
    // BUG REALE trovato dai test: con `toFixed(6)` un capitale molto piccolo
    // (1e-9) veniva registrato come 0 — nella storia sembrava che la scommessa
    // fosse stata azzerata, cosa che per costruzione non può accadere, e in un
    // grafico avrebbe mostrato un crollo a zero mai avvenuto. `toPrecision`
    // conserva l'ordine di grandezza qualunque esso sia.
    storia.push(Number(K.toPrecision(6)));
  }
  return { K, maxK, storia, soglia, primoSuperamento };
}

// Test bilaterale: si scommette sia che la media sia più alta sia che sia più
// bassa, e si prende il capitale maggiore. Ciascuno dei due processi è valido
// da solo; usarne due dimezza il budget di errore, quindi la soglia si alza.
export function evidenceAgainst(x, m, { alpha = 0.05 } = {}) {
  const su = capitalProcess(x, m, { alpha: alpha / 2, direzione: 1 });
  const giu = capitalProcess(x, m, { alpha: alpha / 2, direzione: -1 });
  const K = Math.max(su.K, giu.K);
  const maxK = Math.max(su.maxK, giu.maxK);
  const soglia = 2 / alpha;
  const primo = [su.primoSuperamento, giu.primoSuperamento].filter((v) => v !== null);
  return {
    K: +K.toFixed(4),
    maxK: +maxK.toFixed(4),
    soglia,
    // "Evidenza" leggibile: quante volte il capitale ha battuto la scommessa
    // che nulla fosse cambiato. 20 volte = molto convincente, 2 volte = poco.
    evidenza: +maxK.toFixed(2),
    rifiutato: maxK >= soglia,
    primoIstanteDecisivo: primo.length ? Math.min(...primo) : null,
    direzione: su.maxK >= giu.maxK ? 'aumento' : 'diminuzione',
  };
}

// ── Intervallo valido in ogni istante ──
// L'insieme dei valori di media che NON sono ancora stati esclusi. A differenza
// di un intervallo di confidenza classico, questo si può guardare in continuo:
// resta valido a ogni istante, non solo alla fine.
export function confidenceSequence(x, { alpha = 0.05, griglia = 101 } = {}) {
  if (!x.length) return { lo: 0, hi: 1, larghezza: 1, valori: [] };
  const ammessi = [];
  for (let g = 0; g < griglia; g++) {
    const m = g / (griglia - 1);
    const e = evidenceAgainst(x, m, { alpha });
    if (!e.rifiutato) ammessi.push(m);
  }
  if (!ammessi.length) {
    // Tutti esclusi: succede con dati molto informativi e griglia grossolana.
    // Si dichiara invece di restituire un intervallo vuoto senza spiegazione.
    return { lo: null, hi: null, larghezza: 0, valori: [], degenere: true };
  }
  const lo = Math.min(...ammessi), hi = Math.max(...ammessi);
  return { lo: +lo.toFixed(4), hi: +hi.toFixed(4), larghezza: +(hi - lo).toFixed(4), valori: ammessi };
}

// ── L'esperimento, come lo vive la persona ──
//
// baseline = i periodi PRIMA del cambiamento, followUp = quelli DOPO.
// L'ipotesi nulla è "la media non è cambiata": si scommette contro di essa
// usando la media del periodo precedente come riferimento.
export function runExperiment({
  name, baseline = [], followUp = [], alpha = 0.05,
  lo = null, hi = null, minPeriodi = 5, unita = '€',
} = {}) {
  const tutti = [...baseline, ...followUp];
  const norm = normalizeObservations(tutti, { lo, hi });
  if (norm.degenere || !followUp.length) {
    return {
      name, stato: 'in-corso', conclusione: null,
      messaggio: 'Non è ancora successo abbastanza per dire qualcosa.',
      periodiRaccolti: followUp.length, periodiMinimi: minPeriodi,
    };
  }

  const nB = baseline.length;
  const xB = norm.x.slice(0, nB);
  const xF = norm.x.slice(nB);
  if (!xB.length) {
    return { name, stato: 'senza-riferimento', conclusione: null, messaggio: 'Manca il periodo di confronto: non c\'è nulla con cui paragonare.' };
  }

  const m0 = xB.reduce((s, v) => s + v, 0) / xB.length; // media del periodo di riferimento
  const ev = evidenceAgainst(xF, m0, { alpha });

  const mediaB = baseline.reduce((s, v) => s + v, 0) / baseline.length;
  const mediaF = followUp.reduce((s, v) => s + v, 0) / followUp.length;
  const differenza = mediaF - mediaB;

  // Intervallo riportato nell'unità reale, non normalizzata: un numero in euro
  // si capisce, un numero tra 0 e 1 no.
  const cs = confidenceSequence(xF, { alpha });
  const scala = norm.hi - norm.lo;
  const intervalloReale = cs.lo === null ? null : [
    +((cs.lo * scala + norm.lo) - mediaB).toFixed(2),
    +((cs.hi * scala + norm.lo) - mediaB).toFixed(2),
  ];

  if (ev.rifiutato) {
    const verso = differenza < 0 ? 'diminuito' : 'aumentato';
    return {
      name, stato: 'concluso', conclusione: 'cambiato',
      differenza: +differenza.toFixed(2),
      intervallo: intervalloReale,
      evidenza: ev.evidenza,
      periodiRaccolti: followUp.length,
      istanteDecisivo: ev.primoIstanteDecisivo,
      messaggio: intervalloReale
        ? `È ${verso} davvero: tra ${Math.abs(intervalloReale[1])}${unita} e ${Math.abs(intervalloReale[0])}${unita} a periodo.`
        : `È ${verso} davvero.`,
      puoiFermarti: true,
    };
  }

  if (followUp.length < minPeriodi) {
    return {
      name, stato: 'in-corso', conclusione: null,
      periodiRaccolti: followUp.length, periodiMinimi: minPeriodi,
      evidenza: ev.evidenza,
      messaggio: `Ancora presto: ${followUp.length} ${followUp.length === 1 ? 'periodo' : 'periodi'} su ${minPeriodi}. Puoi guardare quando vuoi, il risultato resta valido.`,
      puoiFermarti: false,
    };
  }

  // Il verdetto scomodo, che è il più prezioso: abbastanza dati, nessun
  // cambiamento. Nessuna app lo dice mai, ed è l'informazione che fa
  // risparmiare tempo e delusioni.
  return {
    name, stato: 'concluso', conclusione: 'nessun-cambiamento',
    differenza: +differenza.toFixed(2),
    intervallo: intervalloReale,
    evidenza: ev.evidenza,
    periodiRaccolti: followUp.length,
    messaggio: 'Non è cambiato niente di misurabile. Hai provato, non ha funzionato: è un\'informazione utile, non un fallimento.',
    puoiFermarti: true,
  };
}

// ── Quanto manca, in periodi ──
// La domanda che ogni persona fa: "quanto devo andare avanti?". Si stima dal
// ritmo di crescita del capitale osservato finora. È una PREVISIONE, e viene
// dichiarata come tale — se il capitale non sta crescendo, la risposta onesta
// è "così non arriveremo da nessuna parte".
export function estimateRemaining(x, m, { alpha = 0.05 } = {}) {
  if (x.length < 3) return { periodi: null, messaggio: 'Troppo presto per stimare quanto manca.' };
  const p = capitalProcess(x, m, { alpha: alpha / 2, direzione: 1 });
  const q = capitalProcess(x, m, { alpha: alpha / 2, direzione: -1 });
  const migliore = p.maxK >= q.maxK ? p : q;
  const soglia = 2 / alpha;
  if (migliore.K >= soglia) return { periodi: 0, messaggio: 'Ne sappiamo già abbastanza.' };

  // Crescita media per periodo, su scala logaritmica.
  const tasso = Math.log(Math.max(migliore.K, 1e-12)) / x.length;
  if (!(tasso > 1e-4)) {
    return {
      periodi: null,
      messaggio: 'Con questo andamento non arriveremo a una risposta: la differenza, se c\'è, è troppo piccola per vedersi.',
    };
  }
  const mancano = Math.ceil((Math.log(soglia) - Math.log(Math.max(migliore.K, 1e-12))) / tasso);
  return {
    periodi: mancano,
    messaggio: mancano <= 0 ? 'Ne sappiamo già abbastanza.' : `Servono ancora circa ${mancano} ${mancano === 1 ? 'periodo' : 'periodi'}.`,
  };
}

// ── Il confronto con il metodo classico, per dimostrare la differenza ──
// Esiste perché la differenza va MISURATA, non affermata: questo è il test t
// applicato a ogni istante, esattamente come farebbe un'app che aggiorna un
// p-value in tempo reale. Serve nei test per contare quanto spesso sbaglia.
export function naivePeekingTest(x, m, { alpha = 0.05 } = {}) {
  let somma = 0, sommaQ = 0;
  for (let i = 0; i < x.length; i++) {
    somma += x[i]; sommaQ += x[i] * x[i];
    const n = i + 1;
    if (n < 3) continue;
    const mu = somma / n;
    const varianza = Math.max(1e-12, (sommaQ - n * mu * mu) / (n - 1));
    const t = (mu - m) / Math.sqrt(varianza / n);
    // Soglia normale al 5% bilaterale: l'approssimazione che userebbe
    // qualunque cruscotto che mostra "significativo" in tempo reale.
    if (Math.abs(t) >= 1.96) return { rifiutato: true, istante: n };
  }
  return { rifiutato: false, istante: null };
}
