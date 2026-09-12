import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDataset, prepareScenarioDataset } from './datasets.js';

const dataset = (extra = {}) => ({ id: 'credit', source: 'official', unit: 'index', frequency: 'daily',
  knowledgeBasis: 'point-in-time', observations: [
    { date: '2020-01-01', availableAt: '2020-01-02', value: -1 },
    { date: '2020-01-02', availableAt: '2020-01-03', value: 0 },
  ], ...extra });
const policy = { source: 'official', unit: 'index', frequency: 'daily', knowledgeBasis: 'point-in-time', allowedPurposes: ['research', 'backtest', 'training'] };
const options = { asOf: '2020-01-03', purpose: 'backtest', policy };

test('publication cutoff preserved, negative indices and zero remain valid', () => {
  const r = prepareDataset(dataset(), { ...options, asOf: '2020-01-02' });
  assert.equal(r.available, true);
  assert.deepEqual(r.observations.map(r => r.value), [-1]);
});
test('incoming dataset cannot grant itself permission', () => {
  const d = dataset({ allowedPurposes: ['backtest'] });
  assert.equal(prepareDataset(d, { ...options, policy: null }).available, false);
  assert.equal(prepareDataset(d, { ...options, policy: { ...policy, allowedPurposes: ['research'] } }).available, false);
});
test('revised snapshots are research-only even when backtest is permitted by caller', () => {
  const d = dataset({ knowledgeBasis: 'latest-revised-snapshot' });
  const p = {...policy,knowledgeBasis:'latest-revised-snapshot'};
  assert.equal(prepareDataset(d, {...options,policy:p}).reason, 'historical-availability-unverified');
  assert.equal(prepareDataset(d, { ...options, policy:p, purpose: 'research' }).available, true);
  assert.equal(prepareDataset(dataset(), {...options,policy:p}).reason, 'metadata-mismatch');
});
test('invalid dates, values and units are rejected, not silently coerced', () => {
  for (const observations of [[{ date: '2020-02-30', value: 1 }], [{ date: '2020-01-01', value: '2' }]]) {
    assert.equal(prepareDataset(dataset({ observations }), options).available, false);
  }
  assert.equal(prepareDataset(dataset({ unit: 'USD' }), options).available, false);
});
test('same-date conflicts do not revive earlier values', () => {
  const observations = [
    { date: '2020-01-01', availableAt: '2020-01-02', value: 1 },
    { date: '2020-01-01', availableAt: '2020-01-03', value: 2 },
    { date: '2020-01-01', availableAt: '2020-01-03', value: 3 },
  ];
  assert.equal(prepareDataset(dataset({ observations }), options).reason, 'no-usable-observations');
});
test('scenario joins actual shared dates, never fills missing observations', () => {
  const a = dataset(), b = dataset({ id: 'other', observations: [a.observations[1]] });
  const r = prepareScenarioDataset([a, b], { ...options, policies: { credit: policy, other: policy }, minCommonDates: 1 });
  assert.equal(r.available, true);
  assert.deepEqual(r.rows, [{ date: '2020-01-02', values: { credit: 0, other: 0 } }]);
  assert.equal(r.columns.credit.coverage, 0.5);
  assert.equal(prepareScenarioDataset([a, a], { ...options, policies: { credit: policy }, minCommonDates: 1 }).available, false);
});
test('mixed frequency and insufficient overlap do not produce a matrix', () => {
  const a = dataset(), b = dataset({ id: 'other', frequency: 'monthly' });
  assert.equal(prepareScenarioDataset([a, b], { ...options, policies: {credit:policy,other:{...policy,frequency:'monthly'}}, minCommonDates:1 }).reason, 'mixed-frequency');
  assert.equal(prepareScenarioDataset([a], { ...options, policies:{credit:policy}, minCommonDates:3 }).reason,'insufficient-overlap');
});
