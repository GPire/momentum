// ============================================================
// SPENDING BRAKE — "quanto l'app ti frena sulle spese", VERO e INTEGRATO
// ============================================================
// Prima era una euristica finta (budget/30 × moltiplicatore) scollegata dai
// modelli, e il risultato veniva quasi buttato (cambiava solo il testo di un
// bottone, con un "Spesa Bloccata" DISONESTO: non bloccava nulla). Ora il freno:
//  · è INTEGRATO coi segnali reali del Momentum Core: safe-to-spend di oggi e
//    PROIEZIONE di fine mese (predittivo), + l'importo tipico per categoria;
//  · i tre livelli si comportano DAVVERO in modo diverso (soglie di sensibilità);
//  · è MOTIVAZIONALE e ONESTO (regola n.1): mai "bloccato", mai paura/vergogna —
//    dà un fatto utile e un'azione ("salti questa e resti in pari"). L'app non
//    muove i tuoi soldi: decidi tu.
// Funzione PURA e testabile: niente DOM, niente stato globale.
'use strict';

const eur = (n) => `${Math.round(n)}€`;

// mode: 'zen' | 'advisor' | 'predator' (quanto è sensibile il freno)
// ctx: { amount, safeToday, monthEndDelta, typical, budget }
//   safeToday      = quanto resta da spendere oggi (getDailySafeToSpend), o null
//   monthEndDelta  = proiezione fine mese vs budget: NEGATIVO = sforo previsto, o null
//   typical        = importo tipico per questa categoria (amount-memory), o null
//   budget         = budget mensile (fallback)
// Ritorna { level:'ok'|'nudge'|'warn', tone:'calm'|'amber', message }.
export function evaluateBrake(mode = 'advisor', ctx = {}) {
  const amount = Math.max(0, +ctx.amount || 0);
  if (!(amount > 0)) return { level: 'ok', tone: 'calm', message: '' };

  const safe = (typeof ctx.safeToday === 'number' && isFinite(ctx.safeToday)) ? ctx.safeToday : null;
  const delta = (typeof ctx.monthEndDelta === 'number' && isFinite(ctx.monthEndDelta)) ? ctx.monthEndDelta : null;
  const typical = (typeof ctx.typical === 'number' && ctx.typical > 0) ? ctx.typical : null;
  const budget = (typeof ctx.budget === 'number' && ctx.budget > 0) ? ctx.budget : null;

  // Sensibilità per modalità: il predator interviene prima (protegge), lo zen
  // solo sull'eccezionale, l'advisor sta nel mezzo. Espressa come frazione del
  // safe-to-spend di oggi oltre cui scatta il nudge.
  const sens = mode === 'zen' ? { nudge: 1.6, warn: 3.0 }
    : mode === 'predator' ? { nudge: 0.6, warn: 1.0 }
    : { nudge: 1.0, warn: 1.8 };

  // 1) Segnale PREDITTIVO più forte: questa spesa fa chiudere il mese in rosso?
  //    (usa la proiezione reale di fine mese). Motivazionale + azionabile.
  if (delta !== null) {
    const after = delta - amount; // margine di fine mese dopo questa spesa (neg = sforo)
    const b = budget || 1500;
    // predator avvisa PRIMA (mentre ti avvicini allo sforo), advisor allo sforo,
    // zen solo quando sfori in modo netto.
    const overThreshold = mode === 'predator' ? b * 0.05 : mode === 'zen' ? -b * 0.10 : 0;
    if (after < overThreshold) {
      return {
        level: mode === 'zen' ? 'nudge' : 'warn', tone: 'amber',
        message: `Di questo passo il mese chiude a −${eur(-after)}. Se salti questa, resti più in pari.`,
      };
    }
  }

  // 2) Rispetto al safe-to-spend di OGGI: quanto pesa? Frazione oltre soglia.
  if (safe !== null && safe >= 0) {
    if (amount > safe * sens.warn) {
      return { level: 'warn', tone: 'amber', message: `È più del doppio di quanto avevi per oggi (${eur(safe)} liberi). Sicuro?` };
    }
    if (amount > safe * sens.nudge) {
      const left = safe - amount;
      return {
        level: 'nudge', tone: 'amber',
        message: left >= 0 ? `Ok: dopo questa ti restano ${eur(left)} per oggi.` : `Con questa vai oltre di ${eur(-left)} il budget di oggi.`,
      };
    }
  }

  // 3) È molto più del SOLITO per questa categoria? (importo tipico appreso).
  if (typical && amount >= typical * (mode === 'predator' ? 1.6 : mode === 'zen' ? 3 : 2.2)) {
    return { level: 'nudge', tone: 'amber', message: `Più del solito qui: di solito spendi ~${eur(typical)}.` };
  }

  // 4) Rete di sicurezza senza segnali: solo su importi enormi vs budget.
  if (safe === null && delta === null && budget) {
    const cap = budget * (mode === 'predator' ? 0.2 : mode === 'zen' ? 0.6 : 0.35);
    if (amount > cap) return { level: 'nudge', tone: 'amber', message: `Spesa importante (${eur(amount)}). Rientra nei piani?` };
  }

  return { level: 'ok', tone: 'calm', message: '' };
}
