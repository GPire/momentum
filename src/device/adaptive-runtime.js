// ============================================================
// ADAPTIVE RUNTIME — sparse-MoE + self-tuning al dispositivo
// ============================================================
// Il layer trasversale che rende ogni parte del "cervello" auto-ottimizzante
// in base a device / risorse / backend. Onestà (regola #1): NON dà più risorse
// di quelle fisiche ("come se ne avesse 25x" è impossibile — vedi
// V6_ASSESSMENT.md). Fa tre cose reali e potenti:
//   1) SPARSE: su un input attiva solo gli esperti NECESSARI, e su device
//      deboli ne rende disponibili di meno (meno calcolo, mai crash).
//   2) SELF-TUNING: dal profilo MISURATO (κ, backend, RAM, core) sceglie tier,
//      precisione (int8/fp32), profondità, worker — e si RI-TARA se rallenta.
//   3) GRACEFUL DEGRADATION: c'è sempre un percorso che gira (JS puro/offline).
// Costruito sopra compute-planner.js (non lo duplica). Funzione pura.
'use strict';

import { planCompute } from './compute-planner.js';

// Budget di esperti per tier hardware = "sparsità strutturale": un device
// minimo attiva solo il gatekeeper; salendo di tier si sbloccano gli esperti
// più pesanti. La cascata (executive.js) resta quella, ma qui si dichiara
// QUANTI esperti sono al massimo attivabili.
export const EXPERT_BUDGET = {
  minimo: ['nano'],
  medio: ['nano', 'meso'],
  massimo: ['nano', 'meso', 'dcgn', 'sequence'],
};

// Piano d'esecuzione adattivo completo per l'inferenza del cervello.
export function adaptiveExecutionPlan(profile, opts = {}) {
  const base = planCompute(profile, opts);
  const tier = (profile && profile.tier) || 'minimo';
  const experts = (EXPERT_BUDGET[tier] || EXPERT_BUDGET.minimo).slice();
  return {
    tier,
    backend: base.backend,
    precision: base.precision,
    montecarloPaths: base.montecarloPaths,
    useWorker: base.useWorker,
    experts,                          // esperti ATTIVABILI (sparse budget)
    maxCascadeDepth: experts.length,  // limite duro alla cascata su questo device
    quantize: tier !== 'massimo',     // int8 (quantize.js) sotto il tier massimo
    explanation: `Tier ${tier}: fino a ${experts.length} esperti (${experts.join('→')}), backend ${base.backend.backend}, ${tier !== 'massimo' ? 'int8' : 'fp32'}.`,
  };
}

// Un esperto è attivabile solo se rientra nel budget del device (sparse).
export function canActivate(expert, plan) {
  return !!plan && Array.isArray(plan.experts) && plan.experts.includes(expert);
}

// SELF-TUNING reattivo: se la latenza osservata supera il target (throttling,
// batteria, device più debole del previsto), si RIDUCE il budget di esperti
// (più sparse) e si forza int8 — mai sotto il gatekeeper. Ri-tarabile ad ogni
// misura reale, senza inventare nulla sul chip.
export function retune(plan, observedMs, opts = {}) {
  const targetMs = opts.targetMs ?? 60;
  if (!plan || observedMs <= targetMs || plan.experts.length <= 1) {
    return { ...plan, retuned: false };
  }
  const experts = plan.experts.slice(0, -1); // togli l'esperto più pesante
  return {
    ...plan,
    experts,
    maxCascadeDepth: experts.length,
    quantize: true,
    retuned: true,
    explanation: `${plan.explanation} → rallentamento (${Math.round(observedMs)}ms > ${targetMs}): ridotto a ${experts.join('→')} + int8.`,
  };
}
