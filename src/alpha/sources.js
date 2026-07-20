// ============================================================
// SOURCES — registro di fonti certe + verifica incrociata (W17)
// ============================================================
// Versione ONESTA dell'"auto-apprendimento online". Cosa NON facciamo:
// niente crawling generico del web (CORS lo impedisce nel browser e il
// risultato non sarebbe verificabile), niente NLP su articoli spacciato
// per "fact-checking". Cosa facciamo: solo DATI STRUTTURATI (serie
// numeriche datate) da una whitelist di fonti primarie documentate, con
//   1. cross-check numerico tra ≥2 fonti indipendenti quando possibile;
//   2. controllo di plausibilità quando la fonte raggiungibile è una sola;
//   3. un gate esplicito (trainingEligible) che impedisce a QUALSIASI
//      dato non verificato di entrare nell'addestramento.
// Regola #1: mai inventare. Il dato non verificato si può MOSTRARE, ma
// sempre etichettato — e non si impara mai da esso.
// Tutto iniettabile (fetchImpl, cache) → testabile senza rete, come in
// market-data.js, di cui riusiamo i parser già collaudati.
'use strict';

import { parseStooqCsv, parseCoinGeckoJson } from './market-data.js';

// ── Parser FRED (JSON: /fred/series/observations?…&file_type=json) ──
// { observations: [{ date:'YYYY-MM-DD', value:'123.4' }, …] }
// I valori mancanti sono '.': si scartano, non si interpolano di nascosto.
export function parseFredJson(json) {
  const arr = (json && json.observations) || [];
  const out = [];
  for (const o of arr) {
    const close = parseFloat(o && o.value);
    if (Number.isFinite(close) && /^\d{4}-\d{2}-\d{2}$/.test(o && o.date)) out.push({ date: o.date, close });
  }
  return out;
}

// ── Parser ECB Data Portal (CSV: ?format=csvdata, colonne TIME_PERIOD/OBS_VALUE) ──
// Le serie mensili usano 'YYYY-MM' → normalizzate a 'YYYY-MM-01'. Limite noto
// e dichiarato: split su ',' semplice — se una serie avesse campi testuali con
// virgole tra virgolette, le colonne slitterebbero e la riga verrebbe scartata
// (mai un numero sbagliato: al peggio, un punto in meno).
export function parseEcbCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(s => s.trim().toUpperCase());
  const di = header.indexOf('TIME_PERIOD');
  const vi = header.indexOf('OBS_VALUE');
  if (di < 0 || vi < 0) return [];
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const raw = (cols[di] || '').trim();
    const date = /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : raw.slice(0, 10);
    const close = parseFloat(cols[vi]);
    if (Number.isFinite(close) && /^\d{4}-\d{2}-\d{2}$/.test(date)) out.push({ date, close });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Whitelist onesta delle fonti. Ogni voce dichiara COSA offre, COME la
// raggiungiamo e PERCHÉ (o perché no). Le esclusioni documentate fanno parte
// del deliverable: dire chiaramente cosa NON possiamo usare è metà dell'onestà. ──
export const SOURCE_REGISTRY = [
  {
    id: 'coingecko', kind: 'prices', name: 'CoinGecko', trust: 'primary',
    cors: 'yes', type: 'json', parse: parseCoinGeckoJson,
    urlFor: (s, { days = 180 } = {}) => `https://api.coingecko.com/api/v3/coins/${s}/market_chart?vs_currency=eur&days=${days}`,
    note: 'Crypto. Già usata da market-data.js; CORS aperto, rate-limit ~10-30 req/min senza chiave.',
  },
  {
    id: 'stooq', kind: 'prices', name: 'Stooq', trust: 'primary',
    cors: 'yes', type: 'text', parse: parseStooqCsv,
    urlFor: (s) => `https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d`,
    note: 'Azioni/indici/valute in CSV. Già usata da market-data.js; CORS aperto. Simboli in formato Stooq (es. aapl.us).',
  },
  {
    id: 'fred', kind: 'macro', name: 'FRED (Federal Reserve)', trust: 'primary',
    cors: 'key', type: 'json', parse: parseFredJson,
    urlFor: (s, { apiKey } = {}) => `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(s)}&api_key=${apiKey}&file_type=json`,
    note: 'Serie macro USA. Richiede chiave API gratuita; CORS da verificare a runtime. Senza chiave la fonte viene SALTATA e dichiarata, mai simulata.',
  },
  {
    id: 'ecb', kind: 'macro', name: 'ECB Data Portal (SDW REST)', trust: 'primary',
    cors: 'yes', type: 'text', parse: parseEcbCsv,
    urlFor: (s) => `https://data-api.ecb.europa.eu/service/data/${s}?format=csvdata`,
    note: 'Serie macro area euro in CSV. Molte serie sono CORS-aperte, ma va verificato a runtime per singola serie: se il browser blocca, si passa oltre senza fingere.',
  },
  {
    id: 'bloomberg', kind: 'prices', name: 'Bloomberg', trust: 'primary',
    cors: 'no', excluded: true,
    note: 'nessuna API CORS pubblica — esclusa, si usa la fallback chain',
  },
  {
    id: 'yahoo-finance', kind: 'prices', name: 'Yahoo Finance', trust: 'secondary',
    cors: 'no', excluded: true,
    note: 'nessuna API CORS pubblica — esclusa, si usa la fallback chain',
  },
];

