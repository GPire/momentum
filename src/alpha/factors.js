// ============================================================
// FATTORI ALPHA — le strategie dei grandi investitori, trasparenti e testate
// ============================================================
// Onestà tecnica (regola #1): value/growth/momentum/risk sono conoscenza
// PUBBLICA decennale — qui li codifichiamo come funzioni pure e misurabili,
// NON li "brevettiamo". La novità difendibile è la COMPOSIZIONE (arbitro a
// regime + grafo + cashflow), non la singola metrica. Nessuna soglia magica:
// le soglie sono DINAMICHE (percentile rispetto ai peer), come chiesto.
// Ogni score porta la spiegazione: mai un numero orfano.
// Funzioni pure (pattern engines.js): nessun DOM, nessun dato di mercato qui.
'use strict';

// Percentile di v nella distribuzione (0..1). higherIsBetter inverte.
export function percentileRank(v, dist, higherIsBetter = true) {
  const xs = (dist || []).filter(x => Number.isFinite(x));
  if (!xs.length || !Number.isFinite(v)) return 0.5; // neutro senza dati
  const below = xs.filter(x => x < v).length;
  const p = below / xs.length;
  return +(higherIsBetter ? p : 1 - p).toFixed(4);
}

const clamp01 = x => Math.max(0, Math.min(1, x));
const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);

// ── Value/Quality (Buffett + Graham): sottovalutato + solido ──
// metrics: { pe, pb, roe, debtEquity, fcfYield }. peers: stesse chiavi → array.
export function valueScore(m, peers = {}) {
  const parts = [
    { k: 'P/E basso', s: percentileRank(m.pe, peers.pe, false) },
    { k: 'P/B basso', s: percentileRank(m.pb, peers.pb, false) },
    { k: 'ROE alto', s: percentileRank(m.roe, peers.roe, true) },
    { k: 'Debito/Equity basso', s: percentileRank(m.debtEquity, peers.debtEquity, false) },
    { k: 'FCF yield alto', s: percentileRank(m.fcfYield, peers.fcfYield, true) },
  ];
  const score = clamp01(mean(parts.map(p => p.s)));
  return { score: +score.toFixed(4), factor: 'value', parts };
}

// ── Growth (Lynch): crescita a prezzo ragionevole ──
// metrics: { revCagr, epsCagr, peg, marginTrend }
export function growthScore(m, peers = {}) {
  const parts = [
    { k: 'CAGR ricavi', s: percentileRank(m.revCagr, peers.revCagr, true) },
    { k: 'CAGR utili', s: percentileRank(m.epsCagr, peers.epsCagr, true) },
    { k: 'PEG basso', s: percentileRank(m.peg, peers.peg, false) },
    { k: 'margine in espansione', s: clamp01((m.marginTrend ?? 0) > 0 ? 0.5 + Math.min(0.5, m.marginTrend) : 0.5 + Math.max(-0.5, m.marginTrend)) },
  ];
  const score = clamp01(mean(parts.map(p => p.s)));
  return { score: +score.toFixed(4), factor: 'growth', parts };
}

