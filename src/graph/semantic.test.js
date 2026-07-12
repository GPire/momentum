import test from 'node:test';
import assert from 'node:assert/strict';
const { RULES, recall, applicableRules, ground, getRule } = await import('./semantic.js');

test('recall: trova regole per argomento, ordinate per priorità', () => {
  const r = recall('investire');
  assert.ok(r.length >= 3);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].priority >= r[i].priority);
});

test('applicableRules: fondo emergenza prima di investire se manca', () => {
  const rules = applicableRules({ wantsToInvest: true, emergencyMonths: 1 });
  assert.ok(rules.some(r => r.id === 'emergency-fund-first'));
});

test('applicableRules: debito ad alto interesse ha priorità e appare', () => {
  const rules = applicableRules({ wantsToInvest: true, hasHighInterestDebt: true, emergencyMonths: 6 });
  assert.equal(rules[0].id, 'high-interest-debt-first'); // priorità 92, la più alta applicabile
});

test('ground: cita la regola più fondante con la fonte, no disclaimer come prima', () => {
  const g = ground({ wantsToInvest: true, emergencyMonths: 0 });
  assert.ok(g && /Fonte:/.test(g.cite));
  assert.notEqual(g.rule.id, 'not-financial-advice');
});

test('applicableRules: forfettario solo se freelance', () => {
  assert.ok(!applicableRules({ isFreelance: false }).some(r => r.id === 'forfettario-set-aside'));
  assert.ok(applicableRules({ isFreelance: true }).some(r => r.id === 'forfettario-set-aside'));
});

test('getRule + disclaimer sempre applicabile', () => {
  assert.equal(getRule('time-in-market').id, 'time-in-market');
  assert.ok(applicableRules({}).some(r => r.id === 'not-financial-advice'));
});
