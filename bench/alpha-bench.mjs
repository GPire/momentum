// Backtest riproducibile del portafoglio Alpha — "npm run bench:alpha".
// Walk-forward: pesi stimati sulla PRIMA metà, applicati alla SECONDA (mai
// look-ahead). Confronto ONESTO vs baseline pubbliche: equal-weight e 60/40.
// Regola #1: numeri solo da questo script, baseline oneste, mai "batte Simons".
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = await import(pathToFileURL(join(root, 'src/alpha/portfolio.js')).href);

function mulberry32(seed) {
  return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rnd = mulberry32(20260707);
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// 4 asset con profili diversi (drift giornaliero, volatilità).
const PROFILES = { AZIONI: [0.0006, 0.013], TECH: [0.0009, 0.022], BOND: [0.00018, 0.004], ORO: [0.0003, 0.010] };
const DAYS = 1000;
const returnsByAsset = {};
for (const [t, [mu, sd]] of Object.entries(PROFILES)) returnsByAsset[t] = Array.from({ length: DAYS }, () => mu + sd * gauss());

const half = DAYS / 2;
const firstHalf = Object.fromEntries(Object.entries(returnsByAsset).map(([t, r]) => [t, r.slice(0, half)]));
const secondHalf = Object.fromEntries(Object.entries(returnsByAsset).map(([t, r]) => [t, r.slice(half)]));

// Strategie
const rpW = P.riskParityWeights(firstHalf);
const tickers = Object.keys(returnsByAsset);
const ewW = Object.fromEntries(tickers.map(t => [t, 1 / tickers.length]));
const w6040 = { AZIONI: 0.6, BOND: 0.4 };

const strategies = {
  'Risk-parity (Alpha)': P.portfolioStats(P.portfolioReturns(rpW, secondHalf)),
  'Equal-weight': P.portfolioStats(P.portfolioReturns(ewW, secondHalf)),
  '60/40 (azioni/bond)': P.portfolioStats(P.portfolioReturns(w6040, { AZIONI: secondHalf.AZIONI, BOND: secondHalf.BOND })),
};

console.log(`\nMomentum Alpha bench — walk-forward ${half}→${half} giorni, seed fisso, 4 asset sintetici`);
console.log('(pesi stimati sulla PRIMA metà, applicati alla SECONDA — nessun look-ahead)\n');
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('Strategia', 24) + pad('Rend. ann.', 12) + pad('Volatilità', 12) + pad('Sharpe', 9) + 'MaxDD');
console.log('-'.repeat(66));
for (const [name, s] of Object.entries(strategies)) {
  console.log(pad(name, 24) + pad(`${(s.annReturn * 100).toFixed(1)}%`, 12) + pad(`${(s.vol * 100).toFixed(1)}%`, 12) + pad(s.sharpe.toFixed(2), 9) + `${(s.maxDrawdown * 100).toFixed(1)}%`);
}
console.log('\nRegola: numeri riproducibili. Risk-parity punta a Sharpe migliore / drawdown minore');
console.log('vs le baseline — su questi dati sintetici, non una promessa di rendimento futuro.');