// ── Momentum/Trend (Simons-lite): forza recente del prezzo ──
// prices: serie storica (vecchio→nuovo). RSI + trend + posizione vs media.
export function momentumScore(prices) {
  const p = (prices || []).filter(Number.isFinite);
  if (p.length < 15) return { score: 0.5, factor: 'momentum', parts: [{ k: 'dati insufficienti', s: 0.5 }] };
  // RSI(14)
  let gain = 0, loss = 0;
  for (let i = p.length - 14; i < p.length; i++) {
    const d = p[i] - p[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  const rs = loss === 0 ? 100 : gain / loss;
  const rsi = 100 - 100 / (1 + rs);
  // trend: ritorno ultimi ~20 punti; posizione vs media mobile
  const look = Math.min(20, p.length - 1);
  const ret = (p[p.length - 1] - p[p.length - 1 - look]) / p[p.length - 1 - look];
  const sma = mean(p.slice(-look));
  const aboveSma = p[p.length - 1] > sma ? 1 : 0;
  const parts = [
    { k: 'RSI (non ipercomprato/venduto)', s: clamp01(1 - Math.abs(rsi - 55) / 55) },
    { k: 'trend positivo', s: clamp01(0.5 + ret) },
    { k: 'sopra media mobile', s: aboveSma },
  ];
  const score = clamp01(mean(parts.map(x => x.s)));
  return { score: +score.toFixed(4), factor: 'momentum', rsi: +rsi.toFixed(1), parts };
}

// ── Risk (Dalio + Bogle): meno rischio = score più alto ──
// returns: serie di rendimenti periodici. Volatilità + max drawdown + Sharpe.
export function riskScore(returns, opts = {}) {
  const r = (returns || []).filter(Number.isFinite);
  if (r.length < 5) return { score: 0.5, factor: 'risk', parts: [{ k: 'dati insufficienti', s: 0.5 }] };
  const mu = mean(r);
  const vol = Math.sqrt(mean(r.map(x => (x - mu) ** 2)));
  // max drawdown su curva cumulata
  let cum = 1, peak = 1, mdd = 0;
  for (const x of r) { cum *= 1 + x; peak = Math.max(peak, cum); mdd = Math.max(mdd, (peak - cum) / peak); }
  const sharpe = vol > 0 ? (mu - (opts.rf ?? 0)) / vol : 0;
  const parts = [
    { k: 'volatilità bassa', s: clamp01(1 - vol * 10) },
    { k: 'drawdown contenuto', s: clamp01(1 - mdd * 2) },
    { k: 'Sharpe positivo', s: clamp01(0.5 + sharpe / 2) },
  ];
  const score = clamp01(mean(parts.map(x => x.s)));
  return { score: +score.toFixed(4), factor: 'risk', vol: +vol.toFixed(4), maxDrawdown: +mdd.toFixed(4), sharpe: +sharpe.toFixed(3), parts };
}

// ── Reflexivity (Soros): i feedback loop prezzo↔percezione ──
// Onestà: non "prevede" la riflessività — la MISURA con proxy osservabili:
// (1) auto-correlazione dei rendimenti (i trend che si auto-alimentano = loop
// positivo, tipico delle bolle riflessive), (2) accelerazione (i rendimenti
// che crescono in modulo = il loop si sta rinforzando), (3) sganciamento dal
// trend di fondo (prezzo che corre lontano dalla media = eccesso riflessivo).
// Score alto = forte dinamica riflessiva IN CORSO (opportunità di trend, ma
// anche rischio di inversione: Soros cavalca il loop e ne esce prima del crollo).
// `prices`: serie storica (vecchio→nuovo).
export function reflexivityScore(prices) {
  const p = (prices || []).filter(Number.isFinite);
  if (p.length < 20) return { score: 0.5, factor: 'reflexivity', parts: [{ k: 'dati insufficienti', s: 0.5 }] };
  const rets = [];
  for (let i = 1; i < p.length; i++) rets.push((p[i] - p[i - 1]) / p[i - 1]);

  // (1) auto-correlazione lag-1 dei rendimenti (loop che si auto-alimenta)
  const mr = mean(rets);
  let num = 0, den = 0;
  for (let i = 1; i < rets.length; i++) { num += (rets[i] - mr) * (rets[i - 1] - mr); }
  for (const x of rets) den += (x - mr) ** 2;
  const acf1 = den > 0 ? num / den : 0;

  // (2) accelerazione: |rendimenti| recenti vs storici (il loop si rinforza?)
  const half = Math.floor(rets.length / 2);
  const magOld = mean(rets.slice(0, half).map(Math.abs));
  const magNew = mean(rets.slice(half).map(Math.abs));
  const accel = magOld > 0 ? (magNew - magOld) / magOld : 0;

  // (3) sganciamento dalla media mobile (eccesso riflessivo)
  const look = Math.min(20, p.length - 1);
  const sma = mean(p.slice(-look));
  const gap = sma > 0 ? Math.abs(p[p.length - 1] - sma) / sma : 0;

  const parts = [
    { k: 'trend auto-alimentato (autocorrelazione)', s: clamp01(0.5 + acf1) },
    { k: 'loop in rafforzamento (accelerazione)', s: clamp01(0.5 + accel) },
    { k: 'sganciamento dalla media (eccesso)', s: clamp01(gap * 3) },
  ];
  const score = clamp01(mean(parts.map(x => x.s)));
  return { score: +score.toFixed(4), factor: 'reflexivity', acf1: +acf1.toFixed(3), accel: +accel.toFixed(3), gap: +gap.toFixed(3), parts,
    note: score > 0.66 ? 'Forte dinamica riflessiva: il trend si auto-alimenta (opportunità, ma occhio all\'inversione).' : 'Dinamica riflessiva debole.' };
}
