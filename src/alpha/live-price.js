// ============================================================
// PREZZO LIVE — solo cripto, verificato CORS-compatibile (v1)
// ============================================================
// Onestà tecnica (regola #1 del progetto, "100% on-device"): quella regola
// dice che i TUOI DATI PERSONALI (spese, transazioni, saldo) non escono MAI
// dal dispositivo — non dice che l'app non possa MAI leggere un dato PUBBLICO
// da internet. Sono due categorie diverse: qui non esce nessuna informazione
// dell'utente, entra solo un prezzo pubblico, e SOLO quando l'utente tocca
// esplicitamente "Aggiorna" (mai in background, mai automatico).
//
// Verificato con una chiamata REALE prima di scrivere questo modulo (non
// assunto): Yahoo Finance e Stooq bloccano le richieste dirette dal browser
// (nessun header CORS) — servirebbe un server-proxy, che reintrodurrebbe
// esattamente la dipendenza da server che il progetto rifiuta. CoinGecko
// invece espone un'API pubblica CORS-abilitata, chiamabile direttamente dal
// dispositivo dell'utente senza alcun intermediario Momentum.
// LIMITE ONESTO: questo copre SOLO le cripto (dove CoinGecko risponde). Per
// azioni/indici (S&P 500, SPY...) non esiste oggi una fonte gratuita
// chiamabile direttamente dal browser — restano sullo scatto statico datato
// (src/alpha/measured-assumptions.js), mai spacciato per un dato live.
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

// Prezzo live di UNA cripto in EUR. Ritorna { price, asOf } o lancia un errore
// con un messaggio onesto (mai un numero inventato se la rete fallisce).
export async function fetchLiveCryptoPrice(coin = 'bitcoin', { vsCurrency = 'eur', fetchImpl = fetchWithTimeout } = {}) {
  const id = COINGECKO_IDS[coin.toLowerCase()] || coin.toLowerCase();
  let res;
  try {
    res = await fetchImpl(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=${encodeURIComponent(vsCurrency)}`);
  } catch (e) {
    throw new Error('Rete non disponibile: resto sul dato storico.');
  }
  if (!res.ok) throw new Error(`CoinGecko ha risposto ${res.status}: resto sul dato storico.`);
  const json = await res.json();
  const price = json?.[id]?.[vsCurrency];
  if (typeof price !== 'number') throw new Error('Prezzo non trovato per questa cripto: resto sul dato storico.');
  return { price, asOf: new Date().toISOString(), source: 'CoinGecko (pubblico, nessun dato personale inviato)' };
}

// ── AZIONI/INDICI LIVE — verificato con chiamata reale, non assunto ─────────
// A differenza di Yahoo Finance/Stooq (bloccano il browser, nessun header
// CORS — servirebbe un proxy, cioè un server Momentum: esattamente ciò che il
// progetto rifiuta), Alpha Vantage e Twelve Data rispondono DIRETTAMENTE dal
// dispositivo con una chiave gratuita che l'UTENTE ottiene da sé (pochi
// secondi, nessuna carta, nessun account Momentum). La chiave vive SOLO nel
// vault locale dell'utente — mai inviata a un server Momentum, perché non ne
// esiste uno. Due provider supportati (non uno solo): se uno cambia o
// deprecata l'endpoint gratuito, l'altro resta un piano B onesto.
const STOCK_PROVIDERS = {
  alphavantage: {
    label: 'Alpha Vantage',
    url: (symbol, key) => `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`,
    extract: (json) => {
      const q = json?.['Global Quote'];
      const price = q && parseFloat(q['05. price']);
      return Number.isFinite(price) ? price : null;
    },
    rateLimitHint: 'gratis: 25 richieste al giorno',
  },
  twelvedata: {
    label: 'Twelve Data',
    url: (symbol, key) => `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`,
    extract: (json) => {
      const price = json?.price !== undefined ? parseFloat(json.price) : null;
      return Number.isFinite(price) ? price : null;
    },
    rateLimitHint: 'gratis: ~800 richieste al giorno (8/minuto)',
  },
};

export const STOCK_PROVIDER_IDS = Object.keys(STOCK_PROVIDERS);

// Prezzo live di un'azione/indice/ETF (es. "SPY", "AAPL"). Richiede una chiave
// gratuita fornita dall'UTENTE (mai una chiave condivisa Momentum: quella
// legherebbe tutti gli utenti a un unico limite di richieste e a un servizio
// terzo gestito da noi, il contrario di "on-device"). Senza chiave: tace
// esplicitamente, non prova a indovinare un provider.
export async function fetchLiveStockPrice(symbol, { provider = 'alphavantage', apiKey, fetchImpl = fetchWithTimeout } = {}) {
  if (!apiKey) throw new Error('Serve una chiave API personale (gratuita) per i prezzi live di azioni/indici.');
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
  if (json?.Note || json?.Information) {
    // Alpha Vantage restituisce 200 anche quando il limite giornaliero è
    // esaurito, con un messaggio in 'Note'/'Information' invece del prezzo:
    // onesto segnalarlo come tale, non come "prezzo non trovato" generico.
    throw new Error(`${p.label}: limite richieste raggiunto (${p.rateLimitHint}). Riprova più tardi.`);
  }
  const price = p.extract(json);
  if (price === null) throw new Error(`Prezzo non trovato per "${symbol}" su ${p.label}: resto sul dato storico.`);
  return { price, asOf: new Date().toISOString(), source: `${p.label} (chiave personale dell'utente, nessun server Momentum coinvolto)` };
}
