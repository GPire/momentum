'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeNetReturn, ALIQUOTA_CAPITAL_GAIN, ALIQUOTA_CAPITAL_GAIN_TITOLI_STATO, BOLLO_TITOLI_ALIQUOTA_ANNUA, BOLLO_TITOLI_SOGLIA_ESENZIONE } from './net-return.js';

test('aliquote verificate: 26% azioni/ETF/crypto, 12,5% titoli di Stato, bollo 0,2%, soglia 5000€', () => {
  assert.equal(ALIQUOTA_CAPITAL_GAIN, 0.26);
  assert.equal(ALIQUOTA_CAPITAL_GAIN_TITOLI_STATO, 0.125);
  assert.equal(BOLLO_TITOLI_ALIQUOTA_ANNUA, 0.002);
  assert.equal(BOLLO_TITOLI_SOGLIA_ESENZIONE, 5000);
});

test('computeNetReturn: plusvalenza su azione tassata al 26%, minusvalenza mai tassata', () => {
  const rows = [
    { ticker: 'AAPL', assetClass: 'stock', pl: 1000, cost: 5000 },
    { ticker: 'TSLA', assetClass: 'stock', pl: -500, cost: 2000 },
  ];
  const r = computeNetReturn(rows, 10000);
  const aapl = r.rows.find(x => x.ticker === 'AAPL');
  const tsla = r.rows.find(x => x.ticker === 'TSLA');
  assert.equal(aapl.impostaCapitalGain, 260); // 1000 * 0.26
  assert.equal(aapl.netPl, 740);
  assert.equal(tsla.impostaCapitalGain, 0, 'una perdita non paga mai imposta');
  assert.equal(tsla.netPl, -500);
});

test('computeNetReturn: bond usa l\'aliquota agevolata 12,5%, non il 26%', () => {
  const rows = [{ ticker: 'BTP', assetClass: 'bond', pl: 800, cost: 10000 }];
  const r = computeNetReturn(rows, 10800);
  assert.equal(r.rows[0].aliquotaCapitalGain, 0.125);
  assert.equal(r.rows[0].impostaCapitalGain, 100); // 800 * 0.125
});

test('computeNetReturn: bollo titoli 0,2% annuo sul totale, sopra la soglia di 5.000€', () => {
  const rows = [{ ticker: 'X', assetClass: 'stock', pl: 0, cost: 10000 }];
  const r = computeNetReturn(rows, 10000);
  assert.equal(r.bolloTitoli, 20); // 10000 * 0.002
  assert.equal(r.bolloEsente, false);
});

test('computeNetReturn: sotto i 5.000€ il bollo è esente, mai addebitato', () => {
  const rows = [{ ticker: 'X', assetClass: 'stock', pl: 0, cost: 3000 }];
  const r = computeNetReturn(rows, 3000);
  assert.equal(r.bolloTitoli, 0);
  assert.equal(r.bolloEsente, true);
});

test('computeNetReturn: il totale netto sottrae imposta E bollo dal lordo, mai solo uno dei due', () => {
  const rows = [{ ticker: 'X', assetClass: 'stock', pl: 1000, cost: 9000 }];
  const r = computeNetReturn(rows, 10000);
  // lordo 1000, imposta 260, bollo 20 -> netto 720
  assert.equal(r.totalPlLordo, 1000);
  assert.equal(r.totaleImpostaCapitalGain, 260);
  assert.equal(r.bolloTitoli, 20);
  assert.equal(r.netTotalPl, 720);
});

test('computeNetReturn: portafoglio vuoto -> tutto a zero, nessun crash', () => {
  const r = computeNetReturn([], 0);
  assert.equal(r.netTotalPl, 0);
  assert.equal(r.bolloTitoli, 0);
  assert.deepEqual(r.rows, []);
});

test('computeNetReturn: dichiara sempre il limite sulle minusvalenze non compensate (onestà)', () => {
  const r = computeNetReturn([{ ticker: 'X', assetClass: 'stock', pl: 100, cost: 1000 }], 1000);
  assert.match(r.disclaimer, /zainetto fiscale/);
});
