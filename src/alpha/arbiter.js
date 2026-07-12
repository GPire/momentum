// ============================================================
// ARBITRO ALPHA (Munger) — combina i fattori per REGIME di mercato
// ============================================================
// Onestà tecnica (regola #1): non predice il futuro. Pesa i quattro fattori
// (value/growth/momentum/risk) in modo condizionato dal REGIME, applica due
// "mental model" di Munger come guardrail espliciti, e SI ASTIENE quando i
// dati non bastano — invece di dare un verdetto sicuro su nulla. Il regime
// arriva da fuori (regime.js, dalla volatilità/trend): qui è solo un input.
// Funzioni pure. La novità difendibile è la composizione, non i pesi.
'use strict';

import { personalizeWeights } from './strategy-evolution.js';

// Pesi per regime (dichiarati). risk-on → più growth/momentum; risk-off →
// più value/risk (difesa); neutral → bilanciato. "All-Weather adattivo".
// reflexivity (Soros) entra con un peso piccolo dichiarato: cavalca i loop
// nei regimi trend (risk-on), quasi assente in difesa (risk-off).
export const REGIME_WEIGHTS = {
  'risk-on':  { value: 0.18, growth: 0.30, momentum: 0.30, risk: 0.10, reflexivity: 0.12 },
  'risk-off': { value: 0.35, growth: 0.10, momentum: 0.08, risk: 0.45, reflexivity: 0.02 },
  'neutral':  { value: 0.24, growth: 0.24, momentum: 0.22, risk: 0.24, reflexivity: 0.06 },
};

// scores: { value, growth, momentum, risk, reflexivity } ciascuno { score } (da factors.js).
// opts.perf (opzionale): track-record per-utente (strategy-evolution.js) → i
// pesi si PERSONALIZZANO su chi usa l'app (sezione 4.2). Senza perf: pesi base.
export function arbitrate(scores, regime = 'neutral', opts = {}) {
  const base = REGIME_WEIGHTS[regime] || REGIME_WEIGHTS.neutral;
  const w = opts.perf ? personalizeWeights(base, opts.perf) : base;
  const s = {
    value: scores.value?.score ?? 0.5,
    growth: scores.growth?.score ?? 0.5,
    momentum: scores.momentum?.score ?? 0.5,
    risk: scores.risk?.score ?? 0.5,
    reflexivity: scores.reflexivity?.score ?? 0.5,
  };
  let composite = (w.value * s.value + w.growth * s.growth + w.momentum * s.momentum + w.risk * s.risk + (w.reflexivity || 0) * s.reflexivity);

  // ── Munger #1 (Inversion): "cosa può andare storto?" Un rischio molto alto
  // (risk score basso) taglia il punteggio, per quanto attraenti gli altri.
  const inversion = s.risk < (opts.riskFloor ?? 0.25);
  if (inversion) composite *= 0.5;

  // ── Munger #2 (Circle of competence): se troppi fattori sono "neutri per
  // mancanza di dati" (≈0.5), non fingere una convinzione → astensione.
  const neutralCount = [s.value, s.growth, s.momentum, s.risk, s.reflexivity].filter(x => Math.abs(x - 0.5) < 1e-6).length;
  const abstain = neutralCount >= 4;

  composite = Math.max(0, Math.min(1, composite));
  const verdict = abstain ? 'astengo' : composite >= 0.66 ? 'compra' : composite >= 0.45 ? 'tieni' : 'evita';

  return {
    score: +composite.toFixed(4),
    regime,
    weights: w,
    verdict,
    abstain,
    flags: { inversion },
    explanation: abstain
      ? 'Dati insufficienti sui fattori: non esprimo un giudizio (circle of competence).'
      : `Regime ${regime}: ${verdict} (composito ${(composite * 100).toFixed(0)}%${inversion ? ', penalizzato per rischio di coda' : ''}).`,
  };
}
