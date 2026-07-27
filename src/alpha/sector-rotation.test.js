import test from 'node:test';
import assert from 'node:assert/strict';
import { sectorRanking } from './sector-rotation.js';

const fakeMeasured = {
  generatedAt: '2026-07-27T00:00:00Z',
  sectors: {
    XLK: { label: 'Technology (XLK)', sampleMonths: 320, fetchedAt: '2026-07-27T00:00:00Z', buyHold: { mu: 0.15, sigma: 0.22, sharpe: 0.68, maxDrawdown: 0.5 }, regime: { regime: 'risk-on', explanation: 'x' } },
    XLU: { label: 'Utilities (XLU)', sampleMonths: 320, fetchedAt: '2026-07-27T00:00:00Z', buyHold: { mu: 0.07, sigma: 0.13, sharpe: 0.54, maxDrawdown: 0.3 }, regime: { regime: 'neutral', explanation: 'y' } },
    XLE: { label: 'Energy (XLE)', sampleMonths: 320, fetchedAt: '2026-07-27T00:00:00Z', buyHold: { mu: 0.06, sigma: 0.30, sharpe: 0.20, maxDrawdown: 0.6 }, regime: { regime: 'risk-off', explanation: 'z' } },
  },
};

test('sectorRanking: ordina per Sharpe reale, non per rendimento nudo', () => {
  const { rows } = sectorRanking(fakeMeasured);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(r => r.symbol), ['XLK', 'XLU', 'XLE']); // Sharpe 0.68 > 0.54 > 0.20
});

test('sectorRanking: dichiara asOf e anni coperti, mai finti', () => {
  const { asOf, yearsCovered } = sectorRanking(fakeMeasured);
  assert.equal(asOf, '2026-07-27T00:00:00Z');
  assert.equal(yearsCovered, Math.round(320 / 12));
});

test('sectorRanking: ogni riga porta regime e drawdown, mai un consiglio di acquisto', () => {
  const { rows } = sectorRanking(fakeMeasured);
  for (const r of rows) {
    assert.ok('regime' in r);
    assert.ok('maxDrawdown' in r);
    assert.ok(!('recommendation' in r) && !('action' in r));
  }
});

test('sectorRanking: senza dati settoriali → lista vuota, mai inventata', () => {
  assert.deepEqual(sectorRanking(null), { rows: [], asOf: null, yearsCovered: null });
  assert.deepEqual(sectorRanking({}), { rows: [], asOf: null, yearsCovered: null });
  assert.deepEqual(sectorRanking({ sectors: {} }), { rows: [], asOf: null, yearsCovered: null });
});
