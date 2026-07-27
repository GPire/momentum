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
