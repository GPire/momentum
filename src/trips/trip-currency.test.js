import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOriginalCurrencyFields, canChangeTripCurrency } from './trip-currency.js';

test('existing expenses and offered items cannot be relabelled as another currency', () => {
  const trip = { id: 'trip', receiptPolicy: { currency: 'EUR' } };
  assert.equal(canChangeTripCurrency(trip, 'USD', []), true);
  assert.equal(canChangeTripCurrency(trip, 'USD', [{ businessTripId: 'other' }]), true);
  assert.equal(canChangeTripCurrency(trip, 'USD', [{ businessTripId: 'trip' }]), false);
  assert.equal(canChangeTripCurrency({ ...trip, offeredItems: [{ amount: 3 }] }, 'USD', []), false);
  assert.equal(canChangeTripCurrency(trip, 'EUR', [{ businessTripId: 'trip' }]), true);
});

test('non-finite conversion inputs cannot pass the consistency check', () => {
  const valid = { amount: 41.4, originalAmount: 45, originalCurrency: 'CHF', exchangeRate: 0.92, tripCurrency: 'EUR' };
  for (const field of ['amount', 'originalAmount', 'exchangeRate']) {
    for (const value of [NaN, Infinity, -Infinity]) assert.throws(() => buildOriginalCurrencyFields({ ...valid, [field]: value }));
  }
});

test('nessuna valuta originale dichiarata → nessun campo aggiunto', () => {
  assert.deepEqual(buildOriginalCurrencyFields({ amount: 45, tripCurrency: 'EUR' }), {});
});

test('valuta originale uguale a quella del viaggio → nessun campo aggiunto', () => {
  const r = buildOriginalCurrencyFields({ amount: 45, originalAmount: 45, originalCurrency: 'EUR', exchangeRate: 1, tripCurrency: 'EUR' });
  assert.deepEqual(r, {});
});

test('conversione coerente → campi originali restituiti arrotondati', () => {
  const r = buildOriginalCurrencyFields({ amount: 41.4, originalAmount: 45, originalCurrency: 'CHF', exchangeRate: 0.92, tripCurrency: 'EUR' });
  assert.deepEqual(r, { originalAmount: 45, originalCurrency: 'CHF', exchangeRate: 0.92 });
});

test('valuta originale senza importo → errore, mai un importo indovinato', () => {
  assert.throws(() => buildOriginalCurrencyFields({ amount: 41.4, originalCurrency: 'CHF', exchangeRate: 0.92, tripCurrency: 'EUR' }));
});

test('valuta originale senza tasso → errore', () => {
  assert.throws(() => buildOriginalCurrencyFields({ amount: 41.4, originalAmount: 45, originalCurrency: 'CHF', tripCurrency: 'EUR' }));
});

test('importo convertito non coerente col tasso dichiarato → errore', () => {
  assert.throws(() => buildOriginalCurrencyFields({ amount: 999, originalAmount: 45, originalCurrency: 'CHF', exchangeRate: 0.92, tripCurrency: 'EUR' }));
});
