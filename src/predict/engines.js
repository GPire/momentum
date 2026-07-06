// ============================================================
// MOTORI PREDITTIVI — funzioni pure, senza DOM né VaultDAO,
// così girano identiche nel Web Worker e nel main thread.
//
// Onestà tecnica, verificata riga per riga sulle fonti:
// - HoltWinters: portato 1:1 dalla v12.5 (triple exponential
//   smoothing additivo, implementazione reale e corretta).
// - Monte Carlo Cornish-Fisher: portato dalla v12.5 (Box-Muller
//   + espansione CF con skew/kurtosis empirici — formula esatta).
// - GARCH(1,1): la v14 dichiarava "fit via MLE" ma i parametri
//   erano fissi; qui i parametri restano fissi (valori standard
//   tipo RiskMetrics) MA lo si dichiara, e il forecast multi-step
//   usa la formula corretta σ²(h) = V∞ + (α+β)^h (σ²₀ − V∞)
//   invece dell'hack ad-hoc della v14.
// - AR(2): la v12.5 aveva coefficienti hardcoded spacciati per
//   ARIMA; qui è un vero AR(2) stimato sui dati via Yule-Walker.
// ============================================================

// ── Holt-Winters (triple exponential smoothing additivo) ──
class HoltWinters {
  // alpha=livello, beta=trend, gamma=stagionalità, period=7 (settimanale)
  forecast(series, horizon = 30, alpha = 0.3, beta = 0.1, gamma = 0.2, period = 7) {
    if (!series || series.length < period * 2) return this._fallback(series, horizon);
    const n = series.length;
    let level = series.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let trend = (series.slice(period, period * 2).reduce((a, b) => a + b, 0) / period - level) / period;
    let seasonals = Array.from({ length: period }, (_, i) => {
      let s = 0, cnt = 0;
      for (let j = i; j < n; j += period) { s += series[j]; cnt++; }
      return s / (cnt || 1) - level;
    });
    const fitted = [];
    for (let t = 0; t < n; t++) {
      const s = seasonals[t % period];
      const prev_level = level;
      level = alpha * (series[t] - s) + (1 - alpha) * (level + trend);
      trend = beta * (level - prev_level) + (1 - beta) * trend;
      seasonals[t % period] = gamma * (series[t] - level) + (1 - gamma) * s;
      fitted.push(level + trend + seasonals[t % period]);
    }
    const forecasted = [];
    for (let h = 1; h <= horizon; h++) {
      const seasonal = seasonals[(n + h - 1) % period];
      forecasted.push(Math.max(0, level + h * trend + seasonal));
    }
    return { forecasted, fitted, level: +level.toFixed(2), trend: +trend.toFixed(4) };
  }

  _fallback(series, horizon) {
    if (!series?.length) return { forecasted: Array(horizon).fill(0), fitted: [], level: 0, trend: 0 };
    const avg = series.reduce((a, b) => a + b, 0) / series.length;
    return { forecasted: Array(horizon).fill(+avg.toFixed(2)), fitted: series, level: +avg.toFixed(2), trend: 0 };
  }
}

// ── GARCH(1,1) a parametri fissi (dichiarati, non "fittati") ──
class GARCH {
  constructor(omega = 0.000002, alpha = 0.1, beta = 0.85) {
    this.omega = omega;
    this.alpha = alpha; // termine ARCH (shock recenti)
    this.beta = beta;   // termine GARCH (persistenza)
  }

  // Filtra la serie dei rendimenti per stimare la varianza condizionale corrente.
  // NON è una stima MLE dei parametri: è il filtro GARCH con parametri standard.
  fit(returns) {
    if (!returns || returns.length < 5) return this;
    const n = returns.length;
    const sigma2 = [returns.reduce((s, r) => s + r * r, 0) / n];
    for (let i = 1; i < n; i++) {
      sigma2.push(this.omega + this.alpha * returns[i - 1] ** 2 + this.beta * sigma2[i - 1]);
    }
    this._lastSigma2 = sigma2[sigma2.length - 1];
    this._longRunVar = this.omega / Math.max(1e-10, 1 - this.alpha - this.beta);
    return this;
  }

