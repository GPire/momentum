// ABLATION del primitivo gerarchico sul DOMINIO DNS PROFONDO — "npm run bench:dns-ablation".
//
// Perche' questo bench esiste: sul dominio ESERCENTI la gerarchia e' degenere
// (il primo token E' gia' la risposta), e li' l'ablation ha mostrato che il
// pooling non batte un backoff banale. Ma la PROMESSA del primitivo — "un nodo
// mai visto EREDITA dall'antenato" — vive dove la gerarchia e' PROFONDA: i
// sotto-domini in discovery-memory.js. Qui lo mettiamo alla prova, onestamente.
//
// LA DOMANDA DECISIVA: un sotto-dominio MAI VISTO sotto un ramo intermedio noto
// (es. 'new.cdn.d3.com', dove 'cdn.d3.com' e' noto ma 'new.*' no) — la gerarchia
// profonda predice l'affidabilita' MEGLIO di un backoff sul dominio registrabile
// ('d3.com')? E il k ADATTIVO conta oltre la varianza?
//
// IL CASO CRITICO = domini ETEROGENEI: rami con affidabilita' OPPOSTA sotto lo
// stesso dominio (cdn affidabile ~0.9, api inaffidabile ~0.1). La media di
// dominio e' ~0.5 = inutile; solo il RAMO profondo porta il segnale. Se la
// gerarchia non vince QUI, non vince da nessuna parte.
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

const BRANCHES = ['cdn', 'api', 'mail', 'edge', 'static'];
const REGIONS = ['eu', 'us', 'asia', 'af', 'sa', 'oce', 'me', 'nord', 'sud', 'centro',
  'west', 'east', 'alpha', 'beta', 'gamma', 'delta', 'r1', 'r2', 'r3', 'r4'];
const TLD = 'com';

const N_DOMAINS = 12;
const TRAIN_LEAVES = 3;   // sotto-domini visti per ramo
const TEST_LEAVES = 4;    // sotto-domini NUOVI per ramo (mai visti)
const OBS = 4;            // osservazioni per sotto-dominio in training

