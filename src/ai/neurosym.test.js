import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.document = globalThis.document || { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, getElementById: () => null };
const { NeuroSym } = await import('./neurosym.js');
const { makeExpert, activatableHeavyExperts, HEAVY_EXPERT_SLOT } = await import('./expert-adapter.js');

test('NeuroSym.explain: descrive i layer attivi, onesto sull\'heavy slot vuoto', () => {
  const e = NeuroSym.explain(null);
  assert.equal(e.engine, 'NeuroSym');
  assert.ok(e.layers.length >= 6);
  assert.equal(e.heavyExpertReady, false); // slot vuoto di default
  assert.ok(/frontier LLM restano avanti/.test(e.honesty));
});

test('NeuroSym.ask: instrada al Q&A deterministico', () => {
  const r = NeuroSym.ask('quanto ho speso questo mese?', { allTx: {}, referenceDate: new Date(2026,6,15) });
  assert.ok(r.intent);
});

test('NeuroSym.categorize: delega all\'orchestratore', () => {
  const orch = { infer: () => ({ category: 'spesa', confidence: 90, abstain: false }) };
  assert.equal(NeuroSym.categorize(orch, 'esselunga', 30, new Date()).category, 'spesa');
});

test('expert-adapter: slot vuoto non disponibile; con modello e RAM ok → attivabile', () => {
  assert.equal(HEAVY_EXPERT_SLOT.available({ memory: 8, webgpu: true }), false); // nessun predictFn
  const real = makeExpert({ id: 'x', requirements: { minRamGB: 6, backend: 'webgpu' }, predictFn: () => ({ category: 'spesa' }) });
  assert.equal(real.available({ memory: 8, webgpu: true }), true);
  assert.equal(real.available({ memory: 2, webgpu: true }), false); // RAM insufficiente
  assert.equal(real.available({ memory: 8, webgpu: false }), false); // backend assente
  assert.equal(activatableHeavyExperts({ memory: 8, webgpu: true }, [real]).length, 1);
});