  // Forecast multi-step corretto: σ²(h) = V∞ + (α+β)^h (σ²₀ − V∞)
  nextVol(n = 1) {
    if (!this._lastSigma2) return Array(n).fill(Math.sqrt(this._longRunVar || 0.01));
    const persistence = this.alpha + this.beta;
    const lr = this._longRunVar;
    const vols = [];
    for (let h = 1; h <= n; h++) {
      const sig2 = lr + Math.pow(persistence, h) * (this._lastSigma2 - lr);
      vols.push(Math.sqrt(Math.max(1e-10, sig2)));
    }
    return vols;
  }
}

// ── AR(2) reale: coefficienti stimati via equazioni di Yule-Walker ──
// r1 = φ1 + φ2·r1 ;  r2 = φ1·r1 + φ2  →  risolto in forma chiusa.
function fitAR2(series) {
  const n = series?.length || 0;
  if (n < 6) return null;
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const centered = series.map(v => v - mean);
  const acov = (lag) => {
    let s = 0;
    for (let i = lag; i < n; i++) s += centered[i] * centered[i - lag];
    return s / n;
  };
  const c0 = acov(0);
  if (c0 < 1e-12) return null; // serie costante: AR non definito
  const r1 = acov(1) / c0, r2 = acov(2) / c0;
  const denom = 1 - r1 * r1;
  if (Math.abs(denom) < 1e-12) return null;
  const phi1 = (r1 * (1 - r2)) / denom;
  const phi2 = (r2 - r1 * r1) / denom;
  // stazionarietà: |φ2|<1, φ2±φ1<1 — se violata il forecast divergerebbe
  if (Math.abs(phi2) >= 1 || phi1 + phi2 >= 1 || phi2 - phi1 >= 1) return null;
  return { phi1, phi2, mean };
}

function forecastAR2(series, horizon = 1) {
  const model = fitAR2(series);
  if (!model) {
    const avg = series?.length ? series.reduce((a, b) => a + b, 0) / series.length : 0;
    return { forecasted: Array(horizon).fill(avg), model: null };
  }
  const { phi1, phi2, mean } = model;
  const n = series.length;
  let prev1 = series[n - 1] - mean, prev2 = series[n - 2] - mean;
  const forecasted = [];
  for (let h = 0; h < horizon; h++) {
    const next = phi1 * prev1 + phi2 * prev2;
    forecasted.push(next + mean);
    prev2 = prev1;
    prev1 = next;
  }
  return { forecasted, model };
}

