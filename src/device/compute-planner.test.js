import test from 'node:test';
import assert from 'node:assert/strict';

const { planInferenceBackend, planCompute, describePlan } = await import('./compute-planner.js');

const prof = (o = {}) => ({
  kappa: 0.5, cores: 4, memory: 8, lowMemory: false,
  webgpu: false, webgpuFallback: false, webnn: false, simd: false,
  tier: 'medio', enable3D: true, retrainEveryTx: 1,
  forecastBudget: { paths: 5000, capitalTrials: 2000 },
  ...o,
});

test('backend: WebGPU reale preferito, fallback software escluso', () => {
  assert.equal(planInferenceBackend(prof({ webgpu: true })).backend, 'webgpu');
  assert.equal(planInferenceBackend(prof({ webgpu: true, webgpuFallback: true })).backend, 'js'); // fallback GPU ignorato; senza SIMD scende a JS
  assert.equal(planInferenceBackend(prof({ webgpu: true, webgpuFallback: true, simd: true })).backend, 'wasm-simd'); // ...o a SIMD se c'è
});

test('backend: ordine di preferenza WebGPU > WebNN > SIMD > JS', () => {
  assert.equal(planInferenceBackend(prof({ webnn: true })).backend, 'webnn');
  assert.equal(planInferenceBackend(prof({ simd: true })).backend, 'wasm-simd');
  assert.equal(planInferenceBackend(prof()).backend, 'js');
});

test('planCompute: hardware potente → Meso, fp16, worker, molte simulazioni', () => {
  const p = planCompute(prof({ webgpu: true, tier: 'massimo', forecastBudget: { paths: 10000 } }));
  assert.equal(p.modelTier, 'meso');
  assert.equal(p.precision, 'fp16');
  assert.equal(p.useWorker, true);
  assert.equal(p.montecarloPaths, 10000);
});

test('planCompute: tier minimo → solo Nano, niente 3D', () => {
  const p = planCompute(prof({ tier: 'minimo', enable3D: false, kappa: 0.05 }));
  assert.equal(p.modelTier, 'nano');
  assert.equal(p.enable3D, false);
});

test('planCompute: evento di routine (intensity fast) riduce le simulazioni', () => {
  const heavy = planCompute(prof({ forecastBudget: { paths: 10000 } }));
  const light = planCompute(prof({ forecastBudget: { paths: 10000 } }), { intensity: 'fast' });
  assert.ok(light.montecarloPaths < heavy.montecarloPaths);
  assert.ok(light.montecarloPaths <= 1000);
});

test('planCompute: RAM bassa limita le simulazioni', () => {
  const p = planCompute(prof({ lowMemory: true, forecastBudget: { paths: 10000 } }));
  assert.ok(p.montecarloPaths <= 2000);
});

test('planCompute: senza profilo → piano di sicurezza funzionante, mai crash', () => {
  const p = planCompute(null);
  assert.equal(p.backend.backend, 'js');
  assert.equal(p.montecarloPaths, 500);
  assert.equal(p.modelTier, 'nano');
});

test('describePlan: linguaggio semplice, nessun gergo di chip', () => {
  const txt = describePlan(planCompute(prof({ webgpu: true, tier: 'massimo' })));
  assert.ok(/scheda grafica|processore|acceleratore/.test(txt));
  assert.ok(!/webgpu|fp16|κ/i.test(txt)); // niente sigla tecnica nel testo utente
});
