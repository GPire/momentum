// ============================================================
// RILEVATORE DI REGIME DI MERCATO — input dell'arbitro
// ============================================================
// Onestà tecnica (regola #1): non prevede il mercato. Classifica lo STATO
// recente in risk-on / risk-off / neutral da due segnali misurati: TREND
// (ritorno recente vs media) e VOLATILITÀ (dispersione recente vs baseline).
// Soglie dichiarate. Neutro senza dati sufficienti. Funzione pura.
'use strict';

const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const std = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };

// prices: serie storica (vecchio→nuovo). Ritorna { regime, trend, vol, explanation }.
export function detectRegime(prices, opts = {}) {
  const p = (prices || []).filter(Number.isFinite);
  if (p.length < 25) return { regime: 'neutral', trend: 0, vol: 0, explanation: 'Dati insufficienti: regime neutro.' };

  const rets = [];
  for (let i = 1; i < p.length; i++) rets.push((p[i] - p[i - 1]) / p[i - 1]);

  const look = Math.min(20, rets.length);
  const recent = rets.slice(-look);
  const trend = mean(recent);                         // ritorno medio recente
  const volRecent = std(recent);
  const volBase = std(rets);                          // baseline sull'intera serie
  const volRatio = volBase > 0 ? volRecent / volBase : 1;

  const trendUp = opts.trendUp ?? 0.001;              // ~0.1%/periodo
  const trendDown = opts.trendDown ?? -0.001;
  const highVol = opts.highVol ?? 1.3;                // vol recente 30% sopra baseline

  let regime = 'neutral';
  if (trend > trendUp && volRatio < highVol) regime = 'risk-on';
  else if (trend < trendDown || volRatio >= highVol) regime = 'risk-off';

  return {
    regime,
    trend: +trend.toFixed(5),
    vol: +volRecent.toFixed(5),
    volRatio: +volRatio.toFixed(3),
    explanation: `Trend ${(trend * 100).toFixed(2)}%/periodo, volatilità ${volRatio.toFixed(2)}× la norma → ${regime}.`,
  };
}
