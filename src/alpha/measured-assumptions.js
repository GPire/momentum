// GENERATO da bench/generate-measured-assumptions.mjs — NON modificare a mano.
// Rilancia lo script quando la cache di bench/data/*.json si aggiorna.
'use strict';

export default {
  "generatedAt": "2026-07-27T01:22:34.823Z",
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
  },
  "sectors": {
    "XLB": {
      "label": "Materials Select Sector (XLB)",
      "source": "Yahoo Finance (query1.finance.yahoo.com, range=max, interval=1mo)",
      "fetchedAt": "2026-07-27T01:22:19.731Z",
      "sampleMonths": 316,
      "monthsInMarketPct": 72.5,
      "buyHold": {
        "mu": 0.0597,
        "sigma": 0.2004,
        "sharpe": 0.391,
        "maxDrawdown": 0.5648
      },
      "momentumTiming": {
        "mu": 0.008,
        "sigma": 0.1413,
        "sharpe": 0.128,
        "maxDrawdown": 0.395
      },
      "regime": {
        "regime": "risk-on",
        "trend": 0.01069,
        "vol": 0.03923,
        "volRatio": 0.656,
        "explanation": "Trend 1.07%/periodo, volatilità 0.66× la norma → risk-on."
      }
    },
    "XLE": {
      "label": "Energy Select Sector (XLE)",
      "source": "Yahoo Finance (query1.finance.yahoo.com, range=max, interval=1mo)",
      "fetchedAt": "2026-07-27T01:22:18.694Z",
      "sampleMonths": 316,
      "monthsInMarketPct": 65.5,
      "buyHold": {
        "mu": 0.0553,
        "sigma": 0.2521,
        "sharpe": 0.341,
        "maxDrawdown": 0.7131
      },
      "momentumTiming": {
        "mu": 0.0607,
        "sigma": 0.1864,
        "sharpe": 0.409,
        "maxDrawdown": 0.4245
      },
      "regime": {
        "regime": "risk-on",
        "trend": 0.01868,
        "vol": 0.06341,
        "volRatio": 0.877,
        "explanation": "Trend 1.87%/periodo, volatilità 0.88× la norma → risk-on."
      }
    },
    "XLF": {
      "label": "Financial Select Sector (XLF)",
      "source": "Yahoo Finance (query1.finance.yahoo.com, range=max, interval=1mo)",
      "fetchedAt": "2026-07-27T01:22:18.555Z",
      "sampleMonths": 316,
      "monthsInMarketPct": 69.6,
      "buyHold": {
        "mu": 0.0403,
        "sigma": 0.2064,
        "sharpe": 0.298,
        "maxDrawdown": 0.7995
      },
      "momentumTiming": {
        "mu": 0.0387,
        "sigma": 0.126,
        "sharpe": 0.365,
        "maxDrawdown": 0.3113
      },
      "regime": {
        "regime": "risk-on",
        "trend": 0.00822,
        "vol": 0.03324,
        "volRatio": 0.549,
        "explanation": "Trend 0.82%/periodo, volatilità 0.55× la norma → risk-on."
      }
    },
    "XLI": {
      "label": "Industrial Select Sector (XLI)",
      "source": "Yahoo Finance (query1.finance.yahoo.com, range=max, interval=1mo)",
      "fetchedAt": "2026-07-27T01:22:19.586Z",
      "sampleMonths": 316,
      "monthsInMarketPct": 78.8,
      "buyHold": {
        "mu": 0.0715,
        "sigma": 0.1853,
        "sharpe": 0.468,
        "maxDrawdown": 0.5837
      },
      "momentumTiming": {
        "mu": 0.0466,
        "sigma": 0.1321,
        "sharpe": 0.412,
        "maxDrawdown": 0.3202
      },
      "regime": {
        "regime": "risk-on",
        "trend": 0.01738,
        "vol": 0.04292,
        "volRatio": 0.795,
        "explanation": "Trend 1.74%/periodo, volatilità 0.79× la norma → risk-on."
      }
    },
    "XLK": {
      "label": "Technology Select Sector (XLK)",
      "source": "Yahoo Finance (query1.finance.yahoo.com, range=max, interval=1mo)",
      "fetchedAt": "2026-07-27T01:22:18.412Z",
      "sampleMonths": 316,
      "monthsInMarketPct": 80.1,
      "buyHold": {
        "mu": 0.073,
        "sigma": 0.2284,
        "sharpe": 0.425,
        "maxDrawdown": 0.7907
      },
      "momentumTiming": {
        "mu": 0.0856,
        "sigma": 0.1688,
        "sharpe": 0.573,
        "maxDrawdown": 0.3853
      },
      "regime": {
        "regime": "risk-on",
        "trend": 0.02368,
        "vol": 0.07676,
        "volRatio": 1.156,
        "explanation": "Trend 2.37%/periodo, volatilità 1.16× la norma → risk-on."
      }
    },
    "XLP": {
      "label": "Consumer Staples Select Sector (XLP)",
      "source": "Yahoo Finance (query1.finance.yahoo.com, range=max, interval=1mo)",
      "fetchedAt": "2026-07-27T01:22:19.452Z",
      "sampleMonths": 316,
      "monthsInMarketPct": 80.7,
      "buyHold": {
        "mu": 0.0516,
        "sigma": 0.1211,
        "sharpe": 0.478,
        "maxDrawdown": 0.3498
      },
      "momentumTiming": {
        "mu": 0.0293,
        "sigma": 0.1044,
        "sharpe": 0.33,
        "maxDrawdown": 0.1933
      },
      "regime": {
        "regime": "risk-on",
        "trend": 0.00411,
        "vol": 0.03761,
        "volRatio": 1.041,
        "explanation": "Trend 0.41%/periodo, volatilità 1.04× la norma → risk-on."
      }
    },
    "XLRE": {
      "label": "Real Estate Select Sector (XLRE)",
      "source": "Yahoo Finance (query1.finance.yahoo.com, range=max, interval=1mo)",
      "fetchedAt": "2026-07-27T01:22:20.011Z",
      "sampleMonths": 114,
      "monthsInMarketPct": 68.4,
      "buyHold": {
        "mu": 0.0383,
        "sigma": 0.1735,
        "sharpe": 0.305,
        "maxDrawdown": 0.3611
      },
      "momentumTiming": {
        "mu": -0.0283,
        "sigma": 0.1311,
        "sharpe": -0.151,
        "maxDrawdown": 0.2991
      },
      "regime": {
        "regime": "risk-on",
        "trend": 0.00671,
        "vol": 0.03433,
        "volRatio": 0.697,
        "explanation": "Trend 0.67%/periodo, volatilità 0.70× la norma → risk-on."
      }
    },
    "XLU": {
      "label": "Utilities Select Sector (XLU)",
      "source": "Yahoo Finance (query1.finance.yahoo.com, range=max, interval=1mo)",
      "fetchedAt": "2026-07-27T01:22:19.886Z",
      "sampleMonths": 316,
      "monthsInMarketPct": 75.6,
      "buyHold": {
        "mu": 0.0458,
        "sigma": 0.1486,
        "sharpe": 0.377,
        "maxDrawdown": 0.4818
      },
      "momentumTiming": {
        "mu": 0.0385,
        "sigma": 0.1193,
        "sharpe": 0.377,
        "maxDrawdown": 0.3152
      },
      "regime": {
        "regime": "risk-on",
        "trend": 0.01073,
        "vol": 0.03512,
        "volRatio": 0.804,
        "explanation": "Trend 1.07%/periodo, volatilità 0.80× la norma → risk-on."
      }
    },
    "XLV": {
      "label": "Health Care Select Sector (XLV)",
      "source": "Yahoo Finance (query1.finance.yahoo.com, range=max, interval=1mo)",
      "fetchedAt": "2026-07-27T01:22:19.173Z",
      "sampleMonths": 316,
      "monthsInMarketPct": 79.4,
      "buyHold": {
        "mu": 0.0659,
        "sigma": 0.1408,
        "sharpe": 0.525,
        "maxDrawdown": 0.3744
      },
      "momentumTiming": {
        "mu": 0.0406,
        "sigma": 0.1134,
        "sharpe": 0.408,
        "maxDrawdown": 0.2123
      },
      "regime": {
        "regime": "risk-on",
        "trend": 0.00928,
        "vol": 0.04244,
        "volRatio": 1.039,
        "explanation": "Trend 0.93%/periodo, volatilità 1.04× la norma → risk-on."
      }
    },
    "XLY": {
      "label": "Consumer Discretionary Select Sector (XLY)",
      "source": "Yahoo Finance (query1.finance.yahoo.com, range=max, interval=1mo)",
      "fetchedAt": "2026-07-27T01:22:19.301Z",
      "sampleMonths": 316,
      "monthsInMarketPct": 79.4,
      "buyHold": {
        "mu": 0.0803,
        "sigma": 0.1893,
        "sharpe": 0.503,
        "maxDrawdown": 0.5628
      },
      "momentumTiming": {
        "mu": 0.0571,
        "sigma": 0.1404,
        "sharpe": 0.467,
        "maxDrawdown": 0.3229
      },
      "regime": {
        "regime": "neutral",
        "trend": -0.00014,
        "vol": 0.0469,
        "volRatio": 0.847,
        "explanation": "Trend -0.01%/periodo, volatilità 0.85× la norma → neutral."
      }
    }
  }
};
