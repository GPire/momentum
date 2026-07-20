// ============================================================
// NET WORTH — patrimonio netto unificato + proiezione Monte Carlo per strategia
// ============================================================
// Aggrega in UN numero le fonti oggi sparse: liquidità (dai movimenti del
// vault), investimenti (posizioni × prezzo), crypto/ETF/azioni per classe, più
// asset dichiarati dall'utente (immobili, contante fuori conto). Poi proietta
// il patrimonio a N anni con una simulazione Monte Carlo PER STRATEGIA.
//
// ONESTÀ (regola #1):
//  - Le "strategie" reali nel codice sono 5 FATTORI (value/growth/momentum/
//    risk/reflexivity), non 8: non gonfio il numero.
//  - μ (rendimento atteso annuo) e σ (volatilità annua) per strategia sono
//    IPOTESI DICHIARATE, ispirate alla letteratura storica sui fattori, NON
//    promesse né serie inventate. Ogni proiezione riporta il disclaimer.
//  - Modulo puro: nessun DOM/vault/rete. Le posizioni e i prezzi si iniettano
//    (come portfolio-import.js / market-data.js), così è testabile e onesto.
'use strict';

// Ipotesi di rendimento/volatilità annua per strategia (nominali, EUR, lungo
// periodo). DICHIARATE come assunzioni ragionevoli da letteratura sui fattori
// (Fama-French, factor investing) — NON garanzie. L'utente può sovrascriverle.
export const STRATEGY_ASSUMPTIONS = {
  risparmio:   { mu: 0.015, sigma: 0.01, label: 'Liquidità / conto deposito' },
  indice:      { mu: 0.07,  sigma: 0.15, label: 'Indice ampio (mercato)' },
  value:       { mu: 0.08,  sigma: 0.16, label: 'Value (Buffett/Graham)' },
  growth:      { mu: 0.09,  sigma: 0.20, label: 'Growth (Lynch)' },
  momentum:    { mu: 0.09,  sigma: 0.18, label: 'Momentum (Simons/trend)' },
  risk:        { mu: 0.07,  sigma: 0.12, label: 'Low-volatility / quality (Dalio)' },
  reflexivity: { mu: 0.08,  sigma: 0.22, label: 'Riflessività/tattica (Soros)' },
};

export const NET_WORTH_DISCLAIMER =
  'Proiezione probabilistica su ipotesi dichiarate (rendimento/volatilità storici tipici, non garantiti). ' +
  'Non è consulenza finanziaria né promessa di rendimento.';

// Liquidità cumulata da TUTTI i movimenti del vault. `transactions` è la mappa
// { "YYYY-MM": [ {type,amount} ] } di VaultDAO.state.transactions.
// entrata = +, uscita = −, invest = esce dalla liquidità ma diventa "invested"
// (lo contiamo separatamente, non lo perdiamo). Ritorna il contante netto.
export function cashFromTransactions(transactions = {}) {
  let cash = 0, investedFromFlow = 0;
  for (const month of Object.keys(transactions)) {
    for (const t of transactions[month] || []) {
      const a = Number(t.amount) || 0;
      if (t.type === 'entrata') cash += a;
      else if (t.type === 'uscita') cash -= a;
      else { cash -= a; investedFromFlow += a; } // invest: esce dal contante
    }
  }
  return { cash, investedFromFlow };
}

// Valorizza le posizioni con l'ultimo prezzo disponibile. `positions` =
// [{ ticker, assetClass, quantity, avgPrice }] (da portfolio-import.js).
// `pricesByTicker` = { TICKER: [{date,close}] } (da market-data.js) OPPURE
// `currentPriceByTicker` = { TICKER: number }. Se un prezzo manca si usa
// avgPrice (costo) e si segna `stale:true` per quella riga (onestà: non
// inventiamo un prezzo di mercato che non abbiamo).
export function valuePositions(positions = [], { pricesByTicker = {}, currentPriceByTicker = {} } = {}) {
  const byClass = {};
  let total = 0, anyStale = false;
  const rows = positions.map(p => {
    const series = pricesByTicker[p.ticker];
    let price = currentPriceByTicker[p.ticker];
    let priced = price != null;
    if (!priced && Array.isArray(series) && series.length) { price = series[series.length - 1].close; priced = true; }
    let stale = false;
    if (!priced) { price = p.avgPrice; stale = true; anyStale = true; } // fallback costo, etichettato
    const value = (Number(p.quantity) || 0) * (Number(price) || 0);
    total += value;
    const cls = p.assetClass || 'altro';
    byClass[cls] = (byClass[cls] || 0) + value;
    return { ...p, price, value, priced: !stale, stale };
  });
  return { rows, total, byClass, stale: anyStale };
}