// ── Cross-check tra due serie [{date, close}]: si confronta l'ULTIMA data in
// comune (la più recente è quella che conta per decidere se fidarsi oggi).
// Divergenza = |a−b| / media(|a|,|b|) in %. Nessun overlap → non confermabile:
// meglio un onesto "non so" che un falso "confermato". ──
export function crossCheck(seriesA, seriesB, { maxDivergencePct = 2 } = {}) {
  const a = Array.isArray(seriesA) ? seriesA : [];
  const b = Array.isArray(seriesB) ? seriesB : [];
  if (!a.length || !b.length) return { confirmed: false, divergencePct: null, reason: 'serie vuota: cross-check impossibile' };
  const byDateB = new Map();
  for (const p of b) if (p && Number.isFinite(p.close)) byDateB.set(p.date, p.close);
  for (let i = a.length - 1; i >= 0; i--) {
    const p = a[i];
    if (!p || !Number.isFinite(p.close) || !byDateB.has(p.date)) continue;
    const ca = p.close, cb = byDateB.get(p.date);
    const mean = (Math.abs(ca) + Math.abs(cb)) / 2;
    const divergencePct = mean === 0 ? (ca === cb ? 0 : Infinity) : +((Math.abs(ca - cb) / mean) * 100).toFixed(4);
    const confirmed = divergencePct <= maxDivergencePct;
    return {
      confirmed, divergencePct,
      reason: `divergenza ${divergencePct}% ${confirmed ? '≤' : '>'} soglia ${maxDivergencePct}% sul ${p.date}`,
    };
  }
  return { confirmed: false, divergencePct: null, reason: 'nessuna data in comune tra le due serie' };
}

// ── Plausibilità di una singola serie: non prova che i dati siano VERI (per
// quello serve il cross-check), ma scarta i casi palesemente rotti o
// manipolati: date che tornano indietro, prezzi ≤ 0, salti giornalieri
// assurdi, stesso timestamp con valori diversi. ──
export function plausibility(series, { maxDailyJumpPct = 50 } = {}) {
  const s = Array.isArray(series) ? series : [];
  if (!s.length) return { plausible: false, reasons: ['serie vuota'] };
  const reasons = [];
  const seen = new Map();
  for (let i = 0; i < s.length; i++) {
    const p = s[i] || {};
    const prev = i > 0 ? (s[i - 1] || {}) : null;
    if (!Number.isFinite(p.close) || p.close <= 0) { reasons.push(`close non positivo (${p.close}) al ${p.date}`); continue; }
    if (prev && typeof prev.date === 'string' && p.date < prev.date) reasons.push(`date non monotone: ${prev.date} → ${p.date}`);
    if (seen.has(p.date) && seen.get(p.date) !== p.close) reasons.push(`timestamp duplicato ${p.date} con valori diversi`);
    seen.set(p.date, p.close);
    if (prev && Number.isFinite(prev.close) && prev.close > 0) {
      const jump = (Math.abs(p.close - prev.close) / prev.close) * 100;
      if (jump > maxDailyJumpPct) reasons.push(`salto ${jump.toFixed(1)}% > ${maxDailyJumpPct}% tra ${prev.date} e ${p.date}`);
    }
  }
  return { plausible: reasons.length === 0, reasons };
}

