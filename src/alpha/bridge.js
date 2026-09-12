// ============================================================
// PONTE CASHFLOW ↔ INVESTIMENTI — il vero moat (privacy-preserving)
// ============================================================
// Collega il cashflow personale (safe-to-spend, avanzi) al
// motore Alpha: "quanto puoi investire questo mese SENZA rompere il budget?".
// Regole prudenti e dichiarate: prima il fondo d'emergenza, poi solo una quota
// dell'avanzo, mai se il flusso è negativo. Funzioni pure.
'use strict';

export function investmentDataMissing(lang = 'en') {
  return ({
    it: 'Non ho abbastanza dati sulle spese e sulla liquidità di emergenza per stimare quanto investire. Gli investimenti non sono denaro subito disponibile.',
    en: 'I need more information about expenses and emergency cash to estimate how much you could invest. Investments are not immediately available cash.',
    de: 'Für eine Schätzung fehlen Angaben zu Ausgaben und Notfallreserven. Anlagen sind kein sofort verfügbares Geld.',
    fr: 'Il manque des informations sur les dépenses et la réserve de précaution pour estimer combien investir. Les placements ne sont pas des liquidités immédiatement disponibles.',
    es: 'Faltan datos sobre gastos y efectivo de emergencia para estimar cuánto invertir. Las inversiones no son dinero disponible de inmediato.',
    nl: 'Er ontbreken gegevens over uitgaven en je noodbuffer om te schatten hoeveel je kunt beleggen. Beleggingen zijn niet direct beschikbaar geld.',
    pt: 'Faltam dados sobre despesas e dinheiro de emergência para estimar quanto investir. Os investimentos não são dinheiro imediatamente disponível.',
  })[lang] || investmentDataMissing('en');
}

// Quanto è prudente investire questo mese.
// input: { netMonthlyFlow, avgMonthlyExpense, currentEmergencyFund,
//          emergencyMonths=6, investFraction=0.7 }
export function investableSurplus(input) {
  const netMonthlyFlow = input.netMonthlyFlow ?? 0;          // entrate - uscite del mese
  const avgMonthlyExpense = input.avgMonthlyExpense ?? 0;
  const currentEmergencyFund = input.currentEmergencyFund;
  const emergencyMonths = input.emergencyMonths ?? 6;
  const investFraction = input.investFraction ?? 0.7;

  const targetEmergency = avgMonthlyExpense * emergencyMonths;

  if (!Number.isFinite(avgMonthlyExpense) || avgMonthlyExpense <= 0 || !Number.isFinite(currentEmergencyFund)
      || currentEmergencyFund < 0 || !Number.isFinite(netMonthlyFlow) || !Number.isFinite(emergencyMonths)
      || emergencyMonths <= 0 || !Number.isFinite(investFraction) || investFraction < 0 || investFraction > 1) {
    return { investable: 0, reason: 'insufficient-data', targetEmergency: null, note: investmentDataMissing(input.lang || 'it') };
  }

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
  const buyable = (Array.isArray(assets) ? assets : []).filter(a => a && Number.isFinite(a.score) && a.score > 0
    && (a.verdict === 'compra' || (opts.includeHold && a.verdict === 'tieni')));
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(cents) || cents <= 0 || buyable.length === 0) {
    return { allocations: [], invested: 0, note: 'Nessuna allocazione: importo o candidati assenti o non validi.' };
  }
  const scale = buyable.reduce((max, a) => Math.max(max, a.score), 0);
  const totalScore = buyable.reduce((sum, a) => sum + a.score / scale, 0);
  const shares = buyable.map(a => cents * (a.score / scale / totalScore));
  const allocated = shares.map(Math.floor);
  let remaining = cents - allocated.reduce((sum, value) => sum + value, 0);
  const order = shares.map((value, i) => ({ i, remainder: value - allocated[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  // Largest remainders conserve the budget; input order breaks equal-score ties.
  for (let i = 0; remaining > 0; i++, remaining--) allocated[order[i % order.length].i]++;
  // Floating-point rounding near the safe-integer limit can over-allocate a cent.
  for (let i = order.length - 1; remaining < 0; i = (i + order.length - 1) % order.length) {
    if (allocated[order[i].i] > 0) { allocated[order[i].i]--; remaining++; }
  }
  const allocations = buyable.map((a, i) => ({
    ticker: a.ticker,
    weight: +(a.score / scale / totalScore).toFixed(4),
    amount: allocated[i] / 100,
    verdict: a.verdict,
  }));
  const invested = cents / 100;
  return { allocations, invested, note: `Allocati ${invested.toFixed(0)}€ su ${allocations.length} asset, pesati per convinzione.` };
}
