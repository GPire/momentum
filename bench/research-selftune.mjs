// ============================================================
// RICERCA — SELF-TUNING del pooling k via CROSS-VALIDATION INTERNA
// "node bench/research-selftune.mjs"
// ============================================================
// L'ATTACCO (diverso da empirical-Bayes/gating): il modello SCOPRE DA SE' il
// proprio k ottimale usando SOLO i dati di training, tramite cross-validation
// interna. Nessuno sguardo al test (= nessun leakage). L'ipotesi da falsificare:
// il k auto-scelto internamente si muove verso l'ottimo del regime
// (~8 sul mix sparso, ~0.5 sul DNS abbondante) e, usato in predizione, EGUAGLIA
// l'ORACOLO del miglior k fisso — che invece sbircia il test.
//
// MECCANISMO DI CV INTERNA (leave-one-out adattivo alla densita' dei dati):
//   - per ogni "esempio" di training (una foglia = un host) costruisco un modello
//     con TUTTI gli altri esempi di training e predico l'host tenuto fuori;
//   - se il ramo della foglia ha >=2 foglie di training, tolgo l'INTERA foglia
//     (mirror fedele del test: predico una foglia assente da un ramo ancora caldo);
//   - se il ramo ha 1 sola foglia (regime ultra-sparso), non posso lasciare il ramo
//     caldo togliendo la foglia intera → degrado a leave-one-OBSERVATION-out
//     (tolgo 1 delle 2 osservazioni, il ramo resta con segnale). E' il punto in cui
//     il CV interno SOFFRE con pochissimi dati: lo dichiaro, non lo nascondo.
//   - segno la log-loss e l'accuratezza held-in a ciascun k del grid e scelgo il k
//     che minimizza la log-loss interna. Tutto deriva da dati di training; le foglie
//     di TEST non entrano mai nella scelta di k.
//
// Confronto apples-to-apples: STESSO grid {0.5,2,4,8,16,24} per il mio CV e per
// l'oracolo. L'oracolo sceglie il k che massimizza l'accuratezza sul TEST (sbircia);
// io scelgo il k che minimizza la log-loss INTERNA (non sbircio). Stessa scelta di
// opzioni, criterio diverso: onesto vs oracolo.
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

const K_GRID = [0.5, 2, 4, 8, 16, 24];
const EPS = 1e-6;

// ── costruisce un modello (mem.hosts) da una lista di osservazioni di training
function buildModel(obs) {
  const mem = initDiscoveryMemory();
  for (const o of obs) recordDiscovery(mem, o.host, o.ok, 0);
  return mem;
}

// ── log-loss + correttezza di una predizione contro una etichetta bersaglio
function scorePred(mem, host, targetLabel, opts) {
  const r = predictHierarchical(mem.hosts, domainPath(host), 0, opts);
  const p = Math.max(EPS, Math.min(1 - EPS, r.dist[targetLabel] ?? 0));
  return { ll: -Math.log(p), correct: r.label === targetLabel ? 1 : 0 };
}

// ── CROSS-VALIDATION INTERNA: sceglie k usando SOLO le osservazioni di training.
//   obsAll: [{id, host, ok}]  (tutte le osservazioni di training)
// Restituisce { k, curve:[{k, ll, acc}] }.
function selfTuneK(obsAll) {
  // raggruppo per host (foglia) e per ramo (nodo sotto il dominio registrabile)
  const leaves = new Map();          // host -> {host, branchKey, obs:[bool], ids:[id]}
  for (const o of obsAll) {
    const branchKey = domainPath(o.host)[2] ?? domainPath(o.host)[1];
    let L = leaves.get(o.host);
    if (!L) { L = { host: o.host, branchKey, obs: [], ids: [] }; leaves.set(o.host, L); }
    L.obs.push(o.ok); L.ids.push(o.id);
  }
  const branchLeafCount = new Map();
  for (const L of leaves.values()) branchLeafCount.set(L.branchKey, (branchLeafCount.get(L.branchKey) || 0) + 1);

  // costruisco i fold (ognuno: sottoinsieme di training + un host bersaglio + etichetta)
  const folds = [];
  for (const L of leaves.values()) {
    const majLabel = L.obs.filter(Boolean).length >= L.obs.length / 2 ? 'ok' : 'ko';
    if (branchLeafCount.get(L.branchKey) >= 2) {
      // mirror fedele: tolgo l'intera foglia, il ramo resta caldo con le altre foglie
      folds.push({ train: obsAll.filter((o) => o.host !== L.host), host: L.host, label: majLabel });
    } else {
      // ultra-sparso: tolgo 1 osservazione per volta, il ramo resta con l'altra
      for (const o of obsAll.filter((x) => x.host === L.host)) {
        folds.push({ train: obsAll.filter((x) => x.id !== o.id), host: L.host, label: o.ok ? 'ok' : 'ko' });
      }
    }
  }

  // per ogni fold costruisco il modello UNA volta, poi valuto tutti i k del grid
  const sumLL = K_GRID.map(() => 0);
  const sumAcc = K_GRID.map(() => 0);
  for (const f of folds) {
    const mem = buildModel(f.train);
    for (let i = 0; i < K_GRID.length; i++) {
      const s = scorePred(mem, f.host, f.label, { fixedK: K_GRID[i] });
      sumLL[i] += s.ll; sumAcc[i] += s.correct;
    }
  }
  const curve = K_GRID.map((k, i) => ({ k, ll: sumLL[i] / folds.length, acc: sumAcc[i] / folds.length }));
  // scelgo il k a MINIMA log-loss interna; a parita', migliore accuratezza interna, poi k minore
  let best = curve[0];
  for (const c of curve) {
    if (c.ll < best.ll - 1e-12 ||
        (Math.abs(c.ll - best.ll) <= 1e-12 && (c.acc > best.acc || (c.acc === best.acc && c.k < best.k)))) best = c;
  }
  return { k: best.k, curve };
}

