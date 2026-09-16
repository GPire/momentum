import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTripArchive, inspectTripArchive, isTripDate } from './trip-archive.js';
import { parseTripAmount } from './trip-engine.js';
import { needsReceipt, exportTripData } from './trip-engine.js';
test('preflight separates optional receipts from warnings and blocks every duplicate identity', () => {
  const rows = [{ id: 'a', amount: 5, date: '2026-09-13' }, { id: 'b', amount: 30, date: '2026-09-13' }];
  const check = inspectTripArchive(rows, { receiptThreshold: 25 });
  assert.equal(check.blockingCount, 0);
  assert.equal(check.warningCount, 1);
  assert.equal(check.issues[0].severity, 'info');
  assert.equal(check.issues[1].severity, 'warning');
  assert.equal(inspectTripArchive(rows, { receiptThreshold: 0 }).warningCount, 2);
  const duplicate = inspectTripArchive([...rows, { ...rows[0] }]);
  assert.equal(duplicate.blockingCount, 2);
  assert.deepEqual(duplicate.issues.filter(x => x.code === 'duplicate_id').map(x => x.index), [0, 2]);
});
test('preflight rejects negative and unsafe amounts and impossible dates without dropping evidence', () => {
  const rows = [{ id: 'a', amount: -5, date: '2026-02-30' }, { id: 'b', amount: Number.MAX_SAFE_INTEGER, date: '2026-09-13' }];
  const copy = JSON.stringify(rows);
  assert.equal(inspectTripArchive(rows).blockingCount, 2);
  assert.equal(JSON.stringify(rows), copy);
  assert.equal(isTripDate('2024-02-29T20:00:00Z'), true);
  assert.equal(isTripDate('2026-02-29'), false);
  assert.equal(isTripDate('2026-09-13T23:00:00-05:00'), true);
});

test('trip receipt policy drives export without changing saved expenses', () => {
  const tx = { id: 'x', businessTripId: 't', type: 'uscita', amount: 10 };
  assert.equal(needsReceipt(tx), false);
  assert.equal(needsReceipt(tx, { receiptThreshold: 0 }), true);
  assert.equal(needsReceipt(tx, { receiptThreshold: 50 }), false);
  assert.equal(needsReceipt(tx, { receiptThreshold: -1 }), false);
  const report = exportTripData({ id: 't', receiptPolicy: { receiptThreshold: 0 } }, [tx]);
  assert.equal(report.numeroGiustificativiMancanti, 1);
  assert.equal(tx.receiptImage, undefined);
});

test('trip amount accepts decimal keyboards and rejects partial or unsafe values', () => {
  assert.equal(parseTripAmount('12,50'), 12.5);
  assert.equal(parseTripAmount('12.50'), 12.5);
  assert.equal(parseTripAmount('0'), 0);
  for (const value of ['', '12 taxi', '1e3', '-1', 'Infinity', '12.345', '9999999999999999']) {
    assert.equal(parseTripAmount(value), null, value);
  }
});

test('export checks flag duplicate identities and malformed data without dropping rows', () => {
  const transactions = [
    { id: 42, amount: 12, date: '2026-09-13', receiptImage: 'data:image/png;base64,YQ==' },
    { id: '42', amount: 'bad', date: 'not-a-date' },
    { amount: 4, date: '2026-09-13' },
  ];
  const before = JSON.stringify(transactions);
  const report = inspectTripArchive(transactions);
  assert.equal(report.transactionCount, 3);
  assert.equal(report.attachmentCount, 1);
  assert.ok(report.issues.some(issue => issue.code === 'duplicate_id' && issue.index === 1));
  assert.ok(report.issues.some(issue => issue.code === 'invalid_amount' && issue.index === 1));
  assert.ok(report.issues.some(issue => issue.code === 'invalid_date' && issue.index === 1));
  assert.ok(report.issues.some(issue => issue.code === 'missing_id' && issue.index === 2));
  assert.equal(JSON.stringify(transactions), before);
});

test('archive checks only the selected trip and preserves unknown fields', () => {
  const row = { id: 'a', businessTripId: 't', amount: 5, date: '2026-09-13', customCostCenter: 'R&D' };
  const archive = buildTripArchive({ id: 't' }, [row, { businessTripId: 'other', amount: 'bad' }]);
  assert.equal(archive.checks.transactionCount, 1);
  assert.equal(archive.transactions[0].customCostCenter, 'R&D');
  assert.ok(!archive.checks.issues.some(issue => issue.code === 'invalid_amount'));
});
test('archive preserves UUIDs, receipts, currency and trip metadata without unrelated data', () => {
  const trip = { id: 't1', name: 'Paris', offeredItems: [{ id: 'meal', amount: 20 }], approval: { state: 'approvata' } };
  const tx = { id: 'uuid-1', businessTripId: 't1', type: 'uscita', amount: 15, currency: 'CHF', receiptImage: 'data:image/png;base64,YQ==', hash: 'original' };
  const archive = buildTripArchive(trip, [tx, { ...tx, id: 'private', businessTripId: 'other' }], '2026-09-13T12:00:00Z');
  assert.deepEqual(archive.transactions, [tx]);
  assert.deepEqual(archive.trip, trip);
  assert.deepEqual(JSON.parse(JSON.stringify(archive)).transactions, [tx]);
  archive.transactions[0].amount = 99;
  assert.equal(tx.amount, 15);
});
test('invalid trip cannot accidentally export an entire archive', () => {
  assert.throws(() => buildTripArchive({}, []));
});
