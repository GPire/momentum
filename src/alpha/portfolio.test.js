import { test } from 'node:test';
import assert from 'node:assert/strict';
import { covarianceMatrix, riskParityWeights, portfolioReturns, portfolioStats, currentWeights, rebalanceSuggestions, equalRiskContributionWeights, riskContributions } from './portfolio.js';

// Correlazione di Pearson misurata direttamente sui dati del test — non ci
// si fida di un generatore casuale "dovrebbe dare correlazione X": si
// costruisce la serie e si VERIFICA la correlazione ottenuta prima di
// usarla come premessa del test.
function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  const ma = a.slice(0, n).reduce((s, x) => s + x, 0) / n, mb = b.slice(0, n).reduce((s, x) => s + x, 0) / n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; cov += da * db; va += da * da; vb += db * db; }
  return cov / Math.sqrt(va * vb);
}

test('risk-parity dà più peso all\'asset meno volatile', () => {
  const calm = Array.from({ length: 50 }, (_, i) => (i % 2 ? 0.002 : -0.002));
  const wild = Array.from({ length: 50 }, (_, i) => (i % 2 ? 0.05 : -0.05));
  const w = riskParityWeights({ CALM: calm, WILD: wild });
  assert.ok(w.CALM > w.WILD);
  assert.ok(Math.abs(w.CALM + w.WILD - 1) < 1e-6);
});

test('covarianza: la diagonale è la varianza di ciascun asset', () => {
  const a = [0.01, -0.01, 0.02, -0.02, 0.01];
  const cov = covarianceMatrix({ A: a, B: a });
  assert.ok(cov.A.A > 0);
  assert.ok(Math.abs(cov.A.A - cov.A.B) < 1e-9); // A e B identici → cov = var
});

test('portfolioReturns combina i pesi; portfolioStats misura Sharpe/drawdown', () => {
  const up = Array.from({ length: 60 }, () => 0.004);
  const flat = Array.from({ length: 60 }, () => 0.0);
  const pr = portfolioReturns({ UP: 0.5, FLAT: 0.5 }, { UP: up, FLAT: flat });
  assert.ok(Math.abs(pr[0] - 0.002) < 1e-9);
  const stats = portfolioStats(pr);
  assert.ok(stats.annReturn > 0);
  assert.equal(stats.maxDrawdown, 0); // serie monotona crescente
});

test('una serie con crolli ha maxDrawdown > 0', () => {
  const r = [0.05, 0.05, -0.2, 0.03, -0.15, 0.04];
  assert.ok(portfolioStats(r).maxDrawdown > 0);
});

test('currentWeights: pesi reali dal valore di mercato (quantità × prezzo), somma 1', () => {
  const positions = [{ ticker: 'AAPL', quantity: 10 }, { ticker: 'MSFT', quantity: 5 }];
  const w = currentWeights(positions, { AAPL: 100, MSFT: 200 }); // 1000 vs 1000
  assert.equal(w.AAPL, 0.5);
  assert.equal(w.MSFT, 0.5);
});

test('currentWeights: posizione senza prezzo noto o quantità non finita viene esclusa, mai un peso inventato', () => {
  const positions = [{ ticker: 'AAPL', quantity: 10 }, { ticker: 'GHOST', quantity: 5 }];
  const w = currentWeights(positions, { AAPL: 100 }); // GHOST senza prezzo
  assert.equal(w.AAPL, 1);
  assert.equal(w.GHOST, undefined);
});

test('currentWeights: due posizioni sullo stesso ticker si sommano (mai due voci separate per lo stesso titolo)', () => {
  const positions = [{ ticker: 'AAPL', quantity: 4 }, { ticker: 'AAPL', quantity: 6 }];
  const w = currentWeights(positions, { AAPL: 50 });
  assert.equal(w.AAPL, 1);
});

test('currentWeights: nessuna posizione valutabile → oggetto vuoto, mai un crash o pesi a somma diversa da 1', () => {
  assert.deepEqual(currentWeights([], {}), {});
  assert.deepEqual(currentWeights([{ ticker: 'X', quantity: 1 }], {}), {});
});

test('rebalanceSuggestions: uno scostamento sopra soglia genera un suggerimento con la direzione corretta', () => {
  const current = { AAPL: 0.7, MSFT: 0.3 };
  const target = { AAPL: 0.5, MSFT: 0.5 };
  const out = rebalanceSuggestions(current, target);
  assert.equal(out.length, 2);
  const aapl = out.find(o => o.ticker === 'AAPL');
  assert.equal(aapl.action, 'reduce'); // pesa più del target → ridurre
  assert.equal(aapl.deltaPts, 20);
  const msft = out.find(o => o.ticker === 'MSFT');
  assert.equal(msft.action, 'increase'); // pesa meno del target → aumentare
});

test('rebalanceSuggestions: uno scostamento minimo (rumore quotidiano dei prezzi) NON genera un segnale', () => {
  const current = { AAPL: 0.52, MSFT: 0.48 };
  const target = { AAPL: 0.5, MSFT: 0.5 };
  assert.deepEqual(rebalanceSuggestions(current, target), []);
});

