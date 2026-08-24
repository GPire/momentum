// ============================================================
// STAFFETTA DEL SENTIMENT — un titolo già classificato, condiviso via mesh
// ============================================================
// Richiesto esplicitamente ("le informazioni ottenute da chi ha una chiave
// API o ha scaricato un modello devono passare anche agli altri
// dispositivi, per potenziare il loro Momentum"): oggi (src/ai/local-
// sentiment.js) un dispositivo senza il modello scaricato (~82MB, opt-in —
// vedi src/core/con-timeout.js per quanto può essere lento o bloccarsi su
// certe reti) o senza WASM SIMD resta con `sentimentScore:null` per
// SEMPRE su ogni notizia. Ma un TITOLO di notizia è testo PUBBLICO — la
// stessa notizia arriva a chiunque legga le stesse fonti (Hacker News,
// Federal Register, Fed/BCE) — e il suo punteggio di sentiment, una volta
// calcolato da un peer, è un fatto sul TESTO, non sull'utente che l'ha
// calcolato. Stesso principio già scritto in knowledge-relay.js per prezzi
// e tassi ("dati pubblici per natura"), qui applicato a un tipo di dato
// diverso (un titolo di notizia + un punteggio, non una serie numerica) —
// NON si riusa knowledge-relay.js perché la sua plausibilità/cross-check è
// costruita per serie di PREZZI (richiede un array `prices`, controlla che
// siano positivi, ecc.): forzarci un punteggio scalare di sentiment
// sarebbe stato piegare una forma per un dato che non è quello per cui è
// stata pensata. Stessa DISCIPLINA (mai fidarsi dell'etichetta del
// mittente, cross-check locale, reputazione), struttura dedicata.
//
// ONESTÀ SUI LIMITI: un peer con un modello diverso (o una versione futura)
// può disaccordare legittimamente di poco — l'accordo qui si misura per
// ETICHETTA (bullish/bearish/ecc, src/alpha/news.js:labelFor), non per
// uguaglianza esatta del punteggio: due modelli concordi sul VERSO del
// sentiment bastano a corroborarsi, anche con punteggi leggermente diversi.
'use strict';

import { labelFor } from '../alpha/news.js';
import { peerReputation, appendUpdate } from './update-ledger.js';

export const REPUTAZIONE_MINIMA_FIDATA = 0.5; // stessa soglia di knowledge-relay.js, stesso significato
export const ETA_MASSIMA_RELAY_MS = 30 * 24 * 3600 * 1000; // 30 giorni: oltre, la notizia non e' piu' quella che qualcuno sta chiedendo
const MAX_TESTO_CARATTERI = 300; // un titolo di notizia, non un articolo — il payload resta piccolo di proposito

// Stessa normalizzazione di trim+lowercase usata per la cache in local-
// sentiment.js: la CHIAVE di relay deve combaciare con quella con cui il
// resto del progetto già identifica "lo stesso testo".
function chiaveTesto(testo) {
  return String(testo || '').trim().toLowerCase().slice(0, MAX_TESTO_CARATTERI);
}

export function initSentimentRelayStore() { return {}; }

// Prepara un pacchetto da mandare in giro. `null` se il risultato non è
// eleggibile (punteggio non finito, testo vuoto) — mai un pacchetto vuoto
// spedito solo per riempire un ciclo.
export function packSentimentForRelay(risultato, { testo, now = Date.now() } = {}) {
  const chiave = chiaveTesto(testo);
  if (!chiave || !risultato || !Number.isFinite(risultato.score)) return null;
  return {
    v: 1, testo: chiave, score: +risultato.score.toFixed(3),
    label: risultato.label || labelFor(risultato.score),
    modello: risultato.modello || 'sconosciuto', asOf: new Date(now).toISOString(),
  };
}