// ── aggregazione (sd di popolazione, come i bench di riferimento)
const agg = (xs) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return { mean, sd };
};
const pct = (x) => (100 * x).toFixed(1);
const fmt = (m) => `${pct(m.mean)}% ±${pct(m.sd)}`;

// ════════════════════════════════════════════════════════════════════════════
// REGIME 1 — MIX SPARSO (VERBATIM da bench/sparse-ablation-bench.mjs)
// ════════════════════════════════════════════════════════════════════════════
const S_REGIONS = ['eu','us','asia','af','sa','oce','me','nord','sud','centro','west','east',
  'alpha','beta','gamma','delta','r1','r2','r3','r4','r5','r6','r7','r8','r9','r10'];
const S_BRANCHES = ['cdn','api','mail','edge','static','auth','img','vid','log','db'];
const S_TLD = 'com';
const N_HOMO = 8, N_HETERO = 8;
const S_TRAIN_LEAVES = 1;
const S_OBS = 2;
const S_TEST_LEAVES = 6;
const HOMO_RATE = 0.85;
const HET_HI = 0.9, HET_LO = 0.1;

function buildSparse(rnd) {
  const doms = [];
  let d = 0;
  for (let i = 0; i < N_HOMO; i++, d++) {
    const branches = [...S_BRANCHES].sort(() => rnd() - 0.5).slice(0, 4)
      .map((name) => ({ name, rate: HOMO_RATE }));
    doms.push({ dom: `d${d}.${S_TLD}`, het: false, branches });
  }
  for (let i = 0; i < N_HETERO; i++, d++) {
    const picks = [...S_BRANCHES].sort(() => rnd() - 0.5).slice(0, 4);
    const branches = picks.map((name, b) => ({ name, rate: b % 2 === 0 ? HET_HI : HET_LO }));
    doms.push({ dom: `d${d}.${S_TLD}`, het: true, branches });
  }
  return doms;
}

function genSparse(seed) {
  const rnd = mulberry32(seed);
  const doms = buildSparse(rnd);
  const used = new Set();
  const trainObs = [];   // [{id, host, ok}]  (SOLO training)
  const truth = [];      // [host, trueLabel, het]
  let id = 0;
  for (const { dom, het, branches } of doms) {
    for (const { name, rate } of branches) {
      for (let l = 0; l < S_TRAIN_LEAVES; l++) {
        let h; do { h = `${S_REGIONS[(rnd()*S_REGIONS.length)|0]}.${name}.${dom}`; } while (used.has(h)); used.add(h);
        for (let o = 0; o < S_OBS; o++) trainObs.push({ id: id++, host: h, ok: rnd() < rate });
      }
      const tl = rate >= 0.5 ? 'ok' : 'ko';
      for (let l = 0; l < S_TEST_LEAVES; l++) {
        let h; do { h = `${S_REGIONS[(rnd()*S_REGIONS.length)|0]}.${name}.${dom}`; } while (used.has(h)); used.add(h);
        truth.push([h, tl, het]);
      }
    }
  }
  return { trainObs, truth };
}

// ════════════════════════════════════════════════════════════════════════════
// REGIME 2 — DNS ABBONDANTE (VERBATIM da bench/dns-ablation-bench.mjs)
// ════════════════════════════════════════════════════════════════════════════
const D_BRANCHES = ['cdn', 'api', 'mail', 'edge', 'static'];
const D_REGIONS = ['eu', 'us', 'asia', 'af', 'sa', 'oce', 'me', 'nord', 'sud', 'centro',
  'west', 'east', 'alpha', 'beta', 'gamma', 'delta', 'r1', 'r2', 'r3', 'r4'];
