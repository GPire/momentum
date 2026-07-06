// Suggerimento intelligente del budget mensile — sostituisce la scelta
// "a caso" fatta una volta sola in onboarding (profilo di rischio → valore
// fisso 1000/1500/2200€, mai più rivisto). Bassa frizione: l'utente non
// parte da un campo vuoto da riempire a indovinare, ma da un numero già
// calcolato sulla sua vera spesa storica, che può accettare con un tap o
// correggere. Predittivo: si ricalcola ogni volta che c'è nuovo storico,
// non resta congelato al giorno dell'onboarding.
import { monthKey } from '../core/constants.js';

// Media della spesa reale degli ultimi mesi COMPLETI (non quello in corso,
// che è parziale e abbasserebbe artificialmente la media), + piccolo
// margine di sicurezza, arrotondato a un numero "pulito" da leggere.
export function suggestMonthlyBudget(transactionsByMonth, referenceDate = new Date(), opts = {}) {
  const { lookbackMonths = 3, safetyMargin = 0.05 } = opts;
  const months = [];
  const cursor = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  cursor.setMonth(cursor.getMonth() - 1); // parte dal mese scorso, quello corrente è escluso
  for (let i = 0; i < lookbackMonths; i++) {
    months.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() - 1);
  }

  const monthlyTotals = months
    .map(mk => (transactionsByMonth[mk] || [])
      .filter(t => t.type === 'uscita')
      .reduce((s, t) => s + t.amount, 0))
    .filter(v => v > 0); // mese senza dati: non contarlo come "hai speso 0"

  if (monthlyTotals.length === 0) return null; // nessuno storico: nessun suggerimento onesto possibile

  const avg = monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length;
  const withMargin = avg * (1 + safetyMargin);
  return {
    suggested: Math.round(withMargin / 10) * 10, // arrotondato ai 10€, numero leggibile
    basedOnMonths: monthlyTotals.length,
    rawAverage: +avg.toFixed(2),
  };
}

// Rileva se il budget impostato si è scollegato dalla spesa reale — usato
// per un avviso non invasivo (stesso pannello alert di abbonamenti/anomalie),
// non per forzare nulla: informa, non decide al posto dell'utente.
export function isBudgetStale(currentBudget, transactionsByMonth, referenceDate = new Date(), opts = {}) {
  const { staleThreshold = 0.25 } = opts;
  if (!currentBudget || currentBudget <= 0) return { stale: false };
  const suggestion = suggestMonthlyBudget(transactionsByMonth, referenceDate, opts);
  if (!suggestion) return { stale: false };

  const diff = Math.abs(currentBudget - suggestion.rawAverage) / currentBudget;
  return {
    stale: diff > staleThreshold,
    direction: suggestion.rawAverage > currentBudget ? 'sotto' : 'sopra', // il budget attuale è sotto/sopra la spesa reale
    suggestion,
    diffPct: +(diff * 100).toFixed(0),
  };
}
