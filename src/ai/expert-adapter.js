// ============================================================
// EXPERT ADAPTER — lo slot pluggable per un GRANDE modello futuro
// ============================================================
// Readiness PrismML/Aurora (richiesta esplicita: "magari in futuro metteremo
// un grande modello e dobbiamo essere pronti"). NON costruiamo un 27B qui —
// costruiamo il GANCIO perché, quando un modello compresso (es. PrismML-style
// via WebGPU/WebNN/WASM) sarà disponibile, si innesti nella cascata sparse-MoE
// come "heavy expert" senza toccare l'architettura. Onesto: è l'interfaccia,
// non il modello. Oggi lo slot è vuoto (available()=false) e non fa nulla.
// Funzioni pure/dichiarative. Requisiti hardware dichiarati → l'adaptive-runtime
// decide se attivarlo (solo tier alto con backend/RAM sufficienti).
'use strict';

// Un esperto uniforme: id, requisiti, disponibilità, predizione.
// requirements: { minRamGB, backend: 'webgpu'|'webnn'|'wasm'|'cpu', bytes }
export function makeExpert({ id, tier = 'massimo', requirements = {}, predictFn = null, isAvailable = null }) {
  return {
    id,
    tier,
    requirements,
    available(profile) {
      if (typeof isAvailable === 'function') return !!isAvailable(profile);
      if (!predictFn) return false; // slot vuoto → non disponibile (default onesto)
      if (!profile) return false;
      const ramOk = !requirements.minRamGB || (profile.memory ?? 0) >= requirements.minRamGB;
      const backendOk = !requirements.backend || requirements.backend === 'cpu'
        || (requirements.backend === 'webgpu' && profile.webgpu)
        || (requirements.backend === 'webnn' && profile.webnn)
        || (requirements.backend === 'wasm' && profile.simd);
      return ramOk && backendOk;
    },
    predict(text) {
      if (!predictFn) throw new Error(`Expert ${id}: slot vuoto (nessun modello caricato).`);
      return predictFn(text);
    },
  };
}

// Slot documentato per il grande modello futuro (oggi vuoto).
// Domani: makeExpert({ id:'prism-fin', tier:'massimo',
//   requirements:{ minRamGB:6, backend:'webgpu', bytes: 4e9 },
//   predictFn: (t)=> compressedModel.classify(t), isAvailable:(p)=>modelLoaded })
export const HEAVY_EXPERT_SLOT = makeExpert({ id: 'heavy-model', tier: 'massimo', requirements: { minRamGB: 6, backend: 'webgpu' } });

// Registro degli esperti pesanti opzionali. La cascata (adaptive-runtime)
// interroga available(profile) prima di attivarli.
export function activatableHeavyExperts(profile, experts = [HEAVY_EXPERT_SLOT]) {
  return experts.filter(e => e.available(profile));
}
