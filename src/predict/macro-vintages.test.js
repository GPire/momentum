import test from 'node:test';
import assert from 'node:assert/strict';
import { macroVintageSnapshot, parseFredVintages } from './macro-vintages.js';
import { alignMacroToMonths, alignMacroToWeeks } from './macro-context.js';
const rows = [
  { date: '2020-01-01', availableAt: '2020-02-10', close: 10, source: 'fixture' },
  { date: '2020-01-01', availableAt: '2020-04-10', close: 15, source: 'fixture' },
  { date: '2020-02-01', availableAt: '2020-03-10', close: 20, source: 'fixture' },
];
test('releases and revisions never travel backwards into a historical snapshot', () => {
  assert.deepEqual(macroVintageSnapshot(rows, '2020-02-01'), []);
  assert.equal(macroVintageSnapshot(rows, '2020-02-20')[0].close, 10);
  assert.equal(macroVintageSnapshot(rows, '2020-04-20')[0].close, 15);
  assert.equal(macroVintageSnapshot(rows, '2020-04-20').at(-1).close, 20);
});
test('missing timing, conflicts and withdrawals cannot become a known numeric value', () => {
  assert.deepEqual(macroVintageSnapshot([{date:'2020-01-01', close:9}], '2020-05-01'), []);
  const conflict = [...rows, {...rows[1], close: 99}];
  assert.equal(macroVintageSnapshot(conflict, '2020-05-01')[0].close, null);
  assert.equal(macroVintageSnapshot([...rows, {...rows[1], close:null}], '2020-05-01')[0].close, null);
});
test('FRED real-time intervals are inclusive and missing observations stay missing', () => {
  const data = parseFredVintages({observations:[{date:'2020-01-01',realtime_start:'2020-02-10',realtime_end:'2020-03-01',value:'-0.1'},
    {date:'2020-02-01',realtime_start:'2020-03-10',realtime_end:'9999-12-31',value:'.'}]});
  assert.equal(macroVintageSnapshot(data,'2020-03-01')[0].close,-0.1);
  assert.deepEqual(macroVintageSnapshot(data,'2020-03-02'),[]);
  assert.equal(data[1].close,null);
});
test('monthly model alignment honours release timing and keeps newest observation after an old revision', () => {
  const r = alignMacroToMonths(rows,{mesi:4,meseFinale:'2020-04',timing:'release'});
  assert.deepEqual(r.values,[null,10,20,20]);
  assert.equal(r.knowledgeBasis,'release');
});

test('weekly model automatically honours availability and excludes undated releases in mixed inputs', () => {
  const input = [
    { date:'2020-03-01', availableAt:'2020-04-27', close:0, source:'fixture' },
    { date:'2020-04-01', availableAt:'2020-05-05', close:-0.1, source:'fixture' },
    { date:'2020-05-01', close:99 },
  ];
  const r = alignMacroToWeeks(input, {weeks:2, referenceDate:new Date(2020,4,11,12)});
  assert.deepEqual(r.values,[0,-0.1]);
  assert.equal(r.knowledgeBasis,'release');
  assert.equal(r.copertura,1);
});