test('rebalanceSuggestions: un ticker presente solo nel target (posizione mai aperta) genera comunque "increase" da zero', () => {
  const out = rebalanceSuggestions({}, { AAPL: 1 });
  assert.equal(out.length, 1);
  assert.equal(out[0].action, 'increase');
  assert.equal(out[0].currentPct, 0);
});

test('rebalanceSuggestions: ordinato per gravità, scostamento più grande prima', () => {
  const out = rebalanceSuggestions({ A: 0.9, B: 0.1 }, { A: 0.5, B: 0.5 });
  assert.equal(out[0].ticker, 'A'); // 40 punti di scostamento, il più grande
});

// ── EQUAL RISK CONTRIBUTION — il caso da manuale che l'inverse-vol non vede ──
// A e B: stessa volatilità, PERFETTAMENTE correlati (B = A, ρ=1) — si
// comportano come un unico asset raddoppiato. C: stessa identica volatilità
// di A/B ma COMPLETAMENTE scorrelato (costruzione ortogonale esatta, non
// stimata). L'inverse-vol (guarda solo la volatilità isolata di ciascuno)
// darebbe 1/3 a testa: non vede che A e B sono la stessa scommessa ripetuta
// due volte. Valori attesi ricavati a mano risolvendo RC_A=RC_B=RC_C con
// var_A=var_B=var_C=sigma^2, cov_AB=sigma^2, cov_AC=cov_BC=0: per simmetria
// w_A=w_B=w e RC_A=2*sigma^2*w^2, RC_C=sigma^2*w_C^2 => w_C=w*sqrt(2);
// normalizzando 2w+w*sqrt(2)=1 => w=1/(2+sqrt(2))~=0.292893,
// w_C=sqrt(2)/(2+sqrt(2))~=0.414214 — C pesa piu' di A/B (diversificazione
// vera premiata), ma NON il doppio come una prima stima approssimata
// suggeriva: verificato qui contro riskContributions, non assunto a mano.
const pattern = (signs) => signs.map(s => 0.02 * s);
const repeat = (arr, times) => Array.from({ length: arr.length * times }, (_, i) => arr[i % arr.length]);
const baseA = repeat(pattern([1, -1, 1, -1]), 10);
const baseC = repeat(pattern([1, 1, -1, -1]), 10); // ortogonale esatto ad A (dot product 0 su ogni blocco di 4)

test('fixture: verifica la premessa prima di usarla — A/B correlazione ~1, A/C correlazione ~0', () => {
  assert.ok(Math.abs(pearson(baseA, baseA) - 1) < 1e-9); // B = A
  assert.ok(Math.abs(pearson(baseA, baseC)) < 1e-9);
});

test('equalRiskContributionWeights: due asset ridondanti (ρ=1) contro uno diversificante, stessa volatilità → C pesa più di A/B (soluzione esatta 1/(2+√2)), l\'inverse-vol darebbe 1/3 a testa a tutti e tre ignorando la correlazione', () => {
  const returnsByAsset = { A: baseA, B: baseA, C: baseC };
  const w = riskParityWeights(returnsByAsset);
  const wAtteso = 1 / (2 + Math.sqrt(2));       // ~0.292893
  const wCAtteso = Math.sqrt(2) / (2 + Math.sqrt(2)); // ~0.414214
  assert.ok(Math.abs(w.A - wAtteso) < 0.005, `w.A atteso ~${wAtteso.toFixed(4)}, ottenuto ${w.A}`);
  assert.ok(Math.abs(w.B - wAtteso) < 0.005, `w.B atteso ~${wAtteso.toFixed(4)}, ottenuto ${w.B}`);
  assert.ok(Math.abs(w.C - wCAtteso) < 0.005, `w.C atteso ~${wCAtteso.toFixed(4)} (più di A/B), ottenuto ${w.C}`);
  assert.ok(w.C > w.A && w.C > w.B, 'C, indipendente, deve pesare più di A o B, che sono ridondanti fra loro');
  assert.ok(Math.abs(w.A + w.B + w.C - 1) < 1e-6);
});

test('riskContributions: ai pesi trovati sopra, ogni asset contribuisce alla STESSA quota di rischio (la promessa della parità, verificata non assunta)', () => {
  const returnsByAsset = { A: baseA, B: baseA, C: baseC };
  const cov = covarianceMatrix(returnsByAsset);
  const w = equalRiskContributionWeights(cov);
  const rc = riskContributions(w, cov);
  const values = Object.values(rc);
  const target = 1 / 3;
  for (const v of values) assert.ok(Math.abs(v - target) < 0.01, `contributo atteso ~${target}, ottenuto ${v}`);
});

test('equalRiskContributionWeights: un solo asset → peso 1 (caso degenere, nessuna divisione per zero)', () => {
  assert.deepEqual(equalRiskContributionWeights({ A: { A: 0.01 } }), { A: 1 });
});

test('riskParityWeights: covarianza degenere (varianza zero, serie costante) ripiega su inverse-vol senza crash', () => {
  const costante = Array(20).fill(0);
  const normale = repeat(pattern([1, -1]), 10);
  assert.doesNotThrow(() => riskParityWeights({ FLAT: costante, VOLATILE: normale }));
});
