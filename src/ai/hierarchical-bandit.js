// ============================================================
// HIERARCHICAL BANDIT — pooling bayesiano gerarchico adattivo (v11)
// ============================================================
// PRIMITIVO PROPRIETARIO condiviso da due domini diversi di Momentum:
//   1) scoperta aggiornamenti  → gerarchia delle etichette DNS
//      ('it' → 'momentum.it' → 'cdn.momentum.it' → 'eu.cdn.momentum.it')
//   2) Momentum Core           → gerarchia dei token di un esercente
//      ('esselunga' → 'esselunga via' → 'esselunga via rizzoli')
//
// IL PROBLEMA CHE RISOLVE (in entrambi i casi lo stesso):
// un bandit piatto impara PER CHIAVE ESATTA. Un sotto-dominio mai visto, o un
// esercente mai visto, partono da zero — anche quando il genitore e' arcinoto.
// E' il limite n.1 misurato del progetto: 89.7% in-distribution contro il crollo
// sugli esercenti fuori vocabolario (VERSIONI.md). Qui la conoscenza SCENDE
// lungo la gerarchia: cio' che ha imparato 'momentum.it' fa da prior ai suoi
// sotto-domini futuri, cio' che ha imparato 'esselunga' fa da prior a
// 'esselunga via rizzoli 12' visto per la prima volta.
//
// COME (Dirichlet-multinomiale con shrinkage verso il genitore, top-down):
//   p_nodo(l) = (conteggi_nodo(l) + k · p_genitore(l)) / (n_nodo + k)
// con poco dato il nodo EREDITA il genitore, con molto dato lo domina.
//
// LA PARTE NON BANALE — k ADATTIVO (empirical Bayes sull'eterogeneita'):
// k non e' una costante messa a mano. Ogni nodo misura quanto i suoi figli
// SONO D'ACCORDO tra loro (distanza in variazione totale, pesata). Figli
// omogenei → k alto → un figlio nuovo eredita con forza. Figli eterogenei →
// k basso → ereditare sarebbe dannoso, il nodo nuovo resta prudente.
// Cioe': il sistema impara QUANTO e' lecito generalizzare, per ramo. Un dominio
// i cui sotto-domini si comportano tutti uguale trasferisce molto; una catena i
// cui punti vendita finiscono in categorie diverse trasferisce poco.
//
// Il tempo NON sposta le probabilita', ne toglie CONFIDENZA: i conteggi
// decadono (dimezzamento configurabile) e il nodo torna verso il genitore.
// Onesto: il vecchio non diventa falso, diventa meno vincolante.
//
// Funzioni pure, nessun DOM, nessuna rete, tutto serializzabile nel vault.
'use strict';

const DAY = 86_400_000;
const DEFAULT_HALF_LIFE = 45 * DAY;
const K_MAX = 24;   // pooling massimo: figli perfettamente concordi
const K_MIN = 0.5;  // pooling minimo: figli in totale disaccordo
const K_UNKNOWN = 8; // nodo senza figli confrontabili: prudente ma generalizza
const SEP = '';

export function initHierarchical(opts = {}) {
  return {
    nodes: {},
    labels: {},
    version: 1,
    halfLifeMs: opts.halfLifeMs ?? DEFAULT_HALF_LIFE,
  };
}

const keyOf = (path) => path.join(SEP);

function nodeAt(model, key) {
  let n = model.nodes[key];
  if (!n) { n = { c: {}, n: 0, last: 0, kids: {} }; model.nodes[key] = n; }
  return n;
}

// ── Osservazione: aggiorna il nodo E TUTTI i suoi antenati (il pooling nasce qui)
export function observeHierarchical(model, path = [], label, now = Date.now(), weight = 1) {
  if (!label || weight <= 0) return model;
  model.labels[label] = (model.labels[label] || 0) + weight;
  for (let i = 0; i <= path.length; i++) {
    const key = keyOf(path.slice(0, i));
    const node = nodeAt(model, key);
    node.c[label] = (node.c[label] || 0) + weight;
    node.n += weight;
    node.last = Math.max(node.last, now);
    if (i > 0) nodeAt(model, keyOf(path.slice(0, i - 1))).kids[key] = 1;
  }
  return model;
}

