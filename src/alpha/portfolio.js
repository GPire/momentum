// ============================================================
// COSTRUZIONE PORTAFOGLIO — risk-parity + statistiche di rischio
// ============================================================
// Onestà tecnica (regola #1): risk-parity qui è la versione inverse-volatility
// (peso ∝ 1/volatilità) — approssimazione trasparente e standard dell'equal
// risk contribution, non una black box. Covarianza reale, metriche misurate
// (Sharpe, max drawdown). Nessuna promessa di rendimento futuro: sono proprietà
// storiche/simulate della serie. Funzioni pure (pattern engines.js).
'use strict';

const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const std = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };

// returnsByAsset: { ticker: [r_t...] } serie di rendimenti allineate.
export function covarianceMatrix(returnsByAsset) {
  const tickers = Object.keys(returnsByAsset);
  const n = Math.min(...tickers.map(t => returnsByAsset[t].length));
  const means = {};
  for (const t of tickers) means[t] = mean(returnsByAsset[t].slice(-n));
  const cov = {};
  for (const a of tickers) {
    cov[a] = {};
    for (const b of tickers) {
      let s = 0;
      for (let i = 0; i < n; i++) s += (returnsByAsset[a][returnsByAsset[a].length - n + i] - means[a]) * (returnsByAsset[b][returnsByAsset[b].length - n + i] - means[b]);
      cov[a][b] = s / (n || 1);
    }
  }
  return cov;
}

// Pesi risk-parity (inverse-vol), normalizzati a somma 1.
export function riskParityWeights(returnsByAsset) {
  const tickers = Object.keys(returnsByAsset);
  const invVol = {};
  let total = 0;
  for (const t of tickers) {
    const v = std(returnsByAsset[t]);
    invVol[t] = v > 0 ? 1 / v : 0;
    total += invVol[t];
  }
  const w = {};
  for (const t of tickers) w[t] = total > 0 ? +(invVol[t] / total).toFixed(6) : +(1 / tickers.length).toFixed(6);
  return w;
}

// Serie di rendimenti del portafoglio dati i pesi.
export function portfolioReturns(weights, returnsByAsset) {
  const tickers = Object.keys(weights);
  const n = Math.min(...tickers.map(t => returnsByAsset[t].length));
  const out = [];
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (const t of tickers) r += weights[t] * returnsByAsset[t][returnsByAsset[t].length - n + i];
    out.push(r);
  }
  return out;
}

// Statistiche di rischio/rendimento di una serie di rendimenti.
export function portfolioStats(returns, opts = {}) {
  const r = (returns || []).filter(Number.isFinite);
  if (r.length < 2) return { annReturn: 0, vol: 0, sharpe: 0, maxDrawdown: 0 };
  const periods = opts.periodsPerYear ?? 252;
  const mu = mean(r), sd = std(r);
  let cum = 1, peak = 1, mdd = 0;
  for (const x of r) { cum *= 1 + x; peak = Math.max(peak, cum); mdd = Math.max(mdd, (peak - cum) / peak); }
  const sharpe = sd > 0 ? (mu / sd) * Math.sqrt(periods) : 0;
  return {
    annReturn: +((cum ** (periods / r.length) - 1)).toFixed(4),
    vol: +(sd * Math.sqrt(periods)).toFixed(4),
    sharpe: +sharpe.toFixed(3),
    maxDrawdown: +mdd.toFixed(4),
  };
}
