// Confronto REALE "un anno fa vs oggi" per le cripto — CoinGecko /coins/{id}/history
// (CORS aperto, nessuna chiave, stesso host già verificato per /search).
// Mai un dato inventato: se la fonte non ha lo storico per quella data,
// dichiara che non è disponibile invece di stimare.
'use strict';

function formatDateDDMMYYYY(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

// yearsAgo: quanti anni indietro guardare (default 1). Ritorna null se la
// fonte non ha il dato per quella data (mai un prezzo inventato).
export async function fetchCryptoPriceYearsAgo(coinId, { yearsAgo = 1, vsCurrency = 'eur', fetchImpl = fetch, referenceDate = new Date() } = {}) {
  if (!coinId) return null;
  const past = new Date(referenceDate);
  past.setFullYear(past.getFullYear() - yearsAgo);
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/history?date=${formatDateDDMMYYYY(past)}&localization=false`;
  const res = await fetchImpl(url);
  if (!res.ok) return null;
  const json = await res.json();
  const price = json?.market_data?.current_price?.[vsCurrency];
  if (!Number.isFinite(price)) return null;
  return { price, date: past.toISOString().slice(0, 10) };
}

// Frase pronta per la UI, onesta: solo se il confronto è disponibile.
export function describeYoyChange(currentPrice, pastEntry, { yearsAgo = 1 } = {}) {
  if (!Number.isFinite(currentPrice) || !pastEntry) return null;
  const pct = ((currentPrice - pastEntry.price) / pastEntry.price) * 100;
  const dir = pct >= 0 ? 'in più' : 'in meno';
  const label = yearsAgo === 1 ? '1 anno fa' : `${yearsAgo} anni fa`;
  return `${label} (${pastEntry.date}) valeva circa ${pastEntry.price.toFixed(2)}, oggi ${Math.abs(pct).toFixed(0)}% ${dir}.`;
}

// Serie storica REALE (CoinGecko /coins/{id}/market_chart/range, CORS
// aperto, nessuna chiave). LIMITE REALE verificato dal vivo (2026-07-27):
// l'API pubblica gratuita di CoinGecko rifiuta richieste oltre 365 giorni
// indietro ("Your request exceeds the allowed time range... Public API
// users are limited to querying historical data within the past 365
// days") — un vero storico multi-anno (2/3/5 anni) richiederebbe un piano
// CoinGecko a pagamento, che questo progetto non usa. `yearsBack` è quindi
// limitato a 1 di default — mai promettere più di quello che l'API gratuita
// dà davvero. Granularità: CoinGecko sceglie da sola (oraria <90gg,
// giornaliera oltre), mai un dato interpolato da noi.
export async function fetchCryptoPriceSeries(coinId, { yearsBack = 1, vsCurrency = 'eur', fetchImpl = fetch, referenceDate = new Date() } = {}) {
  if (!coinId) return [];
  const cappedYears = Math.min(yearsBack, 1);
  const to = Math.floor(referenceDate.getTime() / 1000);
  const from = Math.floor(new Date(referenceDate).setFullYear(referenceDate.getFullYear() - cappedYears) / 1000);
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart/range?vs_currency=${encodeURIComponent(vsCurrency)}&from=${from}&to=${to}`;
  const res = await fetchImpl(url);
  if (!res.ok) return [];
  const json = await res.json();
  const prices = Array.isArray(json?.prices) ? json.prices : [];
  return prices.map(([ts, price]) => ({ date: new Date(ts).toISOString().slice(0, 10), price })).filter(p => Number.isFinite(p.price));
}

// Confronto REALE a più anni (1,2,3,5...) — CoinGecko limita la SERIE
// continua a 365 giorni (piano gratuito), ma il singolo punto nel tempo
// (/history?date=) non ha questo limite: qui si chiamano più punti reali,
// non una linea continua fabbricata. Ogni punto può mancare (fonte senza
// dato per quella data) senza bloccare gli altri.
export async function fetchCryptoMultiYearComparison(coinId, { yearsList = [1, 2, 3, 5], vsCurrency = 'eur', fetchImpl = fetch, referenceDate = new Date() } = {}) {
  const results = await Promise.all(yearsList.map(y => fetchCryptoPriceYearsAgo(coinId, { yearsAgo: y, vsCurrency, fetchImpl, referenceDate }).then(p => ({ yearsAgo: y, point: p }))));
  return results.filter(r => r.point);
}

// Massimo/minimo REALE per anno solare nella serie — i "momenti salienti"
// richiesti dall'utente, SOLO dati misurati (data + prezzo veri), MAI un
// motivo narrativo inventato: il progetto non ha un archivio di notizie
// storiche, quindi non finge di sapere "perché" un picco di anni fa sia
// avvenuto — dichiara solo cosa è realmente successo al prezzo.
export function yearlyExtremes(series) {
  const byYear = {};
  for (const p of series) {
    const year = p.date.slice(0, 4);
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(p);
  }
  return Object.entries(byYear).sort(([a], [b]) => a.localeCompare(b)).map(([year, pts]) => {
    const max = pts.reduce((m, p) => (p.price > m.price ? p : m), pts[0]);
    const min = pts.reduce((m, p) => (p.price < m.price ? p : m), pts[0]);
    const first = pts[0], last = pts[pts.length - 1];
    const changePct = first.price > 0 ? ((last.price - first.price) / first.price) * 100 : null;
    return { year, max, min, changePct };
  });
}
