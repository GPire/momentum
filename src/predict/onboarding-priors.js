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
//
// `liquidityMonths` (opzionale, terzo parametro): la liquidità REALE
// dichiarata dall'utente (domanda 1 dell'onboarding), non derivata dal
// profilo di rischio come `emergencyMonths` qui sotto — due persone
// "aggressive" possono avere situazioni di liquidità opposte, e trattarle
// uguali sarebbe un dato inventato spacciato per personalizzazione. Quando
// c'è, VINCE sul valore derivato dal rischio (con un minimo di 1 mese: mai
// zero, un numero che romperebbe le proiezioni a valle). Contraddizione
// dichiarata, non risolta in silenzio (regola del progetto): un profilo
// "aggressivo" ma con meno di 2 mesi di liquidità reale attiva comunque il
// freno protettivo — il bisogno reale vince sulla dichiarazione di
// tolleranza al rischio, e `cashflowStress` lo rende leggibile a chi
// consuma questi priori (es. il payoff visibile in main.js).
// `invests` (opzionale, quarto parametro): "non investo e preferisco non
// farlo" è un fatto ORTOGONALE al profilo di rischio, non un livello di
// rischio in più — chi non investe ha comunque bisogno di budget, cuscinetto
// e freno spese come chiunque altro, solo `investFraction` si azzera (mai
// una quota "investibile" proposta a chi ha detto esplicitamente di no).
export function derivePriors(risk = 'bilanciato', horizon = 'medio', liquidityMonths = null, invests = true) {
  const r = RISKS.has(risk) ? risk : 'bilanciato';
  const hz = HORIZONS.has(horizon) ? horizon : 'medio';
  const monthlyBudget = r === 'conservativo' ? 1000 : r === 'aggressivo' ? 2200 : 1500;
  const investFraction = r === 'aggressivo' ? 0.85 : r === 'conservativo' ? 0.4 : 0.65;
  // L'orizzonte modula i mesi di emergenza: più è breve il bisogno, più cuscinetto.
  const baseEmergency = r === 'conservativo' ? 9 : r === 'aggressivo' ? 4 : 6;
  const emergencyMonths = hz === 'breve' ? baseEmergency + 2 : hz === 'lungo' ? Math.max(3, baseEmergency - 1) : baseEmergency;
  const riskFloor = r === 'conservativo' ? 0.35 : r === 'aggressivo' ? 0.15 : 0.25;
  // QUANTO L'APP TI FRENA SULLE SPESE (aiAggression) — derivato in modo
  // PREDITTIVO da ENTRAMBE le dimensioni, non dal solo rischio:
  //  · 'predator' (freno forte) se ti servono presto (orizzonte breve) o sei
  //    prudente → guardrail che proteggono il bisogno a breve;
  //  · 'zen' (poche interruzioni) se sei aggressivo E costruisci a lungo →
  //    massima libertà, l'app non ti sta addosso;
  //  · 'advisor' (equilibrato) in tutti gli altri casi.
  // Onesto: è un punto di PARTENZA su misura, sempre modificabile in Impostazioni.
  let aiAggression = 'advisor';
  if (hz === 'breve' || r === 'conservativo') aiAggression = 'predator';
  else if (r === 'aggressivo' && hz === 'lungo') aiAggression = 'zen';

  let finalEmergencyMonths = emergencyMonths;
  let cashflowStress = null;
  const haLiquiditaReale = Number.isFinite(liquidityMonths) && liquidityMonths >= 0;
  if (haLiquiditaReale) {
    finalEmergencyMonths = Math.max(1, Math.round(liquidityMonths));
    cashflowStress = liquidityMonths < 2 ? 'corto' : liquidityMonths >= 12 ? 'ampio' : 'normale';
    if (cashflowStress === 'corto' && aiAggression !== 'predator') aiAggression = 'predator';
  }
  return {
    risk: r, horizon: hz, monthlyBudget, investFraction: invests ? investFraction : 0, emergencyMonths: finalEmergencyMonths, riskFloor, aiAggression,
    cashflowStress, liquidityMonths: haLiquiditaReale ? +liquidityMonths : null, invests: !!invests,
  };
}

// Priori DEBOLI per il contextual bandit dell'advisor (Beta-Bernoulli). Encodano
// una probabilità a priori leggermente più alta che certi consigli facciano
// AGIRE questo profilo: un prudente tende a rispondere ai nudge di RISPARMIO
// ("sweep"), un aggressivo agli spunti di OTTIMIZZAZIONE ("causal"). Restano
// deboli (bias ≤ 0.6 pseudo-conteggi): bastano poche interazioni reali a
// sovrascriverli. Ritorna una mappa { "context|kind": {a, b} } pronta da fondere
// nello stato `advisorBandit`. Contesti coperti: entrambe le fasi mese × over/ok.
// `cashflowStress` (opzionale, secondo parametro): quando 'corto' (liquidità
// reale sotto 2 mesi, domanda 1 dell'onboarding — indipendente dal rischio)
// aggiunge un bias sul kind 'bnpl-exposure' — un avviso di esposizione a
// piani rateali conta di più con un cuscinetto sottile. IMPORTANTE: questo
// NON tocca se bnpl.js rileva un piano (resta puramente sui dati, mai sul
// profilo dichiarato — vedi la nota in neural-nexus.js sullo stesso
// principio), solo QUANTO IN ALTO l'avviso finisce nel feed una volta
// rilevato — la differenza fra "cosa è vero" (mai negoziabile) e "cosa
// vedi per primo" (legittimamente personalizzabile).
export function banditSeed(risk = 'bilanciato', cashflowStress = null) {
  const r = RISKS.has(risk) ? risk : 'bilanciato';
  // kind favorito e forza del bias (pseudo-successi aggiunti al prior a=1).
  const favor = r === 'conservativo' ? { sweep: 0.6, causal: 0.1 }
    : r === 'aggressivo' ? { causal: 0.6, sweep: 0.1 }
    : { sweep: 0.3, causal: 0.3 };
  if (cashflowStress === 'corto') favor['bnpl-exposure'] = 0.5;
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
export function seedBanditState(existing, risk = 'bilanciato', cashflowStress = null) {
  const base = existing && existing.arms ? existing : { version: 1, arms: {} };
  const seed = banditSeed(risk, cashflowStress);
  const arms = { ...base.arms };
  for (const [key, val] of Object.entries(seed)) {
    if (!arms[key]) arms[key] = val; // non toccare i bracci già appresi
  }
  return { ...base, version: base.version || 1, arms };
}

// Cosa dice DAVVERO banditSeed() sopra, in una frase — per il payoff visibile
// dell'onboarding ("ogni risposta deve cambiare qualcosa di vero, non solo
// restare un dato salvato"). Stessa condizione, stessa soglia: se cambia
// banditSeed, questa frase smette di essere vera finché non si aggiorna
// insieme (nessuna descrizione scritta a mano e slegata dal codice che fa
// il lavoro).
export function testoConsiglio(risk = 'bilanciato') {
  const r = RISKS.has(risk) ? risk : 'bilanciato';
  if (r === 'conservativo') return 'I consigli partono orientati al risparmio automatico.';
  if (r === 'aggressivo') return 'I consigli partono orientati a ottimizzare dove spendi.';
  return 'I consigli restano equilibrati fra risparmio e ottimizzazione, finché non mostri una preferenza.';
}
