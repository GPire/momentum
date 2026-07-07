import { test } from 'node:test';
import assert from 'node:assert/strict';
import { investableSurplus, allocateInvestment } from './bridge.js';

test('flusso negativo → non si investe (difende il budget)', () => {
  const r = investableSurplus({ netMonthlyFlow: -50, avgMonthlyExpense: 1000, currentEmergencyFund: 10000 });
  assert.equal(r.investable, 0);
  assert.equal(r.reason, 'flow-negative');
});

test('fondo d\'emergenza non pieno → l\'avanzo va lì, non in mercato', () => {
  const r = investableSurplus({ netMonthlyFlow: 500, avgMonthlyExpense: 1000, currentEmergencyFund: 2000, emergencyMonths: 6 });
  assert.equal(r.investable, 0);
  assert.equal(r.reason, 'building-emergency');
  assert.equal(r.toEmergencyFund, 500); // tutto il flusso verso il fondo (target 6000)
});

test('fondo pieno → investe una quota dell\'avanzo', () => {
  const r = investableSurplus({ netMonthlyFlow: 1000, avgMonthlyExpense: 1000, currentEmergencyFund: 6000, investFraction: 0.7 });
  assert.equal(r.reason, 'ok');
  assert.equal(r.investable, 700);
});

test('allocazione pesata per convinzione, solo verdetti "compra"', () => {
  const assets = [
    { ticker: 'AAA', verdict: 'compra', score: 0.8 },
    { ticker: 'BBB', verdict: 'compra', score: 0.4 },
    { ticker: 'CCC', verdict: 'evita', score: 0.9 },
  ];
  const r = allocateInvestment(1200, assets);
  assert.equal(r.allocations.length, 2, 'CCC (evita) escluso');
  const aaa = r.allocations.find(a => a.ticker === 'AAA');
  assert.equal(aaa.amount, 800); // 0.8/1.2 * 1200
  assert.equal(r.invested, 1200);
});

test('nessun candidato o importo nullo → nessuna allocazione', () => {
  assert.equal(allocateInvestment(0, [{ ticker: 'X', verdict: 'compra', score: 1 }]).invested, 0);
  assert.equal(allocateInvestment(500, [{ ticker: 'X', verdict: 'evita', score: 1 }]).allocations.length, 0);
});
