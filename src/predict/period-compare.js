// Confronto REALE tra due periodi (mese vs mese, o anno vs anno) — richiesto
// esplicitamente: "confrontare periodi come mesi di quest'anno e passati".
// Nessun nuovo motore: riusa la stessa struttura allTx già indicizzata per
// mese ovunque nell'app (monthKey). Funzioni pure, nessun DOM.
'use strict';

function categoryTotals(txs) {
  const totals = {};
  let total = 0;
  for (const t of txs) {
    if (t.type !== 'uscita') continue;
    totals[t.category] = (totals[t.category] || 0) + t.amount;
    total += t.amount;
  }
  return { byCategory: totals, total };
}

// `allTx` = VaultDAO.state.transactions (oggetto {meseKey: [tx,...]}).
// `keysA`/`keysB` = array di monthKey da sommare per ciascun periodo (un
// solo mese per un confronto mese-su-mese, 12 mesi per un confronto
// anno-su-anno) — mai un calcolo diverso per i due casi, stessa funzione.
export function comparePeriods(allTx, keysA, keysB) {
  const txsA = keysA.flatMap(k => allTx?.[k] || []);
  const txsB = keysB.flatMap(k => allTx?.[k] || []);
  const a = categoryTotals(txsA);
  const b = categoryTotals(txsB);
  const cats = new Set([...Object.keys(a.byCategory), ...Object.keys(b.byCategory)]);
  const rows = [...cats].map(cat => {
    const valA = a.byCategory[cat] || 0;
    const valB = b.byCategory[cat] || 0;
    const deltaPct = valB > 0 ? ((valA - valB) / valB) * 100 : (valA > 0 ? 100 : 0);
    return { category: cat, current: +valA.toFixed(2), previous: +valB.toFixed(2), deltaPct: +deltaPct.toFixed(1) };
  }).sort((x, y) => Math.abs(y.current - y.previous) - Math.abs(x.current - x.previous));
  const totalDeltaPct = b.total > 0 ? ((a.total - b.total) / b.total) * 100 : (a.total > 0 ? 100 : 0);
  return {
    current: +a.total.toFixed(2),
    previous: +b.total.toFixed(2),
    totalDeltaPct: +totalDeltaPct.toFixed(1),
    rows,
  };
}

// Helper: genera i monthKey per gli ultimi N mesi COMPLETI prima di
// `referenceDate` (esclude il mese in corso, che è parziale e falserebbe il
// confronto — confrontare un mese pieno con uno a metà è disonesto).
export function lastNMonthKeys(referenceDate, n, offsetMonths = 0) {
  const keys = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - offsetMonths - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}
