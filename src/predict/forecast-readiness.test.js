import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastReadiness } from './forecast-readiness.js';

const expense = amount => ({ type: 'uscita', amount });

test('with no real movements a personal forecast is unavailable', () => {
  assert.deepEqual(forecastReadiness({}), { ready: false, expenseMonths: 0, neededMonths: 3 });
});

test('investment-only and invalid expenses do not pretend to establish spending history', () => {
  assert.deepEqual(forecastReadiness({
    '2026-01': [{ type: 'invest', amount: 200 }],
    '2026-02': [expense(0)],
    '2026-03': [expense(NaN)],
  }), { ready: false, expenseMonths: 0, neededMonths: 3 });
});

test('three separate real expense months unlock a personal forecast', () => {
  assert.deepEqual(forecastReadiness({
    '2026-01': [expense(30), expense(50)],
    '2026-02': [expense(25)],
    '2026-03': [expense(40)],
  }), { ready: true, expenseMonths: 3, neededMonths: 0 });
});