const D_TLD = 'com';
const N_DOMAINS = 12;
const D_TRAIN_LEAVES = 3;
const D_TEST_LEAVES = 4;
const D_OBS = 4;

function makeDomains(rnd) {
  const doms = [];
  for (let d = 0; d < N_DOMAINS; d++) {
    const dom = `d${d}.${D_TLD}`;
    const heterogeneous = d >= N_DOMAINS / 2;
    const nBranch = heterogeneous ? 2 : 1 + Math.floor(rnd() * 2);
    const branches = [];
    const shuffled = [...D_BRANCHES].sort(() => rnd() - 0.5).slice(0, nBranch);
    for (let b = 0; b < shuffled.length; b++) {
      const rate = heterogeneous
        ? (b % 2 === 0 ? 0.9 : 0.1)
        : (d % 2 === 0 ? 0.88 : 0.12);
      branches.push({ name: shuffled[b], rate });
    }
    doms.push({ dom, heterogeneous, branches });
  }
  return doms;
}

function genDns(seed) {
  const rnd = mulberry32(seed);
  const doms = makeDomains(rnd);
  const usedLeaf = new Set();
  const trainObs = [];
  const truth = [];
  let id = 0;
  for (const { dom, heterogeneous, branches } of doms) {
    for (const { name, rate } of branches) {
      for (let l = 0; l < D_TRAIN_LEAVES; l++) {
        let host; do { host = `${D_REGIONS[Math.floor(rnd() * D_REGIONS.length)]}.${name}.${dom}`; }
        while (usedLeaf.has(host)); usedLeaf.add(host);
        for (let o = 0; o < D_OBS; o++) trainObs.push({ id: id++, host, ok: rnd() < rate });
      }
      const trueLabel = rate >= 0.5 ? 'ok' : 'ko';
      for (let l = 0; l < D_TEST_LEAVES; l++) {
        let host; do { host = `${D_REGIONS[Math.floor(rnd() * D_REGIONS.length)]}.${name}.${dom}`; }
        while (usedLeaf.has(host)); usedLeaf.add(host);
        truth.push([host, trueLabel, heterogeneous]);
      }
    }
  }
  return { trainObs, truth };
}

