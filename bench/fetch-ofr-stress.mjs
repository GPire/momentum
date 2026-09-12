// Research-only complementary data. Preserves the app's historical archives.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { finestraLunga } from '../src/alpha/eventi-lunghi.js';
import { prepareScenarioDataset } from '../src/sdk/datasets.js';

const url = 'https://www.financialresearch.gov/financial-stress-index/data/fsi.json';
const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`OFR HTTP ${response.status}`);
const raw = await response.text(), json = JSON.parse(raw);
const keys = ['OFRFSI', 'Credit', 'Equity_Valuation', 'Flight_to_Safety', 'Funding', 'Volatility', 'US', 'AE', 'EM'];
const series = {};
for (const key of keys) {
  const rows = json[key]?.data;
  if (!Array.isArray(rows) || rows.length < 1000) throw new Error(`Insufficient OFR coverage: ${key}`);
  let previous = -Infinity;
  series[key] = rows.map(row => {
    if (!Array.isArray(row) || row.length !== 2) throw new Error(`Invalid OFR row: ${key}`);
    const [time, value] = row;
    if (!Number.isFinite(time) || time <= previous || time % 86400000 !== 0
        || time > Date.now() || !Number.isFinite(value)) throw new Error(`Invalid OFR observation: ${key}`);
    previous = time;
    return { date: new Date(time).toISOString().slice(0, 10), value };
  });
}
const dates = series.OFRFSI.map(r => r.date);
for (const key of keys) {
  if (series[key].length !== dates.length || series[key].some((r, i) => r.date !== dates[i])) {
    throw new Error(`OFR calendars differ: ${key}`);
  }
}
const manifest = { source: url, retrievedAt: new Date().toISOString(), sha256: createHash('sha256').update(raw).digest('hex'),
  dates: dates.length, observations: dates.length * keys.length, start: dates[0], end: dates.at(-1), series: keys,
  knowledgeBasis: 'latest-revised-snapshot', publicationLag: 'two-business-days-per-OFR',
  use: 'local-research-only-redistribution-not-cleared', missingSeries: [],
  limitations: ['not-point-in-time', 'stress-is-not-a-causal-effect', 'components-not-independent-observations'] };
const datasets = keys.map(id => ({ id, source: url, unit: 'OFR-index-points', frequency: 'daily',
  knowledgeBasis: 'latest-revised-snapshot', observations: series[id] }));
// Local research policy. It does not grant redistribution or training rights.
const policies = Object.fromEntries(keys.map(id => [id, { source: url, unit: 'OFR-index-points',
  frequency: 'daily', knowledgeBasis: 'latest-revised-snapshot', allowedPurposes: ['research'] }]));
const matrix = prepareScenarioDataset(datasets, { asOf: manifest.retrievedAt.slice(0, 10), policies });
if (!matrix.available) throw new Error(`SDK data contract failed: ${matrix.reason}`);
manifest.sdkContract = { version: 1, sharedDates: matrix.rows.length, columns: Object.keys(matrix.columns).length };
const episodes = [
  ['global-financial-crisis', '2008-01-01', '2009-12-31'],
  ['pandemic', '2020-02-01', '2020-06-30'],
  ['inflation-rate-shock', '2022-01-01', '2022-12-31'],
  ['banking-stress', '2023-03-01', '2023-05-31'],
].map(([id, start, end]) => {
  const rows = series.OFRFSI.filter(r => r.date >= start && r.date <= end);
  if (!rows.length) throw new Error(`Missing episode: ${id}`);
  const peak = rows.reduce((a, b) => b.value > a.value ? b : a);
  const history = finestraLunga(start, end);
  return { id, start, end, stressObservations: rows.length, peak,
    peakComponents: Object.fromEntries(keys.filter(k => k !== 'OFRFSI').map(k => [k, series[k].find(r => r.date === peak.date).value])),
    historicalMarketWindow: history, interpretation: 'retrospective-cooccurrence-not-attribution-or-forecast' };
});
const directory = 'bench/data/research-universe';
mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/ofr-stress.json`, JSON.stringify({ manifest, series }));
writeFileSync(`${directory}/ofr-scenarios.json`, JSON.stringify({ manifest, episodes }, null, 2));
console.log(JSON.stringify({ manifest, episodes: episodes.map(e => ({ id: e.id, peak: e.peak, observations: e.stressObservations })) }, null, 2));
