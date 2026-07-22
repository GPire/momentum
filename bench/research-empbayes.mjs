// RICERCA — shrinkage EMPIRICAL-BAYES calibrato dalla varianza reale + evidenza locale
// "node bench/research-empbayes.mjs"
//
// TESI (contro il k adattivo attuale e contro il miglior k fisso):
// il k del core dipende SOLO dall'eterogeneita' h (variazione totale figli↔genitore)
// via una curva fatta a mano k = K_MIN+(K_MAX-K_MIN)(1-h)^2, poi bloccata a [0.5,24].
// Non guarda MAI quanta parte di quella eterogeneita' e' semplice RUMORE DI CAMPIONE
// (con 2 obs/ramo un ramo "diverso" puo' esserlo per caso), ne' quanto e' informativa
// l'evidenza locale n del nodo. Qui derivo la forza del prior con il METODO DEI MOMENTI
// sulla Dirichlet-multinomiale (stile Efron-Morris / DerSimonian-Laird): stimo la
// varianza VERA tra i figli attorno al genitore SOTTRAENDO la varianza di campionamento,
// e da quella ricavo la concentrazione M del prior. L'evidenza locale n entra, come
// sempre, nella formula di shrinkage (c + M*mu)/(n + M): pochi dati -> il prior pesa,
// molti dati -> il nodo domina. Nessun parametro girato a mano: UN meccanismo, misurato.
//
// PROTOCOLLO: stessa generazione dati e stessi seed dei bench del core (sparse-ablation
// + dns-ablation, copiati VERBATIM). Cambio SOLO come si sceglie k. Confronto mele-con-mele:
//   EB  vs  k adattivo attuale (predictHierarchical reale)  vs  miglior k fisso della griglia.
// Verdetto a 2 sigma su tutti i seed. Un pareggio NON e' una vittoria.
'use strict';
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { initDiscoveryMemory, recordDiscovery, domainPath } = await imp('src/core/discovery-memory.js');
const { predictHierarchical } = await imp('src/ai/hierarchical-bandit.js');

// ── mulberry32 — COPIATO VERBATIM dai bench del core (stessi seed = stessi dati)
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// IL MECCANISMO — scoring gerarchico con k EMPIRICAL-BAYES
// ============================================================
// Reimplemento la cascata top-down IDENTICA a scoreHierarchical del core
// (stessa formula (c + k*prior)/(n + k), stesso decadimento, stesso universo),
// cambiando SOLO come si deriva k a ogni transizione: al posto di poolingStrength
// (curva TV->k) uso ebConcentration (metodo dei momenti sulla varianza reale).
const OK = 'ok';
const SEP = '';
const K_UNKNOWN = 8;   // nodo senza >=2 figli confrontabili: prudente (come il core)
const K_MIN = 0.5;     // stesso floor del core (apples-to-apples col k fisso piu' basso)
const M_CAP = 1e6;     // figli concordi oltre il rumore -> pooling ~totale (cap numerico)
const DEFAULT_HALF_LIFE = 45 * 86_400_000;

const keyOf = (path) => path.join(SEP);

// decadimento temporale IDENTICO al core (nei bench now=0, last=0 -> nessun decadimento)
function decayed(node, model, now) {
  if (!node || node.n <= 0) return { c: {}, n: 0 };
  const dt = Math.max(0, now - (node.last || 0));
  const d = Math.pow(0.5, dt / (model.halfLifeMs || DEFAULT_HALF_LIFE));
  const c = {};
  for (const l in node.c) c[l] = node.c[l] * d;
  return { c, n: node.n * d };
}
function normalize(dist) {
  let s = 0; for (const l in dist) s += dist[l];
  if (s <= 0) return dist;
  const out = {}; for (const l in dist) out[l] = dist[l] / s;
  return out;
}