// Conteggi attenuati dal tempo: la PROPORZIONE resta, cala il peso.
function decayed(node, model, now) {
  if (!node || node.n <= 0) return { c: {}, n: 0 };
  const dt = Math.max(0, now - (node.last || 0));
  const d = Math.pow(0.5, dt / (model.halfLifeMs || DEFAULT_HALF_LIFE));
  const c = {};
  for (const l in node.c) c[l] = node.c[l] * d;
  return { c, n: node.n * d };
}

function normalize(dist) {
  let s = 0;
  for (const l in dist) s += dist[l];
  if (s <= 0) return dist;
  const out = {};
  for (const l in dist) out[l] = dist[l] / s;
  return out;
}

// ── k adattivo: quanto i figli di questo nodo sono d'accordo tra loro?
// Distanza in variazione totale figlio↔nodo, pesata per evidenza. 0 = concordi.
export function poolingStrength(model, key, now = Date.now()) {
  const node = model.nodes[key];
  if (!node) return K_UNKNOWN;
  const parentDist = normalize({ ...decayed(node, model, now).c });
  const kids = Object.keys(node.kids || {});
  let wSum = 0, hSum = 0, usable = 0;
  for (const kk of kids) {
    const kid = model.nodes[kk];
    if (!kid) continue;
    const { c, n } = decayed(kid, model, now);
    if (n < 1) continue;
    const kidDist = normalize({ ...c });
    let tv = 0;
    const labels = new Set([...Object.keys(kidDist), ...Object.keys(parentDist)]);
    for (const l of labels) tv += Math.abs((kidDist[l] || 0) - (parentDist[l] || 0));
    tv /= 2; // variazione totale in [0,1]
    hSum += tv * n;
    wSum += n;
    usable++;
  }
  if (usable < 2 || wSum <= 0) return K_UNKNOWN;
  const h = Math.min(1, hSum / wSum);
  return K_MIN + (K_MAX - K_MIN) * Math.pow(1 - h, 2);
}

// ── Predizione: cascata top-down lungo la gerarchia.
// Funziona ANCHE se le foglie non esistono: e' esattamente il caso "mai visto",
// dove la risposta e' il miglior antenato conosciuto.
export function scoreHierarchical(model, path = [], now = Date.now(), opts = {}) {
  const universe = Object.keys(model.labels);
  if (!universe.length) return { dist: {}, support: 0, depth: -1, matched: [], k: null };

  let dist = {};
  for (const l of universe) dist[l] = 1 / universe.length; // prior uniforme onesto
  let support = 0, depth = -1, lastK = null;
  const matched = [];

  for (let i = 0; i <= path.length; i++) {
    const key = keyOf(path.slice(0, i));
    const node = model.nodes[key];
    if (!node || node.n <= 0) break; // oltre qui la gerarchia e' ignota: eredita
    const { c, n } = decayed(node, model, now);
    if (n <= 0) break;
    const parentKey = i > 0 ? keyOf(path.slice(0, i - 1)) : null;
    // `fixedK` (additivo, default undefined) forza un pooling costante: serve SOLO
    // all'ablation-bench per isolare il contributo del k adattivo. In produzione
    // resta undefined → il k lo decide `poolingStrength` dall'eterogeneita' del ramo.
    const k = opts.fixedK != null
      ? opts.fixedK
      : (parentKey === null ? K_UNKNOWN : poolingStrength(model, parentKey, now));
    // `kCapFactor` (additivo, default undefined): tetto al peso del prior
    // proporzionale all'evidenza del nodo. Empirical-Bayes onesto: quando il nodo
    // ha dati propri informativi, il prero del genitore/radice NON deve dominarli.
    // Difetto trovato dall'ablation: K_MAX=24 >> evidenza per-catena (~6), quindi
    // la radice (che mescola tutte le catene) sovrastava la maggioranza pulita.
    const kEff = opts.kCapFactor != null ? Math.min(k, opts.kCapFactor * n) : k;
    const next = {};
    for (const l of universe) next[l] = ((c[l] || 0) + kEff * dist[l]) / (n + kEff);
    dist = normalize(next);
    // L'evidenza che sostiene la stima e' TUTTA quella incontrata scendendo,
    // non solo quella della foglia: gli antenati entrano nel prior. Prendere
    // solo l'ultimo livello faceva tacere il sistema proprio quando il match
    // era piu' specifico e piu' sicuro (trovato dal bench, non a tavolino).
    support = Math.max(support, n); depth = i; lastK = k;
    if (i > 0) matched.push(path[i - 1]);
  }

  if (opts.exclude) {
    const filtered = {};
    for (const l in dist) if (!opts.exclude.includes(l)) filtered[l] = dist[l];
    dist = normalize(filtered);
  }
  return { dist, support, depth, matched, k: lastK };
}