// Patrimonio netto unificato. `manualAssets` = [{ name, value }] per immobili/
// contante fuori conto dichiarati dall'utente (valore dichiarato, etichettato).
// Ritorna cifre reali (nessuna stima nascosta) + flag `stale` se qualche prezzo
// mancava. `liabilities` opzionale (debiti) si sottrae.
export function computeNetWorth({ transactions = {}, positions = [], pricesByTicker = {}, currentPriceByTicker = {}, manualAssets = [], liabilities = 0, asOf = new Date() } = {}) {
  const { cash } = cashFromTransactions(transactions);
  const pos = valuePositions(positions, { pricesByTicker, currentPriceByTicker });
  const manualTotal = manualAssets.reduce((s, a) => s + (Number(a.value) || 0), 0);
  const debt = Number(liabilities) || 0;
  const invested = pos.total;
  const total = cash + invested + manualTotal - debt;
  return {
    cash,
    invested,
    byClass: pos.byClass,
    positions: pos.rows,
    manualAssets: manualAssets.map(a => ({ name: a.name, value: Number(a.value) || 0, declared: true })),
    liabilities: debt,
    total,
    stale: pos.stale,
    asOf: (asOf instanceof Date ? asOf : new Date(asOf)).toISOString(),
    disclaimer: NET_WORTH_DISCLAIMER,
  };
}

// --- Monte Carlo per strategia -------------------------------------------
// GBM mensile (Geometric Brownian Motion) del patrimonio: parte da `start`
// (patrimonio investibile), aggiunge `monthlyContribution` ogni mese, cresce
// con μ/σ della strategia. Normali via Box-Muller (deterministiche col seed →
// numeri riproducibili, come richiede la regola di onestà sui bench).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Proietta UNA strategia. Ritorna percentili p5/p50/p95 del patrimonio finale
// + traiettoria mediana annuale. Onesto: distribuzione su ipotesi dichiarate.
export function projectStrategy({ start = 0, monthlyContribution = 0, years = 10, mu, sigma, paths = 2000, seed = 12345 }) {
  const steps = Math.max(1, Math.round(years * 12));
  const mMonthly = mu / 12;
  const sMonthly = sigma / Math.sqrt(12);
  const rng = mulberry32(seed);
  const finals = new Float64Array(paths);
  // Per la traiettoria mediana registriamo il valore a fine di ogni anno.
  const yearMarks = [];
  for (let y = 1; y <= years; y++) yearMarks.push(y * 12);
  const yearlyAll = yearMarks.map(() => new Float64Array(paths));
  for (let p = 0; p < paths; p++) {
    let capital = start;
    let ym = 0;
    for (let s = 1; s <= steps; s++) {
      capital += monthlyContribution;
      // rendimento mensile log-normale: exp((m - s²/2) + s·Z)
      const z = normal(rng);
      capital *= Math.exp((mMonthly - 0.5 * sMonthly * sMonthly) + sMonthly * z);
      if (capital < 0) capital = 0;
      if (ym < yearMarks.length && s === yearMarks[ym]) { yearlyAll[ym][p] = capital; ym++; }
    }
    finals[p] = capital;
  }
  const pct = (arr, q) => { const a = Float64Array.from(arr).sort(); return a[Math.min(a.length - 1, Math.floor(a.length * q))]; };
  const medianTrajectory = yearlyAll.map((a, i) => ({ year: i + 1, p50: pct(a, 0.5) }));
  return {
    p5: pct(finals, 0.05),
    p50: pct(finals, 0.50),
    p95: pct(finals, 0.95),
    invested: start + monthlyContribution * steps, // capitale versato (senza rendimento)
    years, mu, sigma, paths,
    medianTrajectory,
  };
}

// Confronta TUTTE le strategie a parità di capitale/contributo/orizzonte.
// Ritorna una riga per strategia, ordinata per mediana decrescente, + il
// capitale versato totale, così l'utente vede rischio (p5) vs potenziale (p95).
export function projectNetWorthByStrategy({ start = 0, monthlyContribution = 0, years = 10, strategies = null, assumptions = STRATEGY_ASSUMPTIONS, paths = 2000, seed = 12345 } = {}) {
  const keys = strategies || Object.keys(assumptions);
  const rows = keys.map((k, i) => {
    const a = assumptions[k];
    if (!a) return null;
    const r = projectStrategy({ start, monthlyContribution, years, mu: a.mu, sigma: a.sigma, paths, seed: seed + i });
    return { strategy: k, label: a.label, mu: a.mu, sigma: a.sigma, ...r };
  }).filter(Boolean);
  rows.sort((x, y) => y.p50 - x.p50);
  const contributed = start + monthlyContribution * Math.round(years * 12);
  return { rows, contributed, years, disclaimer: NET_WORTH_DISCLAIMER };
}