// ── IL CUORE: concentrazione M del prior via METODO DEI MOMENTI (Dirichlet-multinomiale)
// Figli j del nodo, ognuno con vettore di conteggi c_jl su L etichette e n_j osservazioni.
//   mu_l = (sum_j c_jl) / (sum_j n_j)                        media del genitore (pooled)
//   denom = sum_l mu_l(1-mu_l) = 1 - sum_l mu_l^2            dispersione massima
//   T = sum_j sum_l (c_jl - n_j mu_l)^2 / n_j  = sum_j n_j sum_l (p_jl - mu_l)^2
//   Sotto la Dirichlet-multinomiale con correlazione intraclasse rho:
//     E[T] = denom * [ (J-1) + rho * sum_j (n_j - 1) ]       (correzione media stimata)
//   => rho = ( T/denom - (J-1) ) / sum_j (n_j - 1)
//   => M   = 1/rho - 1
// rho <= 0  (i figli concordano PIU' di quanto il campionamento spieghi) -> M enorme (cap):
//           la varianza vera e' ~0, ha senso ereditare quasi tutto.
// rho >= 1  (i figli discordano al massimo) -> M <= 0 -> floor K_MIN: non ereditare.
// Questa e' la specializzazione binomiale (L=2, ok/ko) dello stimatore Dirichlet-mult.:
// esattamente il caso dei bench. Nessuna curva a mano; la scarsita' n entra sia nella
// sottrazione del rumore (il -(J-1) e sum(n_j-1)) sia poi nella formula di shrinkage.
function ebConcentration(model, parentKey, now) {
  const node = model.nodes[parentKey];
  if (!node) return K_UNKNOWN;
  const kids = Object.keys(node.kids || {});
  const rows = [];
  for (const kk of kids) {
    const kid = model.nodes[kk];
    if (!kid) continue;
    const { c, n } = decayed(kid, model, now);
    if (n < 1) continue;
    rows.push({ c, n });
  }
  const J = rows.length;
  if (J < 2) return K_UNKNOWN;

  // universo delle etichette osservate tra i figli
  const labels = new Set();
  let N = 0;
  for (const { c, n } of rows) { for (const l in c) labels.add(l); N += n; }
  if (N <= 0) return K_UNKNOWN;

  // mu_l pooled + denom = 1 - sum mu_l^2
  const mu = {}; let sumMu2 = 0;
  for (const l of labels) {
    let s = 0; for (const { c } of rows) s += (c[l] || 0);
    mu[l] = s / N; sumMu2 += mu[l] * mu[l];
  }
  const denom = 1 - sumMu2;
  if (denom <= 1e-12) return M_CAP; // genitore degenere su un'etichetta -> figli concordi

  // T = sum_j n_j sum_l (p_jl - mu_l)^2   e   sum_j (n_j - 1)
  let T = 0, dfW = 0;
  for (const { c, n } of rows) {
    let ss = 0;
    for (const l of labels) { const p = (c[l] || 0) / n; const d = p - mu[l]; ss += d * d; }
    T += n * ss;
    dfW += (n - 1);
  }
  if (dfW <= 0) return K_UNKNOWN; // ogni figlio ha 1 sola osservazione: momenti indeterminati

  const rho = (T / denom - (J - 1)) / dfW;
  if (rho <= 1e-9) return M_CAP;   // varianza vera ~0 (o negativa): eredita quasi tutto
  if (rho >= 1) return K_MIN;      // eterogeneita' massima: non ereditare
  const M = 1 / rho - 1;
  return Math.min(M_CAP, Math.max(K_MIN, M));
}

// Cascata top-down: identica a scoreHierarchical, k = ebConcentration(parentKey).
function predictEB(model, path, now = 0) {
  const universe = Object.keys(model.labels);
  if (!universe.length) return null;
  let dist = {};
  for (const l of universe) dist[l] = 1 / universe.length;
  for (let i = 0; i <= path.length; i++) {
    const key = keyOf(path.slice(0, i));
    const node = model.nodes[key];
    if (!node || node.n <= 0) break;
    const { c, n } = decayed(node, model, now);
    if (n <= 0) break;
    const parentKey = i > 0 ? keyOf(path.slice(0, i - 1)) : null;
    const k = parentKey === null ? K_UNKNOWN : ebConcentration(model, parentKey, now);
    const next = {};
    for (const l of universe) next[l] = ((c[l] || 0) + k * dist[l]) / (n + k);
    dist = normalize(next);
  }
  let best = null, bestP = -Infinity;
  for (const l of universe) if (dist[l] > bestP) { bestP = dist[l]; best = l; }
  return best;
}

