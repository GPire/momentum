// ============================================================
// IMPORT & ANALISI DEL PORTAFOGLIO REALE — consigli stile Buffett/Dalio
// ============================================================
// Il pezzo che porta l'intero layer alpha sui dati VERI dell'utente: importa
// le posizioni (stock/etf/crypto/bond), calcola valore/P&L/allocazione/rischio,
// applica le strategie dei grandi (Value/Growth/Momentum/Risk + arbitro Munger
// a regime), e propone un rebalancing. Onestà (regola #1): NON è consulenza
// finanziaria — sono proprietà calcolate sui numeri forniti + strategie
// pubbliche decennali, ognuna tracciabile. Nessuna promessa di rendimento.
// Funzioni pure; i prezzi/ritorni arrivano dal chiamante (market-data.js).
'use strict';

import { riskParityWeights, portfolioReturns, portfolioStats, covarianceMatrix } from './portfolio.js';
import { riskScore, momentumScore } from './factors.js';
import { detectRegime } from './regime.js';
import { arbitrate } from './arbiter.js';

// ── Import posizioni da CSV. Colonne riconosciute (IT/EN, ordine libero):
// ticker/simbolo, classe/asset/tipo, quantità/quantity, prezzomedio/avgprice/pmc.
export function parsePortfolioCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const delim = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const H = lines[0].split(delim).map(s => s.trim().toLowerCase());
  const col = (...names) => H.findIndex(h => names.some(n => h.includes(n)));
  const ti = col('ticker', 'simbolo', 'symbol', 'nome');
  const ci = col('class', 'classe', 'asset', 'tipo', 'kind');
  const qi = col('quant', 'quantity', 'shares', 'azioni', 'numero');
  const pi = col('prezzomedio', 'avgprice', 'avg', 'pmc', 'carico', 'costo');
  if (ti < 0 || qi < 0) return [];
  const num = s => parseFloat(String(s || '').replace(/[^\d.,-]/g, '').replace(',', '.'));
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(delim);
    const ticker = (c[ti] || '').trim();
    if (!ticker) continue;
    const rawClass = ci >= 0 ? (c[ci] || '').trim().toLowerCase() : '';
    const assetClass = /crypto|btc|eth/.test(rawClass) ? 'crypto' : /etf|fund|fondo/.test(rawClass) ? 'etf' : /bond|obblig/.test(rawClass) ? 'bond' : 'stock';
    out.push({ ticker, assetClass, quantity: num(c[qi]) || 0, avgPrice: pi >= 0 ? (num(c[pi]) || 0) : 0 });
  }
  return out;
}

