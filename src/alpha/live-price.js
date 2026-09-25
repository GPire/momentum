// ============================================================
// Prezzi di mercato: la data di ricezione non è la data della quotazione.
// ============================================================
// Onestà tecnica (regola #1 del progetto, "100% on-device"): quella regola
// dice che i TUOI DATI PERSONALI (spese, transazioni, saldo) non escono MAI
// dal dispositivo — non dice che l'app non possa MAI leggere un dato PUBBLICO
// da internet. Sono due categorie diverse: qui non esce nessuna informazione
// dell'utente, entra solo un prezzo pubblico, e SOLO quando l'utente tocca
// esplicitamente "Aggiorna" (mai in background, mai automatico).
//
// CoinGecko fornisce prezzi cripto senza chiave. Per le azioni l'utente può
// interrogare direttamente Finnhub, Alpha Vantage o Twelve Data con la propria chiave;
// disponibilità, copertura, ritardo e licenza dipendono dal piano del provider.
// Non chiamare "live" una risposta solo perché è stata ricevuta ora.
'use strict';

const COINGECKO_IDS = {
  bitcoin: 'bitcoin', btc: 'bitcoin',
  ethereum: 'ethereum', eth: 'ethereum',
};

// Fetch con timeout esplicito: una richiesta di rete non deve MAI bloccare la
// UI indefinitamente se la connessione è lenta o assente.
async function fetchWithTimeout(url, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { mode: 'cors', signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Ultimo prezzo disponibile di UNA cripto in EUR. L'ora della quotazione
// proviene dal provider; asOf è soltanto l'ora in cui riceviamo la risposta.
export async function fetchLiveCryptoPrice(coin = 'bitcoin', { vsCurrency = 'eur', fetchImpl = fetchWithTimeout } = {}) {
  const id = COINGECKO_IDS[coin.toLowerCase()] || coin.toLowerCase();
  let res;
  try {
    res = await fetchImpl(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=${encodeURIComponent(vsCurrency)}&include_last_updated_at=true`);
  } catch (e) {
    throw new Error('Rete non disponibile: resto sul dato storico.');
  }
  if (!res.ok) throw new Error(`CoinGecko ha risposto ${res.status}: resto sul dato storico.`);
  const json = await res.json();
  const price = json?.[id]?.[vsCurrency];
  if (!Number.isFinite(price) || price <= 0) throw new Error('Prezzo non trovato per questa cripto: resto sul dato storico.');
  const receivedAt = Date.now();
  const updatedSeconds = json?.[id]?.last_updated_at;
  const validTime = Number.isSafeInteger(updatedSeconds) && updatedSeconds > 0
    && updatedSeconds * 1000 <= receivedAt + 5 * 60_000;
  const marketAsOf = validTime ? new Date(updatedSeconds * 1000).toISOString() : null;
  return {
    price,
    asOf: new Date(receivedAt).toISOString(),
    marketAsOf,
    freshness: marketAsOf ? (receivedAt - updatedSeconds * 1000 > 15 * 60_000 ? 'stale' : 'recent') : 'unverified',
    source: 'CoinGecko (pubblico, nessun dato personale inviato)',
  };
}

// ── AZIONI/INDICI — fonti facoltative con chiave personale ──────────────────
// La chiave rimane nello stato locale di Momentum e viene inviata al provider
// scelto nella richiesta API. La seconda fonte è un fallback, non una garanzia
// di disponibilità o di quotazione in tempo reale.
const STOCK_PROVIDERS = {
  finnhub: {
    label: 'Finnhub',
    url: (symbol, key) => `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(key)}`,
    extract: (json) => typeof json?.c === 'number' && Number.isFinite(json.c) ? json.c : null,
    rateLimitHint: 'controlla la quota sul sito del provider',
  },
  alphavantage: {
    label: 'Alpha Vantage',
    url: (symbol, key) => `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`,
    extract: (json) => {
      const q = json?.['Global Quote'];
      const price = q && parseFloat(q['05. price']);
      return Number.isFinite(price) ? price : null;
    },
    rateLimitHint: 'controlla la quota sul sito del provider',
  },
  twelvedata: {
    label: 'Twelve Data',
    url: (symbol, key) => `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`,
    extract: (json) => {
      const price = json?.price !== undefined ? parseFloat(json.price) : null;
      return Number.isFinite(price) ? price : null;
    },
    rateLimitHint: 'controlla la quota sul sito del provider',
  },
};

export const STOCK_PROVIDER_IDS = Object.keys(STOCK_PROVIDERS);

// Prezzo disponibile di un'azione/indice/ETF (es. "SPY", "AAPL"). Senza
// chiave personale non prova a indovinare una quotazione.
export async function fetchLiveStockPrice(symbol, { provider = 'alphavantage', apiKey, fetchImpl = fetchWithTimeout } = {}) {
  if (!apiKey) throw new Error('Serve una chiave API personale per le quotazioni di azioni/indici.');
  const p = STOCK_PROVIDERS[provider];
  if (!p) throw new Error(`Provider "${provider}" non supportato.`);
  let res;
  try {
    res = await fetchImpl(p.url(symbol, apiKey));
  } catch (e) {
    throw new Error('Rete non disponibile: resto sul dato storico.');
  }
  if (!res.ok) throw new Error(`${p.label} ha risposto ${res.status}: resto sul dato storico.`);
  const json = await res.json();
  if (json?.Note || json?.Information || json?.status === 'error' || json?.code || json?.error) {
    // Alpha Vantage restituisce 200 anche quando il limite giornaliero è
    // esaurito, con un messaggio in 'Note'/'Information' invece del prezzo:
    // onesto segnalarlo come tale, non come "prezzo non trovato" generico.
    throw new Error(`${p.label}: chiave, copertura o limite richieste da verificare (${p.rateLimitHint}). Riprova più tardi.`);
  }
  const price = p.extract(json);
  if (price === null || price <= 0) throw new Error(`Prezzo non trovato per "${symbol}" su ${p.label}: resto sul dato storico.`);
  const receivedAt = Date.now();
  const finnhubSeconds = json?.t;
  const finnhubTime = provider === 'finnhub' && Number.isSafeInteger(finnhubSeconds) && finnhubSeconds > 0
    && finnhubSeconds * 1000 <= receivedAt + 5 * 60_000
    ? new Date(finnhubSeconds * 1000).toISOString() : null;
  return {
    price,
    asOf: new Date(receivedAt).toISOString(), // istante della risposta, NON istante del mercato
    marketAsOf: provider === 'alphavantage' ? (json?.['Global Quote']?.['07. latest trading day'] || null) : finnhubTime,
    source: p.label,
    freshness: provider === 'alphavantage' ? 'end-of-day' : finnhubTime ? 'source-timestamp' : 'latest-available',
  };
}

// Una chiave salvata non garantisce una risposta: prova la seconda fonte già
// configurata, senza inventare un prezzo se tutte falliscono. FMP è solo
// ricerca/storico qui; il piano gratuito non è un backup quotazioni intraday.
export async function fetchConfiguredStockPrice(symbol, { keys = {}, fetchImpl = fetchWithTimeout } = {}) {
  const available = STOCK_PROVIDER_IDS.filter(provider => keys[provider]);
  if (!available.length) throw new Error('Collega Finnhub, Alpha Vantage o Twelve Data per vedere una quotazione aggiornata.');
  let lastError;
  for (const provider of available) {
    try {
      return await fetchLiveStockPrice(symbol, { provider, apiKey: keys[provider], fetchImpl });
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Nessuna fonte di prezzo disponibile: ${lastError?.message || 'riprova più tardi.'}`);
}
