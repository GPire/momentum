// ABLATION del primitivo proprietario — "npm run bench:ablation".
//
// LA DOMANDA ONESTA che il consiglio ha posto al progetto: il `k` ADATTIVO
// (poolingStrength decide da solo quanto generalizzare dall'eterogeneita' dei
// figli) fa una differenza MISURABILE rispetto a un `k` FISSO? E l'intera
// gerarchia batte una BASELINE FORTE (backoff sul primo token), non lo strawman
// "chiave piatta"? Finche' non c'e' questo numero, "architettura innovativa" e'
// un'etichetta, non un fatto (regola n.1 applicata a noi stessi).
//
// PROTOCOLLO senza scorciatoie che gonfino il numero:
// - Catene generate con seed deterministico; varianti di test MAI viste in train.
// - Caso 1 "catene pure": ogni catena = una categoria (il `k` conta poco: i rami
//   sono omogenei, il pooling satura). Serve come controllo.
// - Caso 2 "catene MISTE": una quota di transazioni della catena e' un'altra
//   categoria. QUI i rami sono eterogenei ed e' dove il `k` adattivo, se vale,
//   deve battere il `k` fisso: deve smettere di generalizzare sui rami incoerenti.
// - Baseline FORTE = backoff sul primo token (maggioranza per primo token). E'
//   cio' che un ingegnere qualunque scriverebbe in 10 righe: il vero avversario.
// - Ogni condizione su piu' SEED; riportiamo media e deviazione (il guadagno
//   vale solo se supera la varianza da seed).
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { initMerchantHierarchy, observeMerchant, predictMerchant, merchantPath } =
  await imp('src/ai/merchant-hierarchy.js');

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Catene reali + categoria "principale". In MISTE una quota va a una 2a categoria.
const CHAINS = [
  ['ESSELUNGA', 'spesa', 'trasporti'],   // il super vende anche carburante
  ['CONAD', 'spesa', 'svago'],
  ['CARREFOUR', 'spesa', 'casa'],
  ['COOP', 'spesa', 'svago'],
  ['LIDL', 'spesa', 'trasporti'],
  ['Q8', 'trasporti', 'spesa'],          // il benzinaio ha il market
  ['ENI STATION', 'trasporti', 'spesa'],
  ['DECATHLON', 'shopping', 'svago'],
  ['IKEA', 'casa', 'svago'],
  ['MEDIAWORLD', 'shopping', 'casa'],
  ['MCDONALDS', 'svago', 'spesa'],
  ['FARMACIA COMUNALE', 'salute', 'spesa'],
];
const STREETS = ['VIA ROMA', 'VIA RIZZOLI', 'CORSO BUENOS AIRES', 'VIALE CERTOSA',
  'PIAZZA DUOMO', 'VIA TORINO', 'STATALE 16', 'TANGENZIALE OVEST', 'VIA GARIBALDI',
  'VIA MAZZINI', 'LARGO AUGUSTO', 'VIA NAZIONALE'];
const PREFIX = ['', 'POS ', 'PAGAMENTO ', 'CARTA *1234 ', 'SATISPAY* '];

function makeVariant(rnd, chain) {
  const s = STREETS[Math.floor(rnd() * STREETS.length)];
  const civ = Math.floor(rnd() * 200);
  const suffix = rnd() < 0.5 ? ` ${civ}` : '';
  const pre = PREFIX[Math.floor(rnd() * PREFIX.length)];
  return `${pre}${chain} ${s}${suffix}`;
}

const TRAIN = 6, TEST = 8, MIX_RATE = 0.30;

// ── Baseline FORTE: maggioranza per primo token (backoff banale) ─────────────
function firstToken(desc) {
  const p = merchantPath(desc);
  return p.length ? p[0] : null;
}
function baselineTrain(map, desc, cat) {
  const k = firstToken(desc); if (!k) return;
  const m = map.get(k) || {}; m[cat] = (m[cat] || 0) + 1; map.set(k, m);
}
function baselinePredict(map, desc) {
  const k = firstToken(desc); if (!k) return null;
  const m = map.get(k); if (!m) return null;
  let best = null, bn = -1;
  for (const c in m) if (m[c] > bn) { bn = m[c]; best = c; }
  return best;
}

