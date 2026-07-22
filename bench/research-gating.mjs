// ============================================================
// RESEARCH — CONFIDENCE GATING sui livelli della gerarchia — `node bench/research-gating.mjs`
// ============================================================
// ATTACCO #3 (diverso da empirical-Bayes shrinkage e da auto-tuning per CV):
// il pooling attuale (scoreHierarchical) FONDE in cascata ogni livello col
// genitore con un peso k, secondo uno SCHEDULE. Non DECIDE mai di chi fidarsi.
//
// Qui invece ogni LIVELLO della gerarchia esposto per una predizione
// (radice → TLD → dominio → ramo; la foglia mai-vista non esiste) e' trattato
// come un ESPERTO indipendente. Per ciascuno si calcola una CONFIDENZA
// predittiva ONESTA e si SELEZIONA (hard gate) o si MISCELA (soft, pesata dalla
// confidenza) — non secondo uno schedule, ma secondo di chi ci si puo' fidare
// per QUELLA predizione.
//
// CONFIDENZA (definizione esatta, dichiarata a priori, NON tarata sul bench):
//   Ogni nodo con conteggi decaduti c_l e totale n ha una posteriore
//   Dirichlet(alpha)-multinomiale. La confidenza dell'esperto e' la probabilita'
//   predittiva ONESTA che la PROSSIMA osservazione del nodo cada sull'argmax:
//       conf_i = max_l  (c_l + alpha) / (n + L*alpha)         (L = #etichette)
//   E' n-dipendente per costruzione: con poco dato si contrae verso 1/L (chance),
//   con molto dato tende all'argmax reale. alpha=1 = prior uniforme (Laplace):
//   scelta di massima onesta', zero gradi di liberta' tarati sul benchmark.
//   Peso soft dell'esperto = "quanto batte il caso":  w_i = max(0, conf_i - 1/L).
//   Un livello piatto (dominio eterogeneo ~0.5) pesa 0 e viene ESCLUSO da solo.
//
// PROTOCOLLO (identico agli altri 2 ricercatori — mele con mele):
//  - dati e seed COPIATI VERBATIM da bench/sparse-ablation-bench.mjs
//    (8 omogenei + 8 eterogenei, 1 foglia train, 2 obs/ramo, 6 foglie held-out, 10 seed)
//  - PIU' il regime DNS ABBONDANTE da bench/dns-ablation-bench.mjs
//    (12 domini, 3 foglie train, 4 obs/foglia, 4 foglie held-out, 8 seed)
//  - cambia SOLO lo scoring. Confronto: GATE vs k adattivo vs MIGLIOR k fisso.
//  - aggregato + omogenei + eterogenei; media +-sigma; verdetto a 2sigma.
//  - REGOLA: vittoria SOLO oltre 2sigma su piu' seed. Un pareggio si dichiara pareggio.
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { initDiscoveryMemory, recordDiscovery, domainPath } = await imp('src/core/discovery-memory.js');
const { predictHierarchical } = await imp('src/ai/hierarchical-bandit.js');

// mulberry32 — COPIATO VERBATIM dai due bench (stessa sequenza pseudo-casuale).
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// IL GATE — reimplementazione LOCALE dello scoring (nessun file core toccato).
// Replica esatta di keyOf/decayed/normalize del primitivo, poi applica il gate.
// ============================================================
const DAY = 86_400_000;
const DEFAULT_HALF_LIFE = 45 * DAY;
const SEP = '\x01';   // separatore REALE del primitivo (keyOf in hierarchical-bandit.js)
const keyOf = (path) => path.join(SEP);

function decayed(node, model, now) {
  if (!node || node.n <= 0) return { c: {}, n: 0 };
  const dt = Math.max(0, now - (node.last || 0));
  const d = Math.pow(0.5, dt / (model.halfLifeMs || DEFAULT_HALF_LIFE));
  const c = {};
  for (const l in node.c) c[l] = node.c[l] * d;
  return { c, n: node.n * d };
}

// Raccoglie gli ESPERTI: ogni livello ESISTENTE lungo il cammino (root..ramo).
// La foglia mai-vista non ha nodo → e' saltata da sola (nessun esperto fantasma).
function experts(model, path, now, alpha) {
  const universe = Object.keys(model.labels);
  const L = universe.length;
  const out = [];
  for (let i = 0; i <= path.length; i++) {
    const key = keyOf(path.slice(0, i));
    const node = model.nodes[key];
    if (!node || node.n <= 0) continue;
    const { c, n } = decayed(node, model, now);
    if (n <= 0) continue;
    const denom = n + alpha * L;
    const pm = {};
    let conf = 0;
    for (const l of universe) {
      const v = ((c[l] || 0) + alpha) / denom;
      pm[l] = v;
      if (v > conf) conf = v;      // conf = massa predittiva sull'argmax (n-dipendente)
    }
    out.push({ i, n, pm, conf, excess: Math.max(0, conf - 1 / L) });
  }
  return { universe, L, out };
}