// Riceve un pacchetto da UN peer. Pura: nessuna rete, nessun DOM — stesso
// motivo di knowledge-relay.js (fuzzabile senza un browser).
export function receiveSentimentRelayed(store, msg, fromPeerId, { now = Date.now(), ledger = null } = {}) {
  if (!msg || msg.v !== 1 || !msg.testo || !fromPeerId) {
    return { accepted: false, reason: 'pacchetto malformato', ledger };
  }
  if (!Number.isFinite(msg.score) || msg.score < -1 || msg.score > 1) {
    return { accepted: false, reason: 'punteggio fuori dall\'intervallo -1..1', ledger };
  }
  const eta = now - new Date(msg.asOf || 0).getTime();
  if (!Number.isFinite(eta) || eta < -60_000 || eta > ETA_MASSIMA_RELAY_MS) {
    return { accepted: false, reason: 'data non plausibile (nel futuro o troppo vecchia)', ledger };
  }

  const chiave = chiaveTesto(msg.testo);
  const esistente = store[chiave];
  const etichettaMsg = msg.label || labelFor(msg.score);

  // IL CANCELLO CHE CONTA: due peer concordano se dicono la STESSA cosa sul
  // VERSO del sentiment (bullish/bearish/ecc), non se il numero è identico
  // — modelli diversi calibrano diversamente, ma "positivo" contro
  // "negativo" sulla stessa notizia è un disaccordo vero, non rumore.
  let concorda = true;
  if (esistente) concorda = esistente.label === etichettaMsg;

  if (esistente && !concorda) {
    const nl = ledger ? appendUpdate(ledger, { peerId: fromPeerId, accepted: true, reason: 'sentiment in disaccordo con quanto gia\' noto, non fuso' }) : ledger;
    return { accepted: true, corroborato: false, affidabile: !!esistente.affidabile, testimoni: esistente.corroboratedBy?.length || 0, ledger: nl };
  }

  const corroboratori = new Set(esistente?.corroboratedBy || []);
  const eraGiaCorroboratoDaMe = corroboratori.has(fromPeerId);
  corroboratori.add(fromPeerId);
  const corroboratoOra = !!esistente && !eraGiaCorroboratoDaMe;

  const reputazione = ledger ? peerReputation(ledger, fromPeerId).score : REPUTAZIONE_MINIMA_FIDATA;
  const mittenteBastaDaSolo = reputazione >= REPUTAZIONE_MINIMA_FIDATA;
  const affidabile = corroboratori.size >= 2 || mittenteBastaDaSolo;

  const megliore = !esistente || new Date(msg.asOf) > new Date(esistente.asOf || 0);
  store[chiave] = megliore
    ? { testo: chiave, score: msg.score, label: etichettaMsg, modello: msg.modello, asOf: msg.asOf, corroboratedBy: [...corroboratori], affidabile }
    : { ...esistente, corroboratedBy: [...corroboratori], affidabile };

  const nuovoLedger = ledger ? appendUpdate(ledger, { peerId: fromPeerId, accepted: true }) : ledger;
  return { accepted: true, corroborato: corroboratoOra, affidabile, testimoni: corroboratori.size, ledger: nuovoLedger };
}

// Il meglio che si conosce per un testo — `null` se non c'è nulla (mai un
// punteggio inventato). Chi chiama sa sempre `affidabile` (corroborato da
// almeno 2 peer indipendenti, o da un solo peer con reputazione buona) per
// decidere se fidarsene quanto di un calcolo locale o mostrarlo con cautela.
export function bestKnownSentiment(store, testo) {
  const voce = store[chiaveTesto(testo)];
  return voce ? { ...voce } : null;
}

export function pruneSentimentRelay(store, { now = Date.now(), maxAgeMs = ETA_MASSIMA_RELAY_MS } = {}) {
  const out = {};
  for (const [k, v] of Object.entries(store)) {
    const eta = now - new Date(v.asOf || 0).getTime();
    if (Number.isFinite(eta) && eta <= maxAgeMs) out[k] = v;
  }
  return out;
}
