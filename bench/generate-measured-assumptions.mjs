// Genera src/alpha/measured-assumptions.json — "npm run bench:measured".
//
// IL GAP CHE CHIUDE: net-worth.js (già LIVE, mostra le proiezioni Monte Carlo
// agli utenti) usa mu/sigma DICHIARATI dalla letteratura sui fattori
// (Fama-French) per la riga 'momentum'/'indice' — onesti come ipotesi, ma
// Momentum possiede GIÀ un backtest walk-forward reale (historical-backtest.js
// + cache di prezzi VERI in bench/data/) che li misura sul serio, e restava
// isolato in un bench. Questo script produce uno SCATTO STATICO (nessuna
// chiamata di rete a runtime: l'app resta 100% on-device) dei risultati
// misurati, bundlato nell'app come qualunque altro asset — sostituisce
// l'ipotesi da manuale con la misura reale, dove esiste una misura reale.
//
// Onestà: lo scatto è DATATO e ricalcolabile (basta rilanciare questo
// script quando la cache di bench/data/*.json si aggiorna) — mai spacciato
// per un flusso live. Copre solo dove abbiamo un backtest vero: SPY
// (indice+momentum) e Bitcoin (cripto). Le altre righe (value/growth/risk/
// reflexivity) restano testuali: non abbiamo un backtest reale per quei
// fattori, quindi non si finge di averne uno.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { walkForwardMomentumBacktest } = await imp('src/alpha/historical-backtest.js');

function loadSeries(file) {
  const raw = JSON.parse(readFileSync(join(root, 'bench/data', file), 'utf8'));
  return raw;
}

function summarize(file, label) {
  const raw = loadSeries(file);
  const bt = walkForwardMomentumBacktest(raw.closes);
  if (!bt) return null;
  return {
    label,
    source: raw.source,
    fetchedAt: raw.fetchedAt,
    sampleMonths: bt.n,
    monthsInMarketPct: bt.monthsInMarketPct,
    buyHold: { mu: bt.buyHold.annReturn, sigma: bt.buyHold.vol, sharpe: bt.buyHold.sharpe, maxDrawdown: bt.buyHold.maxDrawdown },
    momentumTiming: { mu: bt.momentumTiming.annReturn, sigma: bt.momentumTiming.vol, sharpe: bt.momentumTiming.sharpe, maxDrawdown: bt.momentumTiming.maxDrawdown },
  };
}

const out = {
  generatedAt: new Date().toISOString(),
  method: 'walkForwardMomentumBacktest (src/alpha/historical-backtest.js) su prezzi mensili reali, mai look-ahead',
  disclaimer: 'Misura storica walk-forward, non una promessa di rendimento futuro. Ricalcolare periodicamente rilanciando bench/generate-measured-assumptions.mjs.',
  spy: summarize('spy-monthly.json', 'SPY (ETF reale, S&P 500)'),
  btc: summarize('btc-monthly.json', 'Bitcoin'),
};

// File .js (non .json): un import statico `export default {...}` è nativo sia
// per Vite (bundle browser) sia per il test runner Node, senza le sottigliezze
// di import-assertion/attributes sui JSON che spezzavano la build di produzione.
const outPath = join(root, 'src/alpha/measured-assumptions.js');
const header = `// GENERATO da bench/generate-measured-assumptions.mjs — NON modificare a mano.\n// Rilancia lo script quando la cache di bench/data/*.json si aggiorna.\n'use strict';\n\nexport default `;
writeFileSync(outPath, header + JSON.stringify(out, null, 2) + ';\n');
console.log(`Scritto ${outPath}`);
console.log(JSON.stringify(out, null, 2));
