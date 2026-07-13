import test from 'node:test';
import assert from 'node:assert/strict';

// Shim ambiente browser PRIMA di importare (constants.js usa window/navigator).
const learned = [];
globalThis.navigator = { maxTouchPoints: 0 };
globalThis.document = { querySelector: () => null, getElementById: () => null, addEventListener: () => {} };
globalThis.window = {
  momentumOrchestrator: { learn: (d, c) => learned.push([d, c]) },
  requestIdleCallback: (fn) => setTimeout(() => fn({ timeRemaining: () => 10 }), 0),
};
const { learnInBackground } = await import('./multi-import.js');

test('learnInBackground: addestra i modelli da OGNI operazione importata (idle-chunked)', async () => {
  learned.length = 0;
  const pairs = Array.from({ length: 95 }, (_, i) => ({ description: 'tx ' + i, category: 'spesa', amount: 10, date: new Date() }));
  learnInBackground(pairs, 40); // 95 in chunk da 40 → 3 giri idle
  await new Promise(r => setTimeout(r, 120));
  assert.equal(learned.length, 95); // TUTTE le operazioni addestrano i modelli
  assert.equal(learned[0][0], 'tx 0');
});

test('reconcileModelsWithHistory: al cambio firma modelli, ri-addestra dai dati preservati (no data loss)', async () => {
  learned.length = 0;
  const { reconcileModelsWithHistory } = await import('./multi-import.js');
  // shim VaultDAO minimale con storico transazioni
  const { VaultDAO } = await import('../core/vault.js');
  VaultDAO.state.transactions = { '2026-06': [
    { description: 'Netflix', category: 'abbonamenti', amount: 14.99, date: '2026-06-05' },
    { description: 'Esselunga', category: 'spesa', amount: 40, date: '2026-06-10' },
  ] };
  VaultDAO.state.mlData = { modelSignature: 'vecchia' };
  VaultDAO.save = () => {};
  const r1 = reconcileModelsWithHistory('nuova-v2');   // firma diversa → ri-addestra
  await new Promise(r => setTimeout(r, 60));
  assert.equal(r1.reconciled, true);
  assert.equal(r1.count, 2);
  assert.equal(learned.length, 2);                     // ha riappreso da tutto lo storico
  const r2 = reconcileModelsWithHistory('nuova-v2');   // stessa firma → non ripete
  assert.equal(r2.reconciled, false);
});
