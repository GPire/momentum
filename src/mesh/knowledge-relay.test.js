'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  packForRelay, initKnowledgeStore, receiveRelayed, bestKnown, pruneKnowledge,
  MAX_PUNTI_RELAY, ETA_MASSIMA_RELAY_MS,
} from './knowledge-relay.js';
import { appendUpdate } from './update-ledger.js';

const NOW = Date.parse('2026-08-07T12:00:00Z');
// Forma reale usata da sources.js: { date, close } — non "value".
const serie = (base, n, jitter = 0) => Array.from({ length: n }, (_, i) => ({
  date: new Date(NOW - (n - i) * 86400000).toISOString().slice(0, 10),
  close: base + i * 0.1 + jitter,
}));

// ── Impacchettamento: mai far viaggiare ciò che l'origine ha già escluso ──

test('un risultato "confirmed" si impacchetta', () => {
  const r = { verified: 'confirmed', prices: serie(100, 20), source: 'fred+ecb', asOf: new Date(NOW).toISOString() };
  const p = packForRelay(r, { symbol: 'EURUSD', kind: 'macro', now: NOW });
  assert.ok(p);
  assert.equal(p.verified, 'confirmed');
});

test('un risultato "unconfirmed" o "fallback" NON si impacchetta mai', () => {
  for (const verified of ['unconfirmed', 'fallback']) {
    const r = { verified, prices: serie(100, 10), source: 'x', asOf: new Date(NOW).toISOString() };
    assert.equal(packForRelay(r, { symbol: 'BTC', kind: 'prices', now: NOW }), null,
      `un dato "${verified}" propagato perderebbe la sua stessa etichetta di esclusione`);
  }
});

test('un risultato troppo vecchio non si propaga: non aiuterebbe nessuno', () => {
  const vecchio = new Date(NOW - ETA_MASSIMA_RELAY_MS - 86400000).toISOString();
  const r = { verified: 'confirmed', prices: serie(100, 10), source: 'x', asOf: vecchio };
  assert.equal(packForRelay(r, { symbol: 'BTC', kind: 'prices', now: NOW }), null);
});

test('il pacchetto resta piccolo anche con una serie enorme', () => {
  const r = { verified: 'single-source', prices: serie(100, 5000), source: 'x', asOf: new Date(NOW).toISOString() };
  const p = packForRelay(r, { symbol: 'SPY', kind: 'prices', now: NOW });
  assert.ok(p.prices.length <= MAX_PUNTI_RELAY);
});

// ── Ricezione: il cancello locale, non la parola del mittente ──

test('un pacchetto malformato viene rifiutato senza eccezioni', () => {
  const s = initKnowledgeStore();
  for (const bad of [null, {}, { v: 2 }, { v: 1, symbol: 'X' }, { v: 1, symbol: 'X', kind: 'prices', prices: [] }]) {
    const r = receiveRelayed(s, bad, 'peerA', { now: NOW });
    assert.equal(r.accepted, false);
  }
});

test('IL PUNTO: un dato IMPLAUSIBILE non entra, anche se il mittente dichiara "confirmed"', () => {
  const s = initKnowledgeStore();
  const msg = {
    v: 1, symbol: 'BTC', kind: 'prices', verified: 'confirmed', source: 'peer-bugiardo',
    asOf: new Date(NOW).toISOString(),
    prices: serie(100, 10).map((p, i) => (i === 5 ? { ...p, close: -999999 } : p)), // salto assurdo
  };
  const r = receiveRelayed(s, msg, 'malevolo', { now: NOW });
  assert.equal(r.accepted, false, 'la plausibilità locale deve bocciarlo, l\'etichetta del mittente non basta');
  assert.equal(bestKnown(s, 'BTC', 'prices'), null);
});