// ── Monte Carlo spese: Box-Muller + code grasse Cornish-Fisher ──
// (portato dalla v12.5; skew/kurtosis empirici dai VERI importi dell'utente)
function monteCarloExpenses(amounts, recurringTotal = 0, horizon = 30, paths = 5000) {
  if (!amounts || amounts.length < 3) return null;
  const n = amounts.length;
  const mean = amounts.reduce((a, b) => a + b, 0) / n;
  const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  const std = Math.sqrt(variance) || 1;
  const skew = amounts.reduce((a, b) => a + Math.pow((b - mean) / std, 3), 0) / n;
  const kurt = amounts.reduce((a, b) => a + Math.pow((b - mean) / std, 4), 0) / n - 3;
  const cf = z => z + (z * z - 1) * skew / 6 + (z * z * z - 3 * z) * kurt / 24 - (2 * z * z * z - 5 * z) * skew * skew / 36;
  const totals = new Float64Array(paths);
  for (let p = 0; p < paths; p++) {
    let total = 0;
    for (let d = 0; d < horizon; d++) {
      const u1 = Math.max(1e-10, Math.random()), u2 = Math.random();
      const z = cf(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
      const drift = (mean / 30) * (1 + 0.002 * d);
      total += Math.max(0, drift + (std / 30) * z);
    }
    totals[p] = total + recurringTotal;
  }
  const sorted = Array.from(totals).sort((a, b) => a - b);
  const pIdx = pct => Math.min(Math.floor(paths * pct), paths - 1);
  const var95Idx = pIdx(0.95);
  const cvar95 = sorted.slice(var95Idx).reduce((a, b) => a + b, 0) / (paths - var95Idx);
  return {
    p5: +sorted[pIdx(0.05)].toFixed(2), p50: +sorted[pIdx(0.50)].toFixed(2), p95: +sorted[pIdx(0.95)].toFixed(2),
    var95: +sorted[var95Idx].toFixed(2), cvar95: +cvar95.toFixed(2),
    skewness: +skew.toFixed(4), kurtosis: +kurt.toFixed(4), paths,
  };
}

// ── Monte Carlo capitale (bootstrap empirico, logica della V50 spostata qui)
// con flusso centrale dell'ensemble e volatilità modulata dal GARCH ──
function monteCarloCapital({ ySavings, totalInvested, driftRate, stdDevExp, volatilityMultiplier, ensembleFlow, years, trials = 1000 }) {
  const steps = years * 12;
  const results = new Float64Array(trials);
  for (let t = 0; t < trials; t++) {
    let capital = totalInvested;
    for (let s = 0; s < steps; s++) {
      let baseFlow = ensembleFlow;
      if (ySavings.length > 0) {
        baseFlow = ySavings[Math.floor(Math.random() * ySavings.length)]; // bootstrap empirico
      }
      const randomNoise = (Math.random() + Math.random() + Math.random() - 1.5) * stdDevExp * volatilityMultiplier;
      capital = capital * (1 + driftRate / 12) + Math.max(0, baseFlow + randomNoise);
    }
    results[t] = capital;
  }
  const sorted = Array.from(results).sort((a, b) => a - b);
  const pIdx = pct => Math.min(Math.floor(trials * pct), trials - 1);
  return { p5: sorted[pIdx(0.05)] || 0, p50: sorted[pIdx(0.50)] || 0, p95: sorted[pIdx(0.95)] || 0 };
}

// ── Ensemble con backtesting walk-forward reale ──
// Pesa regressione lineare e AR(2) in base all'errore VERO commesso
// sugli ultimi 3 mesi (fit sul prefisso, predizione del mese successivo).
function linRegNext(series) {
  const n = series.length;
  if (n < 2) return series[0] ?? 0;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += series[i]; sxy += i * series[i]; sxx += i * i; }
  const denom = n * sxx - sx * sx;
  const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
  const intercept = (sy - slope * sx) / n;
  return intercept + slope * n;
}

function ensembleMonthlyFlow(ySavings) {
  const n = ySavings.length;
  const avg = n ? ySavings.reduce((a, b) => a + b, 0) / n : 0;
  const predictors = {
    linreg: s => linRegNext(s),
    ar2: s => forecastAR2(s, 1).forecasted[0],
  };
  // pochi dati: media semplice tra i due (o solo media storica)
  if (n < 6) {
    const flow = n >= 2 ? (predictors.linreg(ySavings) + avg) / 2 : avg;
    return { flow, weights: { linreg: 0.5, storico: 0.5 }, backtest: null };
  }
  // walk-forward sugli ultimi 3 mesi
  const errors = { linreg: 0, ar2: 0 };
  for (let k = 3; k >= 1; k--) {
    const trainSet = ySavings.slice(0, n - k);
    const actual = ySavings[n - k];
    for (const name of Object.keys(predictors)) {
      errors[name] += Math.abs(predictors[name](trainSet) - actual);
    }
  }
  const eps = 1e-6;
  const wRaw = { linreg: 1 / (errors.linreg + eps), ar2: 1 / (errors.ar2 + eps) };
  const wSum = wRaw.linreg + wRaw.ar2;
  const weights = { linreg: wRaw.linreg / wSum, ar2: wRaw.ar2 / wSum };
  const flow = weights.linreg * predictors.linreg(ySavings) + weights.ar2 * predictors.ar2(ySavings);
  return {
    flow,
    weights: { linreg: +weights.linreg.toFixed(3), ar2: +weights.ar2.toFixed(3) },
    backtest: { maeLinreg: +(errors.linreg / 3).toFixed(2), maeAr2: +(errors.ar2 / 3).toFixed(2) },
  };
}

export { HoltWinters, GARCH, fitAR2, forecastAR2, monteCarloExpenses, monteCarloCapital, ensembleMonthlyFlow, linRegNext };
