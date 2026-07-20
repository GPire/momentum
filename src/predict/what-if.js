// What-If v2: "se taglio/aumento la categoria X del N%, cosa succede?"
// Combina tre cose GIÀ misurate altrove (nessuna nuova magia):
// 1. la spesa media mensile reale della categoria (ultimi 3 mesi completi);
// 2. gli effetti a catena del grafo causale (propagateImpact) tradotti in €
//    usando la media mensile delle categorie toccate;
// 3. l'impatto sul delta di fine mese.
// Il risultato dichiara sempre che gli effetti a catena sono co-variazioni
// osservate, non leggi. Funzioni pure, nessun DOM.
import { buildCausalGraph, propagateImpact } from './causal-graph.js';

function monthlyAvgByCategory(allTx, referenceDate, months = 3) {
  const totals = {};
  for (let i = 1; i <= months; i++) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    for (const t of allTx?.[mk] || []) {
      if (t.type !== 'uscita') continue;
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    }
  }
  const avg = {};
  for (const [cat, tot] of Object.entries(totals)) avg[cat] = tot / months;
  return avg;
}

// `links` opzionale: se il chiamante ha già un grafo (es. depurato dalla
// precedenza causale via pruneNonCausal, Wave 14) lo riusa invece di
// ricalcolare quello grezzo — retrocompatibile, default invariato.
export function simulateCategoryChange({ allTx, catId, deltaPct, referenceDate = new Date(), links: linksOverride } = {}) {
  const avg = monthlyAvgByCategory(allTx, referenceDate);
  const catAvg = avg[catId] || 0;
  if (catAvg === 0) return null; // nessuna storia recente: simulare sarebbe inventare

  // effetto diretto: N% della spesa media mensile della categoria
  // (deltaPct negativo = taglio = risparmio positivo)
  const directMonthly = +(-(catAvg * deltaPct / 100)).toFixed(2);

  const links = linksOverride || buildCausalGraph(allTx, referenceDate);
  const chainEffects = propagateImpact(links, catId, deltaPct)
    .filter(e => avg[e.category] > 0)
    .map(e => ({
      category: e.category,
      pct: e.expectedPct,
      monthlyEur: +(-(avg[e.category] * e.expectedPct / 100)).toFixed(2),
      lagWeeks: e.lagWeeks,
    }));

  const chainMonthly = +chainEffects.reduce((s, e) => s + e.monthlyEur, 0).toFixed(2);

  return {
    category: catId,
    deltaPct,
    categoryMonthlyAvg: +catAvg.toFixed(2),
    directMonthly,                 // € al mese risparmiati (+) o in più (−)
    chainEffects,                  // co-variazioni osservate, non leggi
    chainMonthly,
    totalMonthly: +(directMonthly + chainMonthly).toFixed(2),
  };
}
