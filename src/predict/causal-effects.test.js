import test from 'node:test';
import assert from 'node:assert/strict';
import {
  olsWithSE, directEffect, interactionEffect, monotoneCheck,
  totalEffect, simulateScenario, analyzeCausalScenario,
} from './causal-effects.js';
import { buildLaggedFrame, discoverCausalGraph } from './causal-discovery.js';

function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; };
}
const gauss = (rnd) => {
  const u1 = Math.max(1e-9, rnd()), u2 = rnd();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

// ── Minimi quadrati: verificati contro una relazione nota ──

test('olsWithSE recupera i coefficienti veri di una relazione nota', () => {
  const rnd = rng(5);
  const n = 300;
  const x1 = Array.from({ length: n }, () => gauss(rnd));
  const x2 = Array.from({ length: n }, () => gauss(rnd));
  const y = x1.map((v, i) => 5 + 2 * v - 3 * x2[i] + 0.2 * gauss(rnd));
  const fit = olsWithSE(y, [x1, x2]);
  assert.ok(Math.abs(fit.beta[0] - 5) < 0.1, `intercetta: ${fit.beta[0]}`);
  assert.ok(Math.abs(fit.beta[1] - 2) < 0.1, `beta1: ${fit.beta[1]}`);
  assert.ok(Math.abs(fit.beta[2] + 3) < 0.1, `beta2: ${fit.beta[2]}`);
  assert.ok(fit.se.every((s) => s > 0 && Number.isFinite(s)));
});

test('gli errori standard si stringono quando i dati aumentano', () => {
  const rnd = rng(9);
  const fai = (n) => {
    const x = Array.from({ length: n }, () => gauss(rnd));
    const y = x.map((v) => 1.5 * v + gauss(rnd));
    return olsWithSE(y, [x]).se[1];
  };
  assert.ok(fai(500) < fai(60), 'più dati devono dare più precisione');
});

test('olsWithSE rifiuta i sistemi degeneri invece di stimare a caso', () => {
  assert.equal(olsWithSE([1, 2, 3], [[1, 2, 3], [2, 4, 6]]), null);
});

// ── Effetto diretto con intervallo ──

test('l\'effetto diretto recupera il coefficiente vero, con un intervallo che lo contiene', () => {
  const rnd = rng(13);
  const n = 250;
  const A = []; let a = 0;
  for (let t = 0; t < n; t++) { a = 0.3 * a + gauss(rnd); A.push(a); }
  const B = A.map((_, t) => (t >= 1 ? 0.8 * A[t - 1] + 0.4 * gauss(rnd) : gauss(rnd)));

  const frame = buildLaggedFrame({ A, B }, { maxLag: 2 });
  const eff = directEffect(frame, {}, 'A@1', 'B');
  assert.ok(Math.abs(eff.beta - 0.8) < 0.15, `atteso ~0.8, ottenuto ${eff.beta}`);
  assert.ok(eff.ic[0] < 0.8 && eff.ic[1] > 0.8, `l'intervallo ${JSON.stringify(eff.ic)} deve contenere il valore vero`);
  assert.ok(eff.p < 0.001);
});

test('un effetto inesistente ha un intervallo che contiene lo zero', () => {
  const rnd = rng(17);
  const n = 200;
  const A = Array.from({ length: n }, () => gauss(rnd));
  const B = Array.from({ length: n }, () => gauss(rnd));
  const frame = buildLaggedFrame({ A, B }, { maxLag: 2 });
  const eff = directEffect(frame, {}, 'A@1', 'B');
  assert.ok(eff.ic[0] < 0 && eff.ic[1] > 0, `atteso un intervallo che contiene 0, ottenuto ${JSON.stringify(eff.ic)}`);
  assert.ok(eff.p > 0.05);
});

// ── Interazione: l'effetto che cambia col contesto ──

test('INTERAZIONE: un effetto che dipende dal contesto viene scoperto', () => {
  const rnd = rng(19);
  const n = 400;
  const X = Array.from({ length: n }, () => gauss(rnd));
  const M = Array.from({ length: n }, () => gauss(rnd));
  // Y dipende da X solo quando M è alto: l'effetto medio NON descrive nessuno.
  const Y = X.map((v, i) => (i >= 1 ? 0.9 * X[i - 1] * M[i - 1] + 0.3 * gauss(rnd) : gauss(rnd)));

  const frame = buildLaggedFrame({ X, M, Y }, { maxLag: 2 });
  const inter = interactionEffect(frame, 'X@1', 'Y', 'M@1');
  assert.equal(inter.significativa, true, `l'interazione doveva essere trovata: ${JSON.stringify(inter)}`);
  // Con un'interazione PURA (nessun effetto principale) i due effetti sono
  // simmetrici per costruzione: il segno si ribalta. È questo che va
  // verificato, non che uno sia più grande — asserirlo sarebbe stato un test
  // scritto male, non una proprietà del metodo.
  assert.ok(inter.effettoQuandoAlto * inter.effettoQuandoBasso < 0,
    `l'effetto deve ribaltarsi di segno col contesto: ${inter.effettoQuandoBasso} → ${inter.effettoQuandoAlto}`);
  assert.ok(Math.abs(inter.effettoQuandoAlto - inter.effettoQuandoBasso) > 1,
    'la differenza tra contesto basso e alto deve essere sostanziale');
});

test('INTERAZIONE con effetto principale: il contesto alto rinforza davvero', () => {
  const rnd = rng(20);
  const n = 400;
  const X = Array.from({ length: n }, () => gauss(rnd));
  const M = Array.from({ length: n }, () => gauss(rnd));
  // Effetto base 0.6, rinforzato quando M è alto.
  const Y = X.map((v, i) => (i >= 1 ? 0.6 * X[i - 1] + 0.9 * X[i - 1] * M[i - 1] + 0.3 * gauss(rnd) : gauss(rnd)));
  const frame = buildLaggedFrame({ X, M, Y }, { maxLag: 2 });
  const inter = interactionEffect(frame, 'X@1', 'Y', 'M@1');
  assert.equal(inter.significativa, true);
  assert.ok(inter.effettoQuandoAlto > inter.effettoQuandoBasso,
    `col contesto alto l'effetto deve essere maggiore: ${inter.effettoQuandoBasso} → ${inter.effettoQuandoAlto}`);
});

test('senza interazione vera, non se ne inventa una', () => {
  const rnd = rng(23);
  const n = 300;
  const X = Array.from({ length: n }, () => gauss(rnd));
  const M = Array.from({ length: n }, () => gauss(rnd));
  const Y = X.map((v, i) => (i >= 1 ? 0.7 * X[i - 1] + 0.3 * gauss(rnd) : gauss(rnd)));
  const frame = buildLaggedFrame({ X, M, Y }, { maxLag: 2 });
  const inter = interactionEffect(frame, 'X@1', 'Y', 'M@1');
  assert.equal(inter.significativa, false, `nessuna interazione doveva emergere: ${JSON.stringify(inter)}`);
});

// ── Non linearità monotona ──

test('un legame monotono ma curvo viene segnalato come non lineare', () => {
  const rnd = rng(29);
  const n = 300;
  const X = Array.from({ length: n }, () => Math.abs(gauss(rnd)) + 0.1);
  // Y cresce con X ma con forte curvatura (radice): monotono, non lineare.
  const Y = X.map((v, i) => (i >= 1 ? 3 * Math.sqrt(X[i - 1]) + 0.05 * gauss(rnd) : 1));
  const frame = buildLaggedFrame({ X, Y }, { maxLag: 2 });
  const m = monotoneCheck(frame, 'X@1', 'Y');
  assert.ok(m.monotono.p < 0.001, 'il legame monotono deve essere trovato');
  assert.ok(Math.abs(m.monotono.r) >= Math.abs(m.lineare.r) - 0.02,
    'sui ranghi la relazione curva deve risultare almeno altrettanto forte');
});

// ── Vie indirette ──

test('VIE INDIRETTE: A→B→C, l\'effetto totale include il cammino lungo', () => {
  const edges = [
    { from: 'A', to: 'B', beta: 0.5, lag: 1 },
    { from: 'B', to: 'C', beta: 0.4, lag: 1 },
    { from: 'A', to: 'C', beta: 0.1, lag: 2 },
  ];
  const te = totalEffect(edges, 'A', 'C');
  assert.ok(Math.abs(te.diretto - 0.1) < 1e-6, `diretto atteso 0.1, ottenuto ${te.diretto}`);
  assert.ok(Math.abs(te.indiretto - 0.2) < 1e-6, `indiretto atteso 0.5*0.4=0.2, ottenuto ${te.indiretto}`);
  assert.ok(Math.abs(te.totale - 0.3) < 1e-6);
  assert.equal(te.dominatoDaIndiretto, true, 'qui l\'indiretto vale il doppio del diretto: va segnalato');
});

test('i cicli non mandano in loop il calcolo dei cammini', () => {
  const edges = [
    { from: 'A', to: 'B', beta: 0.5, lag: 1 },
    { from: 'B', to: 'A', beta: 0.5, lag: 1 },
    { from: 'B', to: 'C', beta: 0.5, lag: 1 },
  ];
  const te = totalEffect(edges, 'A', 'C');
  assert.ok(Number.isFinite(te.totale));
  assert.ok(te.cammini.length > 0);
});

test('senza alcun cammino, l\'effetto totale è zero e non si inventa nulla', () => {
  const te = totalEffect([{ from: 'A', to: 'B', beta: 0.5, lag: 1 }], 'X', 'Y');
  assert.equal(te.totale, 0);
  assert.deepEqual(te.cammini, []);
});

// ── Scenari con più cambiamenti insieme ──

test('SCENARIO: due interventi insieme si sommano lungo il grafo', () => {
  const edges = [
    { from: 'Ristoranti', to: 'Spesa', beta: 0.4, lag: 1 },
    { from: 'Spesa', to: 'Risparmio', beta: -0.6, lag: 1 },
    { from: 'Trasporti', to: 'Risparmio', beta: -0.3, lag: 1 },
  ];
  const r = simulateScenario(edges, { Ristoranti: -100, Trasporti: -50 }, { targets: ['Risparmio'] });
  assert.equal(r.length, 1);
  const risp = r[0];
  // Ristoranti → Spesa → Risparmio = 0.4 * -0.6 = -0.24 ; per -100 = +24
  // Trasporti → Risparmio = -0.3 ; per -50 = +15
  assert.ok(Math.abs(risp.effetto - 39) < 1e-6, `atteso 39, ottenuto ${risp.effetto}`);
  assert.equal(risp.contributi.length, 2);
});

test('l\'incertezza cresce con la lunghezza del cammino', () => {
  const corto = [{ from: 'A', to: 'Z', beta: 0.5, lag: 1 }];
  const lungo = [
    { from: 'A', to: 'B', beta: 1, lag: 1 },
    { from: 'B', to: 'C', beta: 1, lag: 1 },
    { from: 'C', to: 'Z', beta: 0.5, lag: 1 },
  ];
  const rc = simulateScenario(corto, { A: 100 }, { targets: ['Z'] })[0];
  const rl = simulateScenario(lungo, { A: 100 }, { targets: ['Z'] })[0];
  const ampiezza = (r) => r.intervallo[1] - r.intervallo[0];
  assert.ok(ampiezza(rl) > ampiezza(rc), 'un effetto a tre passi deve essere dichiarato meno certo di uno diretto');
});

test('quando l\'intervallo contiene lo zero, il risultato NON è dichiarato certo', () => {
  const edges = [
    { from: 'A', to: 'B', beta: 0.2, lag: 1 },
    { from: 'B', to: 'C', beta: 0.2, lag: 1 },
    { from: 'C', to: 'D', beta: 0.2, lag: 1 },
  ];
  const r = simulateScenario(edges, { A: 10 }, { targets: ['D'], maxDepth: 4 })[0];
  if (r) assert.equal(r.certo, false, 'un effetto piccolo a tre passi non può essere venduto come certo');
});

// ── Integrazione con la scoperta della struttura ──

test('INTEGRAZIONE: catena reale A→B→C scoperta e quantificata dai dati grezzi', () => {
  const rnd = rng(37);
  const n = 300;
  const A = []; let a = 0;
  for (let t = 0; t < n; t++) { a = 0.2 * a + gauss(rnd); A.push(a); }
  const B = A.map((_, t) => (t >= 1 ? 0.9 * A[t - 1] + 0.3 * gauss(rnd) : gauss(rnd)));
  const C = B.map((_, t) => (t >= 1 ? 0.9 * B[t - 1] + 0.3 * gauss(rnd) : gauss(rnd)));

  const g = discoverCausalGraph({ A, B, C }, { maxLag: 2, alpha: 0.05 });
  const analisi = analyzeCausalScenario({ A, B, C }, g, { interventi: { A: -1 } });

  assert.ok(analisi.edges.length >= 2, `attesi almeno due legami, trovati ${analisi.edges.length}`);
  assert.match(analisi.riassunto, /legami con effetto misurabile/);
  const suC = analisi.scenari.find((s) => s.target === 'C');
  assert.ok(suC, 'lo scenario deve raggiungere C attraverso B');
  assert.ok(suC.effetto < 0, `ridurre A deve ridurre C: ottenuto ${suC.effetto}`);
});

test('senza legami affidabili, il riassunto lo dice invece di riempire il vuoto', () => {
  const rnd = rng(43);
  const dati = {};
  for (const nome of ['P', 'Q', 'R']) {
    let v = 0;
    dati[nome] = Array.from({ length: 150 }, () => { v = 0.5 * v + gauss(rnd); return v; });
  }
  const g = discoverCausalGraph(dati, { maxLag: 2 });
  const analisi = analyzeCausalScenario(dati, g, { interventi: { P: -1 } });
  assert.equal(analisi.edges.length, 0);
  assert.match(analisi.riassunto, /niente di affidabile da dire/);
});