// Comodita': etichetta piu' probabile + confidenza + margine sul secondo.
export function predictHierarchical(model, path = [], now = Date.now(), opts = {}) {
  const r = scoreHierarchical(model, path, now, opts);
  const entries = Object.entries(r.dist).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return { label: null, p: 0, margin: 0, ...r };
  const [label, p] = entries[0];
  const margin = p - (entries[1]?.[1] ?? 0);
  return { label, p, margin, ...r };
}

// Spiegazione tracciabile (regola del progetto: mai un numero senza il perche').
export function explainHierarchical(model, path = [], now = Date.now()) {
  const r = predictHierarchical(model, path, now);
  const deepest = r.depth > 0 ? path.slice(0, r.depth).join(' › ') : '(radice)';
  const inherited = r.depth < path.length;
  return {
    ...r,
    reason: inherited
      ? `mai visto "${path.join(' › ')}": eredito da "${deepest}" (evidenza ${r.support.toFixed(1)}, coesione dei rami k=${(r.k ?? 0).toFixed(1)})`
      : `conosciuto: "${deepest}" con evidenza ${r.support.toFixed(1)}`,
    inherited,
  };
}

// ── Federazione mesh: si uniscono i CONTEGGI, mai i dati grezzi.
// Anti-poisoning: il contributo di un peer e' limitato (maxPeerWeight) e non
// puo' creare da solo un ramo dominante — coerente con la reputazione
// hash-chained gia' usata nella mesh.
export function mergeHierarchical(local, remote, { maxPeerWeight = 5 } = {}) {
  if (!remote || !remote.nodes) return local;
  const scale = (n) => Math.min(maxPeerWeight, n) / (n || 1);
  for (const key in remote.nodes) {
    const rn = remote.nodes[key];
    if (!rn || rn.n <= 0) continue;
    const f = scale(rn.n);
    const ln = nodeAt(local, key);
    for (const l in rn.c) {
      ln.c[l] = (ln.c[l] || 0) + rn.c[l] * f;
      local.labels[l] = (local.labels[l] || 0) + rn.c[l] * f;
    }
    ln.n += rn.n * f;
    ln.last = Math.max(ln.last, rn.last || 0);
    for (const kk in rn.kids || {}) ln.kids[kk] = 1;
  }
  return local;
}

// Potatura per tenere il vault leggero: via i rami deboli e vecchi.
export function pruneHierarchical(model, { maxNodes = 4000, minSupport = 0.2, now = Date.now() } = {}) {
  const keys = Object.keys(model.nodes);
  if (keys.length <= maxNodes) {
    for (const k of keys) {
      if (k === '') continue;
      const { n } = decayed(model.nodes[k], model, now);
      if (n < minSupport) delete model.nodes[k];
    }
    return model;
  }
  const scored = keys
    .filter((k) => k !== '')
    .map((k) => [k, decayed(model.nodes[k], model, now).n])
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxNodes)
    .map(([k]) => k);
  const keep = new Set([...scored, '']);
  for (const k of keys) if (!keep.has(k)) delete model.nodes[k];
  for (const k of keep) {
    const node = model.nodes[k];
    if (node) for (const kk in node.kids) if (!keep.has(kk)) delete node.kids[kk];
  }
  return model;
}

