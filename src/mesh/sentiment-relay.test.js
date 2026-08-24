'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  packSentimentForRelay, initSentimentRelayStore, receiveSentimentRelayed, bestKnownSentiment, pruneSentimentRelay,
  REPUTAZIONE_MINIMA_FIDATA, ETA_MASSIMA_RELAY_MS,
} from './sentiment-relay.js';
import { appendUpdate } from './update-ledger.js';

const NOW = Date.parse('2026-08-24T12:00:00Z');
const oraISO = new Date(NOW).toISOString();

// ── Impacchettamento ──

test('un risultato con punteggio finito si impacchetta, testo normalizzato come chiave', () => {
  const p = packSentimentForRelay({ score: 0.6, label: 'bullish', modello: 'Xenova/distilroberta' }, { testo: '  Company Reports Record Profits  ', now: NOW });
  assert.ok(p);
  assert.equal(p.testo, 'company reports record profits');
  assert.equal(p.score, 0.6);
  assert.equal(p.label, 'bullish');
});

test('senza testo o senza punteggio finito, non si impacchetta nulla', () => {
  assert.equal(packSentimentForRelay({ score: 0.5 }, { testo: '', now: NOW }), null);
  assert.equal(packSentimentForRelay({ score: NaN }, { testo: 'un titolo', now: NOW }), null);
  assert.equal(packSentimentForRelay(null, { testo: 'un titolo', now: NOW }), null);
});

test('se manca label, la calcola da sola con labelFor (stessa scala del resto del progetto)', () => {
  const p = packSentimentForRelay({ score: -0.5, modello: 'x' }, { testo: 'titolo negativo', now: NOW });
  assert.equal(p.label, 'bearish');
});

// ── Ricezione: il cancello locale ──

test('un pacchetto malformato viene rifiutato senza eccezioni', () => {
  const s = initSentimentRelayStore();
  for (const bad of [null, {}, { v: 2 }, { v: 1, testo: '' }, { v: 1, testo: 'x', score: 5 }, { v: 1, testo: 'x', score: 'not-a-number' }]) {
    const r = receiveSentimentRelayed(s, bad, 'peer1', { now: NOW });
    assert.equal(r.accepted, false, JSON.stringify(bad));
  }
});

test('un punteggio troppo vecchio (oltre 30 giorni) non viene accettato', () => {
  const s = initSentimentRelayStore();
  const vecchio = new Date(NOW - ETA_MASSIMA_RELAY_MS - 86400000).toISOString();
  const msg = { v: 1, testo: 'notizia vecchia', score: 0.5, label: 'bullish', asOf: vecchio };
  const r = receiveSentimentRelayed(s, msg, 'peer1', { now: NOW });
  assert.equal(r.accepted, false);
});

test('un punteggio datato nel futuro (oltre lo scarto d\'orologio) non viene accettato', () => {
  const s = initSentimentRelayStore();
  const futuro = new Date(NOW + 3600_000).toISOString();
  const msg = { v: 1, testo: 'notizia dal futuro', score: 0.5, label: 'bullish', asOf: futuro };
  const r = receiveSentimentRelayed(s, msg, 'peer1', { now: NOW });
  assert.equal(r.accepted, false);
});

test('il primo peer viene accettato ma affidabile SOLO se la sua reputazione basta da sola', () => {
  const s = initSentimentRelayStore();
  const msg = { v: 1, testo: 'prima notizia', score: 0.4, label: 'bullish', asOf: oraISO };
  // Senza ledger: si assume la soglia minima di default, quindi affidabile da solo.
  const r1 = receiveSentimentRelayed(s, msg, 'peer1', { now: NOW });
  assert.equal(r1.accepted, true);
  assert.equal(r1.testimoni, 1);
  assert.equal(r1.affidabile, true);
});

