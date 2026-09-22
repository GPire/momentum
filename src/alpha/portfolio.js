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

// Pesi REALI di mercato dalle posizioni vere (valore = quantita' * prezzo),
// mai gli stessi pesi target: e' il punto di partenza del confronto, non il
// risultato. Posizioni senza prezzo noto o valore <= 0 vengono escluse (mai
// un peso inventato su un dato mancante).
export function currentWeights(positions = [], priceByTicker = {}) {
  const values = {};
  let total = 0;
  for (const p of positions) {
    const price = priceByTicker[p.ticker];
    const qty = +p.quantity;
    if (!p.ticker || !Number.isFinite(price) || !Number.isFinite(qty)) continue;
    const v = price * qty;
    if (v <= 0) continue;
    values[p.ticker] = (values[p.ticker] || 0) + v;
    total += v;
  }
  const w = {};
  for (const t of Object.keys(values)) w[t] = total > 0 ? +(values[t] / total).toFixed(6) : 0;
  return w;
}

// Confronta i pesi REALI con quelli target (es. risk-parity) e ritorna solo
// gli scostamenti che superano una soglia (default 10 punti percentuali) —
// mai un segnale sul rumore quotidiano dei prezzi. Ordinato per gravita'
// (scostamento assoluto piu' grande prima). 'reduce' = pesa piu' del target
// (troppo rischio concentrato li'), 'increase' = pesa meno del target.
export function rebalanceSuggestions(current = {}, target = {}, { thresholdPct = 10 } = {}) {
  const tickers = new Set([...Object.keys(current), ...Object.keys(target)]);
  const out = [];
  for (const t of tickers) {
    const curPct = +((current[t] || 0) * 100).toFixed(1);
    const tgtPct = +((target[t] || 0) * 100).toFixed(1);
    const deltaPts = +(curPct - tgtPct).toFixed(1);
    if (Math.abs(deltaPts) >= thresholdPct) {
      out.push({ ticker: t, currentPct: curPct, targetPct: tgtPct, deltaPts, action: deltaPts > 0 ? 'reduce' : 'increase' });
    }
  }
  return out.sort((a, b) => Math.abs(b.deltaPts) - Math.abs(a.deltaPts));
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
