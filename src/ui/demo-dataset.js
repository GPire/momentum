// ============================================================
// DATASET DIMOSTRATIVO — l'app piena PRIMA di inserire qualcosa
// ============================================================
// Il punto di abbandono più alto di qualunque app di finanza è il primo
// schermo: si apre, è vuoto, sembra un lavoro da fare invece di uno
// strumento che aiuta. Nessuna app del settore ti fa VEDERE com'è quando
// è piena prima di chiederti i tuoi dati.
//
// IL SALTO (piano T8): il demo non sparisce con un interruttore — si
// DISSOLVE progressivamente man mano che entrano i tuoi dati veri, così
// non esiste mai un momento di schermo vuoto. Ogni transazione vera che
// aggiungi ne spegne alcune finte, finché resta solo la tua vita.
//
// SICUREZZA NON NEGOZIABILE (architetturale, non "ricordarsi di
// filtrare"): queste transazioni NON vivono mai in VaultDAO.state.transactions.
// Stanno in una chiave separata (state.demoTransactions) e vengono unite
// SOLO al momento di disegnare. Il motore fiscale, l'addestramento
// dell'AI e la previsione di cassa leggono state.transactions e quindi
// non possono vederle nemmeno per errore: è impossibile per costruzione,
// non per disciplina. Ogni voce porta comunque `demo: true`, così anche
// un eventuale passaggio futuro resta riconoscibile a colpo d'occhio.
'use strict';

// Quante transazioni vere servono perché il demo sia completamente
// dissolto. 12 è la soglia in cui la Dashboard ha già abbastanza materia
// propria per essere utile da sola (circa due settimane di uso reale).
export const DEMO_FADE_AT = 12;

// Generatore deterministico (LCG): lo stesso "mese di esempio" ad ogni
// avvio, così i test sono stabili e l'utente non vede numeri che ballano
// ad ogni ricarica.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Ritmi veri di una vita normale, non numeri a caso: lo stipendio il 27,
// l'affitto il 1°, la spesa grossa il sabato, il caffè la mattina nei
// giorni feriali. È ciò che rende il demo riconoscibile invece che finto.
const PROFILO = {
  stipendio: { desc: 'Stipendio', cat: 'Entrate', amount: 1850, giorno: 27, type: 'entrata' },
  ricorrenti: [
    { desc: 'Affitto', cat: 'Casa', amount: 650, giorno: 1 },
    { desc: 'Netflix', cat: 'Svago', amount: 12.99, giorno: 8 },
    { desc: 'Spotify', cat: 'Svago', amount: 10.99, giorno: 14 },
    { desc: 'Palestra', cat: 'Salute', amount: 45, giorno: 5 },
    { desc: 'Bolletta luce', cat: 'Casa', amount: 68.4, giorno: 18 },
  ],
  // [descrizione, categoria, minimo, massimo]
  spesaSettimanale: ['Esselunga', 'Spesa', 52, 81],
  caffe: ['Bar', 'Bar e caffè', 1.2, 2.6],
  carburante: ['Benzina', 'Trasporti', 48, 62],
  extra: [
    ['Ristorante', 'Ristoranti', 28, 54],
    ['Farmacia', 'Salute', 9, 24],
    ['Amazon', 'Shopping', 15, 47],
    ['Panetteria', 'Spesa', 3.5, 8],
  ],
};

const iso = (d) => d.toISOString().slice(0, 10);
const mese = (d) => d.toISOString().slice(0, 7);

