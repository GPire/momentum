// ============================================================
// ONBOARDING PRIORS — le 2 domande del primo avvio ADDESTRANO il Core
// ============================================================
// Innovazione proprietaria (anti-attrito/anti-abbandono): invece di partire
// "freddo" come ogni concorrente, Momentum trasforma le due risposte del primo
// avvio in PRIORI BAYESIANI per più modelli, così il motore è già personalizzato
// e predittivo dal PRIMO TOCCO. Onesto (regola n.1): sono PRIORI DEBOLI (encodano
// conoscenza di dominio), non dati inventati — i dati reali dell'utente li
// superano in fretta (il bandit decade verso il prior + osservazioni). Funzioni
// PURE e testabili: nessun DOM, nessuno stato globale.
'use strict';

const RISKS = new Set(['conservativo', 'bilanciato', 'aggressivo']);
const HORIZONS = new Set(['breve', 'medio', 'lungo']);

// Config di base derivata dal profilo (centralizza la logica prima inline in
// seedProfileState → una sola fonte di verità, niente divergenze).
export function derivePriors(risk = 'bilanciato', horizon = 'medio') {
  const r = RISKS.has(risk) ? risk : 'bilanciato';
  const hz = HORIZONS.has(horizon) ? horizon : 'medio';
  const monthlyBudget = r === 'conservativo' ? 1000 : r === 'aggressivo' ? 2200 : 1500;
  const investFraction = r === 'aggressivo' ? 0.85 : r === 'conservativo' ? 0.4 : 0.65;
  // L'orizzonte modula i mesi di emergenza: più è breve il bisogno, più cuscinetto.
  const baseEmergency = r === 'conservativo' ? 9 : r === 'aggressivo' ? 4 : 6;
  const emergencyMonths = hz === 'breve' ? baseEmergency + 2 : hz === 'lungo' ? Math.max(3, baseEmergency - 1) : baseEmergency;
  const riskFloor = r === 'conservativo' ? 0.35 : r === 'aggressivo' ? 0.15 : 0.25;
  // Tono dei nudge di spesa (aiAggression): un profilo prudente vuole essere
  // avvisato di più (advisor), uno aggressivo vuole meno interruzioni (zen).
  const aiAggression = r === 'conservativo' ? 'advisor' : r === 'aggressivo' ? 'zen' : 'advisor';
  return { risk: r, horizon: hz, monthlyBudget, investFraction, emergencyMonths, riskFloor, aiAggression };
}

// Priori DEBOLI per il contextual bandit dell'advisor (Beta-Bernoulli). Encodano
// una probabilità a priori leggermente più alta che certi consigli facciano
// AGIRE questo profilo: un prudente tende a rispondere ai nudge di RISPARMIO
// ("sweep"), un aggressivo agli spunti di OTTIMIZZAZIONE ("causal"). Restano
// deboli (bias ≤ 0.6 pseudo-conteggi): bastano poche interazioni reali a
// sovrascriverli. Ritorna una mappa { "context|kind": {a, b} } pronta da fondere
// nello stato `advisorBandit`. Contesti coperti: entrambe le fasi mese × over/ok.
export function banditSeed(risk = 'bilanciato') {
  const r = RISKS.has(risk) ? risk : 'bilanciato';
  // kind favorito e forza del bias (pseudo-successi aggiunti al prior a=1).
  const favor = r === 'conservativo' ? { sweep: 0.6, causal: 0.1 }
    : r === 'aggressivo' ? { causal: 0.6, sweep: 0.1 }
    : { sweep: 0.3, causal: 0.3 };
  const contexts = ['ok:early', 'ok:mid', 'ok:late', 'over:early', 'over:mid', 'over:late'];
  const arms = {};
  for (const ctx of contexts) {
    for (const [kind, bias] of Object.entries(favor)) {
      arms[`${ctx}|${kind}`] = { a: 1 + bias, b: 1 }; // Beta(1+bias, 1): media a posteriori > 0.5
    }
  }
  return arms;
}

// Fonde i priori del bandit dentro uno stato advisorBandit esistente SENZA
// sovrascrivere bracci già appresi (se l'utente ha già dati reali, quelli
// vincono: si semina solo dove non c'è ancora nulla). Puro.
export function seedBanditState(existing, risk = 'bilanciato') {
  const base = existing && existing.arms ? existing : { version: 1, arms: {} };
  const seed = banditSeed(risk);
  const arms = { ...base.arms };
  for (const [key, val] of Object.entries(seed)) {
    if (!arms[key]) arms[key] = val; // non toccare i bracci già appresi
  }
  return { ...base, version: base.version || 1, arms };
}
