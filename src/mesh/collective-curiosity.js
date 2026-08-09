// ============================================================
// LA CURIOSITÀ COLLETTIVA — la rete decide cosa vale la pena imparare
// ============================================================
// Momentum sa già far crescere i modelli senza far uscire i dati
// (`federated-distillation.js`: escono le PREVISIONI su sonde pubbliche, mai i
// pesi né i gradienti) e sa già propagare conoscenza pubblica
// (`knowledge-relay.js`). Manca il pezzo che rende una rete di dispositivi una
// cosa diversa da tanti dispositivi: **nessuno decide COSA imparare**.
//
// Oggi ogni dispositivo impara da quello che gli capita davanti. Va bene per
// il caso comune e non copre mai il caso raro — ed è esattamente sul caso raro
// che un'app finanziaria sbaglia in modo costoso.
//
// L'IDEA: la rete sa già dove è ignorante, e non se n'è mai accorta. Se sulla
// stessa sonda pubblica dieci dispositivi rispondono dieci cose diverse, quel
// punto è **il buco di conoscenza del collettivo**, misurato e non ipotizzato.
// Il disaccordo non è rumore da mediare via: è l'indice del programma di
// studio. È la versione a rete di un'idea vecchia e solida del machine
// learning (query by committee, Seung-Opper-Sompolinsky 1992): a imparare non
// si fa prima guardando altri mille esempi facili, si fa guardando l'esempio
// su cui il comitato si spacca.
//
// E POI LA PARTE CHE CAMBIA IL PRODOTTO — a chi si chiede la risposta:
//   1. PRIMA ALLA RETE. Se qualche dispositivo è sicuro e concorde mentre noi
//      no, la conoscenza esiste già: non va cercata, va fatta arrivare.
//   2. POI ALLE FONTI VERIFICATE. Se è un fatto pubblico (un tasso, una serie
//      storica), lo si va a prendere dove è controllabile — `alpha/sources.js`
//      ha già il registro delle fonti primarie, il riscontro incrociato e il
//      cancello `trainingEligible` che impedisce a un dato non verificato di
//      entrare nell'addestramento.
//   3. SOLO ALLA FINE ALL'UTENTE, una domanda per volta e con un tetto.
// Quasi tutti i prodotti fanno l'ordine opposto: chiedono subito alla persona,
// perché è la cosa più economica da costruire. È anche la più costosa da
// subire, ed è una delle prime ragioni per cui un'app viene abbandonata.
//
// L'ACCORDO NON È PROVA SE NON È INDIPENDENTE, ed è il difetto che affligge
// ogni sistema federato: se otto dispositivi hanno tutti fuso lo stesso
// modello, il loro accordo non è otto testimoni, è un testimone ripetuto otto
// volte — e su un errore ci si convince a vicenda invece di correggersi
// (camera dell'eco). Qui i testimoni davvero indipendenti si CONTANO, e senza
// bisogno di aggiungere un campo al protocollo: due dispositivi che
// restituiscono le stesse identiche distribuzioni su molte sonde sono quasi
// certamente copie dello stesso modello, non due opinioni.
//
// Funzioni PURE. Nessun dato personale entra da nessuna parte: si lavora solo
// sulle sonde PUBBLICHE già definite in federated-distillation.js.
'use strict';

// Sotto questo disaccordo il collettivo è sostanzialmente d'accordo: non c'è
// niente da imparare, e insistere sarebbe curiosità decorativa.
export const SOGLIA_DISACCORDO = 0.25;
// Un comitato di uno non è un comitato. Con meno di tre testimoni
// INDIPENDENTI il disaccordo misurato è aneddoto.
export const MIN_TESTIMONI = 3;
// Quante domande all'utente si possono fare, al massimo, in un periodo.
// Il tetto non è prudenza: è la differenza fra un'app che impara e un'app che
// interroga. La seconda si chiude e non si riapre.
export const DEFAULT_TETTO_DOMANDE = { quante: 2, periodoMs: 7 * 24 * 3600 * 1000 };

