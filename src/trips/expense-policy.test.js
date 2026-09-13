import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectTripArchive } from './trip-archive.js';
import { tripReviewSnapshot } from './review-fingerprint.js';

const tx = { id: 'uuid', businessTripId: 't', amount: 30, date: '2026-09-13', tripCategory: 'vitto' };
const policy = { expenseLimits: { vitto: 25 }, currency: 'EUR' };
test('category limits flag excess, not equality, without changing reimbursement', () => {
  assert.ok(inspectTripArchive([tx], policy).issues.some(x => x.code === 'policy_limit'));
  assert.ok(!inspectTripArchive([{ ...tx, amount: 25 }], policy).issues.some(x => x.code === 'policy_limit'));
  assert.ok(!inspectTripArchive([{ ...tx, tripCategory: 'trasporto' }], policy).issues.some(x => x.code === 'policy_limit'));
  assert.equal(tx.amount, 30);
});
test('zero limits are active and currencies are never silently compared', () => {
  assert.ok(inspectTripArchive([tx], { ...policy, expenseLimits: { vitto: 0 } }).issues.some(x => x.code === 'policy_limit'));
  const issues = inspectTripArchive([{ ...tx, currency: 'USD' }], policy).issues;
  assert.ok(issues.some(x => x.code === 'policy_currency'));
  assert.ok(!issues.some(x => x.code === 'policy_limit'));
});
test('invalid configured limits block submission; absent limits preserve legacy behavior', () => {
  for (const value of [-1, '25', Infinity]) assert.ok(inspectTripArchive([tx], { ...policy, expenseLimits: { vitto: value } }).issues.some(x => x.code === 'invalid_policy' && x.severity === 'blocking'));
  assert.ok(!inspectTripArchive([tx]).issues.some(x => x.code.startsWith('policy')));
  assert.notEqual(tripReviewSnapshot({ id: 't' }, [tx]), tripReviewSnapshot({ id: 't', receiptPolicy: policy }, [tx]));
});
