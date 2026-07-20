// ============================================================
// HISTORICAL BACKTEST — Wave 10+ v10: strategie su dati REALI di mercato
// ============================================================
// Riusa motori GIÀ reali e testati (factors.js momentumScore, portfolio.js
// portfolioStats) su serie prezzo REALI (S&P 500/ETF/Bitcoin — vedi
// bench/fetch-market-history.mjs per il download+cache onesto, MAI dati
// sintetici spacciati per storia di mercato). Funzioni pure, nessuna rete
// qui dentro: i prezzi arrivano dal chiamante già scaricati.
'use strict';

import { momentumScore } from './factors.js';
import { portfolioStats } from './portfolio.js';

export function computeReturns(closes = []) {
  const out = [];
  for (let i = 1; i < closes.length; i++) {
    if (Number.isFinite(closes[i]) && Number.isFinite(closes[i - 1]) && closes[i - 1] !== 0) {
      out.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }
  return out;
}

// Buy&hold vs momentum-timing, walk-forward reale: `lookback` osservazioni
// iniziali servono SOLO a inizializzare momentumScore (mai look-ahead — ogni
// decisione al tempo i usa solo prezzi fino a i, mai oltre). Score>0.5 =
// dentro il mercato quel mese, altrimenti cash (rendimento 0, non negativo:
// onesto, non stiamo simulando uno short). periodsPerYear=12 per mensili.
export function walkForwardMomentumBacktest(closes = [], { lookback = 15, periodsPerYear = 12 } = {}) {
  if (closes.length < lookback + 10) return null; // troppo pochi dati per un confronto onesto
  const buyHoldReturns = [];
  const timingReturns = [];
  let monthsInMarket = 0;
  for (let i = lookback; i < closes.length - 1; i++) {
    const windowPrices = closes.slice(0, i + 1); // solo dati FINO A i
    const { score } = momentumScore(windowPrices);
    const nextReturn = (closes[i + 1] - closes[i]) / closes[i];
    buyHoldReturns.push(nextReturn);
    const inMarket = score > 0.5;
    if (inMarket) monthsInMarket++;
    timingReturns.push(inMarket ? nextReturn : 0);
  }
  return {
    buyHold: portfolioStats(buyHoldReturns, { periodsPerYear }),
    momentumTiming: portfolioStats(timingReturns, { periodsPerYear }),
    n: buyHoldReturns.length,
    monthsInMarketPct: +(100 * monthsInMarket / buyHoldReturns.length).toFixed(1),
  };
}

// Sanity-check onesto: verifica che la serie catturi drawdown noti (2000
// dot-com, 2008 crisi, 2020 covid, 2022 bear) — prova concreta che i dati
// sono genuini e non un numero di comodo, non un requisito per l'utente.
// Raggruppa per EPISODIO CONTINUO di drawdown (non per anno solare): un
// crollo reale può attraversare un cambio d'anno (es. crisi 2008→2009) senza
// diventare due voci separate — l'episodio finisce solo quando il prezzo
// recupera un nuovo massimo.
export function detectKnownCrashes(dates = [], closes = [], { minDrawdownPct = 15 } = {}) {
  const crashes = [];
  let peak = closes[0], peakIdx = 0;
  let inCrash = false;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] >= peak) { peak = closes[i]; peakIdx = i; inCrash = false; continue; }
    const dd = (peak - closes[i]) / peak * 100;
    if (dd >= minDrawdownPct) {
      if (!inCrash) {
        crashes.push({ year: String(dates[i]).slice(0, 4), fromDate: dates[peakIdx], toDate: dates[i], drawdownPct: +dd.toFixed(1) });
        inCrash = true;
      } else {
        const last = crashes[crashes.length - 1];
        if (dd > last.drawdownPct) { last.drawdownPct = +dd.toFixed(1); last.toDate = dates[i]; }
      }
    }
  }
  return crashes;
}
