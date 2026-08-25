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

import { parseStooqCsv, parseCoinGeckoJson, parseAlphaVantageDailyJson } from './market-data.js';

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

// ── Riga CSV conforme a RFC4180: rispetta i campi tra virgolette (che
// possono contenere virgole, newline e virgolette raddoppiate "").
// BUG REALE trovato integrando BIS (2026-08-05): la loro serie sui tassi ha
// una colonna di descrizione libera con virgole non quotate in modo
// affidabile da uno split(',') ingenuo — ogni riga usciva disallineata e
// veniva scartata per intero (0 punti su 650 righe reali). Split ingenuo
// sostituito ovunque in questo file con questo parser vero.
function splitCsvLine(line) {
  const out = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// ── Parser ECB Data Portal (CSV: ?format=csvdata, colonne TIME_PERIOD/OBS_VALUE) ──
// Le serie mensili usano 'YYYY-MM' → normalizzate a 'YYYY-MM-01'.
export function parseEcbCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map(s => s.trim().toUpperCase());
  const di = header.indexOf('TIME_PERIOD');
  const vi = header.indexOf('OBS_VALUE');
  if (di < 0 || vi < 0) return [];
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const raw = (cols[di] || '').trim();
    const date = /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : raw.slice(0, 10);
    const close = parseFloat(cols[vi]);
    if (Number.isFinite(close) && /^\d{4}-\d{2}-\d{2}$/.test(date)) out.push({ date, close });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Parser DefiLlama (JSON: /v2/historicalChainTvl/{chain} o /protocol/{p}) ──
// [{ date: <secondi unix>, tvl: 123.4 }, …] — a differenza di FRED/ECB la
// data è un timestamp numerico, non una stringa: si converte in ISO prima di
// entrare nel formato comune {date, close} usato da crossCheck/plausibility.
export function parseDefiLlamaTvlJson(json) {
  const arr = Array.isArray(json) ? json : (json?.tvl || []);
  const out = [];
  for (const p of arr) {
    // BUG REALE trovato dal test: `Number(null)` vale 0 (non NaN), quindi un
    // punto con data nulla passava il controllo `isFinite` travestito da
    // 1/1/1970. Si esclude esplicitamente prima della conversione, invece di
    // fidarsi della coercizione automatica di Number().
    if (p?.date === null || p?.date === undefined) continue;
    const ts = Number(p.date);
    const v = Number(p?.tvl);
    if (!Number.isFinite(ts) || !Number.isFinite(v)) continue;
    out.push({ date: new Date(ts * 1000).toISOString().slice(0, 10), close: v });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Parser Eurostat (JSON-stat 2.0: value:{"0":n,...} + dimension.time.
// category.index:{"2024-01":0,...}) — VERIFICATO dal vivo in un vero browser
// (fetch da localhost:5173, non solo curl) il 2026-08-25, richiesta reale a
// ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{dataset}.
// Il formato "flat" del JSON-stat presuppone che, filtrando la query a un
// solo paese/indicatore, TUTTE le altre dimensioni abbiano size=1: in quel
// caso l'indice della dimensione time coincide con la chiave di `value`.
// Se una query restituisse più di una categoria su un'altra dimensione (es.
// più paesi insieme), l'indice andrebbe ricalcolato con la formula generale
// JSON-stat — non implementata qui perché Momentum interroga sempre un solo
// paese/indicatore alla volta: dichiarato esplicitamente, mai un dato
// disallineato spacciato per corretto. ──
export function parseEurostatJsonStat(json) {
  const dim = json && json.dimension;
  const ids = json && json.id;
  const sizes = json && json.size;
  if (!dim || !Array.isArray(ids) || !Array.isArray(sizes)) return [];
  const timeIdx = ids.indexOf('time');
  if (timeIdx < 0) return [];
  const altreDimensioniSingole = sizes.every((s, i) => i === timeIdx || s === 1);
  if (!altreDimensioniSingole) return [];
  const timeCat = dim.time && dim.time.category && dim.time.category.index;
  if (!timeCat) return [];
  const out = [];
  for (const [label, idx] of Object.entries(timeCat)) {
    // Number(null) vale 0 (non NaN) — stesso bug già trovato in
    // parseDefiLlamaTvlJson: un buco nella serie (valore mancante, spesso
    // reso `null` nel JSON-stat) va escluso ESPLICITAMENTE prima della
    // coercizione, altrimenti diventa un falso zero.
    const raw = json.value && json.value[idx];
    if (raw === null || raw === undefined) continue;
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    const date = /^\d{4}-\d{2}$/.test(label) ? `${label}-01` : (/^\d{4}$/.test(label) ? `${label}-01-01` : label);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) out.push({ date, close: v });
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
    // BUG REALE TROVATO (2026-07-27): questa voce dichiarava 'cors: yes' MAI
    // verificato a runtime — testato ora con una chiamata reale dal browser
    // (fetch('https://stooq.com/q/d/l/?s=aapl.us&i=d')) → bloccato, nessun
    // header CORS. Questo significava che idleFetchPrices falliva in
    // silenzio su OGNI posizione azionaria/indice da chissà quando (solo le
    // cripto via CoinGecko funzionavano). Corretto: esclusa, sostituita da
    // Alpha Vantage (sotto), verificata funzionante con una chiamata reale.
    id: 'stooq', kind: 'prices', name: 'Stooq', trust: 'primary',
    cors: 'no', excluded: true, type: 'text', parse: parseStooqCsv,
    urlFor: (s) => `https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d`,
    note: 'VERIFICATO BLOCCATO (nessun header CORS) — esclusa, si usa la fallback chain. Parser tenuto per un eventuale import CSV manuale.',
  },
  {
    id: 'alphavantage', kind: 'prices', name: 'Alpha Vantage', trust: 'primary',
    cors: 'key', type: 'json', parse: parseAlphaVantageDailyJson,
    urlFor: (s, { apiKey } = {}) => `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(s)}&apikey=${encodeURIComponent(apiKey)}&outputsize=compact`,
    note: 'Azioni/indici/ETF. VERIFICATO chiamabile direttamente dal browser (CORS aperto) con una chiave gratuita ottenuta dall\'utente stesso (mai una chiave condivisa Momentum). Senza chiave: saltata, dichiarato. Limite gratuito: 25 richieste/giorno.',
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
    // VERIFICATO dal vivo (2026-08-25, ricerca di mercato + riconciliazione
    // con un vero fetch da browser, non solo curl): formato CSV
    // (`format=csvfilewithlabels`) usa le STESSE colonne TIME_PERIOD/OBS_VALUE
    // di ECB — riusa parseEcbCsv, nessun parser nuovo necessario.
    id: 'oecd', kind: 'macro', name: 'OECD SDMX API', trust: 'primary',
    cors: 'yes', type: 'text', parse: parseEcbCsv,
    // BUG REALE TROVATO integrando la catena di fallback (2026-08-25): senza
    // `startPeriod`, l'API torna l'INTERA storia del dataflow (858 punti dal
    // 1948 per la disoccupazione USA) — include lo shock COVID 2020 (3,5%→
    // 14,7% in due mesi), che la funzione plausibility() di questo file
    // segnala giustamente come "salto assurdo" (pensata per tassi di policy
    // stabili, non per crisi reali). Non è un bug di plausibility() da
    // allentare — è la query che chiedeva più storia di quanta serva:
    // `startPeriod` limita alla finestra recente che il contesto macro usa
    // davvero (allineamento settimanale, tipicamente <52 settimane).
    urlFor: (dataflowConChiave, { startPeriod = '2022-01' } = {}) => `https://sdmx.oecd.org/public/rest/data/${dataflowConChiave}?format=csvfilewithlabels&startPeriod=${encodeURIComponent(startPeriod)}`,
    note: 'VERIFICATO dal vivo in un vero browser (200 OK, CORS confermato): dati macro OCSE (disoccupazione, indicatori compositi, ecc.), copertura globale non solo EU/USA, gratis senza chiave. `dataflowConChiave` include già dataset+filtri (es. "OECD.SDD.TPS,DSD_LFS@DF_IALFS_UNE_M,1.0/USA..._Z.Y._T.Y_GE15..M"), non un semplice ticker. `startPeriod` di default limita a dati recenti (evita shock storici tipo COVID che farebbero scattare il controllo di plausibilità pensato per serie stabili).',
  },
  {
    // VERIFICATO dal vivo (2026-08-25): fetch reale da browser, 200 OK,
    // JSON-stat 2.0 con Access-Control-Allow-Origin:* esplicito.
    id: 'eurostat', kind: 'macro', name: 'Eurostat Statistics API', trust: 'primary',
    cors: 'yes', type: 'json', parse: parseEurostatJsonStat,
    urlFor: (dataset, { params = '' } = {}) => `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${dataset}?format=JSON&lang=EN${params}`,
    // ATTENZIONE OPERATIVA (bug reale trovato dal vivo, 2026-08-25): chiamare
    // questa fonte SENZA `params` (nessun filtro geo/indicatore) ha fatto
    // andare in stallo per >45s una vera scheda del browser — il dataset
    // completo (ogni Paese × ogni categoria COICOP × tutta la storia) è
    // enorme. `parseEurostatJsonStat` resta comunque sicuro in quel caso
    // (ritorna [] perché rileva più di una categoria sulle altre dimensioni,
    // mai un dato disallineato) — ma il fetch stesso può appendere a lungo
    // PRIMA che il parser abbia la possibilità di scartarlo. `params` NON è
    // opzionale nella pratica: sempre con almeno `&geo=XX` e un filtro
    // sull'indicatore (es. "&geo=IT&coicop=CP00&sinceTimePeriod=2024-01").
    note: 'VERIFICATO dal vivo in un vero browser: dati macro EU granulari (inflazione HICP, disoccupazione, ecc. per singolo Paese), aggiornati 2 volte/giorno, gratis senza chiave. `params` porta i filtri e va SEMPRE specificato (es. "&geo=IT&coicop=CP00&sinceTimePeriod=2024-01") — senza, il dataset completo non filtrato può bloccare a lungo il fetch (verificato dal vivo). Un solo Paese/indicatore per query, vedi limite dichiarato in parseEurostatJsonStat.',
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
  {
    // VERIFICATO dal vivo (2026-08-05): richiesta reale dal browser a
    // stats.bis.org/api/v2/... → 200, CSV vero con tassi ufficiali delle
    // banche centrali (colonne TIME_PERIOD/OBS_VALUE, stesso formato ECB).
    id: 'bis', kind: 'macro', name: 'BIS (Bank for International Settlements)', trust: 'primary',
    cors: 'yes', type: 'text', parse: parseEcbCsv,
    urlFor: (dataflow, { key = 'M.IT' } = {}) => `https://stats.bis.org/api/v2/data/dataflow/BIS/${dataflow}/1.0/${key}?format=csv`,
    note: 'VERIFICATO dal vivo: tassi ufficiali e statistiche del sistema finanziario globale. CORS aperto confermato con richiesta reale (dataflow WS_CBPOL, tassi di policy).',
  },
  {
    // VERIFICATO dal vivo (2026-08-05): api.llama.fi/v2/historicalChainTvl/…
    // → 200, JSON reale [{date,tvl}] con storico completo dal 2017.
    id: 'defillama', kind: 'defi', name: 'DefiLlama', trust: 'primary',
    cors: 'yes', type: 'json', parse: parseDefiLlamaTvlJson,
    urlFor: (chainOrProtocol, { protocol = false } = {}) => protocol
      ? `https://api.llama.fi/protocol/${chainOrProtocol}`
      : `https://api.llama.fi/v2/historicalChainTvl/${chainOrProtocol}`,
    note: 'VERIFICATO dal vivo: valore totale bloccato (TVL) in DeFi, per chain o per singolo protocollo. Nessuna chiave richiesta, CORS aperto confermato con richiesta reale.',
  },
  // ── Verificate dal vivo (2026-08-05) e SCARTATE, con il motivo esatto ──
  // Onestà: elencare cosa NON funziona è parte del deliverable tanto quanto
  // ciò che funziona, altrimenti la stessa domanda tornerebbe a ogni sessione.
  {
    id: 'sec-edgar', kind: 'filings', name: 'SEC EDGAR', trust: 'primary',
    cors: 'no', excluded: true,
    note: 'VERIFICATO BLOCCATO dal browser (Failed to fetch, sia su data.sec.gov che su www.sec.gov) — la SEC richiede un User-Agent identificativo che un fetch da pagina web non può impostare in modo affidabile. Serve un canale server-side, che qui non esiste per scelta architetturale.',
  },
  {
    id: 'bancaditalia', kind: 'macro', name: 'Banca d\'Italia (statistiche)', trust: 'primary',
    cors: 'no', excluded: true,
    note: 'VERIFICATO BLOCCATO dal browser su due endpoint SDMX diversi (Failed to fetch) — nessuna API CORS pubblica raggiungibile da pagina web.',
  },
  {
    id: 'istat', kind: 'macro', name: 'ISTAT', trust: 'primary',
    cors: 'unknown', excluded: true,
    note: 'NON VERIFICABILE nel tempo a disposizione: il servizio SDMX (due endpoint diversi provati) non ha risposto entro un tempo ragionevole — non è uno "Failed to fetch" netto come Banca d\'Italia, quindi non si dichiara "bloccato" con certezza, solo non ancora utilizzabile. Da riprovare in una sessione dedicata.',
  },
  {
    id: 'agenzia-entrate', kind: 'fiscal', name: 'Agenzia delle Entrate', trust: 'primary',
    cors: 'no', excluded: true,
    note: 'VERIFICATO BLOCCATO dal browser. In ogni caso è un portale HTML per persone, non un\'API dati strutturati: anche se raggiungibile, non darebbe un payload utilizzabile dal validatore anti-veleno di tax-rules.js. Le regole fiscali restano curate a mano nel codice, con auto-aggiornamento firmato (core/auto-update.js) da una fonte che l\'app deve ospitare essa stessa.',
  },
  {
    id: 'inps', kind: 'fiscal', name: 'INPS', trust: 'primary',
    cors: 'no', excluded: true,
    note: 'VERIFICATO BLOCCATO dal browser (portale HTML, non un\'API dati) — stesso limite di Agenzia delle Entrate.',
  },
  {
    id: 'coinmarketcap', kind: 'prices', name: 'CoinMarketCap', trust: 'secondary',
    cors: 'no', excluded: true,
    note: 'VERIFICATO BLOCCATO dal browser — la loro API richiede la chiave in un header e per policy è pensata per uso server-side, non per chiamate dirette dal browser di un utente.',
  },
  {
    id: 'messari', kind: 'prices', name: 'Messari', trust: 'secondary',
    cors: 'no', excluded: true,
    note: 'VERIFICATO BLOCCATO dal browser (Failed to fetch) sul livello gratuito.',
  },
  {
    id: 'ishares', kind: 'prices', name: 'iShares (holdings ETF)', trust: 'primary',
    cors: 'no', excluded: true,
    note: 'VERIFICATO BLOCCATO dal browser sul download CSV delle holdings — nessuna API CORS pubblica.',
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
// `richiedePositivo` di default true (comportamento originale, corretto per
// PREZZI di mercato: un'azione o una cripto a zero o sotto zero è sempre un
// dato rotto). BUG REALE trovato integrando le serie macro (2026-08-05): un
// TASSO di riferimento può restare esattamente a 0% per anni (la BCE lo ha
// tenuto lì dal 2016 al 2022) o persino sotto zero (il tasso sui depositi
// BCE è stato negativo nello stesso periodo) — questo NON è un dato rotto,
// è la realtà macroeconomica. La funzione trattava ogni giorno a tasso zero
// come "close non positivo", scartando anni di dati reali e corretti. Chi
// chiama per una serie macro/tasso deve passare `richiedePositivo: false`.
// `maxDailyJumpAbs`: usato SOLO quando richiedePositivo=false (serie che
// possono attraversare lo zero, come un tasso). BUG REALE trovato subito
// dopo aver corretto quello dello zero (2026-08-05): il controllo
// percentuale RELATIVO esplode vicino allo zero — un tasso che passa da
// 0,05% a 0,10% è "un salto del 100%" per la formula, ma nella realtà è un
// movimento di 0,05 punti, ininfluente. Per i prezzi (sempre ben lontani da
// zero) la percentuale relativa resta corretta e resta il default.
export function plausibility(series, { maxDailyJumpPct = 50, maxDailyJumpAbs = 5, richiedePositivo = true } = {}) {
  const s = Array.isArray(series) ? series : [];
  if (!s.length) return { plausible: false, reasons: ['serie vuota'] };
  const reasons = [];
  const seen = new Map();
  for (let i = 0; i < s.length; i++) {
    const p = s[i] || {};
    const prev = i > 0 ? (s[i - 1] || {}) : null;
    if (!Number.isFinite(p.close) || (richiedePositivo && p.close <= 0)) { reasons.push(`close ${richiedePositivo ? 'non positivo' : 'non numerico'} (${p.close}) al ${p.date}`); continue; }
    if (prev && typeof prev.date === 'string' && p.date < prev.date) reasons.push(`date non monotone: ${prev.date} → ${p.date}`);
    if (seen.has(p.date) && seen.get(p.date) !== p.close) reasons.push(`timestamp duplicato ${p.date} con valori diversi`);
    seen.set(p.date, p.close);
    if (prev && Number.isFinite(prev.close)) {
      if (!richiedePositivo) {
        const saltoAssoluto = Math.abs(p.close - prev.close);
        if (saltoAssoluto > maxDailyJumpAbs) reasons.push(`salto di ${saltoAssoluto.toFixed(2)} punti > ${maxDailyJumpAbs} tra ${prev.date} e ${p.date}`);
      } else if (prev.close > 0) {
        const jump = (Math.abs(p.close - prev.close) / prev.close) * 100;
        if (jump > maxDailyJumpPct) reasons.push(`salto ${jump.toFixed(1)}% > ${maxDailyJumpPct}% tra ${prev.date} e ${p.date}`);
      }
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
    const pl = plausibility(a.prices, { richiedePositivo: kind !== 'macro' }); // un tasso può essere zero o negativo; un prezzo di mercato no
    if (chk.confirmed && pl.plausible) {
      const out = { prices: a.prices, source: `${a.src.id}+${b.src.id}`, asOf, verified: 'confirmed', priceSource: a.src.id, note: `Confermato da due fonti indipendenti (${chk.reason}).` };
      if (cache) await cache.put(cacheKey, out);
      return out;
    }
    return { prices: a.prices, source: `${a.src.id}+${b.src.id}`, asOf, verified: 'unconfirmed', priceSource: a.src.id, note: `NON confermato: ${chk.confirmed ? pl.reasons.join('; ') : chk.reason}. Dati mostrati solo a scopo informativo, esclusi dall'addestramento.` };
  }

  if (successes.length === 1) {
    const { src, prices } = successes[0];
    const pl = plausibility(prices, { richiedePositivo: kind !== 'macro' });
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