const argmaxLabel = (dist) => {
  let best = null, bp = -Infinity;
  for (const l in dist) if (dist[l] > bp) { bp = dist[l]; best = l; }
  return best;
};

// modes:
//   'soft'    — miscela pm_i pesata da excess^gamma  (PRIMARIO, dichiarato a priori)
//   'hard'    — seleziona l'esperto con confidenza massima (tie → piu' profondo)
//   'softmax' — miscela pesata da exp(conf/temp)      (variante di robustezza)
//   'rawsoft' — come soft ma conf = frequenza grezza (alpha->0): ablazione dello shrinkage
function gateLabel(model, path, now, opts = {}) {
  const alpha = opts.alpha ?? 1;
  const gamma = opts.gamma ?? 1;
  const mode = opts.mode ?? 'soft';
  const aEff = mode === 'rawsoft' ? 1e-9 : alpha;
  const { universe, L, out } = experts(model, path, now, aEff);
  if (!out.length) return universe[0] ?? null;

  if (mode === 'hard') {
    let best = out[0];
    for (const e of out) {
      if (e.conf > best.conf + 1e-12 || (Math.abs(e.conf - best.conf) <= 1e-12 && e.i > best.i)) best = e;
    }
    return argmaxLabel(best.pm);
  }

  let weights;
  if (mode === 'softmax') {
    const temp = opts.temp ?? 0.15;
    weights = out.map((e) => Math.exp(e.conf / temp));
  } else {
    weights = out.map((e) => Math.pow(e.excess, gamma)); // soft / rawsoft
  }
  let wsum = 0; for (const w of weights) wsum += w;
  const mix = {}; for (const l of universe) mix[l] = 0;
  if (wsum <= 0) {
    const e = out[out.length - 1];          // tutti al livello del caso → il piu' specifico
    return argmaxLabel(e.pm);
  }
  for (let j = 0; j < out.length; j++) {
    const w = weights[j] / wsum;
    for (const l of universe) mix[l] += w * out[j].pm[l];
  }
  return argmaxLabel(mix);
}

// ============================================================
// REGIME 1 — SPARSE, regimi misti (VERBATIM da sparse-ablation-bench.mjs)
// ============================================================
const S_REGIONS = ['eu','us','asia','af','sa','oce','me','nord','sud','centro','west','east',
  'alpha','beta','gamma','delta','r1','r2','r3','r4','r5','r6','r7','r8','r9','r10'];
const S_BRANCHES = ['cdn','api','mail','edge','static','auth','img','vid','log','db'];
const S_TLD = 'com';
const S_N_HOMO = 8, S_N_HETERO = 8;
const S_TRAIN_LEAVES = 1, S_OBS = 2, S_TEST_LEAVES = 6;
const S_HOMO_RATE = 0.85, S_HET_HI = 0.9, S_HET_LO = 0.1;

function sparseBuild(rnd) {
  const doms = []; let d = 0;
  for (let i = 0; i < S_N_HOMO; i++, d++) {
    const branches = [...S_BRANCHES].sort(() => rnd() - 0.5).slice(0, 4).map((name) => ({ name, rate: S_HOMO_RATE }));
    doms.push({ dom: `d${d}.${S_TLD}`, het: false, branches });
  }
  for (let i = 0; i < S_N_HETERO; i++, d++) {
    const picks = [...S_BRANCHES].sort(() => rnd() - 0.5).slice(0, 4);
    const branches = picks.map((name, b) => ({ name, rate: b % 2 === 0 ? S_HET_HI : S_HET_LO }));
    doms.push({ dom: `d${d}.${S_TLD}`, het: true, branches });
  }
  return doms;
}

