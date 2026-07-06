// ============================================================
// FORECAST WORKER — tutto il calcolo pesante fuori dal main thread.
// Riceve serie numeriche pure (niente DOM, niente stato condiviso),
// restituisce l'intero pacchetto predittivo. Il chiamante ha sempre
// un fallback sincrono se i Worker non sono disponibili.
// ============================================================
import { HoltWinters, GARCH, forecastAR2, monteCarloExpenses, monteCarloCapital, ensembleMonthlyFlow } from './engines.js';

function runForecast(input) {
  const {
    ySavings = [], dailyExpenses = [], txExpenseAmounts = [],
    totalInvested = 0, driftRate = 0.05, stdDevExp = 150,
    volatilityMultiplier = 1.0, recurringTotal = 0,
    paths = 5000, capitalTrials = 1000, years = [1, 5, 10, 20],
  } = input;

  const t0 = Date.now();

  // 1. Ensemble del flusso mensile (linreg + AR(2), pesati per backtest reale)
  const ensemble = ensembleMonthlyFlow(ySavings);

  // 2. Stagionalità settimanale delle spese giornaliere (Holt-Winters)
  const hw = new HoltWinters().forecast(dailyExpenses, 30);

  // 3. Volatilità condizionale GARCH sui delta dei risparmi mensili,
  //    normalizzati sulla media per avere "rendimenti" adimensionali
  let garchVolRatio = 1.0;
  if (ySavings.length >= 6) {
    const meanAbs = ySavings.reduce((a, b) => a + Math.abs(b), 0) / ySavings.length || 1;
    const returns = [];
    for (let i = 1; i < ySavings.length; i++) returns.push((ySavings[i] - ySavings[i - 1]) / meanAbs);
    const g = new GARCH().fit(returns);
    const uncondStd = Math.sqrt(returns.reduce((a, b) => a + b * b, 0) / returns.length) || 1;
    const nextVol = g.nextVol(1)[0];
    // rapporto vol condizionale / incondizionale: >1 = periodo turbolento
    garchVolRatio = Math.min(2.0, Math.max(0.5, nextVol / uncondStd));
  }

  // 4. Monte Carlo spese prossimo mese (Cornish-Fisher, code grasse reali)
  const mcExpenses = monteCarloExpenses(txExpenseAmounts, recurringTotal, 30, paths);

  // 5. Monte Carlo capitale per ogni orizzonte, con volatilità GARCH-modulata
  const sims = {};
  for (const y of years) {
    sims[`y${y}`] = monteCarloCapital({
      ySavings, totalInvested, driftRate, stdDevExp,
      volatilityMultiplier: volatilityMultiplier * garchVolRatio,
      ensembleFlow: ensemble.flow, years: y, trials: capitalTrials,
    });
  }

  return {
    ensemble, hw: { level: hw.level, trend: hw.trend, next7: hw.forecasted.slice(0, 7) },
    garchVolRatio: +garchVolRatio.toFixed(3),
    mcExpenses, sims,
    meta: { paths, capitalTrials, tookMs: Date.now() - t0 },
  };
}

self.onmessage = (e) => {
  try {
    self.postMessage({ ok: true, result: runForecast(e.data) });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
