// Backtest delle strategie Alpha su dati REALI di mercato (Wave 10+ v10) —
// "npm run bench:alpha-real". A differenza di alpha-bench.mjs (4 asset
// SINTETICI, dichiarati tali), questo scarica e cachea prezzi mensili VERI
// da Yahoo Finance: S&P 500 (^GSPC, dal 1984 — 41+ anni), SPY (ETF reale
// tradeable, dal 1993), Bitcoin (BTC-USD, dal 2014 — non prima: Bitcoin non
// esisteva prima, non è un limite del fetch).
//
// Onestà (regola #1): questo NON e' un training di rete neurale sui prezzi
// (servirebbe un modello sequenziale + dataset enorme, fuori scope
// on-device) — è un BACKTEST walk-forward di una strategia GIA' reale
// (momentumScore, factors.js) su dati storici veri, con sanity-check che
// dimostra che i crolli noti (dot-com 2000, crisi 2008-09, covid 2020, bear
// 2022) sono davvero nella serie. Cache locale in bench/data/*.json (fonte +
// data di fetch documentate) → riproducibile offline dopo il primo download.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { computeReturns, walkForwardMomentumBacktest, detectKnownCrashes } = await imp('src/alpha/historical-backtest.js');

const dataDir = join(root, 'bench/data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const SYMBOLS = [
  { symbol: '%5EGSPC', name: 'S&P 500 (indice)', file: 'sp500-monthly.json' },
  { symbol: 'SPY', name: 'SPY (ETF reale)', file: 'spy-monthly.json' },
  { symbol: 'BTC-USD', name: 'Bitcoin', file: 'btc-monthly.json' },
];

async function fetchOrLoad({ symbol, name, file }) {
  const path = join(dataDir, file);
  if (existsSync(path)) {
    const cached = JSON.parse(readFileSync(path, 'utf8'));
    console.log(`${name}: cache locale (${cached.dates.length} punti, scaricati ${cached.fetchedAt.slice(0, 10)}, fonte ${cached.source}).`);
    return cached;
  }
  console.log(`${name}: nessuna cache, scarico da Yahoo Finance...`);
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=max&interval=1mo`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const r = j.chart?.result?.[0];
    if (!r) throw new Error('risposta senza dati (rate-limit o simbolo non valido)');
    const dates = r.timestamp.map(t => new Date(t * 1000).toISOString().slice(0, 7));
    const closes = r.indicators.quote[0].close;
    const payload = { symbol, name, source: 'Yahoo Finance (query1.finance.yahoo.com, range=max, interval=1mo)', fetchedAt: new Date().toISOString(), dates, closes };
    writeFileSync(path, JSON.stringify(payload));
    console.log(`${name}: scaricati ${dates.length} punti (${dates[0]} → ${dates[dates.length - 1]}), cache salvata.`);
    return payload;
  } catch (e) {
    console.log(`${name}: FETCH FALLITO (${e.message}) e nessuna cache disponibile — salto questo simbolo. Riprova quando la rete è disponibile.`);
    return null;
  }
}

console.log('\n=== ALPHA BENCH REALE — dati di mercato VERI, walk-forward, mai sintetici ===\n');
const pad = (s, n) => String(s).padEnd(n);

for (const spec of SYMBOLS) {
  const data = await fetchOrLoad(spec);
  if (!data) continue;
  const years = ((new Date(data.dates[data.dates.length - 1]) - new Date(data.dates[0])) / (365.25 * 86400 * 1000)).toFixed(1);
  console.log(`\n--- ${spec.name} (${data.dates[0]} → ${data.dates[data.dates.length - 1]}, ${years} anni, ${data.closes.length} punti mensili) ---`);

  const crashes = detectKnownCrashes(data.dates, data.closes, { minDrawdownPct: 15 });
  if (crashes.length) {
    console.log(`Sanity-check (drawdown reali ≥15% rilevati, prova che i dati sono genuini):`);
    for (const c of crashes) console.log(`  ${c.fromDate} → ${c.toDate}: -${c.drawdownPct}%`);
  } else {
    console.log('Nessun drawdown ≥15% in questa serie.');
  }

  const bt = walkForwardMomentumBacktest(data.closes, { lookback: 15, periodsPerYear: 12 });
  if (!bt) { console.log('Storico insufficiente per un walk-forward onesto (serve più dati).'); continue; }
  console.log(`\nWalk-forward momentum-timing vs buy&hold (${bt.n} mesi out-of-sample, mai look-ahead):`);
  console.log(pad('Strategia', 22) + pad('Rend. ann.', 12) + pad('Volatilità', 12) + pad('Sharpe', 9) + 'MaxDD');
  console.log('-'.repeat(65));
  console.log(pad('Buy & hold', 22) + pad(`${(bt.buyHold.annReturn * 100).toFixed(1)}%`, 12) + pad(`${(bt.buyHold.vol * 100).toFixed(1)}%`, 12) + pad(bt.buyHold.sharpe.toFixed(2), 9) + `${(bt.buyHold.maxDrawdown * 100).toFixed(1)}%`);
  console.log(pad(`Momentum-timing (${bt.monthsInMarketPct}% mesi dentro)`, 22) + pad(`${(bt.momentumTiming.annReturn * 100).toFixed(1)}%`, 12) + pad(`${(bt.momentumTiming.vol * 100).toFixed(1)}%`, 12) + pad(bt.momentumTiming.sharpe.toFixed(2), 9) + `${(bt.momentumTiming.maxDrawdown * 100).toFixed(1)}%`);
}

console.log('\nOnestà: backtest storico su dati reali, NON una promessa di rendimento futuro.');
console.log('Il momentum-timing riduce tipicamente la volatilità/drawdown stando fuori nei trend');
console.log('ribassisti — se questo costi in rendimento totale lo dice la tabella, non il claim.');