function sparseSeed(seed) {
  const rnd = mulberry32(seed);
  const doms = sparseBuild(rnd);
  const mem = initDiscoveryMemory();
  const used = new Set();
  const truth = [];
  for (const { dom, het, branches } of doms) {
    for (const { name, rate } of branches) {
      for (let l = 0; l < S_TRAIN_LEAVES; l++) {
        let h; do { h = `${S_REGIONS[(rnd()*S_REGIONS.length)|0]}.${name}.${dom}`; } while (used.has(h)); used.add(h);
        for (let o = 0; o < S_OBS; o++) recordDiscovery(mem, h, rnd() < rate, 0);
      }
      const tl = rate >= 0.5 ? 'ok' : 'ko';
      for (let l = 0; l < S_TEST_LEAVES; l++) {
        let h; do { h = `${S_REGIONS[(rnd()*S_REGIONS.length)|0]}.${name}.${dom}`; } while (used.has(h)); used.add(h);
        truth.push([h, tl, het]);
      }
    }
  }
  return { mem, truth };
}
// CONFERMA PRE-REGISTRATA (out-of-seed): set COMPLETAMENTE DISGIUNTO da quello
// della scoperta [11..151]. Ipotesi pre-registrata: 'hard' e 'rawsoft' battono il
// miglior k fisso (t appaiato > 2) su seed MAI usati. Se regge qui, non e' overfit ai seed.
const SPARSE_SEEDS = [1009,1013,1019,1021,1031,1033,1039,1049,1051,1061,1063,1069,
  1087,1091,1093,1097,1103,1109,1117,1123,1129,1151,1153,1163,1171,1181,1187,1193,1201,1213];

// ============================================================
// REGIME 2 — DNS ABBONDANTE (VERBATIM da dns-ablation-bench.mjs)
// ============================================================
const D_BRANCHES = ['cdn', 'api', 'mail', 'edge', 'static'];
const D_REGIONS = ['eu', 'us', 'asia', 'af', 'sa', 'oce', 'me', 'nord', 'sud', 'centro',
  'west', 'east', 'alpha', 'beta', 'gamma', 'delta', 'r1', 'r2', 'r3', 'r4'];
const D_TLD = 'com';
const D_N_DOMAINS = 12, D_TRAIN_LEAVES = 3, D_TEST_LEAVES = 4, D_OBS = 4;

function dnsMakeDomains(rnd) {
  const doms = [];
  for (let d = 0; d < D_N_DOMAINS; d++) {
    const dom = `d${d}.${D_TLD}`;
    const heterogeneous = d >= D_N_DOMAINS / 2;
    const nBranch = heterogeneous ? 2 : 1 + Math.floor(rnd() * 2);
    const branches = [];
    const shuffled = [...D_BRANCHES].sort(() => rnd() - 0.5).slice(0, nBranch);
    for (let b = 0; b < shuffled.length; b++) {
      const rate = heterogeneous ? (b % 2 === 0 ? 0.9 : 0.1) : (d % 2 === 0 ? 0.88 : 0.12);
      branches.push({ name: shuffled[b], rate });
    }
    doms.push({ dom, heterogeneous, branches });
  }
  return doms;
}

function dnsSeed(seed) {
  const rnd = mulberry32(seed);
  const doms = dnsMakeDomains(rnd);
  const mem = initDiscoveryMemory();
  const usedLeaf = new Set();
  const truth = [];
  for (const { dom, heterogeneous, branches } of doms) {
    for (const { name, rate } of branches) {
      for (let l = 0; l < D_TRAIN_LEAVES; l++) {
        let host; do { host = `${D_REGIONS[Math.floor(rnd() * D_REGIONS.length)]}.${name}.${dom}`; }
        while (usedLeaf.has(host)); usedLeaf.add(host);
        for (let o = 0; o < D_OBS; o++) recordDiscovery(mem, host, rnd() < rate, 0);
      }
      const trueLabel = rate >= 0.5 ? 'ok' : 'ko';
      for (let l = 0; l < D_TEST_LEAVES; l++) {
        let host; do { host = `${D_REGIONS[Math.floor(rnd() * D_REGIONS.length)]}.${name}.${dom}`; }
        while (usedLeaf.has(host)); usedLeaf.add(host);
        truth.push([host, trueLabel, heterogeneous]);
      }
    }
  }
  return { mem, truth };
}
const DNS_SEEDS = [11, 23, 37, 51, 67, 83, 97, 113];

// ============================================================
// VALUTAZIONE COMUNE — stesso truth-set per tutti gli scorer.
// ============================================================
const KS = [0.5, 2, 4, 8, 16, 24];

function evalSeed({ mem, truth }, scorer, filter) {
  let ok = 0, n = 0;
  for (const [h, tl, het] of truth) {
    if (filter != null && het !== filter) continue;
    n++; if (scorer(mem, h) === tl) ok++;
  }
  return n ? ok / n : 0;
}

