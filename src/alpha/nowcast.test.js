import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshness, nowcastPrice } from './nowcast.js';

test('freshness dichiara la staleness in giorni con etichetta', () => {
  const now = Date.now();
  assert.equal(freshness(now).stale, false);
  assert.equal(freshness(now - 3 * 86400000, now).label, '3 giorni fa');
  assert.equal(freshness(now - 3 * 86400000, now).stale, true);
});

test('la banda d\'incertezza CRESCE con l\'orizzonte (√steps)', () => {
  const series = Array.from({ length: 40 }, (_, i) => 100 + i * 0.5 + (i % 3 - 1));
  const b1 = nowcastPrice(series, 1).band;
  const b10 = nowcastPrice(series, 10).band;
  assert.ok(b10 > b1, 'più lontano nel tempo → più incertezza');
});

test('estimate è sempre dentro [low, high] e la stima è dichiarata stale', () => {
  const series = Array.from({ length: 40 }, (_, i) => 100 + i * 0.3);
  const r = nowcastPrice(series, 5);
  assert.ok(r.low <= r.estimate && r.estimate <= r.high);
  assert.equal(r.stale, true);
  assert.equal(r.method, 'ar2-drift');
});

test('steps 0 = dato live (banda nulla); nessun dato = null onesto', () => {
  assert.equal(nowcastPrice([100], 0).band, 0);
  assert.equal(nowcastPrice([], 3).estimate, null);
  assert.equal(nowcastPrice([], 3).method, 'no-data');
});

test('pochi dati → hold-last con banda dichiarata (mai numero falso-preciso)', () => {
  const r = nowcastPrice([100, 101, 99], 4);
  assert.equal(r.method, 'hold-last');
  assert.ok(r.band > 0);
});
