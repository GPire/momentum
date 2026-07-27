// GENERATO da bench/generate-measured-assumptions.mjs — NON modificare a mano.
// Rilancia lo script quando la cache di bench/data/*.json si aggiorna.
'use strict';

export default {
  "generatedAt": "2026-07-27T00:06:55.530Z",
  "method": "walkForwardMomentumBacktest (src/alpha/historical-backtest.js) su prezzi mensili reali, mai look-ahead",
  "disclaimer": "Misura storica walk-forward, non una promessa di rendimento futuro. Ricalcolare periodicamente rilanciando bench/generate-measured-assumptions.mjs.",
  "spy": {
    "label": "SPY (ETF reale, S&P 500)",
    "source": "Yahoo Finance (query1.finance.yahoo.com, range=max, interval=1mo)",
    "fetchedAt": "2026-07-20T15:48:51.712Z",
    "sampleMonths": 387,
    "monthsInMarketPct": 81.4,
    "buyHold": {
      "mu": 0.0903,
      "sigma": 0.15,
      "sharpe": 0.655,
      "maxDrawdown": 0.522
    },
    "momentumTiming": {
      "mu": 0.0891,
      "sigma": 0.1192,
      "sharpe": 0.779,
      "maxDrawdown": 0.2381
    },
    "regime": {
      "regime": "risk-on",
      "trend": 0.01275,
      "vol": 0.03675,
      "volRatio": 0.86,
      "explanation": "Trend 1.27%/periodo, volatilità 0.86× la norma → risk-on."
    }
  },
  "btc": {
    "label": "Bitcoin",
    "source": "Yahoo Finance (query1.finance.yahoo.com, range=max, interval=1mo)",
    "fetchedAt": "2026-07-20T15:48:51.832Z",
    "sampleMonths": 127,
    "monthsInMarketPct": 82.7,
    "buyHold": {
      "mu": 0.6308,
      "sigma": 0.723,
      "sharpe": 1.02,
      "maxDrawdown": 0.7557
    },
    "momentumTiming": {
      "mu": 0.4489,
      "sigma": 0.6707,
      "sharpe": 0.868,
      "maxDrawdown": 0.7955
    },
    "regime": {
      "regime": "risk-off",
      "trend": -0.01208,
      "vol": 0.10445,
      "volRatio": 0.509,
      "explanation": "Trend -1.21%/periodo, volatilità 0.51× la norma → risk-off."
    }
  }
};
