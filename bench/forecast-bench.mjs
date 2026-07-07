// Benchmark riproducibile del forecast — "npm run bench:forecast".
// Backtest walk-forward: su serie di spesa giornaliera generate con seed
// deterministico (trend + stagionalità settimanale + rumore), si confronta
// la previsione a 7 giorni di Holt-Winters (il motore reale dell'app) col
// baseline naive "domani = media recente". Metrica: MAE relativo (MAPE-like).
// Regola: il numero dichiarato è SOLO quello di questo script.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { HoltWinters } = await import(join(root, 'src/predict/engines.js'));

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Serie realistica: base + trend lieve + picco weekend + rumore.
function makeSeries(seed, days) {
  const rnd = mulberry32(seed);
  const s = [];
  for (let i = 0; i < days; i++) {
    const weekend = (i % 7 === 5 || i % 7 === 6) ? 35 : 0; // sab/dom più spesa
    const trend = i * 0.15;
    const noise = (rnd() - 0.5) * 14;
    s.push(Math.max(0, 30 + trend + weekend + noise));
  }
  return s;
}

const N_SERIES = 40;
const TRAIN = 60, TEST = 7;
let hwErr = 0, naiveErr = 0, denom = 0, hwWins = 0;

for (let k = 0; k < N_SERIES; k++) {
  const full = makeSeries(1000 + k, TRAIN + TEST);
  const train = full.slice(0, TRAIN);
  const actual = full.slice(TRAIN, TRAIN + TEST);

  const hw = new HoltWinters().forecast(train, TEST).forecasted;
  const naiveVal = train.slice(-7).reduce((a, b) => a + b, 0) / 7; // media ultima settimana
  const naive = Array(TEST).fill(naiveVal);

  let hwE = 0, nE = 0, d = 0;
  for (let i = 0; i < TEST; i++) {
    hwE += Math.abs(hw[i] - actual[i]);
    nE += Math.abs(naive[i] - actual[i]);
    d += Math.abs(actual[i]);
  }
  hwErr += hwE; naiveErr += nE; denom += d;
  if (hwE < nE) hwWins++;
}

const hwMape = (hwErr / denom) * 100;
const naiveMape = (naiveErr / denom) * 100;
const improvement = ((naiveMape - hwMape) / naiveMape) * 100;

console.log(`\nMomentum forecast bench — ${N_SERIES} serie, walk-forward ${TRAIN}→${TEST} giorni, seed fisso\n`);
console.log(`  Baseline naive (media ultima settimana):  MAPE ${naiveMape.toFixed(1)}%`);
console.log(`  Holt-Winters (motore Momentum):           MAPE ${hwMape.toFixed(1)}%`);
console.log(`  Miglioramento sul naive:                  ${improvement.toFixed(1)}%`);
console.log(`  Serie in cui HW batte il naive:           ${hwWins}/${N_SERIES}`);
console.log('\nRegola: questo è il benchmark riproducibile del forecast. Nessun altro numero è dichiarabile.');
