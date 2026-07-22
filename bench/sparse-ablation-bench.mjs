// LA PROVA DECISIVA del k adattivo — "npm run bench:sparse-ablation".
//
// Le due ablation precedenti (esercenti, DNS a evidenza abbondante) hanno mostrato
// che il k adattivo PAREGGIA con un k fisso: non guadagnava il titolo di tecnologia.
// Ma un ricercatore onesto costruisce la condizione in cui il meccanismo DEVE
// funzionare, se vale, e la misura — invece di scartarlo troppo presto.
//
// LA TEORIA: il k adattivo puo' battere QUALUNQUE k fisso solo se, NELLO STESSO
// modello, convivono due regimi opposti sotto SCARSITA' di dati:
//   - domini OMOGENEI: la foglia (sotto-dominio) ha poca evidenza e rumorosa; il
//     dominio invece e' stabile e affidabile → conviene EREDITARE molto (k ALTO).
//   - domini ETEROGENEI: il dominio e' fuorviante (rami opposti, media ~0.5);
//     ereditare da lui e' veleno → conviene NON ereditare (k BASSO).
// Nessun k FISSO puo' essere giusto per entrambi: high-k vince gli omogenei e
// perde gli eterogenei; low-k il contrario. Solo l'adattivo — che ALZA k dove i
// figli concordano e lo ABBASSA dove discordano — puo' vincere sull'AGGREGATO.
//
// Se il k adattivo NON batte il miglior k fisso nemmeno QUI, oltre 2σ, allora e'
// dimostrato che e' peso morto e va rimosso (ultra-ottimizzazione onesta).
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { initDiscoveryMemory, recordDiscovery, domainPath } = await imp('src/core/discovery-memory.js');
const { predictHierarchical } = await imp('src/ai/hierarchical-bandit.js');

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REGIONS = ['eu','us','asia','af','sa','oce','me','nord','sud','centro','west','east',
  'alpha','beta','gamma','delta','r1','r2','r3','r4','r5','r6','r7','r8','r9','r10'];
const BRANCHES = ['cdn','api','mail','edge','static','auth','img','vid','log','db'];
const TLD = 'com';

const N_HOMO = 8, N_HETERO = 8;
// SCARSITA': pochissime osservazioni per ramo → la foglia da sola e' rumorosa,
// ereditare (o non ereditare) fa la differenza.
const TRAIN_LEAVES = 1;   // un solo sotto-dominio visto per ramo
const OBS = 2;            // 2 osservazioni → segnale debole
const TEST_LEAVES = 6;
const HOMO_RATE = 0.85;   // dominio omogeneo affidabile ma con rumore di campione
const HET_HI = 0.9, HET_LO = 0.1;

function build(rnd) {
  const doms = [];
  let d = 0;
  for (let i = 0; i < N_HOMO; i++, d++) {
    const branches = [...BRANCHES].sort(() => rnd() - 0.5).slice(0, 4)
      .map((name) => ({ name, rate: HOMO_RATE }));      // tutti concordi
    doms.push({ dom: `d${d}.${TLD}`, het: false, branches });
  }
  for (let i = 0; i < N_HETERO; i++, d++) {
    const picks = [...BRANCHES].sort(() => rnd() - 0.5).slice(0, 4);
    const branches = picks.map((name, b) => ({ name, rate: b % 2 === 0 ? HET_HI : HET_LO }));
    doms.push({ dom: `d${d}.${TLD}`, het: true, branches });
  }
  return doms;
}