const adaptiveScorer = (mem, h) => predictHierarchical(mem.hosts, domainPath(h), 0, {}).label || null;
const kfixScorer = (k) => (mem, h) => predictHierarchical(mem.hosts, domainPath(h), 0, { fixedK: k }).label || null;
const gateScorer = (opts) => (mem, h) => gateLabel(mem.hosts, domainPath(h), 0, opts) || null;
// IBRIDO PROPRIETARIO: confidence-gating quando l'evidenza del nodo piu' profondo
// e' SCARSA (regime dove il gating vince), pooling adattivo quando e' ABBONDANTE
// (regime dove pareggiano). La soglia usa r.support = evidenza max lungo il cammino.
const HYBRID_THRESH = 6;
// evidenza del NODO PIU' PROFONDO esistente lungo il cammino (il ramo), NON il max
// (che sarebbe dominato dalla radice). E' il segnale corretto di "quanto so di QUESTO ramo".
function deepestEvidence(model, path, now = 0) {
  let deepest = 0;
  for (let i = 1; i <= path.length; i++) {
    const node = model.nodes[keyOf(path.slice(0, i))];
    if (node && node.n > 0) deepest = decayed(node, model, now).n;
  }
  return deepest;
}
const hybridScorer = (mem, h) => {
  const path = domainPath(h);
  const ev = deepestEvidence(mem.hosts, path);
  if (ev > 0 && ev < HYBRID_THRESH) return gateLabel(mem.hosts, path, 0, { mode: 'hard', alpha: 1 }) || null;
  return predictHierarchical(mem.hosts, path, 0, {}).label || null;
};

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
const agg = (xs) => ({ mean: mean(xs), sd: sd(xs) });
const pct = (x) => (100 * x).toFixed(1);
const fmt = (m) => `${pct(m.mean)}% +-${pct(m.sd)}`;

// GATE PRIMARIO (dichiarato a priori, zero tuning sul bench): soft, alpha=1, gamma=1.
const PRIMARY = { mode: 'soft', alpha: 1, gamma: 1 };
// Varianti riportate per TRASPARENZA (non per cherry-picking del vincitore):
const VARIANTS = [
  ['GATE soft  a=1 g=1 (PRIMARIO)', { mode: 'soft', alpha: 1, gamma: 1 }],
  ['GATE hard  a=1        ', { mode: 'hard', alpha: 1 }],
  ['GATE softmax a=1 T=.15', { mode: 'softmax', alpha: 1, temp: 0.15 }],
  ['GATE rawsoft (no shrink)', { mode: 'rawsoft', gamma: 1 }],
];

