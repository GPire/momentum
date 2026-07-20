// ============================================================
// MARKET DATA — prezzi reali gratuiti, resiliente a CORS e offline
// ============================================================
// Onestà/ingegneria (regola #1): nessun server nostro, nessuno scraping.
// Solo API pubbliche gratuite e documentate, con una CASCATA che gestisce
// esplicitamente il blocco CORS, gli errori HTTP, i rate-limit e l'assenza
// di rete. Mai un crash, mai un prezzo inventato: se non si può aggiornare,
// si usa l'ultima copia buona e la si ETICHETTA come tale.
//
// Parser PURI (testabili senza rete). L'orchestratore accetta `fetchImpl` e
// `cache` iniettabili → testabile con mock, wiring reale in main.js.
// Le serie sono { date:'YYYY-MM-DD', close:number } dalla più vecchia alla più recente.
'use strict';

// ── Parser Stooq (CSV azioni/indici, CORS-friendly: stooq.com/q/d/l/?s=…&i=d) ──
// Formato: Date,Open,High,Low,Close,Volume
export function parseStooqCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  const ci = header.split(',').indexOf('close');
  const di = header.split(',').indexOf('date');
  if (ci < 0 || di < 0) return [];
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const close = parseFloat(cols[ci]);
    const date = cols[di];
    if (Number.isFinite(close) && /^\d{4}-\d{2}-\d{2}$/.test(date)) out.push({ date, close });
  }
  return out;
}

// ── Parser CoinGecko (JSON crypto: /coins/{id}/market_chart?vs_currency=…&days=…) ──
// { prices: [[ms, price], …] }
export function parseCoinGeckoJson(json) {
  const arr = (json && json.prices) || [];
  return arr
    .map(([ms, price]) => ({ date: new Date(ms).toISOString().slice(0, 10), close: +price }))
    .filter(p => Number.isFinite(p.close));
}