const entriesOrd = (o) => Object.entries(o || {}).sort((a, b) => (a[0] < b[0] ? -1 : 1));

// L'impronta delle risposte di un dispositivo: serve solo a riconoscere due
// modelli identici, quindi va bene una firma corta e deterministica.
export function answerFingerprint(digest) {
  const parti = [];
  for (const [probe, dist] of entriesOrd(digest?.answers)) {
    parti.push(`${probe}:${entriesOrd(dist).map(([c, p]) => `${c}=${p}`).join(',')}`);
  }
  const s = parti.join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h >>> 0).toString(36);
}

// QUANTI TESTIMONI INDIPENDENTI ci sono davvero. Dispositivi con risposte
// identiche contano UNO: non sono d'accordo, sono lo stesso.
export function independentWitnesses(digests = []) {
  const gruppi = new Map();
  for (const d of digests) {
    const f = answerFingerprint(d?.digest);
    if (!gruppi.has(f)) gruppi.set(f, []);
    gruppi.get(f).push(d.peerId);
  }
  return {
    indipendenti: gruppi.size,
    totali: digests.length,
    cloni: [...gruppi.values()].filter((g) => g.length > 1),
    // Il rapporto fra "quanti sembrano" e "quanti sono": se scende, la rete si
    // sta convincendo da sola invece di correggersi.
    diversita: digests.length ? gruppi.size / digests.length : 0,
  };
}

// Il disaccordo su UNA sonda. Due componenti, perché dicono cose diverse:
//  - INCERTEZZA: anche se tutti concordano, potrebbero concordare nel non
//    sapere (distribuzioni piatte). Entropia della media, normalizzata.
//  - DIVISIONE: quanti dispositivi puntano su risposte diverse. È il caso più
//    interessante — qualcuno ha ragione, e la rete non sa chi.
export function probeDisagreement(probe, digests = [], { pesi = null } = {}) {
  const voti = [];
  const somma = new Map();
  let pesoTot = 0;
  for (const { peerId, digest } of digests) {
    const dist = digest?.answers?.[probe];
    if (!dist) continue;
    const w = pesi?.get?.(peerId) ?? 1;
    if (!(w > 0)) continue;
    pesoTot += w;
    let miglior = null, migliorP = -1;
    for (const [cat, p] of Object.entries(dist)) {
      if (!Number.isFinite(p)) continue;
      somma.set(cat, (somma.get(cat) || 0) + p * w);
      if (p > migliorP) { migliorP = p; miglior = cat; }
    }
    if (miglior) voti.push({ peerId, categoria: miglior, p: migliorP, peso: w });
  }

  if (!voti.length) return { probe, rispondenti: 0, disaccordo: 0, misurabile: false, motivo: 'nessuno ha risposto a questa sonda' };

  const media = {};
  for (const [cat, s] of somma) media[cat] = s / pesoTot;
  const probabilita = Object.values(media);
  const cat = Object.keys(media);

  // Entropia normalizzata: 0 = tutti certi della stessa cosa, 1 = massima
  // ignoranza distribuita su tutte le risposte possibili.
  let H = 0;
  for (const p of probabilita) if (p > 0) H -= p * Math.log(p);
  const incertezza = cat.length > 1 ? H / Math.log(cat.length) : 0;

  // Divisione: quota di chi NON vota la risposta più votata.
  const conteggi = new Map();
  for (const v of voti) conteggi.set(v.categoria, (conteggi.get(v.categoria) || 0) + v.peso);
  const favorita = [...conteggi.entries()].sort((a, b) => b[1] - a[1])[0];
  const divisione = 1 - favorita[1] / pesoTot;

  return {
    probe,
    rispondenti: voti.length,
    favorita: favorita[0],
    consenso: +(favorita[1] / pesoTot).toFixed(3),
    incertezza: +incertezza.toFixed(3),
    divisione: +divisione.toFixed(3),
    // La divisione pesa il doppio dell'incertezza: "sappiamo tutti di non
    // sapere" è meno urgente di "qualcuno ha ragione e non sappiamo chi".
    disaccordo: +Math.min(1, (2 * divisione + incertezza) / 3).toFixed(3),
    misurabile: true,
    distribuzioneMedia: media,
  };
}