// ── Un esperimento completo per un dato seed e una data quota di mix ─────────
function runSeed(seed, mixRate) {
  const rnd = mulberry32(seed);
  const hier = initMerchantHierarchy();
  const base = new Map();
  const seen = new Set();
  const truth = [];

  // categoria di una singola transazione: principale, salvo quota `mixRate`
  const catFor = (main, alt) => (rnd() < mixRate ? alt : main);

  for (const [chain, main, alt] of CHAINS) {
    for (let i = 0; i < TRAIN; i++) {
      let d; do { d = makeVariant(rnd, chain); } while (seen.has(d));
      seen.add(d);
      const cat = catFor(main, alt);
      observeMerchant(hier, d, cat, 0);
      baselineTrain(base, d, cat);
    }
    for (let i = 0; i < TEST; i++) {
      let d; do { d = makeVariant(rnd, chain); } while (seen.has(d));
      seen.add(d);
      truth.push([d, catFor(main, alt), main]);   // etichetta vera + maggioranza
    }
  }

  // valuta un predittore: accuratezza su tx etichettate + accuratezza-maggioranza
  const evalPred = (predict) => {
    let ok = 0, maj = 0, abstain = 0, n = truth.length;
    for (const [d, cat, main] of truth) {
      const p = predict(d);
      if (p == null) { abstain++; continue; }
      if (p === cat) ok++;
      if (p === main) maj++;
    }
    return { acc: ok / n, majAcc: maj / n, abstain: abstain / n };
  };

  return {
    baseline: evalPred((d) => baselinePredict(base, d)),
    adaptive: evalPred((d) => { const r = predictMerchant(hier, d, 0); return r && r.category; }),
    // k FISSO a diversi valori: stessa gerarchia, solo pooling costante
    kfix: [0.5, 4, 8, 16, 24].map((kv) => ({
      k: kv,
      ...evalPred((d) => { const r = predictMerchant(hier, d, 0, { fixedK: kv }); return r && r.category; }),
    })),
    // GATED: k adattivo MA con tetto del prior proporzionale all'evidenza del nodo
    // (kCapFactor). L'ipotesi da falsificare: batte baseline E k fisso sul misto.
    gated: [0.5, 1, 2, 3].map((f) => ({
      f,
      ...evalPred((d) => { const r = predictMerchant(hier, d, 0, { kCapFactor: f }); return r && r.category; }),
    })),
  };
}

function agg(runs, sel) {
  const xs = runs.map(sel);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return { mean, sd };
}
const pct = (x) => (100 * x).toFixed(1);
const fmt = (m) => `${pct(m.mean)}% ±${pct(m.sd)}`;

const SEEDS = [11, 23, 37, 51, 67, 83, 97, 113];

for (const mixRate of [0.0, MIX_RATE]) {
  const runs = SEEDS.map((s) => runSeed(s, mixRate));
  const label = mixRate === 0 ? 'CATENE PURE (controllo: rami omogenei)'
                              : `CATENE MISTE ${pct(mixRate)}% (rami eterogenei: qui il k adattivo deve contare)`;
  console.log(`\n=== ${label} — ${SEEDS.length} seed ===`);
  console.log(`  Baseline forte (backoff primo token) : ${fmt(agg(runs, r => r.baseline.acc))}`);
  const adaptM = agg(runs, r => r.adaptive.acc);
  console.log(`  Gerarchia k ADATTIVO                 : ${fmt(adaptM)}   (astensioni ${fmt(agg(runs, r => r.adaptive.abstain))})`);
  console.log(`  --- k FISSO (stessa gerarchia, pooling costante) ---`);
  let bestFix = { mean: -1 };
  for (let i = 0; i < runs[0].kfix.length; i++) {
    const kv = runs[0].kfix[i].k;
    const m = agg(runs, r => r.kfix[i].acc);
    if (m.mean > bestFix.mean) bestFix = { ...m, k: kv };
    console.log(`      k=${String(kv).padStart(4)}                            : ${fmt(m)}`);
  }
  console.log(`  --- GATED: k adattivo + tetto prior ∝ evidenza (kCapFactor) [IPOTESI NUOVA] ---`);
  let bestGate = { mean: -1 };
  for (let i = 0; i < runs[0].gated.length; i++) {
    const f = runs[0].gated[i].f;
    const m = agg(runs, r => r.gated[i].acc);
    if (m.mean > bestGate.mean) bestGate = { ...m, f };
    console.log(`      f=${String(f).padStart(4)}                            : ${fmt(m)}`);
  }
  const baseM = agg(runs, r => r.baseline.acc);
  const sdRef = Math.max(adaptM.sd, baseM.sd, bestGate.sd);
  const gainVsBaseline = adaptM.mean - baseM.mean;
  const gainVsBestFix = adaptM.mean - bestFix.mean;
  const gateVsBaseline = bestGate.mean - baseM.mean;
  const gateVsBestFix = bestGate.mean - bestFix.mean;
  const beyond = (g) => Math.abs(g) >= 2 * sdRef ? '(oltre 2σ → reale)' : '(dentro 2σ → NON dimostrato)';
  console.log(`  VERDETTO:`);
  console.log(`    adattivo    vs baseline forte     : ${gainVsBaseline >= 0 ? '+' : ''}${pct(gainVsBaseline)} punti`);
  console.log(`    adattivo    vs miglior k fisso k=${bestFix.k} : ${gainVsBestFix >= 0 ? '+' : ''}${pct(gainVsBestFix)} punti  ${beyond(gainVsBestFix)}`);
  console.log(`    GATED f=${bestGate.f} vs baseline forte     : ${gateVsBaseline >= 0 ? '+' : ''}${pct(gateVsBaseline)} punti  ${beyond(gateVsBaseline)}`);
  console.log(`    GATED f=${bestGate.f} vs miglior k fisso k=${bestFix.k} : ${gateVsBestFix >= 0 ? '+' : ''}${pct(gateVsBestFix)} punti  ${beyond(gateVsBestFix)}`);
}

console.log(`\nOnesta': "architettura innovativa" e' un fatto solo se l'adattivo batte`);
console.log(`il miglior k fisso OLTRE la varianza da seed. Sotto quella soglia, il k`);
console.log(`adattivo e' un iperparametro scelto bene, non una tecnologia.\n`);
