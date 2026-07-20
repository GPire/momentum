// ============================================================
// ADVISOR BANDIT — Lab 5 della Constellation v10 (on-device, per-utente)
// ============================================================
// Contextual bandit (Thompson sampling Beta-Bernoulli) sopra i "kind" di nudge
// prodotti da advisor.getAdvisorInsights. Impara QUALE consiglio porta QUESTO
// utente ad AGIRE/RISPARMIARE davvero, e lo mostra piu' spesso — restando 100%
// on-device (lo stato vive nel vault, nessun dato esce).
//
// Onesta' (regola n.1): NON e' un modello-facciata. Beta-Bernoulli Thompson e'
// l'algoritmo standard di bandit, leggerissimo. E' ADDITIVO: modifica solo
// l'ORDINE di presentazione (i nudge e i loro numeri restano quelli calcolati
// dagli engine deterministici). In modalita' greedy senza dati tutti i bracci
// hanno media a posteriori 0,5 -> ordine d'ingresso preservato (nessun effetto).
// Funzioni pure: lo stato arriva e torna dal chiamante.
'use strict';

const PRIOR_A = 1, PRIOR_B = 1;   // Beta(1,1) = prior uniforme neutro
const DECAY = 0.995;              // le abitudini cambiano: pesa piu' il recente

export function initBandit() { return { version: 1, arms: {} }; }

// Contesto grossolano ma stabile -> e' cio' che rende il bandit "contextual":
// lo stesso nudge puo' funzionare quando sei in pari e non quando sei oltre.
export function banditContext({ overBudget = false, phase = 'mid' } = {}) {
  return `${overBudget ? 'over' : 'ok'}:${phase}`;
}

function armKey(context, kind) { return `${context}|${kind}`; }

function getArm(state, context, kind) {
  const s = state && state.arms ? state : initBandit();
  return s.arms[armKey(context, kind)] || { a: PRIOR_A, b: PRIOR_B };
}

// Osserva l'esito di un nudge mostrato. reward in [0,1]: 1 = l'utente ha agito
// (o ha risparmiato), 0 = ignorato. Ammette reward frazionario (azione parziale).
// Aggiornamento Beta-Bernoulli con decadimento esponenziale verso il prior.
export function banditObserve(state, { context = banditContext(), kind, reward = 0 }) {
  const s = state && state.arms ? state : initBandit();
  const arm = getArm(s, context, kind);
  const r = Math.max(0, Math.min(1, reward));
  const a = PRIOR_A + (arm.a - PRIOR_A) * DECAY + r;
  const b = PRIOR_B + (arm.b - PRIOR_B) * DECAY + (1 - r);
  return { ...s, arms: { ...s.arms, [armKey(context, kind)]: { a, b } } };
}

// Media a posteriori del braccio (deterministica): la "stima migliore" che
// questo nudge funzioni in questo contesto. Senza dati = 0,5 per tutti.
export function armMean(state, { context = banditContext(), kind } = {}) {
  const arm = getArm(state, context, kind);
  return arm.a / (arm.a + arm.b);
}

// RNG seedato (mulberry32) -> Thompson sampling deterministico e testabile.
export function makeRng(seed = 123456789) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// Gamma(k,1) via Marsaglia-Tsang (con boost per k<1). Normale via Box-Muller.
function sampleGamma(k, rng) {
  if (k < 1) return sampleGamma(1 + k, rng) * Math.pow(rng() || 1e-12, 1 / k);
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do {
      const u1 = rng() || 1e-12, u2 = rng();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng() || 1e-12;
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function sampleBeta(a, b, rng) {
  const x = sampleGamma(a, rng), y = sampleGamma(b, rng);
  return (x + y) === 0 ? 0.5 : x / (x + y);
}

// Un campione Thompson dalla posterior del braccio (esplora + sfrutta).
export function thompsonScore(state, { context = banditContext(), kind, rng } = {}) {
  const arm = getArm(state, context, kind);
  return sampleBeta(arm.a, arm.b, rng || makeRng());
}

// Riordina le insight dell'advisor. explore=false (default) = greedy per media
// a posteriori, stabile: senza dati preserva l'ordine d'ingresso (0 effetto).
// explore=true = Thompson sampling (bandit vero): esplora i nudge poco visti.
export function rankNudges(insights = [], state, { context = banditContext(), explore = false, rng } = {}) {
  const r = explore ? (rng || makeRng()) : null;
  const scored = insights.map((ins, i) => ({
    ins, i,
    score: explore
      ? thompsonScore(state, { context, kind: ins.kind, rng: r })
      : armMean(state, { context, kind: ins.kind }),
  }));
  scored.sort((x, y) => (y.score - x.score) || (x.i - y.i));
  return scored.map(s => s.ins);
}

// ── Fase del mese: lo stesso nudge può valere diversamente a inizio/fine mese
// (es. "safe-to-spend" e' piu' rilevante a meta' mese che il giorno 1).
export function phaseOfMonth(date = new Date()) {
  const d = date.getDate();
  return d <= 10 ? 'early' : d <= 20 ? 'mid' : 'late';
}

// Seed deterministico per giorno (YYYYMMDD): il Thompson sampling esplora, ma
// DENTRO la stessa giornata l'ordine resta stabile — niente nudge che
// "saltellano" a ogni render (frustrante, l'opposto di un'app per un bambino
// di 8 anni). Cambia automaticamente al giorno successivo.
export function dailySeed(date = new Date()) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

// Registra quali nudge sono stati MOSTRATI oggi (per poi valutare, a fine
// giornata, quelli mai toccati come reward 0 — "mostrato e ignorato tutto il
// giorno" e' il segnale onesto di "non funziona qui").
export function makeImpressions({ dayKey, context, kinds = [] } = {}) {
  return { dayKey, context, kinds: [...kinds], acted: [] };
}

// renderAnalysis() viene chiamato PIÙ VOLTE nello stesso giorno (init, forecast
// worker, sync mesh, cambio vista...). Ricreare pending da zero ad ogni
// chiamata perderebbe i tap già registrati (pending.acted) tra un render e
// l'altro — bug reale trovato verificando in browser (renderAnalysis chiamato
// 2+ volte al caricamento). Se il pending esistente è di OGGI: si preserva
// acted e si fa l'unione dei kind mostrati; solo se manca o è di un altro
// giorno si crea da zero.
export function mergePendingSameDay(existing, todayKey, context, kinds = []) {
  if (existing && existing.dayKey === todayKey) {
    const merged = Array.from(new Set([...existing.kinds, ...kinds]));
    return { ...existing, kinds: merged };
  }
  return makeImpressions({ dayKey: todayKey, context, kinds });
}

// Se pending si riferisce a un giorno PASSATO (todayKey diverso): applica
// reward 0 a ogni kind mostrato e mai agito, poi azzera pending. Nello stesso
// giorno è un no-op. Idempotente: pending=null non fa nulla.
export function settleImpressions(state, pending, todayKey) {
  if (!pending || pending.dayKey === todayKey) return { state, pending };
  let s = state && state.arms ? state : initBandit();
  for (const kind of pending.kinds) {
    if (!pending.acted.includes(kind)) {
      s = banditObserve(s, { context: pending.context, kind, reward: 0 });
    }
  }
  return { state: s, pending: null };
}
