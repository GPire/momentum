// ============================================================
// ESECUTIVO A CASCATA — cost-aware gating tra le "regioni corticali"
// ============================================================
// Onestà tecnica (regola #1): non è magia, è una CASCATA con soglie
// dichiarate. Risolve un difetto reale dell'architettura precedente —
// Nano e Meso facevano lo STESSO compito (voto ridondante). Qui hanno
// ruoli DIVERSI e complementari, e il pesante si sveglia solo se serve:
//
//   Nano  = gatekeeper istantaneo (sempre attivo, ogni hardware): se è
//           già molto sicuro, chiude lì → costo 1.
//   Meso  = specialista subword profondo: invocato SOLO se Nano è incerto.
//   DCGN  = segnale di CONTESTO (importo/ora/merchant/causalità): invocato
//           solo se testo ambiguo dopo Nano+Meso.
//   Astensione = se anche dopo tutto la confidenza è bassa e i modelli
//           NON concordano → "non lo so" (trigger di active learning),
//           invece di sbagliare con sicurezza (problema noto degli LLM).
//
// Funzioni PURE (nessun DOM/VaultDAO): gli stadi sono callback pigre, così
// il test verifica che il costo sia reale (Meso/DCGN non vengono chiamati
// quando Nano basta). Il peso di ogni voto è modulato dalla competenza
// per-categoria misurata (stessa filosofia dell'orchestrator/federazione).
'use strict';

const DEFAULTS = { highConf: 0.85, midConf: 0.60, abstainConf: 0.50 };

// Fusione a voto pesato: score[cat] += confidence * reliability(model,cat).
function fuse(votes, reliability) {
  const score = {};
  for (const v of votes) {
    const r = reliability ? reliability(v.source, v.category) : 1;
    score[v.category] = (score[v.category] || 0) + v.confidence * r;
  }
  let total = 0;
  for (const c in score) total += score[c];
  let best = null, bestScore = -Infinity;
  for (const c in score) if (score[c] > bestScore) { bestScore = score[c]; best = c; }
  return { category: best, confidence: total > 0 ? bestScore / total : 0 };
}

// stages = { nano, meso?, dcgn? }: ognuno è (text) => { category, confidence∈0..1 }.
// Ritorna { category, confidence, ran:[stadi eseguiti], abstain, agreement }.
export function executiveCascade(text, stages, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const reliability = opts.reliability || null;
  const ran = [];
  // Budget esperti del device (adaptive-runtime): su hardware debole un
  // esperto pesante non è nemmeno attivabile → sparse-MoE reale, non solo
  // early-exit. Senza plan, tutti attivabili (comportamento invariato).
  const allowed = (e) => !opts.plan || (opts.plan.experts || []).includes(e);

  // ── Stadio 1: Nano gatekeeper ──
  const nano = stages.nano(text); ran.push('nano');
  const nanoVote = { source: 'nano', category: nano.category, confidence: nano.confidence };
  if (nano.confidence >= cfg.highConf) {
    return { category: nano.category, confidence: nano.confidence, ran, abstain: false, agreement: true };
  }

  // ── Stadio 2: escalation allo specialista Meso (se il device lo consente) ──
  if (!stages.meso || !allowed('meso')) {
    return { category: nano.category, confidence: nano.confidence, ran, abstain: nano.confidence < cfg.abstainConf, agreement: true };
  }
  const meso = stages.meso(text); ran.push('meso');
  const mesoVote = { source: 'meso', category: meso.category, confidence: meso.confidence };
  let combined = fuse([nanoVote, mesoVote], reliability);
  const agree2 = nano.category === meso.category;
  if (agree2 || combined.confidence >= cfg.midConf) {
    return { category: combined.category, confidence: combined.confidence, ran, abstain: false, agreement: agree2 };
  }

  // ── Stadio 3: segnale di contesto DCGN (solo se ancora ambiguo) ──
  const votes = [nanoVote, mesoVote];
  if (stages.dcgn && allowed('dcgn')) {
    const dcgn = stages.dcgn(text); ran.push('dcgn');
    votes.push({ source: 'dcgn', category: dcgn.category, confidence: dcgn.confidence });
    combined = fuse(votes, reliability);
  }

  // ── Astensione: incerto E in disaccordo → "non lo so" ──
  const distinct = new Set(votes.map(v => v.category)).size;
  const abstain = combined.confidence < cfg.abstainConf && distinct > 1;
  return { category: combined.category, confidence: combined.confidence, ran, abstain, agreement: distinct === 1 };
}
