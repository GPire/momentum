import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentileRank, valueScore, growthScore, momentumScore, riskScore, qualityScore } from './factors.js';
import { piotroskiFScore } from './quality-scores.js';

test('percentileRank: soglie dinamiche, neutro senza dati', () => {
  assert.equal(percentileRank(5, [1, 2, 3, 4, 10], true), 0.8);
  assert.equal(percentileRank(5, [1, 2, 3, 4, 10], false), 0.2); // basso è meglio
  assert.equal(percentileRank(5, [], true), 0.5); // neutro
});

test('valueScore: un asset a sconto e solido batte uno caro e indebitato', () => {
  const peers = { pe: [10, 20, 30], pb: [1, 2, 3], roe: [5, 15, 25], debtEquity: [0.2, 0.5, 1.0], fcfYield: [1, 3, 6] };
  const cheap = valueScore({ pe: 9, pb: 0.9, roe: 26, debtEquity: 0.1, fcfYield: 7 }, peers);
  const pricey = valueScore({ pe: 31, pb: 3.5, roe: 4, debtEquity: 1.2, fcfYield: 0.5 }, peers);
  assert.ok(cheap.score > pricey.score);
  assert.ok(cheap.score > 0.8 && pricey.score < 0.2);
});

test('growthScore premia crescita alta a PEG basso', () => {
  const peers = { revCagr: [5, 10, 20], epsCagr: [5, 12, 25], peg: [0.8, 1.5, 3] };
  const g = growthScore({ revCagr: 22, epsCagr: 26, peg: 0.7, marginTrend: 0.1 }, peers);
  assert.ok(g.score > 0.7);
});

test('momentumScore: trend rialzista netto → score alto; dati scarsi → neutro', () => {
  const up = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
  assert.ok(momentumScore(up).score > 0.6);
  assert.equal(momentumScore([1, 2, 3]).score, 0.5);
});

test('riskScore: serie volatile con drawdown → score più basso di una stabile', () => {
  const stable = Array.from({ length: 30 }, () => 0.005);
  const wild = Array.from({ length: 30 }, (_, i) => (i % 2 ? -0.08 : 0.09));
  assert.ok(riskScore(stable).score > riskScore(wild).score);
  assert.ok(riskScore([0.01]).score === 0.5); // dati insufficienti → neutro
});

test('ogni fattore porta la spiegazione (parts), mai numero orfano', () => {
  for (const r of [valueScore({}, {}), growthScore({}, {}), momentumScore([]), riskScore([])]) {
    assert.ok(Array.isArray(r.parts) && r.parts.length > 0);
    assert.ok(typeof r.score === 'number');
  }
});

// ── qualityScore (Cantiere E3): riusa il vero F-Score di Piotroski, non un proxy ──

test('qualityScore: un\'azienda sana che migliora su tutti i fronti → score massimo (8/8)', () => {
  const t1 = { ricavi: 1000, costoVenduto: 650, utileNetto: 80, attivo: 2000, attivoCorrente: 500, passivoCorrente: 400, debitoLungo: 600, flussoCassaOperativo: 100 };
  const t = { ricavi: 1100, costoVenduto: 693, utileNetto: 110, attivo: 2100, attivoCorrente: 600, passivoCorrente: 380, debitoLungo: 550, flussoCassaOperativo: 140 };
  const piotroski = piotroskiFScore(t, t1);
  const r = qualityScore(piotroski);
  assert.equal(r.score, 1);
  assert.equal(r.puntiGrezzi, '8/8');
  assert.equal(r.parts.length, 8);
});

test('qualityScore: senza un Piotroski valido, null dichiarato — mai uno score inventato', () => {
  const r = qualityScore({ valido: false, motivo: 'dati mancanti: roaT' });
  assert.equal(r.score, null);
  assert.equal(r.factor, 'quality');
  assert.match(r.motivo, /dati mancanti/);
  assert.deepEqual(qualityScore(null).parts, []);
});

test('ogni fattore, quality incluso, porta la spiegazione (parts) quando lo score esiste', () => {
  const t1 = { ricavi: 1000, costoVenduto: 650, utileNetto: 80, attivo: 2000, attivoCorrente: 500, passivoCorrente: 400, debitoLungo: 600, flussoCassaOperativo: 100 };
  const t = { ricavi: 1100, costoVenduto: 693, utileNetto: 110, attivo: 2100, attivoCorrente: 600, passivoCorrente: 380, debitoLungo: 550, flussoCassaOperativo: 140 };
  const r = qualityScore(piotroskiFScore(t, t1));
  assert.ok(Array.isArray(r.parts) && r.parts.length > 0);
  assert.ok(typeof r.score === 'number');
});
