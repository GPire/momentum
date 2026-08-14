// Scarica e mette in cache prezzi mensili REALI dei settori S&P 500 (SPDR
// Select Sector ETF) da Yahoo Finance — "npm run bench:sectors".
//
// Questo script gira in Node, a tempo di sviluppo (mai a runtime nell'app:
// l'app resta 100% on-device). Serve a produrre in bench/data/*.json uno
// snapshot dei prezzi reali che generate-measured-assumptions.mjs poi
// trasforma in backtest misurati (mai simulati).
//
// Onestà sui limiti: gli ETF settoriali SPDR sono nati a fine 1998, quindi
// "40 anni di storia per settore" non è materialmente possibile — la storia
// reale disponibile è ~27 anni per la maggior parte, meno per XLRE/XLC
// (nati 2015/2018). Ogni file dichiara fetchedAt e la data di inizio reale,
// mai un periodo più lungo di quello davvero scaricato.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Solo settori con almeno ~10 anni di storia reale al momento della scrittura.
const SECTORS = [
  { symbol: 'XLK', name: 'Technology Select Sector' },
  { symbol: 'XLF', name: 'Financial Select Sector' },
  { symbol: 'XLE', name: 'Energy Select Sector' },
  { symbol: 'XLV', name: 'Health Care Select Sector' },
  { symbol: 'XLY', name: 'Consumer Discretionary Select Sector' },
  { symbol: 'XLP', name: 'Consumer Staples Select Sector' },
  { symbol: 'XLI', name: 'Industrial Select Sector' },
  { symbol: 'XLB', name: 'Materials Select Sector' },
  { symbol: 'XLU', name: 'Utilities Select Sector' },
  { symbol: 'XLRE', name: 'Real Estate Select Sector' },
];

async function fetchMonthly(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=max&interval=1mo`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error(`${symbol}: risposta senza dati`);
  const ts = r.timestamp || [];
  const closes = r.indicators?.quote?.[0]?.close || [];
  // ⚠️ IL MESE FANTASMA (corretto il 2026-08-14, dopo averlo trovato dentro il
  // pannello in produzione). Con interval=1mo Yahoo restituisce il mese IN
  // CORSO come riga a se' stante ACCANTO all'ultimo mese chiuso, quindi lo
  // stesso 'YYYY-MM' compare due volte. Chi calcola i rendimenti dalle
  // chiusure ottiene cosi' un mese in piu' con variazione ZERO ESATTA — che
  // per nove settori insieme e' il caso limite di massima concordanza, e
  // falsava dispersione, correlazioni e indice di paura (percentile di
  // dispersione 0,003 invece di 0,915).
  // Qui si tiene UNA sola riga per mese, l'ULTIMA (la chiusura piu' recente
  // di quel mese), e si scarta comunque il mese in corso: un mese non ancora
  // finito non e' un dato mensile, e mostrarlo come tale sarebbe il dato falso
  // piu' visibile di tutti.
  const meseCorrente = new Date().toISOString().slice(0, 7);
  const perMese = new Map();
  for (let i = 0; i < ts.length; i++) {
    if (!Number.isFinite(closes[i])) continue;
    const d = new Date(ts[i] * 1000);
    const mese = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (mese >= meseCorrente) continue;
    perMese.set(mese, closes[i]); // l'ultima osservazione del mese vince
  }
  const dates = [...perMese.keys()].sort();
  const outCloses = dates.map((m) => perMese.get(m));
  return { dates, closes: outCloses };
}

for (const { symbol, name } of SECTORS) {
  try {
    const { dates, closes } = await fetchMonthly(symbol);
    if (dates.length < 24) { console.warn(`${symbol}: solo ${dates.length} mesi, saltato (troppo pochi per un backtest onesto)`); continue; }
    const out = {
      symbol,
      name: `${name} (${symbol})`,
      source: 'Yahoo Finance (query1.finance.yahoo.com, range=max, interval=1mo)',
      fetchedAt: new Date().toISOString(),
      dates,
      closes,
    };
    writeFileSync(join(root, 'bench/data', `sector-${symbol.toLowerCase()}-monthly.json`), JSON.stringify(out));
    console.log(`${symbol}: ${dates.length} mesi, dal ${dates[0]} al ${dates[dates.length - 1]}`);
  } catch (e) {
    console.warn(`${symbol}: fallito (${e.message}) — nessun dato inventato, il settore resta escluso`);
  }
}