// Genera ~6 settimane di vita finanziaria plausibile, ordinata nel tempo.
// `now` iniettabile: i test non dipendono dall'orologio.
// QUATTORDICI settimane e non sei. Sei bastavano a far vedere "com'e' l'app
// piena", ma contengono UNA SOLA busta paga — e con una sola non si puo'
// dedurre nessuno schema. La striscia del mese, che mostra quando arrivano i
// soldi, restava muta proprio per l'utente nuovo: cioe' l'unico che il demo
// serve a convincere. Tre mesi e mezzo danno tre stipendi, che e' il minimo
// per dire "il tuo stipendio arriva il 27" senza indovinare.
// La scelta giusta era allungare il demo, non abbassare la soglia: la soglia
// protegge dal vedere schemi dove non ci sono, e piegarla per far funzionare
// una demo sarebbe stato barare con l'utente vero.
export function generateDemoTransactions({ now = new Date(), weeks = 14, seed = 20260806 } = {}) {
  const rnd = lcg(seed);
  const pick = (min, max) => +(min + rnd() * (max - min)).toFixed(2);
  const out = [];
  const fine = new Date(now);
  const inizio = new Date(now);
  inizio.setDate(inizio.getDate() - weeks * 7);

  const add = (date, description, category, amount, type = 'uscita') => {
    out.push({
      id: `demo-${out.length}`,
      demo: true, // riconoscibile ovunque, anche fuori da qui
      date: iso(date),
      description, category,
      amount: +amount.toFixed(2),
      type,
    });
  };

  for (const d = new Date(inizio); d <= fine; d.setDate(d.getDate() + 1)) {
    const giorno = d.getDate();
    const settimana = d.getDay(); // 0 domenica, 6 sabato

    if (giorno === PROFILO.stipendio.giorno) {
      add(d, PROFILO.stipendio.desc, PROFILO.stipendio.cat, PROFILO.stipendio.amount, 'entrata');
    }
    for (const r of PROFILO.ricorrenti) {
      if (giorno === r.giorno) add(d, r.desc, r.cat, r.amount);
    }
    // Caffè: giorni feriali, quasi sempre ma non sempre (la vita vera ha buchi)
    if (settimana >= 1 && settimana <= 5 && rnd() > 0.25) {
      const [desc, cat, min, max] = PROFILO.caffe;
      add(d, desc, cat, pick(min, max));
    }
    // Spesa grossa il sabato
    if (settimana === 6) {
      const [desc, cat, min, max] = PROFILO.spesaSettimanale;
      add(d, desc, cat, pick(min, max));
    }
    // Carburante ogni ~10 giorni
    if (giorno % 10 === 3) {
      const [desc, cat, min, max] = PROFILO.carburante;
      add(d, desc, cat, pick(min, max));
    }
    // Una spesa extra ogni tanto, variata
    if (rnd() > 0.72) {
      const [desc, cat, min, max] = PROFILO.extra[Math.floor(rnd() * PROFILO.extra.length)];
      add(d, desc, cat, pick(min, max));
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// LA DISSOLVENZA: quante voci finte restano visibili, dato quante vere
// ne sono entrate. Lineare e prevedibile — a 0 transazioni vere il demo è
// intero, a DEMO_FADE_AT è sparito del tutto, in mezzo scala dolcemente.
// Mai un salto: è esattamente il punto del piano ("nessun momento di
// schermo vuoto").
export function demoKeepCount(realCount, total, fadeAt = DEMO_FADE_AT) {
  const reali = Math.max(0, +realCount || 0);
  const tot = Math.max(0, +total || 0);
  if (reali >= fadeAt) return 0;
  const quota = 1 - reali / fadeAt;
  return Math.round(tot * quota);
}

// Quali voci tenere: si spengono prima le PIÙ VECCHIE, così ciò che resta
// visibile è sempre il periodo più vicino a oggi — dove l'utente guarda.
export function fadeDemo(demoTx, realCount, fadeAt = DEMO_FADE_AT) {
  const tutte = demoTx || [];
  const quante = demoKeepCount(realCount, tutte.length, fadeAt);
  if (quante <= 0) return [];
  return tutte.slice(tutte.length - quante);
}

// Unisce, SOLO PER DISEGNARE, le voci finte superstiti alla mappa reale
// { 'YYYY-MM': [tx] }. Non muta l'originale: ritorna una copia, così non
// esiste il rischio che una scrittura successiva persista il demo.
export function mergeDemoForDisplay(realByMonth = {}, demoTx = [], realCount = null) {
  const conteggioReale = realCount != null
    ? realCount
    : Object.values(realByMonth).reduce((n, arr) => n + (arr?.length || 0), 0);
  const vive = fadeDemo(demoTx, conteggioReale);
  if (!vive.length) return realByMonth;

  const fuse = {};
  for (const [k, arr] of Object.entries(realByMonth)) fuse[k] = [...(arr || [])];
  for (const tx of vive) {
    const k = mese(new Date(tx.date));
    (fuse[k] = fuse[k] || []).push(tx);
  }
  for (const k of Object.keys(fuse)) fuse[k].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return fuse;
}

// Stato leggibile per la UI: serve a mostrare un avviso ONESTO e sempre
// visibile ("questi sono dati di esempio") e quanto manca alla sparizione.
export function demoStatus(demoTx = [], realCount = 0, fadeAt = DEMO_FADE_AT) {
  const tot = (demoTx || []).length;
  const vive = demoKeepCount(realCount, tot, fadeAt);
  const attivo = vive > 0;
  return {
    attivo,
    visibili: vive,
    totali: tot,
    realiMancanti: Math.max(0, fadeAt - realCount),
    messaggio: attivo
      ? `Stai guardando un esempio, non i tuoi soldi. Sparisce da solo man mano che aggiungi le tue spese: ne mancano ${Math.max(0, fadeAt - realCount)}.`
      : null,
  };
}
