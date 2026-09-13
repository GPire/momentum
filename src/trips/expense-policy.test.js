import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectTripArchive } from './trip-archive.js';
import { tripReviewSnapshot } from './review-fingerprint.js';
import { tripPolicyFromTemplate } from './policy-template.js';
import { exportTripData } from './trip-engine.js';
import { encodeTripReview, decodeTripReview } from './trip-review.js';

test('policy defaults are isolated snapshots and never copy an exception', () => {
  const template = { version: 'v1', rules: { dailyLimits: { vitto: 40 }, exceptionReason: 'one trip only' } };
  const rules = tripPolicyFromTemplate(template);
  assert.equal(rules.exceptionReason, undefined);
  assert.equal(rules.templateVersion, 'v1');
  template.rules.dailyLimits.vitto = 80;
  assert.equal(rules.dailyLimits.vitto, 40);
});
test('exception travels with the review and changes the reviewed snapshot', async () => {
  const trip = { id: 't', receiptPolicy: { exceptionReason: 'Conference hotel' } };
  const report = exportTripData(trip, []);
  const code = await encodeTripReview({ ...report, tripId: 't' });
  const decoded = await decodeTripReview(code);
  assert.equal(decoded.policyExceptionReason, 'Conference hotel');
  assert.notEqual(tripReviewSnapshot(trip, []), tripReviewSnapshot({ id: 't' }, []));
});

const tx = { id: 'uuid', businessTripId: 't', amount: 30, date: '2026-09-13', tripCategory: 'vitto' };
const policy = { expenseLimits: { vitto: 25 }, currency: 'EUR' };
test('daily limits sum cents by recorded date and category, keeping currencies separate', () => {
  const rows = [tx, { ...tx, id: 'b', amount: 21 }, { ...tx, id: 'c', date: '2026-09-14', amount: 20 }];
  const issues = inspectTripArchive(rows, { dailyLimits: { vitto: 50 }, currency: 'EUR' }).issues;
  assert.deepEqual(issues.filter(x => x.code === 'policy_daily').map(x => x.transactionId), ['uuid', 'b']);
  assert.equal(inspectTripArchive(rows, { dailyLimits: { vitto: 51 } }).issues.filter(x => x.code === 'policy_daily').length, 0);
  assert.ok(inspectTripArchive([{ ...tx, currency: 'USD' }], { dailyLimits: { vitto: 20 } }).issues.some(x => x.code === 'policy_currency'));
});
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
