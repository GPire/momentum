// ============================================================
// LA PROVA DEL BAMBINO DI OTTO ANNI — come test automatico
// ============================================================
// Perché esiste. In questa sessione lo stesso errore di scrittura è
// ricomparso 3+ volte in file diversi, sempre lo stesso: una preposizione
// concatenata al suo articolo invece di fondersi con lui — "In il 2008",
// "Su gli ultimi 26 anni", "da le azioni americane". Ogni volta corretto a
// mano, ogni volta ricapitato altrove: un correttore umano che rilegge non
// scala su centinaia di stringhe sparse nel codice. Questo file rende quel
// controllo un test, non una buona intenzione.
//
// COSA CONTROLLA E COSA NO, deliberatamente:
// - La concatenazione preposizione+articolo: SEMPRE sbagliata in italiano,
//   in QUALUNQUE dominio — una frase tecnica su un IBAN ha lo stesso obbligo
//   grammaticale di una frase sulla dashboard. Zero falsi positivi possibili:
//   non è un giudizio di stile, è una regola grammaticale.
// - "per"/"tra"/"fra"/"con" NON sono nella lista: in italiano NON è
//   obbligatorio fonderli con l'articolo ("per il", "tra la" sono corretti;
//   "col"/"coi" sono contrazioni facoltative, non richieste). Includerli
//   avrebbe prodotto falsi allarmi su frasi corrette.
// - La lunghezza delle frasi è ESPOSTA come misura (lunghezzaFrasi), non
//   imposta come soglia pass/fail: un disclaimer fiscale svizzero ha bisogno
//   di essere preciso anche se lungo, e forzarlo a essere breve lo
//   renderebbe impreciso, non più semplice. Chi usa questo modulo decide la
//   soglia adatta al SUO testo, non il modulo per lui.
// - Nessuna lista di "parole gergali vietate": un modulo che rifiuta "IBAN"
//   in un modulo per l'IBAN sarebbe più preoccupato di sembrare semplice che
//   di esserlo davvero.
'use strict';

// Le uniche preposizioni la cui fusione con l'articolo è OBBLIGATORIA in
// italiano standard (in→nel, su→sul, da→dal, di→del, a→al...). "per/tra/
// fra/con" restano fuori apposta: vedi il commento sopra.
// "l'" (l'automobile) resta fuori apposta: nella forma scorretta non c'è
// uno spazio da cercare ("in l'automobile" non è un errore che ricorre —
// chi sbaglia scrive "nell'automobile" attaccato comunque). La regola vale
// per gli articoli che restano parole separate.
const PREPOSIZIONI_DA_FONDERE = ['in', 'su', 'da', 'di', 'a'];
const ARTICOLI = ['il', 'lo', 'la', 'i', 'gli', 'le'];

const RE_PREPOSIZIONE_ARTICOLATA = new RegExp(
  `\\b(${PREPOSIZIONI_DA_FONDERE.join('|')})\\s+(${ARTICOLI.join('|')})\\b`,
  'gi'
);

// Ritorna ogni occorrenza trovata (stringa vuota se il testo è pulito) —
// non un semplice booleano, così un test fallito dice ESATTAMENTE cosa
// correggere invece di costringere a ricercarlo a mano nella stringa.
export function preposizioniArticolateConcatenate(testo) {
  const t = String(testo ?? '');
  const trovate = [];
  let m;
  RE_PREPOSIZIONE_ARTICOLATA.lastIndex = 0;
  while ((m = RE_PREPOSIZIONE_ARTICOLATA.exec(t))) trovate.push(m[0]);
  return trovate;
}

// Misura, non giudizio: lunghezza in caratteri di ogni frase (split su
// . ! ? seguiti da spazio o fine stringa). Chi chiama decide la soglia.
export function lunghezzaFrasi(testo) {
  const t = String(testo ?? '').trim();
  if (!t) return [];
  return t.split(/(?<=[.!?])\s+/).map(f => f.trim()).filter(Boolean).map(f => f.length);
}

// Percorre un dizionario { chiave: stringa | funzione(...args)->stringa } e
// applica `controllo` a ogni valore stringa risolvibile. Le funzioni-modello
// (es. chResultTitle: (v) => `Con CHF ${v}/anno`) si testano chiamandole con
// placeholder innocui, non saltandole: sono le stesse frasi che l'utente
// legge, solo con un numero al posto della cifra vera.
export function perOgniStringa(dizionario, controllo) {
  const problemi = [];
  for (const [chiave, valore] of Object.entries(dizionario)) {
    const testo = typeof valore === 'function' ? valore('X', 'X') : valore;
    if (typeof testo !== 'string') continue;
    const esito = controllo(testo);
    if (esito && esito.length) problemi.push({ chiave, testo, esito });
  }
  return problemi;
}