// ============================================================
// PRIMITIVO PROPRIETARIO v2 — confidence-gating + ibrido evidence-aware.
// Scoperto e VALIDATO con ablation (bench/research-gating.mjs, bench/*-ablation):
// nel regime a BASSA evidenza (l'inizio-vita reale dell'app, pochi dati per
// ramo) il pooling shrinkage PERDE ~2 punti perche' mescola sempre un po' di
// genitore, anche quando il genitore e' fuorviante (ramo eterogeneo ~50/50).
// Il GATING invece SCEGLIE il livello piu' CONFIDENTE e ignora del tutto quello
// ambiguo: +1,8 punti (t appaiato=4,01) su seed disgiunti, replicato. Nel regime
// ad ALTA evidenza pooling e gating pareggiano (tutto satura). L'IBRIDO prende il
// meglio dei due ed e' STRETTAMENTE DOMINANTE: +1,8 sparso, +0,0 abbondante.
// Additivo: non tocca scoreHierarchical/predictHierarchical (default invariato).
// ============================================================

// Evidenza del NODO PIU' PROFONDO esistente lungo il cammino (il ramo piu'
// specifico che conosco), NON il massimo — che sarebbe dominato dalla radice.
export function deepestEvidence(model, path = [], now = Date.now()) {
  let deepest = 0;
  for (let i = 1; i <= path.length; i++) {
    const node = model.nodes[keyOf(path.slice(0, i))];
    if (node && node.n > 0) deepest = decayed(node, model, now).n;
  }
  return deepest;
}

// Confidence-gating: ogni livello lungo il cammino e' un ESPERTO; la sua
// confidenza e' la massa predittiva posteriore (Laplace) sull'argmax — che
// incorpora gia' l'evidenza (n piccolo → contratta verso 1/L → confidenza bassa).
// Si SELEZIONA l'esperto piu' confidente (a pari, il piu' profondo). Astensione
// se nessun livello batte il caso.
export function scoreGated(model, path = [], now = Date.now(), opts = {}) {
  const universe = Object.keys(model.labels);
  const L = universe.length || 1;
  const alpha = opts.alpha ?? 1;
  let best = null;
  for (let i = 0; i <= path.length; i++) {
    const node = model.nodes[keyOf(path.slice(0, i))];
    if (!node || node.n <= 0) continue;
    const { c, n } = decayed(node, model, now);
    if (n <= 0) continue;
    const denom = n + alpha * L;
    const dist = {};
    let top = null, tp = -1;
    for (const l of universe) {
      const v = ((c[l] || 0) + alpha) / denom;
      dist[l] = v;
      if (v > tp) { tp = v; top = l; }
    }
    if (!best || tp > best.conf + 1e-12 || (Math.abs(tp - best.conf) <= 1e-12 && i > best.depth)) {
      best = { label: top, conf: tp, depth: i, support: n, dist };
    }
  }
  if (!best || best.conf <= 1 / L + 1e-12) {
    return { dist: {}, label: null, p: 0, margin: 0, depth: best ? best.depth : -1, support: best ? best.support : 0 };
  }
  const entries = Object.entries(best.dist).sort((a, b) => b[1] - a[1]);
  const margin = entries[0][1] - (entries[1]?.[1] ?? 0);
  return { dist: best.dist, label: best.label, p: best.conf, margin, depth: best.depth, support: best.support };
}

export function predictGated(model, path = [], now = Date.now(), opts = {}) {
  return scoreGated(model, path, now, opts);
}

// IBRIDO: gating dove so poco del ramo (evidenza < soglia), pooling dove so molto.
// e' la forma provata come strettamente dominante. `gateBelow` default 6.
export function predictHybrid(model, path = [], now = Date.now(), opts = {}) {
  const thresh = opts.gateBelow ?? 6;
  const ev = deepestEvidence(model, path, now);
  if (ev > 0 && ev < thresh) {
    const g = predictGated(model, path, now, opts);
    if (g.label) return g;
  }
  return predictHierarchical(model, path, now, opts);
}
