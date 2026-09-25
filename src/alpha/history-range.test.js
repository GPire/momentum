import test from 'node:test';
import assert from 'node:assert/strict';
import { historyWithinYears, historyPlot, nearestHistoryIndex, formatHistoryPrice, historyCoverage } from './history-range.js';

const series = [
  { date: '2020-01-01', price: 10 },
  { date: '2020-02-01', price: 20 },
  { date: '2025-07-01', price: 30 },
  { date: '2026-01-01', price: 40 },
];

test('periodi di uno e cinque anni usano date reali, non il numero dei punti', () => {
  assert.deepEqual(historyWithinYears(series, 1).map(p => p.date), ['2025-07-01', '2026-01-01']);
  assert.deepEqual(historyWithinYears(series, 5).map(p => p.date), ['2025-07-01', '2026-01-01']);
});

test('grafico distribuisce i punti secondo il tempo e interrompe la linea nei vuoti', () => {
  const plot = historyPlot(series);
  assert.ok(plot.points[1].x - plot.points[0].x < plot.points[2].x - plot.points[1].x);
  assert.equal(plot.points[2].gap, true);
  assert.equal((plot.path.match(/M/g) || []).length, 3);
  assert.equal(nearestHistoryIndex(series, 0.75), 2);
});

test('dati non validi non generano un grafico o un punto inventato', () => {
  assert.equal(historyPlot([{ date: '2026-01-01', price: 1 }, { date: '2026-02-30', price: 2 }]).path, '');
  assert.equal(nearestHistoryIndex([], 0.5), -1);
});

test('i prezzi molto piccoli non vengono arrotondati a zero', () => {
  assert.equal(formatHistoryPrice(0.00000042, 'it-IT'), '0,00000042');
  assert.notEqual(formatHistoryPrice(0.00000000042, 'it-IT'), '0,00');
  assert.equal(formatHistoryPrice(120.5, 'it-IT'), '120,50');
});

test('la copertura segnala una fonte non aggiornata senza inventare punti recenti', () => {
  assert.deepEqual(historyCoverage(series, new Date('2026-09-25')), {
    first: '2020-01-01', last: '2026-01-01', ageDays: 267, stale: true, gaps: 2,
  });
  assert.equal(historyCoverage([{ date: '2026-09-01', price: 1 }], new Date('2026-09-25')).stale, false);
});

test('un mese senza dato lascia una discontinuità nel grafico', () => {
  const monthly = [
    { date: '2026-01-01', price: 1 }, { date: '2026-02-01', price: 2 },
    { date: '2026-04-01', price: 3 }, { date: '2026-05-01', price: 4 },
  ];
  assert.equal(historyPlot(monthly).points[2].gap, true);
  assert.equal(historyCoverage(monthly, new Date('2026-05-20')).gaps, 1);
});

test('due soli punti separati da anni non vengono uniti in una linea continua', () => {
  const sparse = [{ date: '2016-01-01', price: 1 }, { date: '2026-01-01', price: 2 }];
  assert.equal(historyPlot(sparse).points[1].gap, true);
});