// ── Analisi completa. `positions` = da parsePortfolioCsv/manuale;
// `pricesByTicker` = { TICKER: [{date,close}…] } da market-data.js (opz.);
// `currentPriceByTicker` opzionale se non c'è la serie completa.
export function analyzePortfolio(positions, { pricesByTicker = {}, currentPriceByTicker = {}, referenceDate = new Date() } = {}) {
  const rows = positions.map(p => {
    const series = pricesByTicker[p.ticker];
    const price = currentPriceByTicker[p.ticker] ?? (series?.length ? series[series.length - 1].close : p.avgPrice);
    const value = +(price * p.quantity).toFixed(2);
    const cost = +(p.avgPrice * p.quantity).toFixed(2);
    const pl = +(value - cost).toFixed(2);
    const plPct = cost > 0 ? +((pl / cost) * 100).toFixed(1) : 0;
    return { ...p, price, value, cost, pl, plPct, series };
  });

  const totalValue = +rows.reduce((s, r) => s + r.value, 0).toFixed(2);
  const totalCost = +rows.reduce((s, r) => s + r.cost, 0).toFixed(2);
  const totalPl = +(totalValue - totalCost).toFixed(2);

  // Allocazione per classe + per posizione
  const byClass = {};
  for (const r of rows) byClass[r.assetClass] = +(((byClass[r.assetClass] || 0) + r.value)).toFixed(2);
  const allocation = Object.fromEntries(Object.entries(byClass).map(([k, v]) => [k, +(v / (totalValue || 1)).toFixed(4)]));
  for (const r of rows) r.weight = +(r.value / (totalValue || 1)).toFixed(4);

  // Concentrazione (Graham margin of safety): la posizione più grande
  const topWeight = rows.reduce((m, r) => Math.max(m, r.weight), 0);

  // Rischio/rendimento del portafoglio (se abbiamo serie di prezzi allineabili)
  const returnsByAsset = {};
  for (const r of rows) if (r.series?.length > 5) returnsByAsset[r.ticker] = seriesReturns(r.series);
  let stats = null, rebalance = null;
  if (Object.keys(returnsByAsset).length >= 2) {
    const currentWeights = Object.fromEntries(rows.filter(r => returnsByAsset[r.ticker]).map(r => [r.ticker, r.weight]));
    stats = portfolioStats(portfolioReturns(currentWeights, returnsByAsset));
    const target = riskParityWeights(returnsByAsset);
    rebalance = Object.keys(target).map(t => ({ ticker: t, current: +(currentWeights[t] || 0).toFixed(3), target: target[t], delta: +(target[t] - (currentWeights[t] || 0)).toFixed(3) }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }

  // Regime di mercato dall'asset più liquido con più storia (proxy)
  const proxy = rows.filter(r => r.series?.length > 25).sort((a, b) => b.series.length - a.series.length)[0];
  const regime = proxy ? detectRegime(proxy.series.map(x => x.close)) : { regime: 'neutral', explanation: 'Dati di prezzo insufficienti per il regime.' };

  // Consigli tracciabili alle strategie
  const advice = [];
  if (topWeight > 0.35) advice.push({ rule: 'Graham — margine di sicurezza', text: `Concentrazione alta: una posizione è il ${Math.round(topWeight * 100)}% del portafoglio. Valuta di diversificare per ridurre il rischio idiosincratico.` });
  if ((allocation.crypto || 0) > 0.3) advice.push({ rule: 'Dalio — bilanciamento del rischio', text: `Crypto al ${Math.round((allocation.crypto) * 100)}%: classe ad alta volatilità. Un peso così alto aumenta il rischio di coda.` });
  if (stats && stats.sharpe < 0.3) advice.push({ rule: 'Bogle/Dalio — rischio/rendimento', text: `Sharpe storico basso (${stats.sharpe}): il portafoglio rende poco per il rischio che corre. Il risk-parity qui sotto tende a migliorarlo.` });
  if (rebalance && rebalance[0] && Math.abs(rebalance[0].delta) > 0.1) advice.push({ rule: 'Dalio — risk parity', text: `Ribilanciamento suggerito: porta ${rebalance[0].ticker} dal ${Math.round(rebalance[0].current * 100)}% verso il ${Math.round(rebalance[0].target * 100)}% (contributo di rischio più equo).` });
  if (!advice.length) advice.push({ rule: 'ok', text: 'Allocazione ragionevole sui dati disponibili. Continua a monitorare diversificazione e rischio.' });

  return {
    rows, totalValue, totalCost, totalPl,
    plPct: totalCost > 0 ? +((totalPl / totalCost) * 100).toFixed(1) : 0,
    allocation, topWeight: +topWeight.toFixed(3),
    stats, rebalance, regime: regime.regime, regimeNote: regime.explanation,
    advice,
    disclaimer: 'Non è consulenza finanziaria: sono proprietà calcolate sui dati forniti e strategie pubbliche. Le performance passate non garantiscono quelle future.',
  };
}

function seriesReturns(series) {
  const p = series.map(x => x.close);
  const r = [];
  for (let i = 1; i < p.length; i++) r.push((p[i] - p[i - 1]) / p[i - 1]);
  return r;
}
