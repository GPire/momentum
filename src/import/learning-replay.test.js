import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };
const { VaultDAO } = await import('../core/vault.js');
const { reconcileModelsWithHistory } = await import('./multi-import.js');
function world(t, count = 95) {
  const old = { state: VaultDAO.state, save: VaultDAO.save, window: globalThis.window };
  t.after(() => { VaultDAO.state = old.state; VaultDAO.save = old.save; globalThis.window = old.window; });
  const queue = [], learned = [], saves = [];
  VaultDAO.state = { transactions: { '2026-07': Array.from({ length: count }, (_, i) => ({ id: i, description: `shop ${i}`, category: 'spesa', amount: 5, date: '2026-07-01' })) }, mlData: { modelSignature: 'old', learnedWeights: [0.25] } };
  VaultDAO.save = () => saves.push(structuredClone(VaultDAO.state.mlData));
  globalThis.window = { requestIdleCallback: fn => queue.push(fn), momentumOrchestrator: { learn: text => learned.push(text) } };
  return { queue, learned, saves };
}
test('signature changes only after the final chunk and no duplicate job is queued', async t => {
  const { queue, learned } = world(t);
  const job = reconcileModelsWithHistory('new');
  assert.equal(VaultDAO.state.mlData.modelSignature, 'old');
  assert.equal(reconcileModelsWithHistory('new').pending, true);
  queue.shift()(); assert.equal(learned.length, 40);
  assert.equal(VaultDAO.state.mlData.historyReplay.next, 40);
  assert.equal(VaultDAO.state.mlData.modelSignature, 'old');
  while (queue.length) queue.shift()();
  assert.equal((await job.completion).complete, true);
  assert.equal(learned.length, 95);
  assert.equal(VaultDAO.state.mlData.modelSignature, 'new');
  assert.equal(VaultDAO.state.mlData.historyReplay, undefined);
  assert.deepEqual(VaultDAO.state.mlData.learnedWeights, [0.25]);
});
test('interrupted learning resumes from a saved chunk after opening the same history', async t => {
  const { queue, learned } = world(t);
  const first = reconcileModelsWithHistory('new'); queue.shift()();
  VaultDAO.state = structuredClone(VaultDAO.state); // simulate reopening persisted state
  const resumed = reconcileModelsWithHistory('new');
  assert.equal(resumed.resumedFrom, 40);
  while (queue.length) queue.shift()();
  assert.equal((await first.completion).cancelled, true);
  assert.equal((await resumed.completion).complete, true);
  assert.equal(learned.length, 95);
  assert.equal(new Set(learned).size, 95);
});
test('unavailable or failing learner cannot mark an upgrade as completed', async t => {
  const { queue } = world(t, 1);
  delete window.momentumOrchestrator;
  assert.equal(reconcileModelsWithHistory('new').pending, true);
  assert.equal(VaultDAO.state.mlData.modelSignature, 'old');
  window.momentumOrchestrator = { learn() { throw new Error('failed'); } };
  const job = reconcileModelsWithHistory('new'); queue.shift()();
  assert.equal((await job.completion).complete, false);
  assert.equal(VaultDAO.state.mlData.modelSignature, 'old');
});
