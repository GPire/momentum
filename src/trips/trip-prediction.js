import { giornoLocale } from '../core/date-utils.js';
import { isTripDate } from './trip-archive.js';
import { VALUTE_ISO4217 } from '../core/iso4217.js';

const median = values => {
  const ordered = [...values].sort((a, b) => a - b), middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};

// Retrospective replay of current records, not prospective validation or fraud detection.
export function evaluateTripPredictions(transactions) {
  const counts = new Map();
  for (const tx of transactions) if (tx?.id != null) counts.set(String(tx.id), (counts.get(String(tx.id)) || 0) + 1);
  const rows = transactions.filter(tx => tx?.id != null && counts.get(String(tx.id)) === 1
    && tx.businessTripId && !tx.tripPersonal && tx.type !== 'entrata' && !tx.tripRevisionConflict
    && Number.isFinite(tx.amount) && tx.amount > 0 && Number.isSafeInteger(Math.round(tx.amount * 100))
    && isTripDate(tx.date) && VALUTE_ISO4217.has(tx.currency || 'EUR'))
    .map(tx => ({ tx, day: giornoLocale(tx.date) }))
    .sort((a, b) => a.day.localeCompare(b.day) || String(a.tx.id).localeCompare(String(b.tx.id)));
  const history = new Map(), predictions = [], totals = new Map();
  for (const { tx, day } of rows) {
    const currency = tx.currency || 'EUR', key = `${tx.tripCategory || 'altro'}|${currency}`;
    const prior = history.get(key) || { day: null, sample: [], recent: [] };
    if (prior.day !== day) { prior.sample = [...prior.recent]; prior.day = day; }
    const sample = prior.sample;
    if (sample.length >= 5) {
      const expected = median(sample), baseline = sample.reduce((sum, amount) => sum + amount, 0) / sample.length;
      const scale = Math.max(1.4826 * median(sample.map(amount => Math.abs(amount - expected))), expected * 0.15, 0.01);
      const score = (tx.amount - expected) / scale;
      predictions.push({ transactionId: tx.id, expected, baseline, currency, historyCount: sample.length, unusual: score > 3, score });
      const total = totals.get(currency) || { currency, cases: 0, error: 0, baselineError: 0 };
      total.cases++; total.error += Math.abs(tx.amount - expected); total.baselineError += Math.abs(tx.amount - baseline);
      totals.set(currency, total);
    }
    prior.recent.push(tx.amount);
    if (prior.recent.length > 24) prior.recent.shift();
    history.set(key, prior);
  }
  return { mode: 'historical-replay', predictions, metrics: [...totals.values()].map(({ currency, cases, error, baselineError }) => ({ currency, cases, mae: error / cases, baselineMae: baselineError / cases })) };
}