test('UN SOLO PEER a bassa reputazione non basta, ANCHE SE dichiara "confirmed"', () => {
  const s = initKnowledgeStore();
  // Storia di scarti: reputazione sotto soglia. appendUpdate e' immutabile
  // (ritorna un nuovo array, stessa convenzione di tutto il progetto): va
  // riassegnato ad ogni chiamata, non richiamato a vuoto.
  let ledger = [];
  for (let i = 0; i < 5; i++) ledger = appendUpdate(ledger, { peerId: 'peerBasso', accepted: false });
  const msg = { v: 1, symbol: 'ORO', kind: 'macro', verified: 'confirmed', source: 'x', asOf: new Date(NOW).toISOString(), prices: serie(2000, 10) };
  const r = receiveRelayed(s, msg, 'peerBasso', { now: NOW, ledger });
  assert.equal(r.accepted, true, 'il dato passa comunque la plausibilita\' locale...');
  assert.equal(r.affidabile, false, '...ma non diventa affidabile da un solo peer con storia scarsa');
});

test('UN SOLO PEER con BUONA reputazione e "confirmed" dichiarato basta da solo', () => {
  const s = initKnowledgeStore();
  let ledger = [];
  for (let i = 0; i < 5; i++) ledger = appendUpdate(ledger, { peerId: 'peerBuono', accepted: true });
  const msg = { v: 1, symbol: 'ORO', kind: 'macro', verified: 'confirmed', source: 'x', asOf: new Date(NOW).toISOString(), prices: serie(2000, 10) };
  const r = receiveRelayed(s, msg, 'peerBuono', { now: NOW, ledger });
  assert.equal(r.affidabile, true);
});

test('il ledger ritornato e\' quello NUOVO (immutabile), pronto da riassegnare', () => {
  const s = initKnowledgeStore();
  const msg = { v: 1, symbol: 'ORO', kind: 'macro', verified: 'confirmed', source: 'x', asOf: new Date(NOW).toISOString(), prices: serie(2000, 10) };
  const r = receiveRelayed(s, msg, 'peerX', { now: NOW, ledger: [] });
  assert.equal(r.ledger.length, 1, 'senza riassegnare r.ledger la voce andrebbe persa, come in un array.push scambiato per immutabile');
});

test('senza ledger si è PRUDENTI di default (nessuna reputazione nota)', () => {
  const s = initKnowledgeStore();
  const msg = { v: 1, symbol: 'ORO', kind: 'macro', verified: 'confirmed', source: 'x', asOf: new Date(NOW).toISOString(), prices: serie(2000, 10) };
  const r = receiveRelayed(s, msg, 'chissachi', { now: NOW }); // niente ledger
  assert.equal(r.affidabile, true, 'reputazione neutra di default basta per un "confirmed" dichiarato');
});

test('DUE PEER INDIPENDENTI che concordano rendono il dato affidabile anche senza reputazione', () => {
  const s = initKnowledgeStore();
  const a = { v: 1, symbol: 'SPY', kind: 'prices', verified: 'single-source', source: 'x', asOf: new Date(NOW).toISOString(), prices: serie(400, 15) };
  const b = { v: 1, symbol: 'SPY', kind: 'prices', verified: 'single-source', source: 'y', asOf: new Date(NOW).toISOString(), prices: serie(400, 15, 0.01) };
  receiveRelayed(s, a, 'peer1', { now: NOW });
  const r2 = receiveRelayed(s, b, 'peer2', { now: NOW });
  assert.equal(r2.corroborato, true);
  assert.equal(r2.affidabile, true);
  assert.equal(bestKnown(s, 'SPY', 'prices').corroboratedBy.length, 2);
});

test('ATTACCO DI COLLUSIONE: due identità DELLO STESSO peer non contano due volte', () => {
  const s = initKnowledgeStore();
  const a = { v: 1, symbol: 'SPY', kind: 'prices', verified: 'single-source', source: 'x', asOf: new Date(NOW).toISOString(), prices: serie(400, 15) };
  receiveRelayed(s, a, 'sockpuppet', { now: NOW });
  const r2 = receiveRelayed(s, { ...a }, 'sockpuppet', { now: NOW }); // stesso id, rimanda lo stesso dato
  assert.equal(bestKnown(s, 'SPY', 'prices').corroboratedBy.length, 1,
    'lo stesso peer non puo\' corroborare se stesso mandando di nuovo lo stesso pacchetto');
});