// ════════════════════════════════════════════════════════════════════════════
// VALUTAZIONE DI UN REGIME
// ════════════════════════════════════════════════════════════════════════════
function evalRegime(name, gen, seeds) {
  const per = seeds.map((seed) => {
    const { trainObs, truth } = gen(seed);
    const fullMem = buildModel(trainObs);
    const { k: kcv, curve } = selfTuneK(trainObs);

    const labelOf = (h, opts) => predictHierarchical(fullMem.hosts, domainPath(h), 0, opts).label || null;
    const accOn = (opts, filter) => {
      let ok = 0, n = 0;
      for (const [h, tl, het] of truth) { if (filter != null && het !== filter) continue; n++; if (labelOf(h, opts) === tl) ok++; }
      return n ? ok / n : 0;
    };
    const slice = (filter) => ({
      selftuned: accOn({ fixedK: kcv }, filter),
      adaptive: accOn({}, filter),
      fix: K_GRID.map((k) => accOn({ fixedK: k }, filter)),
    });
    return { kcv, curve, all: slice(null), homo: slice(false), het: slice(true) };
  });

  const aggSlice = (key) => {
    const selftuned = agg(per.map((p) => p[key].selftuned));
    const adaptive = agg(per.map((p) => p[key].adaptive));
    const fix = K_GRID.map((_, i) => agg(per.map((p) => p[key].fix[i])));
    let oracle = { mean: -1, k: null, sd: 0 };
    fix.forEach((m, i) => { if (m.mean > oracle.mean) oracle = { ...m, k: K_GRID[i] }; });
    return { selftuned, adaptive, fix, oracle };
  };
  const A = aggSlice('all'), H = aggSlice('homo'), E = aggSlice('het');
  const kcvAgg = agg(per.map((p) => p.kcv));

  console.log(`\n================================================================`);
  console.log(`REGIME: ${name}  (${seeds.length} seed)`);
  console.log(`================================================================`);
  console.log(`                         AGGREGATO        omogenei        eterogenei`);
  console.log(`  self-tuned (CV int.) : ${fmt(A.selftuned).padEnd(15)}  ${fmt(H.selftuned).padEnd(14)}  ${fmt(E.selftuned)}`);
  console.log(`  k ADATTIVO (attuale) : ${fmt(A.adaptive).padEnd(15)}  ${fmt(H.adaptive).padEnd(14)}  ${fmt(E.adaptive)}`);
  console.log(`  --- k FISSO (oracolo: sceglie k sbirciando il TEST) ---`);
  A.fix.forEach((m, i) => {
    console.log(`  k=${String(K_GRID[i]).padStart(4)}              : ${fmt(m).padEnd(15)}  ${fmt(H.fix[i]).padEnd(14)}  ${fmt(E.fix[i])}`);
  });
  console.log(`  ORACOLO best-fixed   : aggregato k=${A.oracle.k} (${fmt(A.oracle)}) | omo k=${H.oracle.k} | eter k=${E.oracle.k}`);

  // k auto-scelto dal CV interno per seed + media
  console.log(`\n  k AUTO-SCELTO dal CV interno: per-seed [${per.map((p) => p.kcv).join(', ')}]`);
  console.log(`     media = ${kcvAgg.mean.toFixed(2)} ±${kcvAgg.sd.toFixed(2)}   (ottimo-oracolo del regime = k=${A.oracle.k})`);
  // curva CV interna media (perche' ha scelto quel k)
  const curveAgg = K_GRID.map((k, i) => ({
    k,
    ll: agg(per.map((p) => p.curve[i].ll)).mean,
    acc: agg(per.map((p) => p.curve[i].acc)).mean,
  }));
  console.log(`     curva CV interna (log-loss held-in ↓ = meglio):`);
  curveAgg.forEach((c) => console.log(`        k=${String(c.k).padStart(4)}  logloss=${c.ll.toFixed(4)}  acc=${pct(c.acc)}%`));

  // VERDETTI a 2σ: self-tuned vs oracolo, e adattivo vs oracolo
  const verdict = (label, a, b) => {
    const gain = a.mean - b.mean;
    const sdRef = Math.max(a.sd, b.sd);
    const beyond = Math.abs(gain) >= 2 * sdRef;
    return `${label}: ${gain >= 0 ? '+' : ''}${pct(gain)} punti  ${beyond ? (gain >= 0 ? '(OLTRE 2σ → VITTORIA)' : '(OLTRE 2σ → SCONFITTA)') : '(dentro 2σ → PAREGGIO)'}`;
  };
  console.log(`\n  VERDETTO (aggregato, 2σ):`);
  console.log(`    ${verdict('self-tuned vs ORACOLO best-fixed', A.selftuned, A.oracle)}`);
  console.log(`    ${verdict('self-tuned vs k adattivo attuale', A.selftuned, A.adaptive)}`);
  console.log(`    ${verdict('k adattivo  vs ORACOLO best-fixed', A.adaptive, A.oracle)}`);

  return { A, H, E, kcvAgg, oracleK: A.oracle.k };
}

const SPARSE_SEEDS = [11, 23, 37, 51, 67, 83, 97, 113, 129, 151];
const DNS_SEEDS = [11, 23, 37, 51, 67, 83, 97, 113];

console.log(`\n#################################################################`);
console.log(`# SELF-TUNING del pooling k via CROSS-VALIDATION INTERNA`);
console.log(`# nessuno sguardo al test — il k lo sceglie la sola log-loss held-in`);
console.log(`#################################################################`);

const r1 = evalRegime('MIX SPARSO (8 omogenei + 8 eterogenei, 2 obs/ramo)', genSparse, SPARSE_SEEDS);
const r2 = evalRegime('DNS ABBONDANTE (12 domini, 3 foglie/ramo, 4 obs/foglia)', genDns, DNS_SEEDS);

console.log(`\n================================================================`);
console.log(`SINTESI: il CV interno si SPOSTA verso l'ottimo del regime, DA SOLO?`);
console.log(`================================================================`);
console.log(`  MIX SPARSO    : k auto = ${r1.kcvAgg.mean.toFixed(2)} ±${r1.kcvAgg.sd.toFixed(2)}  (ottimo-oracolo k=${r1.oracleK})`);
console.log(`  DNS ABBONDANTE: k auto = ${r2.kcvAgg.mean.toFixed(2)} ±${r2.kcvAgg.sd.toFixed(2)}  (ottimo-oracolo k=${r2.oracleK})`);
console.log(`\nOnesta': l'oracolo best-fixed sbircia il test; il self-tuning no. Un PAREGGIO`);
console.log(`col'oracolo, SENZA sbirciare, e' gia' forte. Una vittoria sull'oracolo si`);
console.log(`dichiara solo oltre 2σ. Nessun pareggio va spacciato per vittoria.\n`);
