import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentAgenda, paymentKey, validPaymentDate, validatePaymentDeclaration, buildPaymentAgenda } from './payment-agenda.js';
import { subscriptionSummary, detectRecurring } from './subscriptions.js';

const series = (days, amounts = days.map(() => 12)) => ({ all: days.map((day, i) => ({ id: i, date: new Date(Date.UTC(2026, 0, day)).toISOString(), type: 'uscita', description: 'Streaming', category: 'abbonamenti', amount: amounts[i] })) });
test('weekly and fortnightly require three regular charges with stable amounts', () => {
  assert.equal(detectRecurring(series([1, 8])).length, 0);
  assert.equal(detectRecurring(series([1, 8, 15]))[0].cadenza, 'settimanale');
  assert.equal(detectRecurring(series([1, 15, 29]))[0].cadenza, 'quindicinale');
  assert.equal(detectRecurring(series([1, 8, 15], [12, 20, 9])).length, 0);
  assert.equal(subscriptionSummary(series([1, 8, 15])).monthlyTotal, 52);
});
test('invalid transaction data cannot crash recurrence detection', () => {
  assert.equal(detectRecurring({ all: [null, { type: 'uscita', amount: 10, date: 'bad' }] }).length, 0);
});
test('calendar validation rejects rollover dates', () => {
  assert.equal(validPaymentDate('2026-02-30'), false);
  assert.equal(validPaymentDate('2028-02-29'), true);
});
test('date correction changes agenda only, retaining the source history', () => {
  const sub = { name: 'Streaming', category: 'abbonamenti', amount: 12, nextDate: '2026-02-01' };
  const copy = structuredClone(sub);
  const result = paymentAgenda({ subscriptions: [sub] }, [], { [paymentKey(sub)]: { date: '2026-02-05' } }, '2026-01-01');
  assert.equal(result[0].date, '2026-02-05');
  assert.equal(result[0].source, 'declared');
  assert.deepEqual(sub, copy);
});
test('declared installments retain month-end anchor and stop at chosen count', () => {
  const plan = { key: 'manual:1', name: 'Computer', date: '2026-01-31', amount: 100, kind: 'installment', months: 3 };
  const result = paymentAgenda({}, [plan]);
  assert.deepEqual(result.map(p => p.date), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.ok(result.every(p => p.parentKey === plan.key));
  assert.equal(validatePaymentDeclaration({ ...plan, months: 500 }), false);
});
test('free trial with unknown price remains a declaration, not a paid expense', () => {
  const item = { key: 'manual:trial', name: 'Trial', date: '2026-02-01', amount: null, kind: 'trial' };
  const result = buildPaymentAgenda({ transactions: {}, paymentDeclarations: [item] });
  assert.equal(result[0].amount, null);
  assert.equal(result[0].source, 'declared');
});
test('known BNPL charges do not also become endless subscriptions', () => {
  const tx = series([1, 15]);
  tx.all.forEach(t => { t.description = 'KLARNA*ZARA'; t.amount = 45; });
  const result = buildPaymentAgenda({ transactions: tx }, new Date('2026-01-16'));
  assert.ok(result.length > 0);
  assert.ok(result.every(p => p.kind === 'installment'));
});
test('recurring schedule respects start, end and month-end dates', () => {
  const plan = { key: 'manual:rent', name: 'Rent', amount: 80, kind: 'recurring', cadence: 'monthly', startDate: '2026-01-01', date: '2026-01-31', endDate: '2026-03-31' };
  assert.equal(validatePaymentDeclaration(plan), true);
  assert.deepEqual(paymentAgenda({}, [plan], {}, '2026-01-01').map(p => p.date), ['2026-01-31','2026-02-28','2026-03-31']);
  assert.equal(validatePaymentDeclaration({ ...plan, endDate: '2026-01-20' }), false);
  assert.equal(validatePaymentDeclaration({ ...plan, startDate: '2026-02-01' }), false);
  assert.equal(validatePaymentDeclaration({ ...plan, cadence: 'bad' }), false);
});
test('weekly schedules stay active years after their initial date', () => {
  const plan = { key:'manual:weekly', name:'Course', amount:10, kind:'recurring', cadence:'weekly', date:'2020-01-06' };
  const rows = paymentAgenda({}, [plan], {}, '2026-01-05');
  assert.equal(rows.length, 12);
  assert.equal(rows[0].date, '2026-01-05');
  assert.equal(rows[1].date, '2026-01-12');
});
test('installments always stay monthly after switching from another cadence', () => {
  const rows = paymentAgenda({}, [{ key:'manual:rate', name:'Phone', amount:20, kind:'installment', cadence:'yearly', date:'2026-01-31', months:2 }]);
  assert.deepEqual(rows.map(p => p.date), ['2026-01-31','2026-02-28']);
});
test('user end date suppresses predictions after a contract ends', () => {
  const sub = { name:'Streaming', amount:12, nextDate:'2026-04-01' };
  assert.equal(paymentAgenda({ subscriptions:[sub] }, [], { [paymentKey(sub)]:{ endDate:'2026-03-31' } }, '2026-01-01').length, 0);
});
