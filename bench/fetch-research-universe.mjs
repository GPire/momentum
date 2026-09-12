// Research archive only, excluded from Git and the application bundle.
// Redistribution rights and point-in-time corporate actions are not implied
// by successful download. Each symbol keeps its own trading calendar.
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { cleanPriceSeries } from '../src/alpha/market-series-quality.js';

const universe = {
  equity: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'JPM', 'BAC', 'GS', 'MS', 'V', 'MA', 'AXP', 'BRK-B', 'COIN', 'HOOD'],
  etf: ['SPY', 'QQQ', 'IWM', 'VTI', 'VEA', 'VWO', 'VGK', 'EWJ', 'EEM', 'TLT', 'IEF', 'SHY', 'TIP', 'LQD', 'HYG', 'GLD', 'SLV', 'VNQ', 'XLE', 'XLF'],
  crypto: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'XRP-USD', 'ADA-USD', 'AVAX-USD', 'LINK-USD'],
};
const output = new URL('./data/research-universe/', import.meta.url);
mkdirSync(output, { recursive: true });
const generatedAt = new Date().toISOString();
const cutoff = generatedAt.slice(0, 10); // exclude incomplete current UTC day
const from = '2000-01-01';
const manifest = {
  version: 1, generatedAt, from, provider: 'Yahoo Finance',
  usage: 'local-research; redistribution-not-verified',
  limitations: ['selected-current-symbols-survivorship-bias', 'adjustments-not-point-in-time', 'daily-not-intraday', 'cross-market-closes-not-simultaneous'],
  assets: [], failures: [],
};

async function download(symbol, assetClass) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${Date.parse(from) / 1000}&period2=${Date.parse(cutoff) / 1000}&interval=1d&events=div%2Csplits`;
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
      if (response.ok) break;
      if (response.status !== 429 && response.status < 500) throw new Error(`HTTP ${response.status}`);
    } catch (error) { if (attempt === 2) throw error; }
    await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
  }
  if (!response?.ok) throw new Error(`HTTP ${response?.status || 'unavailable'}`);
  const result = (await response.json())?.chart?.result?.[0];
  if (!result?.timestamp?.length) throw new Error('empty-chart');
  const q = result.indicators?.quote?.[0], adjusted = result.indicators?.adjclose?.[0]?.adjclose;
  if (!q) throw new Error('missing-quotes');
  const candidates = result.timestamp.map((stamp, i) => {
    const row = { date: new Date(stamp * 1000).toISOString().slice(0, 10), open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i], volume: q.volume?.[i], adjustedClose: adjusted?.[i] ?? null };
    return row;
  }).filter(row => row.date < cutoff);
  const validDates = new Set(cleanPriceSeries(candidates.map(row => ({ date: row.date, price: row.close }))).map(row => row.date));
  const rows = candidates.filter(row => validDates.has(row.date)
    && [row.open, row.high, row.low, row.close].every(n => Number.isFinite(n) && n > 0)
    && row.low <= Math.min(row.open, row.close) && row.high >= Math.max(row.open, row.close)
    && (row.volume == null || (Number.isFinite(row.volume) && row.volume >= 0))
    && (row.adjustedClose === null || (Number.isFinite(row.adjustedClose) && row.adjustedClose > 0)))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (new Set(rows.map(row => row.date)).size !== rows.length) throw new Error('duplicate-session');
  if (rows.length < 250) throw new Error(`insufficient-history:${rows.length}`);
  const ageDays = (Date.parse(cutoff) - Date.parse(rows.at(-1).date)) / 86400000;
  if (ageDays > 7) throw new Error(`stale:${rows.at(-1).date}`);
  if (rows.length / candidates.length < 0.98) throw new Error('excessive-invalid-rows');
  const metadata = {
    symbol, assetClass, currency: result.meta?.currency ?? null,
    exchange: result.meta?.exchangeName ?? null, timezone: result.meta?.exchangeTimezoneName ?? null,
    first: rows[0].date, last: rows.at(-1).date, rows: rows.length,
    rejected: candidates.length - rows.length, adjustedRows: rows.filter(row => row.adjustedClose !== null).length,
  };
  const payload = JSON.stringify({ version: 1, generatedAt, source: url, ...metadata, rows, corporateActions: result.events ?? {} });
  const file = `${symbol}.json`;
  writeFileSync(new URL(`${file}.tmp`, output), payload);
  renameSync(new URL(`${file}.tmp`, output), new URL(file, output));
  return { ...metadata, file, sha256: createHash('sha256').update(payload).digest('hex'), bytes: Buffer.byteLength(payload) };
}

for (const [assetClass, symbols] of Object.entries(universe)) {
  for (const symbol of symbols) {
    try {
      const asset = await download(symbol, assetClass);
      manifest.assets.push(asset);
      console.log(`${symbol}: ${asset.rows} rows, ${asset.first} → ${asset.last}`);
    } catch (error) {
      manifest.failures.push({ symbol, error: error.message });
      console.log(`${symbol}: rejected (${error.message})`);
    }
  }
}
manifest.totalRows = manifest.assets.reduce((sum, asset) => sum + asset.rows, 0);
writeFileSync(new URL('manifest.json.tmp', output), JSON.stringify(manifest, null, 2));
renameSync(new URL('manifest.json.tmp', output), new URL('manifest.json', output));
console.log(JSON.stringify({ assets: manifest.assets.length, rows: manifest.totalRows, failures: manifest.failures, manifest: fileURLToPath(new URL('manifest.json', output)) }));
if (manifest.failures.length) process.exitCode = 1;
