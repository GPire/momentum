import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptiveExecutionPlan, canActivate, retune, EXPERT_BUDGET } from './adaptive-runtime.js';

const prof = (tier, extra = {}) => ({ tier, cores: 4, kappa: 1, forecastBudget: { paths: 3000 }, ...extra });

test('sparse per tier: device debole = meno esperti attivabili', () => {
  assert.deepEqual(adaptiveExecutionPlan(prof('minimo')).experts, ['nano']);
  assert.deepEqual(adaptiveExecutionPlan(prof('medio')).experts, ['nano', 'meso']);
  assert.equal(adaptiveExecutionPlan(prof('massimo')).experts.length, 4);
});

test('int8 (quantize) sotto il tier massimo, fp32 al massimo', () => {
  assert.equal(adaptiveExecutionPlan(prof('minimo')).quantize, true);
  assert.equal(adaptiveExecutionPlan(prof('massimo')).quantize, false);
});

test('nessun profilo → piano minimo sicuro (graceful)', () => {
  const p = adaptiveExecutionPlan(null);
  assert.equal(p.tier, 'minimo');
  assert.deepEqual(p.experts, ['nano']);
});

test('canActivate rispetta il budget del device (sparse)', () => {
  const p = adaptiveExecutionPlan(prof('minimo'));
  assert.equal(canActivate('nano', p), true);
  assert.equal(canActivate('meso', p), false); // non attivabile su tier minimo
});

test('self-tuning: se rallenta, riduce gli esperti (più sparse) + int8', () => {
  const p = adaptiveExecutionPlan(prof('massimo'));
  const r = retune(p, 120, { targetMs: 60 });
  assert.equal(r.retuned, true);
  assert.equal(r.experts.length, p.experts.length - 1, 'tolto l\'esperto più pesante');
  assert.equal(r.quantize, true);
});

test('self-tuning: mai sotto il gatekeeper; se veloce non tocca nulla', () => {
  const fast = retune(adaptiveExecutionPlan(prof('medio')), 20, { targetMs: 60 });
  assert.equal(fast.retuned, false);
  let p = adaptiveExecutionPlan(prof('minimo'));
  p = retune(p, 999, { targetMs: 60 });
  assert.equal(p.retuned, false, 'nano da solo non si riduce oltre');
});

test('budget dichiarato e monotòno (più tier = più esperti)', () => {
  assert.ok(EXPERT_BUDGET.minimo.length < EXPERT_BUDGET.medio.length);
  assert.ok(EXPERT_BUDGET.medio.length < EXPERT_BUDGET.massimo.length);
});
