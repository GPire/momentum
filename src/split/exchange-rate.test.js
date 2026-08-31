import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchHistoricalRate } from './exchange-rate.js';

test('fetchHistoricalRate: stessa valuta → 1, nessuna chiamata di rete', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  assert.equal(await fetchHistoricalRate('EUR', 'EUR', '2026-08-12', fetchImpl), 1);
  assert.equal(called, false);
});

test('fetchHistoricalRate: forma reale Frankfurter → estrae il tasso', async () => {
  const fetchImpl = async (url) => {
    assert.match(url, /frankfurter\.dev\/v1\/2026-08-12\?base=CHF&symbols=EUR/);
    return { ok: true, json: async () => ({ amount: 1, base: 'CHF', date: '2026-08-12', rates: { EUR: 1.0677 } }) };
  };
  const rate = await fetchHistoricalRate('CHF', 'EUR', '2026-08-12', fetchImpl);
  assert.equal(rate, 1.0677);
});

// Ogni test qui sotto usa una coppia valuta+data DIVERSA: la cache del
// modulo è per-processo e la stessa chiave usata due volte in test diversi
// farebbe leggere il risultato del test precedente invece di chiamare
// davvero il fetchImpl di questo test.
test('fetchHistoricalRate: HTTP non ok → null, mai un tasso indovinato', async () => {
  const fetchImpl = async () => ({ ok: false });
  assert.equal(await fetchHistoricalRate('CHF', 'EUR', '2026-01-01', fetchImpl), null);
});

// Il "non blocca per sempre" è garantito da conTimeout, già testato a fondo
// nella sua suite dedicata (src/core/con-timeout.test.js) — ripeterlo qui
// con un vero timeout da 8s lascerebbe un timer attivo che rallenta ogni
// esecuzione della suite di test. Basta verificare che il modulo lo usi
// (importato in cima al file) e che una fetch che fallisce sia gestita:

test('fetchHistoricalRate: fetch che lancia (rete assente) → null, non un\'eccezione non gestita', async () => {
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  assert.equal(await fetchHistoricalRate('CHF', 'EUR', '2026-01-03', fetchImpl), null);
});

test('fetchHistoricalRate: risposta senza il tasso richiesto → null', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ rates: {} }) });
  assert.equal(await fetchHistoricalRate('CHF', 'EUR', '2026-01-04', fetchImpl), null);
});

test('fetchHistoricalRate: chiamate ripetute per la stessa coppia+data → una sola richiesta di rete (cache)', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: true, json: async () => ({ rates: { EUR: 1.05 } }) }; };
  await fetchHistoricalRate('USD', 'EUR', '2026-08-01', fetchImpl);
  await fetchHistoricalRate('USD', 'EUR', '2026-08-01', fetchImpl);
  assert.equal(calls, 1);
});