function runRegime(name, seeds, seedFn, sublabel) {
  const runs = seeds.map(seedFn);
  const slices = [['AGGREGATO', null], ['omogenei', false], ['eterogenei', true]];

  // pre-calcola per ogni scorer i valori per-seed su ogni slice
  const perSeed = (scorer, filter) => runs.map((r) => evalSeed(r, scorer, filter));

  console.log(`\n============================================================`);
  console.log(`REGIME: ${name}  (${seeds.length} seed)`);
  console.log(sublabel);
  console.log(`============================================================`);
  console.log(`                             AGGREGATO         omogenei         eterogenei`);

  const row = (label, scorer) => {
    const cells = slices.map(([, f]) => fmt(agg(perSeed(scorer, f))));
    console.log(`  ${label.padEnd(26)}: ${cells[0].padEnd(16)} ${cells[1].padEnd(16)} ${cells[2]}`);
  };

  // k adattivo
  row('k ADATTIVO (attuale)', adaptiveScorer);
  // k fissi + individua il migliore sull'aggregato
  console.log(`  --- k FISSO ---`);
  let bestFix = { mean: -1 };
  const kfixPerSeed = {};
  for (const k of KS) {
    const sc = kfixScorer(k);
    kfixPerSeed[k] = perSeed(sc, null);
    const a = agg(kfixPerSeed[k]);
    if (a.mean > bestFix.mean) bestFix = { ...a, k };
    row(`k=${k}`, sc);
  }
  console.log(`  --- GATE (confidence) ---`);
  const gateSeries = {};
  for (const [label, opts] of VARIANTS) {
    const sc = gateScorer(opts);
    gateSeries[label] = perSeed(sc, null);
    row(label, sc);
  }
  console.log(`  --- IBRIDO (gate se evidenza<${HYBRID_THRESH}, altrimenti pooling) ---`);
  const hybridSeeds = perSeed(hybridScorer, null);
  row(`IBRIDO gate+pooling`, hybridScorer);
  {
    const hy = agg(hybridSeeds);
    const g = hy.mean - bestFix.mean;
    const diffs = hybridSeeds.map((v, i) => v - kfixPerSeed[bestFix.k][i]);
    const dm = mean(diffs), dsd = sd(diffs), se = dsd / Math.sqrt(diffs.length), t = se > 0 ? dm / se : 0;
    console.log(`    IBRIDO vs miglior k fisso k=${bestFix.k}: ${g>=0?'+':''}${pct(g)} punti  [appaiato t=${t.toFixed(2)}]`);
  }

  // VERDETTO 2sigma sull'AGGREGATO: GATE PRIMARIO vs miglior k fisso vs k adattivo
  const gatePrimary = agg(gateSeries[VARIANTS[0][0]]);
  const adaptAgg = agg(perSeed(adaptiveScorer, null));
  const bestFixSeeds = kfixPerSeed[bestFix.k];
  const gatePrimarySeeds = gateSeries[VARIANTS[0][0]];

  const verdict = (label, xsA, aggA, xsB, aggB) => {
    const gain = aggA.mean - aggB.mean;
    const sdRef = Math.max(aggA.sd, aggB.sd);                 // convenzione IDENTICA agli altri bench
    const beyond2sd = Math.abs(gain) >= 2 * sdRef;
    // Analisi APPAIATA (statisticamente corretta) come dato aggiuntivo onesto:
    const diffs = xsA.map((v, i) => v - xsB[i]);
    const dm = mean(diffs), dsd = sd(diffs);
    const se = dsd / Math.sqrt(diffs.length);
    const t = se > 0 ? dm / se : 0;
    console.log(`    ${label}: ${gain >= 0 ? '+' : ''}${pct(gain)} punti  ` +
      `[2sigma-perSeed: ${beyond2sd ? 'OLTRE 2sigma' : 'DENTRO 2sigma'} | appaiato t=${t.toFixed(2)} (|t|>=2 ~ sig.)]`);
    return beyond2sd && gain > 0;
  };

  console.log(`\n  VERDETTO aggregato (GATE PRIMARIO = ${VARIANTS[0][0].trim()}):`);
  const winVsFix = verdict(`gate vs miglior k fisso (k=${bestFix.k})`, gatePrimarySeeds, gatePrimary, bestFixSeeds, bestFix);
  verdict(`gate vs k adattivo         `, gatePrimarySeeds, gatePrimary, perSeed(adaptiveScorer, null), adaptAgg);
  console.log(`    => ${winVsFix ? 'GATE VINCE oltre 2sigma sul migliore k fisso' : 'PAREGGIO (dentro 2sigma): non batte il miglior k fisso'}`);

  // PIENA TRASPARENZA (anti p-hacking): ogni variante di gate vs miglior k fisso.
  // Riportate TUTTE, non solo la migliore — cosi' nessun cherry-picking a posteriori.
  console.log(`\n  Trasparenza — TUTTE le varianti vs miglior k fisso (k=${bestFix.k}):`);
  for (const [label] of VARIANTS) {
    const g = agg(gateSeries[label]);
    verdict(label.trim().padEnd(26), gateSeries[label], g, bestFixSeeds, bestFix);
  }

  return {
    name,
    gatePrimary, adaptAgg, bestFix,
    winVsFix,
  };
}

console.log(`\n################################################################`);
console.log(`# RESEARCH GATING — confidenza predittiva come selettore di livello`);
console.log(`# Confidenza = max_l (c_l+alpha)/(n+L*alpha)  [Dirichlet-mult., alpha=1]`);
console.log(`# Vittoria SOLO se GATE PRIMARIO batte il miglior k fisso OLTRE 2sigma.`);
console.log(`################################################################`);

const r1 = runRegime(
  'SPARSE / regimi misti (verbatim sparse-ablation-bench)',
  SPARSE_SEEDS, sparseSeed,
  `(${S_N_HOMO} omogenei + ${S_N_HETERO} eterogenei; ${S_OBS} obs/ramo; foglie di test MAI viste)`
);
const r2 = runRegime(
  'DNS ABBONDANTE (verbatim dns-ablation-bench)',
  DNS_SEEDS, dnsSeed,
  `(${D_N_DOMAINS} domini, ${D_TRAIN_LEAVES} foglie train, ${D_OBS} obs/foglia, ${D_TEST_LEAVES} foglie held-out)`
);

console.log(`\n################################################################`);
console.log(`# SINTESI ONESTA`);
for (const r of [r1, r2]) {
  console.log(`#  ${r.name.split('(')[0].trim()}`);
  console.log(`#    GATE ${fmt(r.gatePrimary)} | adattivo ${fmt(r.adaptAgg)} | miglior k=${r.bestFix.k} ${fmt(r.bestFix)}`);
  console.log(`#    -> ${r.winVsFix ? 'GATE batte il miglior k fisso oltre 2sigma' : 'PAREGGIO: il gate NON batte il miglior k fisso oltre 2sigma'}`);
}
console.log(`################################################################\n`);
