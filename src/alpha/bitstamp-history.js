// Public exchange candles, kept separate from Binance and CoinGecko quotes.
// Commercial use needs Bitstamp's data agreement. This adapter is disabled
// in the public app until Momentum has the required license.
// A 3-day candle is the finest Bitstamp interval that fits years into a page;
// the chart keeps the last observed traded close of each month, with its date.
import { conTimeout } from '../core/con-timeout.js';
import { cleanPriceSeries } from './market-series-quality.js';

const PAIRS = Object.freeze({
  bitcoin: 'btcusd', ethereum: 'ethusd', litecoin: 'ltcusd', ripple: 'xrpusd',
  'bitcoin-cash': 'bchusd', stellar: 'xlmusd', chainlink: 'linkusd',
  cardano: 'adausd', dogecoin: 'dogeusd', polkadot: 'dotusd',
  solana: 'solusd', 'avalanche-2': 'avaxusd',
});

export async function fetchBitstampHistory(coinId, { fetchImpl = fetch, maxPages = 4 } = {}) {
  const pair = PAIRS[coinId];
  if (!pair) return { series: [], pair: null };
  const rows = [];
  let end = null;
  for (let page = 0; page < Math.min(4, Math.max(1, maxPages)); page++) {
    const url = new URL(`https://www.bitstamp.net/api/v2/ohlc/${pair}/`);
    url.searchParams.set('step', '259200');
    url.searchParams.set('limit', '1000');
    url.searchParams.set('exclude_current_candle', 'true');
    if (end !== null) url.searchParams.set('end', String(end));
    let response;
    try { response = await conTimeout(fetchImpl(url.toString()), 8_000, 'Bitstamp history unavailable'); }
    catch (_) { break; }
    if (!response.ok) break;
    const data = await response.json().catch(() => null);
    const pageRows = data?.data?.ohlc;
    if (!Array.isArray(pageRows) || !pageRows.length) break;
    const timestamps = pageRows.map(row => Number(row?.timestamp)).filter(Number.isFinite);
    if (!timestamps.length) break;
    const oldest = Math.min(...timestamps);
    if (end !== null && oldest >= end) break;
    rows.push(...pageRows);
    if (pageRows.length < 1000) break;
    end = oldest - 1;
  }
  const clean = cleanPriceSeries(rows.filter(row => Number.isFinite(Number(row?.timestamp)) && Number.isFinite(new Date(Number(row?.timestamp) * 1000).getTime()) && Number(row?.volume) > 0)
    .map(row => ({ date: new Date(Number(row.timestamp) * 1000).toISOString().slice(0, 10), price: Number(row.close) })));
  const monthly = new Map();
  for (const point of clean) monthly.set(point.date.slice(0, 7), point);
  return { series: [...monthly.values()], pair: pair.toUpperCase() };
}
