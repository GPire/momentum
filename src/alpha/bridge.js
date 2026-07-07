// ============================================================
// PONTE CASHFLOW ↔ INVESTIMENTI — il vero moat (privacy-preserving)
// ============================================================
// Onestà tecnica (regola #1): nessun competitor cloud può copiarlo perché non
// riceve i tuoi dati. Collega il cashflow personale (safe-to-spend, avanzi) al
// motore Alpha: "quanto puoi investire questo mese SENZA rompere il budget?".
// Regole prudenti e dichiarate: prima il fondo d'emergenza, poi solo una quota
// dell'avanzo, mai se il flusso è negativo. Funzioni pure.
'use strict';

// Quanto è prudente investire questo mese.
// input: { netMonthlyFlow, avgMonthlyExpense, currentEmergencyFund,
//          emergencyMonths=6, investFraction=0.7 }
export function investableSurplus(input) {
  const netMonthlyFlow = input.netMonthlyFlow ?? 0;          // entrate - uscite del mese
  const avgMonthlyExpense = input.avgMonthlyExpense ?? 0;
  const currentEmergencyFund = input.currentEmergencyFund ?? 0;
  const emergencyMonths = input.emergencyMonths ?? 6;
  const investFraction = input.investFraction ?? 0.7;

  const targetEmergency = avgMonthlyExpense * emergencyMonths;

  // 1) Flusso negativo → non si investe (si difende il budget).
  if (netMonthlyFlow <= 0) {
    return { investable: 0, reason: 'flow-negative', targetEmergency, note: 'Questo mese non avanza nulla: prima il budget.' };
  }
  // 2) Fondo d'emergenza non pieno → l'avanzo va lì, non in mercato.
  if (currentEmergencyFund < targetEmergency) {
    const toFund = Math.min(netMonthlyFlow, targetEmergency - currentEmergencyFund);
    return { investable: 0, toEmergencyFund: +toFund.toFixed(2), reason: 'building-emergency', targetEmergency,
             note: `Prima completi il fondo d'emergenza (${(targetEmergency).toFixed(0)}€): questo mese ${toFund.toFixed(0)}€ lì.` };
  }
  // 3) Fondo pieno → investi una QUOTA dell'avanzo (il resto resta cuscinetto).
  const investable = +(netMonthlyFlow * investFraction).toFixed(2);
  return { investable, reason: 'ok', targetEmergency,
           note: `Fondo d'emergenza pieno: puoi investire ~${investable.toFixed(0)}€ (il ${Math.round(investFraction * 100)}% dell'avanzo).` };
}

// Distribuisce l'importo investibile tra gli asset con verdetto favorevole,
// proporzionalmente al punteggio dell'arbitro. Ignora 'evita'/'astengo'.
// assets: [{ ticker, verdict, score }] (da arbiter.js).
export function allocateInvestment(amount, assets, opts = {}) {
  const buyable = (assets || []).filter(a => a.verdict === 'compra' || (opts.includeHold && a.verdict === 'tieni'));
  if (amount <= 0 || buyable.length === 0) return { allocations: [], invested: 0, note: 'Nessuna allocazione: importo o candidati assenti.' };
  const totalScore = buyable.reduce((s, a) => s + (a.score || 0), 0) || 1;
  const allocations = buyable.map(a => ({
    ticker: a.ticker,
    weight: +((a.score || 0) / totalScore).toFixed(4),
    amount: +(amount * (a.score || 0) / totalScore).toFixed(2),
    verdict: a.verdict,
  }));
  const invested = +allocations.reduce((s, a) => s + a.amount, 0).toFixed(2);
  return { allocations, invested, note: `Allocati ${invested.toFixed(0)}€ su ${allocations.length} asset, pesati per convinzione.` };
}