// ============================================================
// aggregazione + verdetto (stesso stile dei bench del core)
// ============================================================
const KS = [0.5, 2, 4, 8, 16, 24]; // griglia unificata richiesta dal protocollo
const pct = (x) => (100 * x).toFixed(1);
const aggOf = (xs) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return { mean, sd };
};
const fmt = (m) => `${pct(m.mean)}% ±${pct(m.sd)}`;

// ============================================================
// REGIME A — sparse-ablation-bench.mjs  (VERBATIM: dati, costanti, seed)
// ============================================================
const A = (() => {
  const REGIONS = ['eu','us','asia','af','sa','oce','me','nord','sud','centro','west','east',
    'alpha','beta','gamma','delta','r1','r2','r3','r4','r5','r6','r7','r8','r9','r10'];
  const BRANCHES = ['cdn','api','mail','edge','static','auth','img','vid','log','db'];
  const TLD = 'com';
  const N_HOMO = 8, N_HETERO = 8;
  const TRAIN_LEAVES = 1;
  const OBS = 2;
  const TEST_LEAVES = 6;
  const HOMO_RATE = 0.85;
  const HET_HI = 0.9, HET_LO = 0.1;

  function build(rnd) {
    const doms = [];
    let d = 0;
    for (let i = 0; i < N_HOMO; i++, d++) {
      const branches = [...BRANCHES].sort(() => rnd() - 0.5).slice(0, 4)
        .map((name) => ({ name, rate: HOMO_RATE }));
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
    const labAdaptive = (h, opts) => predictHierarchical(mem.hosts, domainPath(h), 0, opts).label || null;
    const labEB = (h) => predictEB(mem.hosts, domainPath(h), 0);
    const evalWith = (fn, filter) => {
      let ok = 0, n = 0;
      for (const [h, tl, het] of truth) { if (filter != null && het !== filter) continue; n++; if (fn(h) === tl) ok++; }
      return n ? ok / n : 0;
    };
    return {
      eb:       { all: evalWith(labEB, null),                    homo: evalWith(labEB, false),                    het: evalWith(labEB, true) },
      adaptive: { all: evalWith((h)=>labAdaptive(h,{}), null),   homo: evalWith((h)=>labAdaptive(h,{}), false),   het: evalWith((h)=>labAdaptive(h,{}), true) },
      kfix: KS.map((k) => ({ k,
        all: evalWith((h)=>labAdaptive(h,{fixedK:k}), null),
        homo: evalWith((h)=>labAdaptive(h,{fixedK:k}), false),
        het: evalWith((h)=>labAdaptive(h,{fixedK:k}), true) })),
    };
  }
  const SEEDS = [11,23,37,51,67,83,97,113,129,151];
  return { name: 'A — SPARSE regimi MISTI (8 omogenei + 8 eterogenei, 2 obs/ramo, foglie MAI viste)',
           runs: SEEDS.map(runSeed), seeds: SEEDS };
})();

// ============================================================
// REGIME B — dns-ablation-bench.mjs  (VERBATIM: dati, costanti, seed) — DNS ABBONDANTE
// ============================================================
const B = (() => {
  const BRANCHES = ['cdn', 'api', 'mail', 'edge', 'static'];
  const REGIONS = ['eu', 'us', 'asia', 'af', 'sa', 'oce', 'me', 'nord', 'sud', 'centro',
    'west', 'east', 'alpha', 'beta', 'gamma', 'delta', 'r1', 'r2', 'r3', 'r4'];
  const TLD = 'com';
  const N_DOMAINS = 12;
  const TRAIN_LEAVES = 3;
  const TEST_LEAVES = 4;
  const OBS = 4;

  function makeDomains(rnd) {
    const doms = [];
    for (let d = 0; d < N_DOMAINS; d++) {
      const dom = `d${d}.${TLD}`;
      const heterogeneous = d >= N_DOMAINS / 2;
      const nBranch = heterogeneous ? 2 : 1 + Math.floor(rnd() * 2);
      const branches = [];
      const shuffled = [...BRANCHES].sort(() => rnd() - 0.5).slice(0, nBranch);
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

  function runSeed(seed) {
    const rnd = mulberry32(seed);
    const doms = makeDomains(rnd);
    const mem = initDiscoveryMemory();
    const usedLeaf = new Set();
    const truth = [];
    for (const { dom, heterogeneous, branches } of doms) {
      for (const { name, rate } of branches) {
        for (let l = 0; l < TRAIN_LEAVES; l++) {
          let host; do { host = `${REGIONS[Math.floor(rnd() * REGIONS.length)]}.${name}.${dom}`; }
          while (usedLeaf.has(host)); usedLeaf.add(host);
          for (let o = 0; o < OBS; o++) recordDiscovery(mem, host, rnd() < rate, 0);
        }
        const trueLabel = rate >= 0.5 ? 'ok' : 'ko';
        for (let l = 0; l < TEST_LEAVES; l++) {
          let host; do { host = `${REGIONS[Math.floor(rnd() * REGIONS.length)]}.${name}.${dom}`; }
          while (usedLeaf.has(host)); usedLeaf.add(host);
          truth.push([host, trueLabel, heterogeneous]);
        }
      }
    }
    const labAdaptive = (h, opts) => predictHierarchical(mem.hosts, domainPath(h), 0, opts).label || null;
    const labEB = (h) => predictEB(mem.hosts, domainPath(h), 0);
    const evalWith = (fn, filter) => {
      let ok = 0, n = 0;
      for (const [h, tl, het] of truth) { if (filter != null && het !== filter) continue; n++; if (fn(h) === tl) ok++; }
      return n ? ok / n : 0;
    };
    return {
      eb:       { all: evalWith(labEB, null),                    homo: evalWith(labEB, false),                    het: evalWith(labEB, true) },
      adaptive: { all: evalWith((h)=>labAdaptive(h,{}), null),   homo: evalWith((h)=>labAdaptive(h,{}), false),   het: evalWith((h)=>labAdaptive(h,{}), true) },
      kfix: KS.map((k) => ({ k,
        all: evalWith((h)=>labAdaptive(h,{fixedK:k}), null),
        homo: evalWith((h)=>labAdaptive(h,{fixedK:k}), false),
        het: evalWith((h)=>labAdaptive(h,{fixedK:k}), true) })),
    };
  }
  const SEEDS = [11, 23, 37, 51, 67, 83, 97, 113];
  return { name: 'B — DNS ABBONDANTE (12 domini, 3 foglie/ramo, 4 obs, foglie di test MAI viste)',
           runs: SEEDS.map(runSeed), seeds: SEEDS };
})();

// ============================================================
// REPORT
// ============================================================
function reportRegime(reg) {
  const { name, runs, seeds } = reg;
  console.log(`\n============================================================`);
  console.log(`REGIME ${name}`);
  console.log(`  ${seeds.length} seed  —  colonne: AGGREGATO | omogenei | eterogenei`);
  console.log(`------------------------------------------------------------`);
  const slice = (m, s) => aggOf(runs.map((r) => r[m][s]));
  const line = (lbl, m) => console.log(
    `  ${lbl.padEnd(22)}: ${fmt(slice(m,'all')).padEnd(15)}  ${fmt(slice(m,'homo')).padEnd(15)}  ${fmt(slice(m,'het'))}`);
  line('EB (metodo momenti)', 'eb');
  line('k ADATTIVO (core)', 'adaptive');
  console.log(`  --- k FISSO ---`);
  let bestFix = { mean: -1 };
  for (let i = 0; i < KS.length; i++) {
    const all = aggOf(runs.map((r) => r.kfix[i].all));
    const homo = aggOf(runs.map((r) => r.kfix[i].homo));
    const het = aggOf(runs.map((r) => r.kfix[i].het));
    if (all.mean > bestFix.mean) bestFix = { ...all, k: KS[i] };
    console.log(`  k=${String(KS[i]).padStart(4).padEnd(20)}: ${fmt(all).padEnd(15)}  ${fmt(homo).padEnd(15)}  ${fmt(het)}`);
  }
  const eb = slice('eb', 'all');
  const ad = slice('adaptive', 'all');
  const sdRef = Math.max(eb.sd, bestFix.sd);
  const gEB = eb.mean - bestFix.mean;
  const gAD = ad.mean - bestFix.mean;
  const two = (g) => Math.abs(g) >= 2 * sdRef;
  console.log(`\n  VERDETTO (aggregato, riferimento sigma = max(EB, miglior k fisso) = ±${pct({mean:0,sd:sdRef}.sd||sdRef)} usato come ${pct(sdRef)}pt):`);
  console.log(`    miglior k fisso = k=${bestFix.k}  (${fmt(bestFix)})`);
  console.log(`    EB       vs miglior k fisso : ${gEB>=0?'+':''}${pct(gEB)} pt   ${two(gEB) ? '(OLTRE 2σ)' : '(dentro 2σ = pareggio)'}`);
  console.log(`    adattivo vs miglior k fisso : ${gAD>=0?'+':''}${pct(gAD)} pt   ${two(gAD) ? '(OLTRE 2σ)' : '(dentro 2σ = pareggio)'}`);
  return { name, eb, ad, bestFix, sdRef, gEB, gAD };
}

console.log(`\n################  RICERCA EMPIRICAL-BAYES (metodo dei momenti)  ################`);
console.log(`EB vs k adattivo (core) vs miglior k fisso — stesso set, stessi seed, 2σ.`);
const rA = reportRegime(A);
const rB = reportRegime(B);

// aggregato globale mele-con-mele: media sui seed di TUTTI i regimi impilati
console.log(`\n============================================================`);
console.log(`AGGREGATO GLOBALE (tutti i seed dei 2 regimi impilati)`);
console.log(`------------------------------------------------------------`);
const allEB = [...A.runs.map(r=>r.eb.all), ...B.runs.map(r=>r.eb.all)];
const allAD = [...A.runs.map(r=>r.adaptive.all), ...B.runs.map(r=>r.adaptive.all)];
// miglior k fisso globale = quello con media impilata massima
let bestGlobal = { mean: -1 };
for (let i = 0; i < KS.length; i++) {
  const stacked = [...A.runs.map(r=>r.kfix[i].all), ...B.runs.map(r=>r.kfix[i].all)];
  const m = aggOf(stacked);
  if (m.mean > bestGlobal.mean) bestGlobal = { ...m, k: KS[i] };
}
const gEB = aggOf(allEB), gAD = aggOf(allAD);
const sdRefG = Math.max(gEB.sd, bestGlobal.sd);
const twoG = (g) => Math.abs(g) >= 2 * sdRefG;
console.log(`  EB (metodo momenti)   : ${fmt(gEB)}`);
console.log(`  k ADATTIVO (core)     : ${fmt(gAD)}`);
console.log(`  miglior k fisso k=${bestGlobal.k} : ${fmt(bestGlobal)}`);
console.log(`\n  VERDETTO GLOBALE (σ riferimento = ${pct(sdRefG)}pt):`);
console.log(`    EB       vs miglior k fisso : ${gEB.mean-bestGlobal.mean>=0?'+':''}${pct(gEB.mean-bestGlobal.mean)} pt   ${twoG(gEB.mean-bestGlobal.mean) ? '(OLTRE 2σ → tecnologia)' : '(dentro 2σ → pareggio, NON vittoria)'}`);
console.log(`    adattivo vs miglior k fisso : ${gAD.mean-bestGlobal.mean>=0?'+':''}${pct(gAD.mean-bestGlobal.mean)} pt   ${twoG(gAD.mean-bestGlobal.mean) ? '(OLTRE 2σ)' : '(dentro 2σ → pareggio)'}`);
console.log(`    EB       vs k adattivo      : ${gEB.mean-gAD.mean>=0?'+':''}${pct(gEB.mean-gAD.mean)} pt`);
console.log(``);
