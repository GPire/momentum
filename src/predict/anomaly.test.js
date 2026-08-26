import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.document = globalThis.document || { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, getElementById: () => null };

const { findUnknownMerchants, AnomalyDetector } = await import('./anomaly.js');
const { VaultDAO } = await import('../core/vault.js');

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

// ── AnomalyDetector.detectAll: zThreshold collegato al profilo (2026-08-26)
// — a senso unico, solo verso PIÙ sensibilità, mai meno. ──

function setVaultTx(txByMonth) {
  VaultDAO.state = { transactions: txByMonth };
}

test('detectAll: soglia di default (2.0) invariata quando zThreshold non è passato', () => {
  // Categoria con 5 spese simili + 1 chiaramente fuori scala (z-score alto ma < a soglie assurde).
  setVaultTx({
    '2026-07': [
      tx(1, '2026-07-01', 20, 'A', 'Shopping'), tx(2, '2026-07-02', 22, 'B', 'Shopping'),
      tx(3, '2026-07-03', 21, 'C', 'Shopping'), tx(4, '2026-07-04', 19, 'D', 'Shopping'),
      tx(5, '2026-07-05', 20, 'E', 'Shopping'), tx(6, '2026-07-06', 45, 'F', 'Shopping'), // z ~ 2.3
    ],
  });
  const conDefault = AnomalyDetector.detectAll();
  assert.equal(conDefault.length, 1, 'la spesa da 45 deve risultare anomala alla soglia di default');
});

test('detectAll: zThreshold più basso trova PIÙ anomalie (mai di meno) — direzione unica verso più sensibilità', () => {
  setVaultTx({
    '2026-07': [
      tx(1, '2026-07-01', 20, 'A', 'Shopping'), tx(2, '2026-07-02', 22, 'B', 'Shopping'),
      tx(3, '2026-07-03', 21, 'C', 'Shopping'), tx(4, '2026-07-04', 19, 'D', 'Shopping'),
      tx(5, '2026-07-05', 20, 'E', 'Shopping'), tx(6, '2026-07-06', 25, 'F', 'Shopping'), // z ≈ 1.965: sotto 2.0, sopra 1.6
    ],
  });
  const conDefault = AnomalyDetector.detectAll({ zThreshold: 2.0 });
  const conStress = AnomalyDetector.detectAll({ zThreshold: 1.6 });
  assert.equal(conDefault.length, 0, 'alla soglia di default questa spesa NON è ancora anomala');
  assert.equal(conStress.length, 1, 'con la soglia più sensibile (liquidità corta) sì');
});
