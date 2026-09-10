import test from 'node:test';
import assert from 'node:assert/strict';
import { onboardingBudget } from './onboarding-priors.js';
test('onboarding never turns income, risk or legacy defaults into a chosen budget', () => {
  for (const value of ['', null, undefined, NaN, Infinity, -5, 0]) {
    assert.equal(onboardingBudget(value, { monthlyBudget: 1500, statedMonthlyIncome: 5000, riskProfile: 'aggressivo' }), 0);
  }
});
test('explicit budgets and previously confirmed budgets are retained', () => {
  assert.equal(onboardingBudget('723.45'), 723.45);
  assert.equal(onboardingBudget('', { monthlyBudgetAt: 1, monthlyBudget: 900 }), 900);
});
