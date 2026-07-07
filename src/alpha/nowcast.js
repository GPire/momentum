// ============================================================
// NOWCASTING PREZZI — dati di mercato quando sei OFFLINE o rate-limited
// ============================================================
// Il metodo proprietario onesto (regola #1): quando non c'è rete o l'API ha
// esaurito le request, il prezzo NON si blocca e NON si finge aggiornato. Si
// ESTRAPOLA l'ultimo noto con un modello trasparente (drift AR + volatilità) e
// si ALLARGA la banda d'incertezza in proporzione alla staleness. La UI mostra
// "stima ±banda con data", non un numero falso-preciso. Offline è cittadino di
// prima classe. Funzioni pure (riusano engines.js).
'use strict';

import { forecastAR2 } from '../predict/engines.js';

const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const std = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };

// Freschezza dichiarata di un dato dato il suo timestamp.
export function freshness(tsMs, nowMs = Date.now()) {
  const days = Math.max(0, (nowMs - tsMs) / 86_400_000);
  const label = days < 1 ? 'oggi' : days < 2 ? 'ieri' : `${Math.round(days)} giorni fa`;
  return { days: +days.toFixed(2), label, stale: days >= 1 };
}

// Estrapola il prezzo `stepsAhead` avanti dall'ultimo noto. Ritorna
// { estimate, low, high, band, stale, method } — la banda cresce con √steps
// (incertezza che si accumula) e col numero di step.
export function nowcastPrice(priceSeries, stepsAhead = 1, opts = {}) {
  const p = (priceSeries || []).filter(Number.isFinite);
  if (!p.length) return { estimate: null, low: null, high: null, band: null, stale: true, method: 'no-data' };
  const last = p[p.length - 1];
  if (stepsAhead <= 0) return { estimate: last, low: last, high: last, band: 0, stale: false, method: 'live' };
  if (p.length < 6) {
    // pochi dati: si tiene l'ultimo prezzo, ma con banda dichiarata dalla volatilità grezza
    const vol = p.length > 1 ? std(p) : Math.abs(last) * 0.02;
    const band = vol * Math.sqrt(stepsAhead);
    return { estimate: +last.toFixed(4), low: +(last - band).toFixed(4), high: +(last + band).toFixed(4), band: +band.toFixed(4), stale: true, method: 'hold-last' };
  }
  // rendimenti → AR(2) per il drift; volatilità dei rendimenti per la banda
  const rets = [];
  for (let i = 1; i < p.length; i++) rets.push((p[i] - p[i - 1]) / p[i - 1]);
  const drift = forecastAR2(rets, stepsAhead).forecasted;
  let est = last;
  for (let i = 0; i < stepsAhead; i++) est *= 1 + (drift[i] ?? 0);
  const band = last * std(rets) * Math.sqrt(stepsAhead); // incertezza ~ √orizzonte
  return {
    estimate: +est.toFixed(4),
    low: +(est - band).toFixed(4),
    high: +(est + band).toFixed(4),
    band: +band.toFixed(4),
    stale: true,
    method: 'ar2-drift',
  };
}
