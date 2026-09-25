// Storico mensile REALE per azioni/ETF — Alpha Vantage TIME_SERIES_MONTHLY
// o Twelve Data /time_series (stessi host già verificati per prezzi/notizie,
// CORS aperto con chiave personale). La profondità disponibile dipende dal
// piano e dal titolo. Le condizioni per uso commerciale vanno verificate
// separatamente; una chiave personale non conferisce diritti di distribuzione.
// Mai un prezzo inventato:
// se la fonte non risponde o la chiave non ha quota, ritorna array vuoto.
'use strict';

import { conTimeout } from '../core/con-timeout.js';
import { cleanPriceSeries } from './market-series-quality.js';

// Stesso buco già trovato e corretto in src/ai/local-sentiment.js: un
// provider a chiave reale che resta "pending" senza mai rispondere né
// fallire bloccava `await fetchImpl(url)` per sempre, mai un errore che il
// try/catch a monte potesse intercettare — a cascata "Chiedi a Momentum"
// restava bloccato su "sto cercando..." indefinitamente.
const TIMEOUT_STORICO_MS = 15_000;

function filterByYearsBack(entries, yearsBack) {
  if (!Number.isFinite(yearsBack)) return entries;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - yearsBack);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return entries.filter(p => p.date >= cutoffStr);
}

async function fetchFromAlphaVantage(symbol, { apiKey, fetchImpl, yearsBack }) {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await conTimeout(fetchImpl(url), TIMEOUT_STORICO_MS, 'Alpha Vantage storico non risponde da troppo tempo');
  if (!res.ok) return [];
  const json = await res.json();
  if (json?.Note || json?.Information || json?.['Error Message']) return [];
  const series = json?.['Monthly Time Series'];
  if (!series || typeof series !== 'object') return [];
  const entries = Object.entries(series)
    .map(([date, v]) => ({ date, price: Number(v['4. close']) }))
    .filter(p => Number.isFinite(p.price))
    .sort((a, b) => a.date.localeCompare(b.date));
  return filterByYearsBack(entries, yearsBack);
}

async function fetchFromTwelveData(symbol, { apiKey, fetchImpl, yearsBack }) {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1month&outputsize=5000&apikey=${encodeURIComponent(apiKey)}`;
  const res = await conTimeout(fetchImpl(url), TIMEOUT_STORICO_MS, 'Twelve Data storico non risponde da troppo tempo');
  if (!res.ok) return [];
  const json = await res.json();
  if (json?.status === 'error' || !Array.isArray(json?.values)) return [];
  const entries = json.values
    .map(v => ({ date: v.datetime, price: Number(v.close) }))
    .filter(p => Number.isFinite(p.price))
    .sort((a, b) => a.date.localeCompare(b.date));
  return filterByYearsBack(entries, yearsBack);
}

// Financial Modeling Prep — CORS verificato dal vivo (2026-07-27, header
// access-control-allow-origin:* presente anche su risposta 401, confermato
// funzionante da fetch() reale nel browser). Piano gratuito: 250 richieste/
// giorno (più generoso di Alpha Vantage), storico USA fino al 1985 per le
// grandi aziende — solo azioni USA sul piano gratuito, dichiarato.
async function fetchFromFMP(symbol, { apiKey, fetchImpl, yearsBack }) {
  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(symbol)}?apikey=${encodeURIComponent(apiKey)}`;
  const res = await conTimeout(fetchImpl(url), TIMEOUT_STORICO_MS, 'FMP storico non risponde da troppo tempo');
  if (!res.ok) return [];
  const json = await res.json();
  const hist = json?.historical;
  if (!Array.isArray(hist)) return [];
  const entries = hist
    .map(v => ({ date: v.date, price: Number(v.close) }))
    .filter(p => Number.isFinite(p.price))
    .sort((a, b) => a.date.localeCompare(b.date));
  // FMP returns daily rows here; keep the last observed close per month so
  // the all-time chart stays responsive and comparable to the other sources.
  const monthly = new Map();
  for (const point of entries) monthly.set(point.date.slice(0, 7), point);
  return filterByYearsBack([...monthly.values()], yearsBack);
}

const PROVIDERS = { alphavantage: fetchFromAlphaVantage, twelvedata: fetchFromTwelveData, fmp: fetchFromFMP };

export async function fetchStockMonthlySeries(symbol, { apiKey, fetchImpl = fetch, yearsBack = null, provider = 'alphavantage' } = {}) {
  if (!symbol || !apiKey) return [];
  const fn = PROVIDERS[provider];
  if (!fn) return [];
  try { return cleanPriceSeries(await fn(symbol, { apiKey, fetchImpl, yearsBack })); } catch (_) { return []; }
}

// Ask configured providers concurrently. The first response is not always the
// longest history; prefer the oldest series that is also current relative to
// the freshest available source. Do not splice prices from different vendors.
export async function fetchStockMonthlySeriesCascade(symbol, { keys = {}, fetchImpl = fetch, yearsBack = null, order = ['alphavantage', 'twelvedata', 'fmp'] } = {}) {
  const available = order.filter(provider => keys[provider]);
  const results = await Promise.all(available.map(async provider => ({
    provider, series: await fetchStockMonthlySeries(symbol, { apiKey: keys[provider], fetchImpl, yearsBack, provider }),
  })));
  const populated = results.filter(result => result.series.length);
  if (!populated.length) return { series: [], provider: null };
  const latest = Math.max(...populated.map(result => Date.parse(`${result.series.at(-1).date}T00:00:00Z`)));
  const recent = populated.filter(result => Date.parse(`${result.series.at(-1).date}T00:00:00Z`) >= latest - 62 * 86_400_000);
  recent.sort((a, b) => a.series[0].date.localeCompare(b.series[0].date) || b.series.length - a.series.length);
  return recent[0];
}

// Confronto reale "N anni fa vs oggi" a partire dalla STESSA serie mensile
// (mai una chiamata di rete in più): trova il mese più vicino a N anni fa.
// Ritorna null se la serie non copre così indietro nel tempo — mai un dato
// stimato al posto di uno mancante.
export function describeStockYearsAgo(series, yearsAgo, currentPrice) {
  if (!series.length || !Number.isFinite(currentPrice)) return null;
  const target = new Date();
  target.setFullYear(target.getFullYear() - yearsAgo);
  const targetStr = target.toISOString().slice(0, 10);
  if (series[0].date > targetStr) return null; // la serie non arriva così indietro
  let closest = series[0];
  for (const p of series) {
    if (p.date <= targetStr) closest = p; else break;
  }
  const pct = ((currentPrice - closest.price) / closest.price) * 100;
  const dir = pct >= 0 ? 'in più' : 'in meno';
  const label = yearsAgo === 1 ? '1 anno fa' : `${yearsAgo} anni fa`;
  return `${label} (${closest.date}) valeva circa ${closest.price.toFixed(2)}, oggi ${Math.abs(pct).toFixed(0)}% ${dir}.`;
}