// ── Orchestratore verificato. Prova ≥2 fonti utilizzabili (cors!=='no', non
// escluse, del kind giusto) per lo stesso simbolo e ritorna SEMPRE, mai un
// crash e mai un dato inventato:
//   verified:'confirmed'     → 2 fonti concordi (e serie plausibile) → può addestrare
//   verified:'single-source' → 1 sola fonte, ma plausibile → può addestrare
//   verified:'unconfirmed'   → divergenza o implausibilità → SOLO display, con avviso
//   verified:'fallback'      → tutte le fonti giù, ultima copia buona di cache, etichettata
// `source` = fonti consultate (es. 'coingecko+stooq'); `priceSource` = fonte
// della serie effettivamente ritornata. `params` (es. apiKey per FRED) è
// opzionale e passato a urlFor: senza chiave la fonte è saltata, dichiarandolo.
export async function fetchVerified({ symbol, kind = 'prices', fetchImpl, cache, sources = SOURCE_REGISTRY, params = {} }) {
  const cacheKey = `vrf:${kind}:${symbol}`;
  const errors = [];
  const usable = (sources || []).filter(s =>
    s && !s.excluded && s.cors !== 'no' && s.kind === kind &&
    typeof s.parse === 'function' && typeof s.urlFor === 'function');
  // le fonti 'primary' prima delle 'secondary'; a parità, ordine di registro
  const ordered = [...usable].sort((x, y) => (x.trust === 'primary' ? 0 : 1) - (y.trust === 'primary' ? 0 : 1));

  const successes = [];
  for (const src of ordered) {
    if (successes.length >= 2) break; // due fonti indipendenti bastano per il cross-check
    if (src.cors === 'key' && !params.apiKey) { errors.push(`${src.id}: chiave API mancante — saltata, non simulata`); continue; }
    try {
      const res = await fetchImpl(src.urlFor(symbol, params));
      if (!res || !res.ok) { errors.push(`${src.id}: HTTP ${res && res.status}`); continue; }
      const raw = src.type === 'json' ? await res.json() : await res.text();
      const prices = src.parse(raw);
      if (prices.length) successes.push({ src, prices });
      else errors.push(`${src.id}: 0 punti`);
    } catch (e) {
      // errore di rete O blocco CORS (fetch rigetta) → si passa alla fonte dopo
      errors.push(`${src.id}: ${e && e.name === 'TypeError' ? 'CORS/rete' : (e && e.message) || 'errore'}`);
    }
  }

  const asOf = new Date().toISOString();

  if (successes.length >= 2) {
    const [a, b] = successes;
    const chk = crossCheck(a.prices, b.prices);
    const pl = plausibility(a.prices); // due fonti concordi ma serie rotta → comunque niente training
    if (chk.confirmed && pl.plausible) {
      const out = { prices: a.prices, source: `${a.src.id}+${b.src.id}`, asOf, verified: 'confirmed', priceSource: a.src.id, note: `Confermato da due fonti indipendenti (${chk.reason}).` };
      if (cache) await cache.put(cacheKey, out);
      return out;
    }
    return { prices: a.prices, source: `${a.src.id}+${b.src.id}`, asOf, verified: 'unconfirmed', priceSource: a.src.id, note: `NON confermato: ${chk.confirmed ? pl.reasons.join('; ') : chk.reason}. Dati mostrati solo a scopo informativo, esclusi dall'addestramento.` };
  }

  if (successes.length === 1) {
    const { src, prices } = successes[0];
    const pl = plausibility(prices);
    if (pl.plausible) {
      const out = { prices, source: src.id, asOf, verified: 'single-source', priceSource: src.id, note: `Fonte singola (${src.name}) plausibile; cross-check non possibile (${errors.join('; ') || 'nessun’altra fonte per questo simbolo'}).` };
      if (cache) await cache.put(cacheKey, out);
      return out;
    }
    return { prices, source: src.id, asOf, verified: 'unconfirmed', priceSource: src.id, note: `Fonte singola NON plausibile: ${pl.reasons.join('; ')}. Dati mostrati con avviso, esclusi dall'addestramento.` };
  }

  // Tutte le fonti giù (offline, CORS, rate-limit) → ultima copia VERIFICATA
  // in cache, rietichettata 'fallback': utile a schermo, mai per addestrare.
  if (cache) {
    const cached = await cache.get(cacheKey);
    if (cached && cached.prices?.length) {
      return { ...cached, verified: 'fallback', note: `Dati dalla cache del ${cached.asOf?.slice(0, 10)} (fonti non raggiungibili: ${errors.join('; ')}). Esclusi dall'addestramento.` };
    }
  }
  // Nessuna copia: si dichiara. Mai inventare.
  return { prices: [], source: null, asOf: null, verified: 'unconfirmed', priceSource: null, note: `Nessun dato verificabile disponibile (${errors.join('; ') || 'nessuna fonte utilizzabile'}). Riprova online o importa un CSV dal tuo broker.` };
}

// ── Il gate anti-dato-falso: SOLO 'confirmed' e 'single-source' possono
// entrare nell'addestramento. 'unconfirmed' e 'fallback' restano display-only.
// Questa funzione è l'unico punto di decisione: lo scheduler DEVE passarci. ──
export function trainingEligible(result) {
  return !!(result && Array.isArray(result.prices) && result.prices.length &&
    (result.verified === 'confirmed' || result.verified === 'single-source'));
}
