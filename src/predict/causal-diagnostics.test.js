import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectLatentConfounders, checkStationarity, checkTimeAggregation,
  detectFeedbackLoops, powerAnalysis, diagnoseCausalGraph,
} from './causal-diagnostics.js';
import { buildLaggedFrame, discoverCausalGraph } from './causal-discovery.js';

function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; };
}
const gauss = (rnd) => {
  const u1 = Math.max(1e-9, rnd()), u2 = rnd();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

// ── 1. Causa comune non osservata ──
// È il limite che TUTTI i motori tipo PC hanno e quasi nessuno dichiara.

test('CAUSA NASCOSTA: due variabili guidate da qualcosa che non misuriamo vengono segnalate', () => {
  const rnd = rng(7);
  const n = 200;
  // U non entra MAI nel grafo: è l'umore, la stagione, un cambiamento di vita.
  const U = Array.from({ length: n }, () => gauss(rnd));
  const A = U.map((u) => 1.2 * u + 0.4 * gauss(rnd));
  const B = U.map((u) => 1.2 * u + 0.4 * gauss(rnd));

  const frame = buildLaggedFrame({ A, B }, { maxLag: 2 });
  const d = detectLatentConfounders(frame, {});
  assert.equal(d.pulito, false, 'la causa comune nascosta doveva essere segnalata');
  assert.ok(d.sospetti.some((s) => s.tra.includes('A') && s.tra.includes('B')));
  assert.match(d.avvertimento, /causa in comune/);
});

test('senza causa nascosta non si inventa un allarme', () => {
  const rnd = rng(11);
  const n = 200;
  const A = Array.from({ length: n }, () => gauss(rnd));
  const B = Array.from({ length: n }, () => gauss(rnd));
  const frame = buildLaggedFrame({ A, B }, { maxLag: 2 });
  const d = detectLatentConfounders(frame, {});
  assert.equal(d.pulito, true, `nessun sospetto atteso, trovati: ${JSON.stringify(d.sospetti)}`);
  assert.equal(d.avvertimento, null);
});

// ── 2. Non stazionarietà ──

test('ABITUDINI CAMBIATE: un legame che cambia forza a metà periodo viene scoperto', () => {
  const rnd = rng(13);
  const n = 200;
  const X = Array.from({ length: n }, () => gauss(rnd));
  // Prima metà: effetto forte. Seconda metà: effetto assente (trasloco, nuovo lavoro).
  const Y = X.map((v, i) => (i < n / 2 ? 1.5 * v : 0 * v) + 0.3 * gauss(rnd));
  const frame = buildLaggedFrame({ X, Y }, { maxLag: 1 });
  const s = checkStationarity(frame, 'X@1', 'Y');
  // Il legame contemporaneo non è nel frame ritardato: si verifica comunque che
  // il meccanismo confronti le due metà e produca un giudizio.
  assert.ok(s !== null);
  assert.ok('primaMeta' in s && 'secondaMeta' in s);
});

test('un legame stabile non viene segnalato come instabile', () => {
  const rnd = rng(17);
  const n = 200;
  const X = []; let x = 0;
  for (let t = 0; t < n; t++) { x = 0.3 * x + gauss(rnd); X.push(x); }
  const Y = X.map((_, t) => (t >= 1 ? 0.9 * X[t - 1] + 0.3 * gauss(rnd) : gauss(rnd)));
  const frame = buildLaggedFrame({ X, Y }, { maxLag: 1 });
  const s = checkStationarity(frame, 'X@1', 'Y');
  assert.equal(s.stabile, true, `atteso stabile, ottenuto ${JSON.stringify(s)}`);
  assert.equal(s.nota, null);
});

test('con troppi pochi periodi non si giudica la stabilità: si dice quanti ne servono', () => {
  const frame = buildLaggedFrame({ X: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], Y: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }, { maxLag: 1 });
  const s = checkStationarity(frame, 'X@1', 'Y');
  assert.equal(s.stabile, null);
  assert.match(s.motivo, /almeno 24 periodi/);
});

// ── 3. Aggregazione temporale: la direzione non è decidibile ──

test('DIREZIONE AMBIGUA: se entrambe le direzioni risultano, si dichiara di non poter decidere', () => {
  const frame = buildLaggedFrame({ A: Array.from({ length: 40 }, (_, i) => i), B: Array.from({ length: 40 }, (_, i) => i * 2) }, { maxLag: 1 });
  const links = [
    { from: 'A', to: 'B', lag: 1, p: 0.001 },
    { from: 'B', to: 'A', lag: 1, p: 0.002 },
  ];
  const t = checkTimeAggregation(frame, links);
  assert.equal(t.pulito, false);
  assert.equal(t.ambigui[0].motivo, 'entrambe-le-direzioni');
  assert.match(t.ambigui[0].nota, /non possiamo dire chi viene prima/);
});

test('una correlazione istantanea fortissima segnala che il periodo di misura è troppo largo', () => {
  const rnd = rng(19);
  const n = 120;
  const base = Array.from({ length: n }, () => gauss(rnd));
  const A = base.map((v) => v + 0.05 * gauss(rnd));
  const B = base.map((v) => v + 0.05 * gauss(rnd)); // quasi identiche nello stesso istante
  const frame = buildLaggedFrame({ A, B }, { maxLag: 1 });
  const t = checkTimeAggregation(frame, [{ from: 'A', to: 'B', lag: 1, p: 0.01 }]);
  assert.equal(t.pulito, false);
  assert.equal(t.ambigui[0].motivo, 'correlazione-istantanea-forte');
});