test('un peer con reputazione bassa NON basta da solo — serve un secondo peer indipendente', () => {
  const s = initSentimentRelayStore();
  let ledger = [];
  // Reputazione scarsa: tante correzioni rifiutate per lo stesso peer.
  for (let i = 0; i < 5; i++) ledger = appendUpdate(ledger, { peerId: 'peerScarso', accepted: false, reason: 'test' }, NOW);
  const msg = { v: 1, testo: 'notizia dubbia', score: 0.4, label: 'bullish', asOf: oraISO };
  const r1 = receiveSentimentRelayed(s, msg, 'peerScarso', { now: NOW, ledger });
  assert.equal(r1.affidabile, false, 'un solo peer con storia scarsa non deve bastare da solo');
  const r2 = receiveSentimentRelayed(s, { ...msg }, 'peerIndipendente', { now: NOW, ledger: r1.ledger });
  assert.equal(r2.testimoni, 2);
  assert.equal(r2.affidabile, true, 'due testimoni indipendenti bastano anche con reputazione bassa del primo');
});

test('due peer che concordano SULL\'ETICHETTA corroborano anche con punteggi leggermente diversi (modelli diversi)', () => {
  const s = initSentimentRelayStore();
  const t = 'stessa notizia, due modelli';
  receiveSentimentRelayed(s, { v: 1, testo: t, score: 0.42, label: 'bullish', asOf: oraISO }, 'peerA', { now: NOW });
  const r2 = receiveSentimentRelayed(s, { v: 1, testo: t, score: 0.55, label: 'bullish', asOf: oraISO }, 'peerB', { now: NOW });
  assert.equal(r2.corroborato, true);
  assert.equal(r2.testimoni, 2);
});

test('un peer in DISACCORDO sull\'etichetta non corrompe il dato esistente, ma resta "accettato" (non è colpa sua, è disaccordo legittimo)', () => {
  const s = initSentimentRelayStore();
  const t = 'notizia controversa';
  receiveSentimentRelayed(s, { v: 1, testo: t, score: 0.6, label: 'bullish', asOf: oraISO }, 'peerA', { now: NOW });
  const r2 = receiveSentimentRelayed(s, { v: 1, testo: t, score: -0.6, label: 'bearish', asOf: oraISO }, 'peerB', { now: NOW });
  assert.equal(r2.accepted, true);
  assert.equal(r2.corroborato, false);
  // Lo store mantiene il primo valore (bullish), non viene scalzato in silenzio.
  const best = bestKnownSentiment(s, t);
  assert.equal(best.label, 'bullish');
});

test('lo stesso peer che rimanda lo stesso testo due volte non si corrobora da solo', () => {
  const s = initSentimentRelayStore();
  const t = 'stesso peer due volte';
  receiveSentimentRelayed(s, { v: 1, testo: t, score: 0.5, label: 'bullish', asOf: oraISO }, 'peerA', { now: NOW });
  const r2 = receiveSentimentRelayed(s, { v: 1, testo: t, score: 0.5, label: 'bullish', asOf: oraISO }, 'peerA', { now: NOW });
  assert.equal(r2.testimoni, 1, 'lo stesso peer non conta due volte come testimone');
  assert.equal(r2.corroborato, false);
});

// ── bestKnownSentiment / pruneSentimentRelay ──

test('bestKnownSentiment: null onesto quando non si sa nulla; il testo si normalizza allo stesso modo dell\'impacchettamento', () => {
  const s = initSentimentRelayStore();
  assert.equal(bestKnownSentiment(s, 'mai visto'), null);
  receiveSentimentRelayed(s, { v: 1, testo: 'apple reports earnings', score: 0.3, label: 'somewhat-bullish', asOf: oraISO }, 'peerA', { now: NOW });
  assert.ok(bestKnownSentiment(s, '  Apple Reports Earnings  '));
});

test('pruneSentimentRelay: rimuove solo le voci scadute, tiene le altre', () => {
  const s = {
    fresca: { testo: 'fresca', score: 0.1, label: 'neutral', asOf: oraISO },
    vecchia: { testo: 'vecchia', score: 0.1, label: 'neutral', asOf: new Date(NOW - ETA_MASSIMA_RELAY_MS - 86400000).toISOString() },
  };
  const pulito = pruneSentimentRelay(s, { now: NOW });
  assert.ok('fresca' in pulito);
  assert.ok(!('vecchia' in pulito));
});

test('REPUTAZIONE_MINIMA_FIDATA è la stessa soglia di knowledge-relay.js (0,5) — un solo posto dove "fidarsi abbastanza" vuol dire qualcosa', () => {
  assert.equal(REPUTAZIONE_MINIMA_FIDATA, 0.5);
});
