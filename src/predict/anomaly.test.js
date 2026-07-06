import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.document = globalThis.document || { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, getElementById: () => null };

const { findUnknownMerchants } = await import('./anomaly.js');

function tx(id, date, amount, description, category = 'Shopping') {
  return { id, date, amount, description, type: 'uscita', category };
}

test('findUnknownMerchants: esercente mai visto prima → sospetto', () => {
  const allTx = {
    '2026-06': [tx(1, '2026-06-01', 20, 'Esselunga'), tx(2, '2026-06-15', 30, 'Esselunga')],
    '2026-07': [tx(3, '2026-07-10', 500, 'NEGOZIO SCONOSCIUTO XYZ')],
  };
  const anomalies = [{ tx: allTx['2026-07'][0], zScore: 3.2 }];
  const unknown = findUnknownMerchants(anomalies, allTx);
  assert.equal(unknown.length, 1);
});

test('findUnknownMerchants: esercente già visto in passato → NON sospetto', () => {
  const allTx = {
    '2026-06': [tx(1, '2026-06-01', 20, 'Amazon'), tx(2, '2026-06-15', 25, 'Amazon marketplace')],
    '2026-07': [tx(3, '2026-07-10', 500, 'Amazon')],
  };
  const anomalies = [{ tx: allTx['2026-07'][0], zScore: 3.0 }];
  assert.equal(findUnknownMerchants(anomalies, allTx).length, 0);
});

test('findUnknownMerchants: solo transazioni PRECEDENTI contano (non quelle dopo)', () => {
  const allTx = {
    '2026-07': [
      tx(1, '2026-07-10', 500, 'Nuovo Store'),  // anomalia
      tx(2, '2026-07-20', 30, 'Nuovo Store'),   // dopo: non deve renderla "conosciuta"
    ],
  };
  const anomalies = [{ tx: allTx['2026-07'][0], zScore: 3.0 }];
  assert.equal(findUnknownMerchants(anomalies, allTx).length, 1);
});
