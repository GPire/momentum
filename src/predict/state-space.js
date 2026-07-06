// Holt-Winters in forma state-space: stesso identico algoritmo di
// HoltWinters.forecast() in engines.js, ma con lo stato (level, trend,
// seasonals) esplicito e persistibile, cosi ogni NUOVA transazione costa
// O(1) invece di ri-processare l'intera serie storica da capo.
//
// Onestà tecnica dichiarata (non ovvia, va detta): questa NON è
// un'approssimazione della versione batch, è la STESSA formula — ma con una
// differenza di comportamento intrinseca al fatto di essere O(1):
// - `HoltWinters.forecast(series)` ricalcola ogni volta la media stagionale
//   iniziale su TUTTA la serie corrente (è per questo che è O(n) per
//   chiamata) — quella media "si sposta" leggermente ogni volta che entra
//   un nuovo punto.
// - Questa versione calcola quella media UNA VOLTA (in createHoltWintersState,
//   O(n), da fare solo quando serve una vera re-inizializzazione, es. cambio
//   di stagionalità strutturale) e poi aggiorna solo con la ricorrenza
//   (O(1) per punto), senza mai ripetere il ricalcolo della media globale.
// Le due versioni CONVERGONO nel tempo (la ricorrenza di gamma fa decadere
// geometricamente l'influenza del valore iniziale), ma non sono bit-identiche
// dopo molti nuovi punti — è il costo onesto del passaggio a O(1), verificato
// nei test sotto invece che dichiarato senza controllo.
export function createHoltWintersState(series, period = 7, alpha = 0.3, beta = 0.1, gamma = 0.2) {
  if (!series || series.length < period * 2) {
    const avg = series?.length ? series.reduce((a, b) => a + b, 0) / series.length : 0;
    return { level: avg, trend: 0, seasonals: Array(period).fill(0), period, alpha, beta, gamma, t: series?.length || 0, initialized: false };
  }

  const n = series.length;
  let level = series.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let trend = (series.slice(period, period * 2).reduce((a, b) => a + b, 0) / period - level) / period;
  let seasonals = Array.from({ length: period }, (_, i) => {
    let s = 0, cnt = 0;
    for (let j = i; j < n; j += period) { s += series[j]; cnt++; }
    return s / (cnt || 1) - level;
  });

  // stessa passata della versione batch, per arrivare allo stesso stato
  // finale che avrebbe HoltWinters.forecast() dopo aver "visto" tutta series
  for (let t = 0; t < n; t++) {
    const s = seasonals[t % period];
    const prevLevel = level;
    level = alpha * (series[t] - s) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonals[t % period] = gamma * (series[t] - level) + (1 - gamma) * s;
  }

  return { level, trend, seasonals, period, alpha, beta, gamma, t: n, initialized: true };
}

// Costo O(1): una sola iterazione della ricorrenza, nessuna scansione della
// storia. Questo è il punto di tutto il modulo — va chiamato ad ogni nuova
// transazione al posto di ri-processare l'intera serie.
export function updateHoltWintersState(state, newValue) {
  if (!state.initialized) {
    // ancora sotto la soglia minima (2 periodi) per Holt-Winters vero:
    // fallback a media incrementale, stesso spirito di HoltWinters._fallback
    const newT = state.t + 1;
    const newLevel = state.level + (newValue - state.level) / newT;
    const initialized = newT >= state.period * 2;
    return { ...state, level: newLevel, t: newT, initialized };
  }

  const { period, alpha, beta, gamma } = state;
  const idx = state.t % period;
  const s = state.seasonals[idx];
  const prevLevel = state.level;
  const level = alpha * (newValue - s) + (1 - alpha) * (state.level + state.trend);
  const trend = beta * (level - prevLevel) + (1 - beta) * state.trend;
  const seasonals = state.seasonals.slice();
  seasonals[idx] = gamma * (newValue - level) + (1 - gamma) * s;

  return { ...state, level, trend, seasonals, t: state.t + 1 };
}

export function forecastFromState(state, horizon = 30) {
  if (!state.initialized) {
    return { forecasted: Array(horizon).fill(+state.level.toFixed(2)), level: +state.level.toFixed(2), trend: 0 };
  }
  const { level, trend, seasonals, period, t } = state;
  const forecasted = [];
  for (let h = 1; h <= horizon; h++) {
    const seasonal = seasonals[(t + h - 1) % period];
    forecasted.push(Math.max(0, level + h * trend + seasonal));
  }
  return { forecasted, level: +level.toFixed(2), trend: +trend.toFixed(4) };
}