// ── Parser CSV generico (per l'import manuale quando CORS blocca tutto) ──
// Rileva la colonna data e la colonna prezzo (close/price/adj close/last).
export function parseGenericCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  // Rileva il delimitatore: se c'è ';' o tab, quello (così la virgola resta
  // separatore decimale); altrimenti ','.
  const delim = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const split = l => l.split(delim);
  const header = split(lines[0]).map(s => s.trim().toLowerCase());
  const di = header.findIndex(h => /date|data/.test(h));
  let pi = header.findIndex(h => /adj.?close|close|price|prezzo|last/.test(h));
  if (pi < 0) pi = header.length - 1;
  if (di < 0) return [];
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = split(lines[i]);
    const raw = (cols[di] || '').trim();
    // normalizza data → YYYY-MM-DD
    let date = raw;
    const m = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) date = raw.slice(0, 10);
    else if (m) { let y = m[3].length === 2 ? '20' + m[3] : m[3]; date = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
    const close = parseFloat(String(cols[pi]).replace(',', '.'));
    if (Number.isFinite(close) && /^\d{4}-\d{2}-\d{2}$/.test(date)) out.push({ date, close });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Sorgenti dichiarate. `build(url)` produce l'URL; `parse` il parser. ──
export const SOURCES = {
  crypto: [
    { id: 'coingecko', url: (s, days = 180) => `https://api.coingecko.com/api/v3/coins/${s}/market_chart?vs_currency=eur&days=${days}`, parse: parseCoinGeckoJson, type: 'json', cors: true },
  ],
  stock: [
    { id: 'stooq', url: (s) => `https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d`, parse: parseStooqCsv, type: 'text', cors: true },
  ],
};

// ── Orchestratore resiliente. Ritorna sempre qualcosa di usabile:
//   { prices, source, asOf, stale, note, priceSource }
// stale=true → dati dalla cache (offline / tutte le fonti fallite).
// priceSource = provenienza ESPLICITA del dato (regola #1, mai ambigua):
//   id fonte live ('coingecko'/'stooq') | 'holt-estimate' (cache + stima)
//   | 'cache' (cache pura) | null (nessun dato). ──
export async function fetchPrices({ symbol, kind = 'crypto', days = 180, fetchImpl, cache }) {
  const sources = SOURCES[kind] || [];
  const errors = [];

  for (const src of sources) {
    try {
      const res = await fetchImpl(src.url(symbol, days));
      if (!res || !res.ok) { errors.push(`${src.id}: HTTP ${res && res.status}`); continue; }
      const raw = src.type === 'json' ? await res.json() : await res.text();
      const prices = src.parse(raw);
      if (prices.length) {
        const payload = { prices, source: src.id, asOf: new Date().toISOString(), stale: false, priceSource: src.id };
        if (cache) await cache.put(`mkt:${kind}:${symbol}`, payload);
        return payload;
      }
      errors.push(`${src.id}: 0 punti`);
    } catch (e) {
      // errore di rete O blocco CORS (fetch rigetta) → si passa alla fonte dopo
      errors.push(`${src.id}: ${e.name === 'TypeError' ? 'CORS/rete' : e.message}`);
    }
  }

  // Tutte le fonti fallite (offline, CORS, rate-limit) → ultima copia buona +
  // STIMA del valore corrente (Holt) se i dati sono vecchi. Onesto: è una stima
  // etichettata, mai spacciata per prezzo reale.
  if (cache) {
    const cached = await cache.get(`mkt:${kind}:${symbol}`);
    if (cached && cached.prices?.length) {
      const est = estimateCurrentPrice(cached.prices, { asOfDate: cached.asOf });
      // priceSource: 'holt-estimate' solo se la stima c'è davvero, altrimenti 'cache' pura
      return { ...cached, stale: true, estimatedNow: est, priceSource: est ? 'holt-estimate' : 'cache', note: `Dati aggiornati al ${cached.asOf?.slice(0, 10)}${est && est.daysAhead > 0 ? ` · stima oggi ~${est.estimate} (Holt, ${est.daysAhead}g)` : ''} (offline o fonte non raggiungibile). ${errors.join('; ')}` };
    }
  }
  // Nessuna copia: si dichiara, si offre l'import CSV manuale. Mai inventare.
  return { prices: [], source: null, asOf: null, stale: true, priceSource: null, note: `Prezzi non disponibili (${errors.join('; ')}). Puoi importare un CSV di prezzi dal tuo broker.` };
}

// Stima del prezzo CORRENTE quando i dati sono vecchi/offline: estrapola con
// il metodo di Holt (livello + trend, doppio smoothing esponenziale) di
// `daysAhead` passi dall'ultimo dato disponibile. Onesto (regola #1): è una
// STIMA etichettata, con quanti giorni di estrapolazione — mai un prezzo reale.
export function estimateCurrentPrice(prices, { asOfDate, now = new Date(), alpha = 0.5, beta = 0.3 } = {}) {
  const closes = (prices || []).map(p => p.close).filter(Number.isFinite);
  if (closes.length < 3) return null;
  let level = closes[0], trend = closes[1] - closes[0];
  for (let i = 1; i < closes.length; i++) {
    const prevLevel = level;
    level = alpha * closes[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const last = prices[prices.length - 1];
  const lastDate = new Date(asOfDate || last.date);
  const daysAhead = Math.max(0, Math.round((new Date(now) - lastDate) / 86_400_000));
  const estimate = +(level + daysAhead * trend).toFixed(4);
  return { estimate, method: 'holt', daysAhead, lastClose: last.close, lastDate: last.date };
}

// ── Merge dei prezzi ricevuti dalla mesh (messaggio price_share). PURO e
// paranoico, stessa filosofia anti-poison di update-ledger: mai fidarsi
// ciecamente di un peer. `peerPayload` è la voce per singolo simbolo
// { kind, asOf, source, series:[{date,close},…] }; `localCached` è la copia
// locale in forma-cache (o null/undefined se non esiste).
// Accetta SOLO se:
//   (a) l'asOf del peer è STRETTAMENTE più recente del locale (newest-wins);
//   (b) la serie è plausibile: date monotone non decrescenti, close > 0, e
//       — se esiste un dato locale — il salto tra ultimo close locale e
//       ultimo close del peer è sotto il 50% (anti-avvelenamento).
// Ritorna l'oggetto vincente in forma-cache con priceSource 'peer:<id>':
// dato REALE (fetchato da un altro nodo, non stimato) → stale:false, ma con
// provenienza esplicita e l'asOf del peer — mai spacciato per fetch locale.
// Rifiuto → null (il chiamante tiene la propria copia).
export function mergePeerPrices(localCached, peerPayload, peerId) {
  const series = peerPayload?.series;
  if (!Array.isArray(series) || !series.length || !peerPayload.asOf) return null;

  // (a) newest-wins: se ho già un dato locale, il peer deve batterlo sull'asOf
  if (localCached?.asOf && !(String(peerPayload.asOf) > String(localCached.asOf))) return null;

  // (b) plausibilità della serie: date monotone non decrescenti, close positivi
  for (let i = 0; i < series.length; i++) {
    const p = series[i];
    if (!p || !Number.isFinite(p.close) || p.close <= 0) return null;
    if (i > 0 && String(p.date) < String(series[i - 1].date)) return null;
  }

  // (b) anti-poison: salto ultimo-close-locale → ultimo-close-peer sotto il 50%
  const localLast = localCached?.prices?.length ? localCached.prices[localCached.prices.length - 1].close : null;
  if (Number.isFinite(localLast) && localLast > 0) {
    const peerLast = series[series.length - 1].close;
    if (Math.abs(peerLast - localLast) / localLast >= 0.5) return null;
  }

  return { prices: series, source: peerPayload.source ?? null, asOf: peerPayload.asOf, stale: false, priceSource: 'peer:' + peerId };
}

// Rendimenti giornalieri da una serie di prezzi (per i moduli alpha).
export function toReturns(prices) {
  const p = (prices || []).map(x => x.close).filter(Number.isFinite);
  const r = [];
  for (let i = 1; i < p.length; i++) r.push((p[i] - p[i - 1]) / p[i - 1]);
  return r;
}