function runSeed(seed) {
  const rnd = mulberry32(seed);
  const doms = build(rnd);
  const mem = initDiscoveryMemory();
  const used = new Set();
  const truth = [];
  for (const { dom, het, branches } of doms) {
    for (const { name, rate } of branches) {
      for (let l = 0; l < TRAIN_LEAVES; l++) {
        let h; do { h = `${REGIONS[(rnd()*REGIONS.length)|0]}.${name}.${dom}`; } while (used.has(h)); used.add(h);
        for (let o = 0; o < OBS; o++) recordDiscovery(mem, h, rnd() < rate, 0);
      }
      const tl = rate >= 0.5 ? 'ok' : 'ko';
      for (let l = 0; l < TEST_LEAVES; l++) {
        let h; do { h = `${REGIONS[(rnd()*REGIONS.length)|0]}.${name}.${dom}`; } while (used.has(h)); used.add(h);
        truth.push([h, tl, het]);
      }
    }
  }
  const labelOf = (h, opts) => predictHierarchical(mem.hosts, domainPath(h), 0, opts).label || null;
  const evalP = (opts, filter) => {
    let ok = 0, n = 0;
    for (const [h, tl, het] of truth) { if (filter != null && het !== filter) continue; n++; if (labelOf(h, opts) === tl) ok++; }
    return n ? ok / n : 0;
  };
  const KS = [0.5, 2, 4, 8, 16, 24];
  return {
    adaptive: { all: evalP({}, null), homo: evalP({}, false), het: evalP({}, true) },
    kfix: KS.map((k) => ({ k, all: evalP({ fixedK: k }, null), homo: evalP({ fixedK: k }, false), het: evalP({ fixedK: k }, true) })),
  };
}

const SEEDS = [11,23,37,51,67,83,97,113,129,151];
const runs = SEEDS.map(runSeed);
const agg = (sel) => {
  const xs = runs.map(sel);
  const mean = xs.reduce((a,b)=>a+b,0)/xs.length;
  const sd = Math.sqrt(xs.reduce((a,b)=>a+(b-mean)**2,0)/xs.length);
  return { mean, sd };
};
const pct = (x) => (100*x).toFixed(1);
const fmt = (m) => `${pct(m.mean)}% ±${pct(m.sd)}`;

const adaptAll = agg(r => r.adaptive.all);
console.log(`\n=== PROVA DECISIVA k adattivo — evidenza SCARSA, regimi MISTI — ${SEEDS.length} seed ===`);
console.log(`(${N_HOMO} domini omogenei + ${N_HETERO} eterogenei; ${OBS} osservazioni/ramo; foglie di test MAI viste)\n`);
console.log(`                         AGGREGATO        omogenei        eterogenei`);
console.log(`  k ADATTIVO           : ${fmt(adaptAll).padEnd(15)}  ${fmt(agg(r=>r.adaptive.homo)).padEnd(14)}  ${fmt(agg(r=>r.adaptive.het))}`);
console.log(`  --- k FISSO (nessuno puo' vincere entrambi i regimi, se la teoria regge) ---`);
let bestFix = { mean: -1 };
for (let i = 0; i < runs[0].kfix.length; i++) {
  const k = runs[0].kfix[i].k;
  const all = agg(r=>r.kfix[i].all), homo = agg(r=>r.kfix[i].homo), het = agg(r=>r.kfix[i].het);
  if (all.mean > bestFix.mean) bestFix = { ...all, k };
  console.log(`  k=${String(k).padStart(4)}              : ${fmt(all).padEnd(15)}  ${fmt(homo).padEnd(14)}  ${fmt(het)}`);
}
const sdRef = Math.max(adaptAll.sd, bestFix.sd);
const gain = adaptAll.mean - bestFix.mean;
const beyond = Math.abs(gain) >= 2 * sdRef;
console.log(`\n  VERDETTO (aggregato):`);
console.log(`    adattivo vs miglior k fisso (k=${bestFix.k}): ${gain>=0?'+':''}${pct(gain)} punti  ${beyond ? '(OLTRE 2σ → il k adattivo È tecnologia)' : '(dentro 2σ → k adattivo = peso morto, rimuovibile)'}`);
console.log(`\nSe l'adattivo non vince nemmeno qui, e' dimostrato su 3 regimi indipendenti che`);
console.log(`va sostituito da un k fisso: stessa accuratezza, meno codice, piu' veloce.\n`);