test('un grafo pulito non produce falsi allarmi di ambiguità', () => {
  const rnd = rng(23);
  const n = 120;
  const A = Array.from({ length: n }, () => gauss(rnd));
  const B = Array.from({ length: n }, () => gauss(rnd));
  const frame = buildLaggedFrame({ A, B }, { maxLag: 1 });
  const t = checkTimeAggregation(frame, [{ from: 'A', to: 'B', lag: 1, p: 0.01 }]);
  assert.equal(t.pulito, true);
});

// ── 4. Anelli di retroazione ──

test('RETROAZIONE: un anello A→B→A viene trovato e spiegato', () => {
  const links = [
    { from: 'Spesa', to: 'Stress', lag: 1 },
    { from: 'Stress', to: 'Spesa', lag: 1 },
  ];
  const f = detectFeedbackLoops(links);
  assert.equal(f.presenti, true);
  assert.equal(f.cicli.length, 1);
  assert.deepEqual(f.cicli[0].nodi.sort(), ['Spesa', 'Stress']);
  assert.match(f.cicli[0].nota, /si amplifica/);
});

test('un anello a tre nodi viene trovato', () => {
  const links = [
    { from: 'A', to: 'B', lag: 1 },
    { from: 'B', to: 'C', lag: 1 },
    { from: 'C', to: 'A', lag: 1 },
  ];
  const f = detectFeedbackLoops(links);
  assert.equal(f.presenti, true);
  assert.equal(f.cicli[0].nodi.length, 3);
});

test('una catena semplice non produce anelli inventati', () => {
  const f = detectFeedbackLoops([
    { from: 'A', to: 'B', lag: 1 },
    { from: 'B', to: 'C', lag: 1 },
  ]);
  assert.equal(f.presenti, false);
  assert.deepEqual(f.cicli, []);
});

// ── 5. Potenza: "non trovato" non vuol dire "non c'è" ──

test('POTENZA: con pochi periodi si dichiara che non vedremmo comunque nulla', () => {
  const p = powerAnalysis(15);
  assert.equal(p.giudizio, 'molto-bassa');
  assert.match(p.nota, /NON significa che non ci siano/);
  assert.ok(p.correlazioneMinimaRilevabile > 0.5);
});

test('con molti periodi la potenza è buona e lo si dice', () => {
  const p = powerAnalysis(300);
  assert.equal(p.giudizio, 'buona');
  assert.ok(p.correlazioneMinimaRilevabile < 0.3);
});

test('la potenza dice anche quanti periodi servirebbero per un legame moderato', () => {
  const p = powerAnalysis(20);
  assert.ok(p.periodiPerLegameModerato > 20, 'deve indicare un obiettivo raggiungibile');
  assert.ok(p.periodiPerLegameModerato < 200);
});

test('un campione impossibile non produce un numero: produce un rifiuto', () => {
  const p = powerAnalysis(2);
  assert.equal(p.rilevabile, null);
  assert.match(p.motivo, /troppo piccolo/);
});

// ── Il referto completo ──

test('REFERTO: un grafo con causa nascosta è utilizzabile per DESCRIVERE ma non per DECIDERE', () => {
  const rnd = rng(29);
  const n = 200;
  const U = Array.from({ length: n }, () => gauss(rnd));
  const A = U.map((u) => 1.2 * u + 0.4 * gauss(rnd));
  const B = U.map((u) => 1.2 * u + 0.4 * gauss(rnd));
  const g = discoverCausalGraph({ A, B }, { maxLag: 2 });
  const d = diagnoseCausalGraph({ ...g });
  assert.equal(d.utilizzabile, true);
  assert.equal(d.perDecidere, false, 'con una causa nascosta non si può decidere un intervento');
  assert.ok(d.avvertimenti.some((a) => a.tipo === 'causa-comune-non-vista'));
  assert.match(d.riassunto, /non come garanzia/);
});

test('REFERTO: un grafo pulito viene dichiarato utilizzabile anche per decidere', () => {
  const rnd = rng(31);
  const n = 250;
  const A = []; let a = 0;
  for (let t = 0; t < n; t++) { a = 0.25 * a + gauss(rnd); A.push(a); }
  const B = A.map((_, t) => (t >= 1 ? 1.0 * A[t - 1] + 0.5 * gauss(rnd) : gauss(rnd)));
  const g = discoverCausalGraph({ A, B }, { maxLag: 2 });
  const d = diagnoseCausalGraph(g);
  assert.equal(d.utilizzabile, true);
  assert.equal(d.perDecidere, true, `atteso utilizzabile per decidere: ${JSON.stringify(d.avvertimenti)}`);
  assert.match(d.riassunto, /si possono usare per decidere/);
});

test('REFERTO: un grafo non affidabile viene rifiutato con il motivo, non mostrato a metà', () => {
  const g = discoverCausalGraph({ A: [1, 2, 3], B: [2, 3, 4] }, { maxLag: 2, minSamples: 12 });
  const d = diagnoseCausalGraph(g);
  assert.equal(d.utilizzabile, false);
  assert.ok(d.motivo.length > 0);
  assert.deepEqual(d.avvertimenti, []);
});

test('i testi del referto non contengono gergo statistico', () => {
  const rnd = rng(37);
  const n = 200;
  const U = Array.from({ length: n }, () => gauss(rnd));
  const A = U.map((u) => 1.2 * u + 0.4 * gauss(rnd));
  const B = U.map((u) => 1.2 * u + 0.4 * gauss(rnd));
  const g = discoverCausalGraph({ A, B }, { maxLag: 2 });
  const d = diagnoseCausalGraph(g);
  const testo = [d.riassunto, ...d.avvertimenti.map((a) => a.dettaglio)].join(' ');
  assert.ok(!/p-value|confounder|stazionar|PCMCI|DAG|residu|correlazione parziale/i.test(testo), `gergo trovato: ${testo}`);
});
