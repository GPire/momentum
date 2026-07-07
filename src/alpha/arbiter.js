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

// Pesi per regime (dichiarati). risk-on → più growth/momentum; risk-off →
// più value/risk (difesa); neutral → bilanciato. "All-Weather adattivo".
export const REGIME_WEIGHTS = {
  'risk-on':  { value: 0.20, growth: 0.35, momentum: 0.35, risk: 0.10 },
  'risk-off': { value: 0.35, growth: 0.10, momentum: 0.10, risk: 0.45 },
  'neutral':  { value: 0.25, growth: 0.25, momentum: 0.25, risk: 0.25 },
};

// scores: { value, growth, momentum, risk } ciascuno { score, parts } (da factors.js).
export function arbitrate(scores, regime = 'neutral', opts = {}) {
  const w = REGIME_WEIGHTS[regime] || REGIME_WEIGHTS.neutral;
  const s = {
    value: scores.value?.score ?? 0.5,
    growth: scores.growth?.score ?? 0.5,
    momentum: scores.momentum?.score ?? 0.5,
    risk: scores.risk?.score ?? 0.5,
  };
  let composite = w.value * s.value + w.growth * s.growth + w.momentum * s.momentum + w.risk * s.risk;

  // ── Munger #1 (Inversion): "cosa può andare storto?" Un rischio molto alto
  // (risk score basso) taglia il punteggio, per quanto attraenti gli altri.
  const inversion = s.risk < (opts.riskFloor ?? 0.25);
  if (inversion) composite *= 0.5;

  // ── Munger #2 (Circle of competence): se troppi fattori sono "neutri per
  // mancanza di dati" (≈0.5), non fingere una convinzione → astensione.
  const neutralCount = [s.value, s.growth, s.momentum, s.risk].filter(x => Math.abs(x - 0.5) < 1e-6).length;
  const abstain = neutralCount >= 3;

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
