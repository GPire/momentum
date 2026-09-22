// ============================================================
// COSTRUZIONE PORTAFOGLIO — risk-parity + statistiche di rischio
// ============================================================
// Onestà tecnica (regola #1): risk-parity qui è EQUAL RISK CONTRIBUTION
// esatto sulla covarianza reale (2026-09-23, upgrade da inverse-volatility —
// vedi equalRiskContributionWeights), lo stesso principio dei fondi
// risk-parity istituzionali (es. Bridgewater All Weather): ogni asset
// contribuisce alla STESSA quota di rischio totale, non solo pesato per la
// propria volatilità isolata. Nessuna libreria di ottimizzazione esterna:
// discesa a coordinate cicliche su una riformulazione convessa nota
// (Spinu 2013 / Roncalli), formula chiusa per coordinata, sempre
// convergente per una covarianza reale. Covarianza reale, metriche misurate
// (Sharpe, max drawdown). Nessuna promessa di rendimento futuro: sono
// proprietà storiche/simulate della serie. Funzioni pure (pattern
// engines.js).
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

// Pesi inverse-volatility (fallback esplicito, MAI il caso normale): ignora
// la correlazione fra asset, quindi due asset che salgono e scendono sempre
// insieme vengono trattati come indipendenti. Usato solo quando la
// covarianza non permette il calcolo esatto sotto (n=1, o dati degeneri).
function inverseVolWeights(returnsByAsset) {
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

// EQUAL RISK CONTRIBUTION esatto (non l'approssimazione inverse-vol): pesi
// tali per cui ogni asset contribuisce alla STESSA quota di rischio TOTALE
// del portafoglio (varianza), usando la covarianza intera — non solo la
// volatilità di ciascuno, anche come si muovono INSIEME. Due asset con la
// stessa volatilità ma correlati al 90% ricevono pesi diversi da due
// altrettanto volatili ma scorrelati: il secondo caso diversifica per
// davvero, il primo no, ed è esattamente quello che l'inverse-vol non vede.
//
// Metodo: discesa a coordinate cicliche sulla riformulazione convessa di
// Spinu (2013) — risolve min 0.5*y'Σy - Σ b_i*ln(y_i) aggiornando UNA
// coordinata alla volta con la radice positiva di un'equazione quadratica
// (Roncalli, "Introduction to Risk Parity and Budgeting", cap. 2). Nessuna
// libreria di ottimizzazione: la formula chiusa per coordinata la rende
// implementabile a mano, sempre convergente per una covarianza reale
// (semidefinita positiva), mai un numero immaginario per costruzione
// (discriminante sempre >= 0 perché varianza e budget sono sempre >= 0).
// budget: quota di rischio desiderata per asset (default 1/N = parità
// vera); un budget diverso da 1/N sarebbe "risk budgeting", non parità.
export function equalRiskContributionWeights(cov, { budget = null, maxIter = 200, tol = 1e-10 } = {}) {
  const tickers = Object.keys(cov);
  const n = tickers.length;
  if (n === 0) return {};
  if (n === 1) return { [tickers[0]]: 1 };
  const b = budget || Object.fromEntries(tickers.map(t => [t, 1 / n]));
  // Partenza da inverse-vol sulla sola diagonale: un punto di partenza
  // ragionevole, mai il risultato finale (l'iterazione sotto lo corregge
  // per la correlazione).
  let y = {};
  for (const t of tickers) { const v = Math.sqrt(Math.max(cov[t][t], 1e-12)); y[t] = 1 / v; }
  for (let iter = 0; iter < maxIter; iter++) {
    let maxRelChange = 0;
    for (const i of tickers) {
      const sigmaII = Math.max(cov[i][i], 1e-12);
      let c = 0;
      for (const j of tickers) { if (j !== i) c += y[j] * (cov[i][j] ?? cov[j][i] ?? 0); }
      const bi = b[i] ?? 1 / n;
      const discriminant = Math.max(c * c + 4 * sigmaII * bi, 0);
      const yNew = (-c + Math.sqrt(discriminant)) / (2 * sigmaII);
      const rel = y[i] > 0 ? Math.abs(yNew - y[i]) / y[i] : Math.abs(yNew);
      maxRelChange = Math.max(maxRelChange, rel);
      y[i] = yNew > 0 ? yNew : y[i]; // una radice non positiva (dato degenere) non aggiorna: meglio fermo che sbagliato
    }
    if (maxRelChange < tol) break;
  }
  const total = tickers.reduce((s, t) => s + y[t], 0);
  const w = {};
  for (const t of tickers) w[t] = total > 0 ? +(y[t] / total).toFixed(6) : +(1 / n).toFixed(6);
  return w;
}

// Contributo di rischio REALE di ciascun asset ai pesi dati (frazione della
// varianza totale del portafoglio) — per verificare/mostrare quanto la
// parità è stata raggiunta davvero, mai fidarsi ciecamente dell'output
// dell'ottimizzatore sopra senza poterlo controllare.
export function riskContributions(weights, cov) {
  const tickers = Object.keys(weights);
  const portfolioVar = tickers.reduce((s, i) => s + tickers.reduce((s2, j) => s2 + weights[i] * weights[j] * (cov[i]?.[j] ?? cov[j]?.[i] ?? 0), 0), 0);
  const rc = {};
  for (const i of tickers) {
    const marginal = tickers.reduce((s, j) => s + weights[j] * (cov[i]?.[j] ?? cov[j]?.[i] ?? 0), 0);
    rc[i] = portfolioVar > 0 ? +((weights[i] * marginal) / portfolioVar).toFixed(6) : +(1 / tickers.length).toFixed(6);
  }
  return rc;
}

// Pesi a parità di rischio, normalizzati a somma 1. Equal risk contribution
// ESATTO sulla covarianza reale (vedi equalRiskContributionWeights) — non
// più solo inverse-volatility, che resta il ripiego esplicito per i casi
// degeneri (un solo asset, o covarianza non calcolabile).
export function riskParityWeights(returnsByAsset) {
  const tickers = Object.keys(returnsByAsset);
  if (tickers.length <= 1) return inverseVolWeights(returnsByAsset);
  try {
    const cov = covarianceMatrix(returnsByAsset);
    // Covarianza degenere (es. una serie costante, varianza 0): l'ERC non è
    // definito, il ripiego inverse-vol resta l'unica risposta onesta.
    if (tickers.some(t => !(cov[t][t] > 0))) return inverseVolWeights(returnsByAsset);
    return equalRiskContributionWeights(cov);
  } catch (_) {
    return inverseVolWeights(returnsByAsset);
  }
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
