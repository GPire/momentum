import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCryptoPriceYearsAgo, describeYoyChange } from './year-over-year.js';

test('fetchCryptoPriceYearsAgo: costruisce la data corretta (1 anno fa) e chiama l\'URL giusto', async () => {
  let calledUrl = null;
  const fetchImpl = async (url) => {
    calledUrl = url;
    return { ok: true, json: async () => ({ market_data: { current_price: { eur: 100 } } }) };
  };
  const r = await fetchCryptoPriceYearsAgo('bitcoin', { yearsAgo: 1, fetchImpl, referenceDate: new Date('2026-07-27') });
  assert.equal(r.price, 100);
  assert.equal(r.date, '2025-07-27');
  assert.ok(calledUrl.includes('date=27-07-2025'));
  assert.ok(calledUrl.includes('coins/bitcoin/history'));
});

test('fetchCryptoPriceYearsAgo: fonte senza dato -> null, mai un prezzo inventato', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({}) });
  const r = await fetchCryptoPriceYearsAgo('bitcoin', { fetchImpl });
  assert.equal(r, null);
});

test('fetchCryptoPriceYearsAgo: HTTP non ok -> null', async () => {
  const fetchImpl = async () => ({ ok: false });
  const r = await fetchCryptoPriceYearsAgo('bitcoin', { fetchImpl });
  assert.equal(r, null);
});

test('fetchCryptoPriceYearsAgo: nessun coinId -> null', async () => {
  assert.equal(await fetchCryptoPriceYearsAgo(null, { fetchImpl: async () => ({}) }), null);
});

test('describeYoyChange: variazione positiva', () => {
  const s = describeYoyChange(150, { price: 100, date: '2025-07-27' }, { yearsAgo: 1 });
  assert.ok(s.includes('1 anno fa'));
  assert.ok(s.includes('50% in più'));
});

test('describeYoyChange: variazione negativa', () => {
  const s = describeYoyChange(50, { price: 100, date: '2024-07-27' }, { yearsAgo: 2 });
  assert.ok(s.includes('2 anni fa'));
  assert.ok(s.includes('50% in meno'));
});

test('describeYoyChange: senza dato passato -> null', () => {
  assert.equal(describeYoyChange(100, null), null);
});
