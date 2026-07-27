// Avvisi di prezzo — logica pura, on-device (nessuna chiamata di rete qui
// dentro). L'utente sceglie un asset e una soglia; ad ogni ciclo di prezzi
// (idleFetchPrices in main.js) si confronta l'ultimo prezzo noto con le
// soglie e si dichiarano gli avvisi scattati. Ogni avviso scatta UNA sola
// volta (triggeredAt), poi resta silenzioso finché l'utente non lo resetta:
// niente spam ad ogni ciclo idle.
'use strict';

export function createPriceAlert({ symbol, direction, threshold, id = null }) {
  if (!symbol || !['above', 'below'].includes(direction) || !Number.isFinite(threshold) || threshold <= 0) {
    throw new Error('Avviso non valido: servono simbolo, direzione (above/below) e soglia positiva.');
  }
  return { id: id || `${symbol.toUpperCase()}-${direction}-${threshold}-${Date.now()}`, symbol: symbol.toUpperCase(), direction, threshold, createdAt: Date.now(), triggeredAt: null };
}

// `livePrices`: { SYMBOL: price }. Ritorna { alerts (aggiornati), fired
// (quelli appena scattati in QUESTO giro) } — mai muta l'array in input.
export function checkPriceAlerts(alerts = [], livePrices = {}) {
  const fired = [];
  const updated = alerts.map((a) => {
    if (a.triggeredAt) return a;
    const price = livePrices[a.symbol];
    if (!Number.isFinite(price)) return a;
    const hit = a.direction === 'above' ? price >= a.threshold : price <= a.threshold;
    if (!hit) return a;
    const next = { ...a, triggeredAt: Date.now(), triggeredPrice: price };
    fired.push(next);
    return next;
  });
  return { alerts: updated, fired };
}

export function resetPriceAlert(alerts = [], id) {
  return alerts.map((a) => (a.id === id ? { ...a, triggeredAt: null, triggeredPrice: null } : a));
}

export function removePriceAlert(alerts = [], id) {
  return alerts.filter((a) => a.id !== id);
}
