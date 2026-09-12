import test from 'node:test';
import assert from 'node:assert/strict';
import { validComputeRequest, validComputeReply, executePublicUnits, MAX_COMPUTE_BATCH } from './compute-protocol.js';
const workload = 'montecarlo-strategie';
const units = n => Array.from({ length: n }, (_, index) => ({ index, seed: index + 1 }));
test('only implemented public work, bounded batches and distinct unsigned seeds are allowed', () => {
  assert.equal(validComputeRequest(workload, units(MAX_COMPUTE_BATCH)), true);
  for (const batch of [units(MAX_COMPUTE_BATCH + 1), [], [null], [{ index: 0, seed: -1 }], [{ index: 0, seed: Infinity }],
    [{ index: 0, seed: 1, amount: 123 }], [{ index: 0, seed: 1 }, { index: 0, seed: 2 }]]) {
    assert.equal(validComputeRequest(workload, batch), false);
  }
  assert.equal(validComputeRequest('calcolo-fiscale', units(1)), false);
  assert.equal(validComputeRequest('backtest-storico', units(1)), false);
});
test('partial, non-numeric, additional and non-finite results are refused', () => {
  assert.equal(validComputeReply(units(2), { 0: 1.1, 1: 0.9 }), true);
  for (const results of [null, {}, { 0: 1 }, { 0: '1', 1: 2 }, { 0: NaN, 1: 2 }, { 0: 1, 1: 2, 2: 3 }]) {
    assert.equal(validComputeReply(units(2), results), false);
  }
});
test('different batch sizes produce the same deterministic answers and yield to UI', async () => {
  let yields = 0;
  const all = await executePublicUnits(workload, units(40), { yieldControl: async () => { yields++; } });
  const split = { ...await executePublicUnits(workload, units(40).slice(0, 20)), ...await executePublicUnits(workload, units(40).slice(20)) };
  assert.deepEqual(all, split);
  assert.equal(yields, 3);
  assert.equal(validComputeReply(units(40), all), true);
});
test('a suspended or cancelled device stops between chunks instead of returning a partial answer', async () => {
  let yields = 0;
  const result = await executePublicUnits(workload, units(40), { yieldControl: async () => { yields++; }, shouldContinue: () => yields < 2 });
  assert.equal(result, null); assert.equal(yields, 2);
});
