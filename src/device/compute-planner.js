// Pianificatore di calcolo adattivo (Adaptive Compute Engine).
// Traduce il profilo hardware REALE rilevato (device/profiler.js: κ dal
// micro-benchmark + WebGPU/WebNN/SIMD/RAM/core) in un PIANO D'ESECUZIONE
// concreto per ogni tipo di lavoro dell'app. Non promette "25x" — quello
// è fisicamente impossibile: promette di usare al meglio ciò che c'è,
// e di degradare con grazia (mai crash, mai freeze) su hardware debole.
//
// Onestà su cosa una PWA può DAVVERO vedere del dispositivo (verificato):
// - Sì: numero di core logici (hardwareConcurrency), RAM approssimata
//   (deviceMemory, solo Chromium), presenza di WebGPU/WebNN/WASM-SIMD,
//   se è fallback software, ops/ms misurate da un benchmark reale.
// - No: modello esatto di CPU/GPU/NPU/TPU, se è Metal o Vulkan sotto,
//   frequenza, cache, tipo di RAM. Nessuna API web li espone. Chi dice
//   di rilevarli sta inventando un dato — e questo progetto non lo fa.
// Il piano è quindi basato su CAPACITÀ misurate, non su nomi di chip.

// Backend di inferenza preferito, dal più capace al fallback universale.
// WebGPU sfrutta la GPU (Metal su Apple, Vulkan/DX su altri: il browser
// sceglie, noi non dobbiamo saperlo); WebNN l'acceleratore neurale (NPU)
// quando c'è; WASM-SIMD la CPU vettoriale; poi JS puro ovunque.
export function planInferenceBackend(profile) {
  if (profile.webgpu && !profile.webgpuFallback) {
    return { backend: 'webgpu', reason: 'GPU disponibile via WebGPU (Metal/Vulkan gestiti dal browser)', accelerated: true };
  }
  if (profile.webnn) {
    return { backend: 'webnn', reason: 'acceleratore neurale (NPU) via WebNN', accelerated: true };
  }
  if (profile.simd) {
    return { backend: 'wasm-simd', reason: 'CPU vettoriale via WASM SIMD', accelerated: true };
  }
  return { backend: 'js', reason: 'JavaScript puro: massima compatibilità', accelerated: false };
}

// Piano completo: cosa fare, con quanta profondità, dove.
// `intensity` è opzionale (dal dispatcher novelty): un evento di routine
// non merita il percorso pesante anche su hardware potente — risparmio
// batteria reale, non solo capacità.
export function planCompute(profile, opts = {}) {
  if (!profile) {
    // Nessun profilo (primissimo boot): piano prudente ma funzionante.
    return {
      backend: { backend: 'js', reason: 'profilo non ancora pronto', accelerated: false },
      montecarloPaths: 500, useWorker: false, modelTier: 'nano',
      precision: 'fp32', enable3D: false, retrainEveryTx: 3,
      note: 'piano di sicurezza: si affina dopo il primo benchmark',
    };
  }

  const backend = planInferenceBackend(profile);
  const heavy = opts.intensity === 'heavy' || opts.intensity === undefined;

  // Un core in più = un worker in più che ha senso usare senza contendere
  // il thread UI. Sotto 4 core, il worker resta ma senza parallelismo spinto.
  const useWorker = (profile.cores || 2) >= 2;

  // Profondità Monte Carlo: parte dal budget del profiler (già κ-scalato),
  // ridotta se l'evento non è significativo (dispatcher) o su RAM bassa.
  let montecarloPaths = profile.forecastBudget?.paths ?? 500;
  if (!heavy) montecarloPaths = Math.min(montecarloPaths, 1000);
  if (profile.lowMemory) montecarloPaths = Math.min(montecarloPaths, 2000);

  // Il modello di categorizzazione più pesante (Meso, ~400KB) solo se il
  // dispositivo non è nel tier minimo — coerente con main.js.
  const modelTier = profile.tier === 'minimo' ? 'nano' : 'meso';

  // Precisione: su GPU/NPU fp16 è più veloce e sufficiente per la
  // categorizzazione; su CPU/JS si resta fp32 (nessun vantaggio da fp16
  // in JS, che non ha half-float nativo nei loop caldi).
  const precision = backend.accelerated && backend.backend !== 'wasm-simd' ? 'fp16' : 'fp32';

  return {
    backend,
    montecarloPaths,
    useWorker,
    modelTier,
    precision,
    enable3D: profile.enable3D,
    retrainEveryTx: profile.retrainEveryTx,
    tier: profile.tier,
    note: `piano adattivo su κ=${profile.kappa}, ${profile.cores} core, backend ${backend.backend}`,
  };
}

// Riepilogo leggibile per la UI (Momentum Vault): dice all'utente, in
// parole semplici, come l'app sta usando il suo dispositivo.
export function describePlan(plan) {
  if (!plan) return 'Sto ancora misurando il tuo dispositivo…';
  const engine = {
    webgpu: 'la scheda grafica (GPU)',
    webnn: "l'acceleratore AI del dispositivo",
    'wasm-simd': 'il processore in modo vettoriale',
    js: 'il processore',
  }[plan.backend.backend] || 'il processore';
  const potenza = plan.tier === 'massimo' ? 'al massimo' : plan.tier === 'medio' ? 'in modo bilanciato' : 'in modo leggero, per non scaricare la batteria';
  return `Momentum sta usando ${engine} ${potenza}. Calcoli di previsione: ${plan.montecarloPaths.toLocaleString('it-IT')} simulazioni.`;
}