// L'AGENDA: le sonde su cui la rete ha più da guadagnare, in ordine.
// `frequenzaLocale` (opzionale) è quanto quel tipo di caso capita DAVVERO qui:
// imparare benissimo qualcosa che non incontrerai mai è tempo di batteria
// buttato. Resta un numero locale — non entra in nessun messaggio.
export function learningAgenda(digests = [], {
  probes = null, pesi = null, frequenzaLocale = null, soglia = SOGLIA_DISACCORDO, limite = 5,
} = {}) {
  const test = independentWitnesses(digests);
  const elenco = probes || [...new Set(digests.flatMap((d) => Object.keys(d?.digest?.answers || {})))];

  const valutate = elenco
    .map((p) => probeDisagreement(p, digests, { pesi }))
    .filter((d) => d.misurabile)
    .map((d) => {
      const freq = frequenzaLocale?.[d.probe];
      // Senza frequenza nota si usa 1: non si penalizza ciò che non si sa,
      // altrimenti la rete imparerebbe solo ciò che già incontra spesso — e
      // resterebbe cieca esattamente dove è cieca adesso.
      const rilevanza = Number.isFinite(freq) ? Math.max(0.15, Math.min(1, freq)) : 1;
      return { ...d, rilevanza, valore: +(d.disaccordo * rilevanza).toFixed(3) };
    })
    .sort((a, b) => b.valore - a.valore);

  return {
    agenda: valutate.filter((d) => d.disaccordo >= soglia).slice(0, limite),
    giaConcordi: valutate.filter((d) => d.disaccordo < soglia).length,
    testimoni: test,
    // Con pochi testimoni indipendenti l'agenda esiste ma non è affidabile, e
    // va detto: agire su un disaccordo fra due copie dello stesso modello
    // significa inseguire un'illusione.
    affidabile: test.indipendenti >= MIN_TESTIMONI,
    motivo: test.indipendenti >= MIN_TESTIMONI
      ? null
      : `solo ${test.indipendenti} punti di vista davvero diversi su ${test.totali} dispositivi: troppo pochi per dire dove la rete è ignorante`,
  };
}

// ── A CHI SI CHIEDE LA RISPOSTA ──
// Nell'ordine che costa meno alla persona: la rete, poi le fonti, poi lei.
export function routeQuestion(analisi, {
  fattoPubblico = false, sogliaSicurezza = 0.7, tettoRaggiunto = false,
} = {}) {
  if (!analisi?.misurabile) return { a: 'nessuno', perche: 'non c\'è niente di misurato su cui chiedere' };

  // 1) La rete sa già. Non è una domanda: è una consegna mancata.
  if (analisi.consenso >= sogliaSicurezza && analisi.divisione > 0) {
    return {
      a: 'rete',
      perche: `${Math.round(analisi.consenso * 100)}% dei dispositivi risponde già la stessa cosa: la conoscenza esiste, deve solo arrivare qui`,
      atteso: analisi.favorita,
    };
  }
  // 2) È un fatto pubblico: si va dove è verificabile, con riscontro incrociato.
  if (fattoPubblico) {
    return {
      a: 'fonti',
      perche: 'è un dato pubblico: si prende da una fonte primaria e si incrocia con una seconda prima di usarlo per imparare',
    };
  }
  // 3) Solo la persona può saperlo — e solo se non l'abbiamo già disturbata troppo.
  if (tettoRaggiunto) {
    return { a: 'nessuno', perche: 'lo saprebbe solo l\'utente, ma ho già chiesto abbastanza per questa settimana: resta in agenda' };
  }
  return { a: 'utente', perche: 'nessun altro può saperlo: è una cosa sua' };
}