// costruisce i domini: meta' OMOGENEI (rami concordi), meta' ETEROGENEI (rami opposti)
function makeDomains(rnd) {
  const doms = [];
  for (let d = 0; d < N_DOMAINS; d++) {
    const dom = `d${d}.${TLD}`;
    const heterogeneous = d >= N_DOMAINS / 2;
    const nBranch = heterogeneous ? 2 : 1 + Math.floor(rnd() * 2);
    const branches = [];
    const shuffled = [...BRANCHES].sort(() => rnd() - 0.5).slice(0, nBranch);
    for (let b = 0; b < shuffled.length; b++) {
      // omogeneo: tutti i rami stessa polarita'. eterogeneo: rami alternati alto/basso.
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
  const domBackoff = new Map(); // baseline: maggioranza per dominio registrabile
  const usedLeaf = new Set();
  const truth = []; // [host, trueLabel('ok'|'ko'), heterogeneous]

  const bump = (map, key, ok) => {
    const m = map.get(key) || { ok: 0, ko: 0 }; m[ok ? 'ok' : 'ko']++; map.set(key, m);
  };

  for (const { dom, heterogeneous, branches } of doms) {
    for (const { name, rate } of branches) {
      // TRAIN: sotto-domini visti
      for (let l = 0; l < TRAIN_LEAVES; l++) {
        let host; do { host = `${REGIONS[Math.floor(rnd() * REGIONS.length)]}.${name}.${dom}`; }
        while (usedLeaf.has(host)); usedLeaf.add(host);
        for (let o = 0; o < OBS; o++) {
          const ok = rnd() < rate;
          recordDiscovery(mem, host, ok, 0);
          bump(domBackoff, dom, ok);
        }
      }
      // TEST: sotto-domini NUOVI sotto lo stesso ramo noto
      const trueLabel = rate >= 0.5 ? 'ok' : 'ko';
      for (let l = 0; l < TEST_LEAVES; l++) {
        let host; do { host = `${REGIONS[Math.floor(rnd() * REGIONS.length)]}.${name}.${dom}`; }
        while (usedLeaf.has(host)); usedLeaf.add(host);
        truth.push([host, trueLabel, heterogeneous]);
      }
    }
  }

  const labelOf = (host, opts) => {
    const r = predictHierarchical(mem.hosts, domainPath(host), 0, opts);
    return r.label || null;
  };
  const domBackoffLabel = (host) => {
    const dom = domainPath(host)[1]; // dominio registrabile
    const m = domBackoff.get(dom); if (!m) return null;
    return m.ok >= m.ko ? 'ok' : 'ko';
  };

  const evalPred = (fn, filter = null) => {
    let ok = 0, n = 0;
    for (const [host, tl, het] of truth) {
      if (filter !== null && het !== filter) continue;
      n++; if (fn(host) === tl) ok++;
    }
    return n ? ok / n : 0;
  };

  const slice = (filter) => ({
    backoff: evalPred(domBackoffLabel, filter),
    adaptive: evalPred((h) => labelOf(h, {}), filter),
    kfix: [0.5, 4, 8, 16, 24].map((kv) => ({ k: kv, acc: evalPred((h) => labelOf(h, { fixedK: kv }), filter) })),
  });
  return { all: slice(null), hetero: slice(true), homo: slice(false) };
}

const SEEDS = [11, 23, 37, 51, 67, 83, 97, 113];
const runs = SEEDS.map(runSeed);
const agg = (sel) => {
  const xs = runs.map(sel);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return { mean, sd };
};
const pct = (x) => (100 * x).toFixed(1);
const fmt = (m) => `${pct(m.mean)}% ±${pct(m.sd)}`;

function report(name, key) {
  const backoff = agg(r => r[key].backoff.acc ?? r[key].backoff);
  const adaptive = agg(r => r[key].adaptive.acc ?? r[key].adaptive);
  let bestFix = { mean: -1 };
  for (let i = 0; i < runs[0][key].kfix.length; i++) {
    const m = agg(r => r[key].kfix[i].acc);
    if (m.mean > bestFix.mean) bestFix = { ...m, k: runs[0][key].kfix[i].k };
  }
  const sdRef = Math.max(backoff.sd, adaptive.sd, bestFix.sd);
  const beyond = (g) => Math.abs(g) >= 2 * sdRef ? '(oltre 2σ → REALE)' : '(dentro 2σ → non dimostrato)';
  console.log(`\n=== ${name} — ${SEEDS.length} seed ===`);
  console.log(`  Baseline backoff dominio registrabile : ${fmt(backoff)}`);
  console.log(`  Gerarchia PROFONDA k adattivo         : ${fmt(adaptive)}`);
  console.log(`  Miglior k fisso (k=${bestFix.k})                 : ${fmt(bestFix)}`);
  console.log(`  VERDETTO:`);
  console.log(`    gerarchia vs backoff dominio : ${adaptive.mean - backoff.mean >= 0 ? '+' : ''}${pct(adaptive.mean - backoff.mean)} punti  ${beyond(adaptive.mean - backoff.mean)}`);
  console.log(`    adattivo  vs miglior k fisso : ${adaptive.mean - bestFix.mean >= 0 ? '+' : ''}${pct(adaptive.mean - bestFix.mean)} punti  ${beyond(adaptive.mean - bestFix.mean)}`);
}

report('TUTTI i domini', 'all');
report('SOLO domini ETEROGENEI (il caso decisivo)', 'hetero');
report('Solo domini omogenei (controllo)', 'homo');
console.log(`\nOnesta': la gerarchia profonda vale se batte il backoff sul dominio OLTRE 2σ`);
console.log(`sui domini ETEROGENEI — dove la media di dominio e' inutile e solo il ramo`);
console.log(`profondo porta il segnale. E' l'unica prova che l'ereditarieta' e' tecnologia.\n`);
