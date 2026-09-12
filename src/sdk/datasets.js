// Transport-independent data contract. Policies come from the integrating
// application, never from a downloaded payload. Not authentication or licensing.
import { macroVintageSnapshot } from '../predict/macro-vintages.js';

const date = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)
  && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0, 10) === x;
const id = x => typeof x === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(x);
const fail = reason => ({ available: false, reason });

export function prepareDataset(dataset, { asOf, purpose = 'research', policy } = {}) {
  if (!date(asOf) || !id(dataset?.id) || !['research', 'backtest', 'training'].includes(purpose)) return fail('invalid-request');
  if (!policy || !Array.isArray(policy.allowedPurposes) || !policy.allowedPurposes.includes(purpose)) return fail('purpose-not-approved');
  if (!dataset.source || !dataset.unit || !['daily','weekly','monthly','annual'].includes(dataset.frequency)
      || dataset.source !== policy.source || dataset.unit !== policy.unit || dataset.frequency !== policy.frequency
      || dataset.knowledgeBasis !== policy.knowledgeBasis) return fail('metadata-mismatch');
  if (!['point-in-time', 'latest-revised-snapshot'].includes(dataset.knowledgeBasis)) return fail('unknown-knowledge-basis');
  const historical = dataset.knowledgeBasis === 'point-in-time';
  if (purpose !== 'research' && !historical) return fail('historical-availability-unverified');
  if (!Array.isArray(dataset.observations) || dataset.observations.length > 1000000
      || dataset.observations.some(r => !date(r?.date) || !Number.isFinite(r.value)
        || (historical && (!date(r.availableAt) || r.availableAt < r.date)))) return fail('invalid-observations');
  let observations;
  if (historical) {
    observations = macroVintageSnapshot(dataset.observations.map(r => ({
      date: r.date, availableAt: r.availableAt, close: r.value, source: dataset.source,
    })), asOf).filter(r => Number.isFinite(r.close))
      .map(r => ({ date: r.date, availableAt: r.availableAt, value: r.close }));
  } else {
    const values = new Map();
    for (const r of dataset.observations) {
      if (r.date > asOf) continue;
      if (!values.has(r.date)) values.set(r.date, r.value);
      else if (values.get(r.date) !== r.value) values.set(r.date, null);
    }
    observations = [...values].filter(([, value]) => Number.isFinite(value))
      .sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({date, value}));
  }
  if (!observations.length) return fail('no-usable-observations');
  return { available: true, id: dataset.id, source: dataset.source, unit: dataset.unit,
    frequency: dataset.frequency, knowledgeBasis: dataset.knowledgeBasis, purpose, asOf,
    firstDate: observations[0].date, lastDate: observations.at(-1).date, observations };
}

export function prepareScenarioDataset(datasets, { asOf, purpose = 'research', policies, minCommonDates = 30 } = {}) {
  if (!Array.isArray(datasets) || !datasets.length || datasets.length > 100
      || datasets.some(d => !id(d?.id)) || new Set(datasets.map(d => d.id)).size !== datasets.length
      || !Number.isInteger(minCommonDates) || minCommonDates < 1) return fail('invalid-request');
  const prepared = datasets.map(d => prepareDataset(d, { asOf, purpose,
    policy: policies && Object.hasOwn(policies, d.id) ? policies[d.id] : null }));
  const rejected = prepared.find(d => !d.available);
  if (rejected) return rejected;
  if (new Set(prepared.map(d => d.frequency)).size !== 1) return fail('mixed-frequency');
  const indices = prepared.map(d => new Map(d.observations.map(r => [r.date, r.value])));
  const shared = prepared[0].observations.map(r => r.date).filter(date => indices.every(index => index.has(date)));
  if (shared.length < minCommonDates) return fail('insufficient-overlap');
  return { available: true, asOf, purpose, frequency: prepared[0].frequency,
    columns: Object.fromEntries(prepared.map(d => [d.id, { source: d.source, unit: d.unit,
      knowledgeBasis: d.knowledgeBasis, availableDates: d.observations.length, coverage: shared.length / d.observations.length }])),
    rows: shared.map(date => ({ date, values: Object.fromEntries(prepared.map((d, i) => [d.id, indices[i].get(date)])) })) };
}