test('DUE PEER che NON concordano non si corroborano a vicenda', () => {
  const s = initKnowledgeStore();
  const a = { v: 1, symbol: 'SPY', kind: 'prices', verified: 'single-source', source: 'x', asOf: new Date(NOW).toISOString(), prices: serie(400, 15) };
  const b = { v: 1, symbol: 'SPY', kind: 'prices', verified: 'single-source', source: 'y', asOf: new Date(NOW).toISOString(), prices: serie(4000, 15) }; // ordine di grandezza diverso
  receiveRelayed(s, a, 'peer1', { now: NOW });
  const r2 = receiveRelayed(s, b, 'peer2', { now: NOW });
  assert.equal(r2.corroborato, false);
  assert.equal(r2.affidabile, false, 'due dati in disaccordo non possono confermarsi a vicenda');
});

test('un dato migliore (piu\' fresco/piu\' lungo) sostituisce quello vecchio', () => {
  const s = initKnowledgeStore();
  const corto = { v: 1, symbol: 'BTC', kind: 'prices', verified: 'single-source', source: 'x', asOf: new Date(NOW - 86400000).toISOString(), prices: serie(50000, 5) };
  const lungo = { v: 1, symbol: 'BTC', kind: 'prices', verified: 'single-source', source: 'y', asOf: new Date(NOW).toISOString(), prices: serie(50000, 30) };
  receiveRelayed(s, corto, 'peer1', { now: NOW });
  receiveRelayed(s, lungo, 'peer2', { now: NOW });
  assert.equal(bestKnown(s, 'BTC', 'prices').prices.length, 30);
});

test('un dato peggiore non scalza uno gia\' migliore', () => {
  const s = initKnowledgeStore();
  const lungo = { v: 1, symbol: 'BTC', kind: 'prices', verified: 'single-source', source: 'y', asOf: new Date(NOW).toISOString(), prices: serie(50000, 30) };
  const corto = { v: 1, symbol: 'BTC', kind: 'prices', verified: 'single-source', source: 'x', asOf: new Date(NOW - 86400000).toISOString(), prices: serie(50000, 5) };
  receiveRelayed(s, lungo, 'peer1', { now: NOW });
  receiveRelayed(s, corto, 'peer2', { now: NOW });
  assert.equal(bestKnown(s, 'BTC', 'prices').prices.length, 30);
});

test('bestKnown non esiste per una chiave mai vista: null, non un oggetto vuoto', () => {
  assert.equal(bestKnown(initKnowledgeStore(), 'NIENTE', 'prices'), null);
});

test('la nota di provenienza distingue "confermato da N" da "non ancora confermato"', () => {
  const s = initKnowledgeStore();
  const msg = { v: 1, symbol: 'BTC', kind: 'prices', verified: 'single-source', source: 'x', asOf: new Date(NOW).toISOString(), prices: serie(50000, 10) };
  receiveRelayed(s, msg, 'peerSolo', { now: NOW }); // reputazione neutra + single-source dichiarato: non basta da solo
  const nota = bestKnown(s, 'BTC', 'prices').nota;
  assert.match(nota, /non ancora confermato/);
});

test('POTATURA: le voci troppo vecchie spariscono, quelle fresche restano', () => {
  const s = initKnowledgeStore();
  s['prices:VECCHIO'] = { symbol: 'VECCHIO', kind: 'prices', prices: [{}], asOf: new Date(NOW - ETA_MASSIMA_RELAY_MS * 2).toISOString(), corroboratedBy: ['x'] };
  s['prices:FRESCO'] = { symbol: 'FRESCO', kind: 'prices', prices: [{}], asOf: new Date(NOW).toISOString(), corroboratedBy: ['x'] };
  pruneKnowledge(s, { now: NOW });
  assert.equal(bestKnown(s, 'VECCHIO', 'prices'), null);
  assert.ok(bestKnown(s, 'FRESCO', 'prices'));
});
