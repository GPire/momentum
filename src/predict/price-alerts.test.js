import test from 'node:test';
import assert from 'node:assert/strict';
import { createPriceAlert, checkPriceAlerts, resetPriceAlert, removePriceAlert } from './price-alerts.js';

test('createPriceAlert: valido → oggetto con id stabile', () => {
  const a = createPriceAlert({ symbol: 'btc', direction: 'above', threshold: 100000 });
  assert.equal(a.symbol, 'BTC');
  assert.equal(a.triggeredAt, null);
});

test('createPriceAlert: input non valido → errore, mai un avviso rotto silenzioso', () => {
  assert.throws(() => createPriceAlert({ symbol: '', direction: 'above', threshold: 100 }));
  assert.throws(() => createPriceAlert({ symbol: 'BTC', direction: 'sideways', threshold: 100 }));
  assert.throws(() => createPriceAlert({ symbol: 'BTC', direction: 'above', threshold: -5 }));
});

test('checkPriceAlerts: soglia "above" superata → scatta una volta sola', () => {
  const a = createPriceAlert({ symbol: 'BTC', direction: 'above', threshold: 100 });
  const r1 = checkPriceAlerts([a], { BTC: 105 });
  assert.equal(r1.fired.length, 1);
  assert.ok(r1.alerts[0].triggeredAt);
  const r2 = checkPriceAlerts(r1.alerts, { BTC: 110 }); // già scattato, non deve scattare di nuovo
  assert.equal(r2.fired.length, 0);
});

test('checkPriceAlerts: soglia "below" e prezzo mancante → nessuno scatto', () => {
  const a = createPriceAlert({ symbol: 'AAPL', direction: 'below', threshold: 50 });
  assert.equal(checkPriceAlerts([a], {}).fired.length, 0);
  assert.equal(checkPriceAlerts([a], { AAPL: 60 }).fired.length, 0);
  assert.equal(checkPriceAlerts([a], { AAPL: 40 }).fired.length, 1);
});

test('resetPriceAlert / removePriceAlert: gestione manuale', () => {
  const a = createPriceAlert({ symbol: 'BTC', direction: 'above', threshold: 100 });
  const { alerts } = checkPriceAlerts([a], { BTC: 200 });
  const reset = resetPriceAlert(alerts, a.id);
  assert.equal(reset[0].triggeredAt, null);
  assert.equal(removePriceAlert(alerts, a.id).length, 0);
});

test('checkPriceAlerts: non muta l\'array in input', () => {
  const a = createPriceAlert({ symbol: 'BTC', direction: 'above', threshold: 100 });
  const original = [a];
  checkPriceAlerts(original, { BTC: 200 });
  assert.equal(original[0].triggeredAt, null);
});
