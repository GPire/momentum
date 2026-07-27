// Storico mensile REALE per azioni/ETF — Alpha Vantage TIME_SERIES_MONTHLY
// o Twelve Data /time_series (stessi host già verificati per prezzi/notizie,
// CORS aperto con chiave personale). A differenza di CoinGecko (limitata a
// 365gg sul piano gratuito), entrambi danno storico mensile reale spesso
// 20+ anni anche gratis — qui NON serve nessun compromesso "solo punti
// singoli": una vera serie continua multi-anno. Mai un prezzo inventato:
// se la fonte non risponde o la chiave non ha quota, ritorna array vuoto.
'use strict';

function filterByYearsBack(entries, yearsBack) {
  if (!Number.isFinite(yearsBack)) return entries;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - yearsBack);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return entries.filter(p => p.date >= cutoffStr);
}

async function fetchFromAlphaVantage(symbol, { apiKey, fetchImpl, yearsBack }) {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url);
  if (!res.ok) return [];
  const json = await res.json();
  if (json?.Note || json?.Information || json?.['Error Message']) return [];
  const series = json?.['Monthly Time Series'];
  if (!series || typeof series !== 'object') return [];
  const entries = Object.entries(series)
    .map(([date, v]) => ({ date, price: parseFloat(v['4. close']) }))
    .filter(p => Number.isFinite(p.price))
    .sort((a, b) => a.date.localeCompare(b.date));
  return filterByYearsBack(entries, yearsBack);
}

async function fetchFromTwelveData(symbol, { apiKey, fetchImpl, yearsBack }) {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1month&outputsize=5000&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url);
  if (!res.ok) return [];
  const json = await res.json();
  if (json?.status === 'error' || !Array.isArray(json?.values)) return [];
  const entries = json.values
    .map(v => ({ date: v.datetime, price: parseFloat(v.close) }))
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
  const res = await fetchImpl(url);
  if (!res.ok) return [];
  const json = await res.json();
  const hist = json?.historical;
  if (!Array.isArray(hist)) return [];
  const entries = hist
    .map(v => ({ date: v.date, price: parseFloat(v.close) }))
    .filter(p => Number.isFinite(p.price))
    .sort((a, b) => a.date.localeCompare(b.date));
  return filterByYearsBack(entries, yearsBack);
}

const PROVIDERS = { alphavantage: fetchFromAlphaVantage, twelvedata: fetchFromTwelveData, fmp: fetchFromFMP };

export async function fetchStockMonthlySeries(symbol, { apiKey, fetchImpl = fetch, yearsBack = null, provider = 'alphavantage' } = {}) {
  if (!symbol || !apiKey) return [];
  const fn = PROVIDERS[provider];
  if (!fn) return [];
  try { return await fn(symbol, { apiKey, fetchImpl, yearsBack }); } catch (_) { return []; }
}

// A CASCATA (stesso principio già usato per la chat generica): prova ogni
// provider per cui l'utente ha configurato una chiave, in ordine, si ferma
// al primo che dà una serie non vuota. `keys` = { alphavantage?, twelvedata? }.
// Richiesto esplicitamente dall'utente: mai dipendere da un solo provider —
// se Momentum crescesse, ogni utente usa comunque la propria chiave (mai
// condivisa), ma avere un piano B onesto resta più solido.
export async function fetchStockMonthlySeriesCascade(symbol, { keys = {}, fetchImpl = fetch, yearsBack = null, order = ['alphavantage', 'twelvedata', 'fmp'] } = {}) {
  for (const provider of order) {
    if (!keys[provider]) continue;
    const series = await fetchStockMonthlySeries(symbol, { apiKey: keys[provider], fetchImpl, yearsBack, provider });
    if (series.length) return { series, provider };
  }
  return { series: [], provider: null };
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