// Il tetto alle domande, contato davvero.
export function initAskBudget(now = Date.now(), tetto = DEFAULT_TETTO_DOMANDE) {
  return { ...tetto, da: now, fatte: 0 };
}
export function askBudgetStatus(budget, now = Date.now()) {
  const b = budget || initAskBudget(now);
  const scaduto = now - b.da >= b.periodoMs;
  const fatte = scaduto ? 0 : b.fatte;
  return { rimaste: Math.max(0, b.quante - fatte), esaurito: fatte >= b.quante, riparteIl: scaduto ? now : b.da + b.periodoMs };
}
export function spendAsk(budget, now = Date.now()) {
  const b = budget || initAskBudget(now);
  const scaduto = now - b.da >= b.periodoMs;
  if (scaduto) return { ...b, da: now, fatte: 1 };
  if (b.fatte >= b.quante) return b; // mai oltre il tetto, nemmeno per sbaglio
  return { ...b, fatte: b.fatte + 1 };
}

// IL PIANO COMPLETO, pronto da eseguire e da mostrare. Ogni voce dice cosa
// chiedere, a chi, e perché — un'app che va a cercare cose per conto suo deve
// poter spiegare ogni singola ricerca che fa.
export function curiosityPlan(digests = [], {
  probes = null, pesi = null, frequenzaLocale = null, fattiPubblici = null,
  budget = null, now = Date.now(), limite = 5,
} = {}) {
  const { agenda, testimoni, affidabile, motivo, giaConcordi } = learningAgenda(digests, { probes, pesi, frequenzaLocale, limite });
  const stato = askBudgetStatus(budget, now);
  let domandeRimaste = stato.rimaste;

  const azioni = agenda.map((d) => {
    const pubblico = !!fattiPubblici?.[d.probe];
    const r = routeQuestion(d, { fattoPubblico: pubblico, tettoRaggiunto: domandeRimaste <= 0 });
    if (r.a === 'utente') domandeRimaste--;
    return { probe: d.probe, valore: d.valore, disaccordo: d.disaccordo, consenso: d.consenso, ...r };
  });

  return {
    azioni,
    // Quante ne servono davvero all'utente: è il numero che dice se il disegno
    // sta funzionando. Se cresce, la rete ha smesso di essere utile.
    allUtente: azioni.filter((a) => a.a === 'utente').length,
    allaRete: azioni.filter((a) => a.a === 'rete').length,
    alleFonti: azioni.filter((a) => a.a === 'fonti').length,
    giaConcordi, testimoni, affidabile, motivo,
  };
}

// Come si racconta. Mai "entropia", mai "comitato": la persona deve capire che
// l'app sta studiando, non che sta facendo statistica.
export function curiosityText(piano) {
  if (!piano?.azioni?.length) return 'Per ora i dispositivi collegati sono d\'accordo su tutto: non c\'è niente da chiarire.';
  if (!piano.affidabile) return 'Ci sono ancora pochi punti di vista diversi: aspetto altri dispositivi prima di trarne conclusioni.';
  const pezzi = [];
  if (piano.allaRete) pezzi.push(`${piano.allaRete} ${piano.allaRete > 1 ? 'cose le sanno' : 'cosa la sa'} già un altro dispositivo`);
  if (piano.alleFonti) pezzi.push(`${piano.alleFonti} ${piano.alleFonti > 1 ? 'le controllo' : 'la controllo'} alla fonte`);
  if (piano.allUtente) pezzi.push(`su ${piano.allUtente} ${piano.allUtente > 1 ? 'avrei bisogno di te' : 'avrei bisogno di te'}`);
  return `Ho trovato ${piano.azioni.length} punti su cui i dispositivi non vanno d'accordo: ${pezzi.join(', ')}.`;
}
