import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCausalStructure } from './causal-orchestrator.js';

function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; };
}
const gauss = (rnd) => {
  const u1 = Math.max(1e-9, rnd()), u2 = rnd();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

// ── Degradazione onesta ──

test('con poche settimane si passa al motore base, DICHIARATO', () => {
  const series = { A: [1, 2, 3, 4, 5, 6, 7, 8], B: [2, 3, 4, 5, 6, 7, 8, 9] };
  const r = analyzeCausalStructure(series, { allTx: {} });
  assert.equal(r.motore, 'base');
  assert.match(r.motivoMotoreBase, /Servono almeno/);
});

test('con abbastanza settimane si usa il motore avanzato', () => {
  const rnd = rng(3);
  const n = 40;
  const A = []; let a = 0;
  for (let t = 0; t < n; t++) { a = 0.2 * a + gauss(rnd); A.push(a); }
  const B = A.map((_, t) => (t >= 1 ? 0.9 * A[t - 1] + 0.3 * gauss(rnd) : gauss(rnd)));
  const r = analyzeCausalStructure({ A, B }, { maxLag: 2 });
  assert.equal(r.motore, 'pcmci');
  assert.ok(r.diagnosi !== null, 'il motore avanzato deve produrre una diagnosi');
});

// ── Integrazione: un legame reale attraversa tutta la catena ──

test('INTEGRAZIONE: un legame vero produce link + effetto quantificato + diagnosi pulita', () => {
  const rnd = rng(11);
  const n = 250;
  const A = []; let a = 0;
  for (let t = 0; t < n; t++) { a = 0.25 * a + gauss(rnd); A.push(a); }
  const B = A.map((_, t) => (t >= 1 ? 1.0 * A[t - 1] + 0.4 * gauss(rnd) : gauss(rnd)));
  const r = analyzeCausalStructure({ A, B }, { maxLag: 2, interventi: { A: -10 } });

  assert.ok(r.links.length > 0, 'deve trovare il legame');
  assert.ok(r.edges.length > 0, 'deve quantificare l\'effetto');
  assert.equal(r.diagnosi.perDecidere, true, 'un grafo pulito deve essere utilizzabile per decidere');
  const scenario = r.scenari.find((s) => s.target === 'B');
  assert.ok(scenario, 'lo scenario deve includere B');
  assert.ok(scenario.effetto < 0, 'ridurre A deve ridurre B');
});

test('INTEGRAZIONE: una causa comune nascosta produce un avvertimento che arriva fino in cima', () => {
  const rnd = rng(13);
  const n = 200;
  const U = Array.from({ length: n }, () => gauss(rnd));
  const A = U.map((u) => 1.2 * u + 0.4 * gauss(rnd));
  const B = U.map((u) => 1.2 * u + 0.4 * gauss(rnd));
  const r = analyzeCausalStructure({ A, B }, { maxLag: 2 });
  assert.ok(r.diagnosi !== null);
  if (r.diagnosi.utilizzabile) {
    assert.equal(r.diagnosi.perDecidere, false, 'una causa nascosta deve rendere il grafo non decisionale');
    assert.match(r.riassunto, /rendono rischioso|rende rischioso/);
  }
});

// ── Legami nascosti (non lineari) ──

test('INTEGRAZIONE: un legame a soglia scartato da PCMCI viene ripescato come "nascosto"', () => {
  const rnd = rng(17);
  const n = 200;
  const X = Array.from({ length: n }, () => rnd() * 100);
  // Il motore causale testa SOLO legami RITARDATI (mai istantanei, per
  // costruzione — coerente con `causal-graph.js` esistente): la soglia va
  // applicata a X del periodo PRECEDENTE, non allo stesso istante.
  const Y = X.map((v, t) => (t === 0 ? gauss(rnd) : (X[t - 1] > 60 ? (X[t - 1] - 60) * 4 : 0) + 3 * gauss(rnd)));
  const r = analyzeCausalStructure({ X, Y }, { maxLag: 1 });
  // O il legame è già in links (se anche la parte lineare basta), o compare
  // tra i non lineari: in ogni caso NON deve sparire silenziosamente.
  const trovatoLineare = r.links.some((l) => l.from === 'X' && l.to === 'Y');
  const trovatoNonLineare = r.nonLineari.some((l) => l.from === 'X' && l.to === 'Y');
  assert.ok(trovatoLineare || trovatoNonLineare, 'un legame a soglia forte non deve sparire del tutto');
});

// ── Nessun legame: il vuoto onesto ──

test('serie indipendenti producono un risultato vuoto ma coerente, non un crash', () => {
  const rnd = rng(23);
  const n = 40;
  const A = Array.from({ length: n }, () => gauss(rnd));
  const B = Array.from({ length: n }, () => gauss(rnd));
  const r = analyzeCausalStructure({ A, B }, { maxLag: 2 });
  assert.equal(r.motore, 'pcmci');
  assert.deepEqual(r.links, []);
  assert.deepEqual(r.edges, []);
});

test('il riassunto non contiene mai gergo tecnico', () => {
  const rnd = rng(29);
  const n = 200;
  const A = []; let a = 0;
  for (let t = 0; t < n; t++) { a = 0.25 * a + gauss(rnd); A.push(a); }
  const B = A.map((_, t) => (t >= 1 ? 1.0 * A[t - 1] + 0.4 * gauss(rnd) : gauss(rnd)));
  const r = analyzeCausalStructure({ A, B }, { maxLag: 2 });
  assert.ok(!/PCMCI|MCI|p-value|Benjamini|deflat/i.test(r.riassunto), `gergo trovato: ${r.riassunto}`);
});
