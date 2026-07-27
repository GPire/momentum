// Storico mensile REALE per azioni/ETF — Alpha Vantage TIME_SERIES_MONTHLY
// (stesso host già verificato per prezzi/notizie, CORS aperto con chiave
// personale). A differenza di CoinGecko (limitata a 365gg sul piano
// gratuito), Alpha Vantage dà storico mensile reale spesso 20+ anni anche
// gratis — qui NON serve nessun compromesso "solo punti singoli": una
// vera serie continua multi-anno. Mai un prezzo inventato: se la fonte
// non risponde o la chiave non ha quota, ritorna array vuoto.
'use strict';

export async function fetchStockMonthlySeries(symbol, { apiKey, fetchImpl = fetch, yearsBack = null } = {}) {
  if (!symbol || !apiKey) return [];
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url);
  if (!res.ok) return [];
  const json = await res.json();
  if (json?.Note || json?.Information || json?.['Error Message']) return [];
  const series = json?.['Monthly Time Series'];
  if (!series || typeof series !== 'object') return [];
  let entries = Object.entries(series)
    .map(([date, v]) => ({ date, price: parseFloat(v['4. close']) }))
    .filter(p => Number.isFinite(p.price))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (Number.isFinite(yearsBack)) {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - yearsBack);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    entries = entries.filter(p => p.date >= cutoffStr);
  }
  return entries;
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
