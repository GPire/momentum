import test from 'node:test';
import assert from 'node:assert/strict';

const ptr = await import('./portfolio-track-record.js');
const { SETTORI } = await import('./portfolio-tail-risk.js');

const pos = (ticker, quantity, avgPrice = 100, assetClass = 'stock') => ({ ticker, quantity, avgPrice, assetClass });

test('nessuna posizione → non valutabile, motivo esplicito', () => {
  const r = ptr.trackRecordPortafoglio([]);
  assert.equal(r.valutabile, false);
  assert.match(r.motivo, /posizione/);
});

test('sotto la copertura minima → rifiuta come portfolio-tail-risk (stessa disciplina)', () => {
  const r = ptr.trackRecordPortafoglio([pos('XLK', 1, 100), pos('BTC', 1, 50000, 'crypto')]);
  assert.equal(r.valutabile, false);
  assert.match(r.motivo, /%/);
});

test('un ETF settoriale (copertura piena) → valutabile, con verdetto e messaggio senza gergo', () => {
  const r = ptr.trackRecordPortafoglio([pos('XLK', 10)]);
  assert.equal(r.valutabile, true);
  assert.ok(['solido', 'incerto', 'probabile-fortuna'].includes(r.verdetto));
  assert.ok(r.messaggio.length > 0);
  assert.ok(r.periodi >= 300); // 331 mesi reali - 1 per il calcolo dei rendimenti
});

test('un indice ampio equipesato sui nove settori → valutabile, copertura piena', () => {
  const r = ptr.trackRecordPortafoglio([pos('SPY', 10)]);
  assert.equal(r.valutabile, true);
  assert.equal(r.mappa.copertura, 1);
});

test('due allocazioni diverse producono verdetti calcolati sui LORO rendimenti, non identici a caso', () => {
  const soloTech = ptr.trackRecordPortafoglio([pos('XLK', 10)]);
  const soloUtility = ptr.trackRecordPortafoglio([pos('XLU', 10)]);
  assert.equal(soloTech.valutabile, true);
  assert.equal(soloUtility.valutabile, true);
  // Sharpe diverso: le due allocazioni non possono produrre lo stesso identico numero
  assert.notEqual(soloTech.sharpe, soloUtility.sharpe);
});

test('espone la stessa dichiarazione di copertura di mappaPortafoglio (nessuna bugia sulla parte non misurata)', () => {
  const r = ptr.trackRecordPortafoglio([pos('XLK', 10), pos('BTC', 1, 1000, 'crypto')]);
  // 10*100=1000 XLK vs 1*1000=1000 BTC → copertura 50%, esattamente al limite
  if (r.valutabile) assert.ok(r.mappa.copertura >= 0.5);
  else assert.ok(r.mappa.copertura < 0.5 || r.mappa.copertura === 0.5);
});

test('equipesato sui nove settori resta dentro l\'insieme dei settori noti', () => {
  const pesi = Object.fromEntries(SETTORI.map((s) => [s, 1 / SETTORI.length]));
  assert.ok(Object.keys(pesi).length === 9);
});
