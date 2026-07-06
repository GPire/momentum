// ============================================================
// DEVICE PROFILER — adattamento onesto all'hardware reale.
// Nessuna "NPU virtuale", nessuna promessa su hardware che il
// browser non supporta: un micro-benchmark misurato + i segnali
// che il browser espone davvero (deviceMemory, hardwareConcurrency),
// tradotti in budget di calcolo concreti che l'app rispetta.
// ============================================================
import { DurableStore } from '../core/vault.js';

// Rilevamento capacità reali del browser. Nessuna di queste funzioni
// identifica UN acceleratore specifico (niente "è una NPU Apple" o "è una
// TPU"): il browser non espone quell'informazione a nessuna API web, quindi
// fingere di leggerla sarebbe un dato inventato. Si rileva solo la presenza
// di una via di esecuzione più veloce della CPU scalare, in modo binario.
async function detectWebGPU() {
  if (!('gpu' in navigator)) return { available: false };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { available: false };
    return { available: true, isFallback: !!adapter.isFallbackAdapter };
  } catch {
    return { available: false };
  }
}

// WebNN (navigator.ml): API ancora sperimentale a metà 2026, dietro flag su
// molti browser. Se presente ci dice solo "esiste un context ML", non quale
// hardware lo esegue davvero — il backend è scelto dal sistema operativo.
async function detectWebNN() {
  if (!('ml' in navigator)) return { available: false };
  try {
    await navigator.ml.createContext();
    return { available: true };
  } catch {
    return { available: false };
  }
}

// WASM SIMD: test reale, non un flag di feature-detection statico — prova a
// validare un modulo WASM minimo che usa un'istruzione SIMD (v128.const).
function detectWasmSimd() {
  try {
    return WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0,
      10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
    ]));
  } catch {
    return false;
  }
}

// Micro-benchmark: moltiplicazione matrice-vettore in Float64Array,
// stessa classe di operazioni del Monte Carlo e della rete neurale.
// Ritorna operazioni/ms misurate (numero reale, non stima).
function benchmarkOpsPerMs(budgetMs = 40) {
  const dim = 64;
  const mat = new Float64Array(dim * dim);
  const vec = new Float64Array(dim);
  const out = new Float64Array(dim);
  for (let i = 0; i < mat.length; i++) mat[i] = Math.random();
  for (let i = 0; i < dim; i++) vec[i] = Math.random();
  const t0 = performance.now();
  let rounds = 0;
  while (performance.now() - t0 < budgetMs) {
    for (let r = 0; r < dim; r++) {
      let s = 0;
      const off = r * dim;
      for (let c = 0; c < dim; c++) s += mat[off + c] * vec[c];
      out[r] = s;
    }
    rounds++;
  }
  const elapsed = performance.now() - t0;
  return Math.round((rounds * dim * dim) / elapsed); // moltiplicazioni/ms
}

// Traduce le misure in budget concreti. Le soglie sono dichiarate
// e modificabili, non nascoste: ~2M ops/ms è un laptop moderno,
// ~200k ops/ms un mobile di fascia bassa.
// `caps` = capacità rilevate da detectWebGPU/detectWebNN/detectWasmSimd:
// contribuiscono a κ come bonus limitato, MAI come sostituto del benchmark
// misurato (una GPU presente ma bloccata da un driver scarso non aiuta
// davvero — per questo il bonus è piccolo, non un moltiplicatore).
function computeProfile(opsPerMs, caps = {}) {
  const memory = navigator.deviceMemory || null;        // GB, solo Chrome/Edge
  const cores = navigator.hardwareConcurrency || 2;
  const { webgpu = { available: false }, webnn = { available: false }, simd = false, threaded = false } = caps;

  // κ base dal benchmark reale, su scala logaritmica
  let kappa = Math.min(1, Math.max(0, (Math.log10(opsPerMs) - 4.5) / 2)); // 30k→0, 3M→1
  // bonus capati: presenza di una via di esecuzione più veloce della CPU
  // scalare, non prova che verrà usata in modo efficiente per ogni task.
  if (webgpu.available && !webgpu.isFallback) kappa = Math.min(1, kappa + 0.15);
  if (webnn.available) kappa = Math.min(1, kappa + 0.1);
  if (simd) kappa = Math.min(1, kappa + 0.05);

  const lowMemory = memory !== null && memory <= 2;
  return {
    opsPerMs, memory, cores, kappa: +kappa.toFixed(3), lowMemory,
    webgpu: webgpu.available, webgpuFallback: !!webgpu.isFallback,
    webnn: webnn.available, simd, threaded,
    measuredAt: Date.now(),
    // budget concreti usati dall'app:
    forecastBudget: {
      paths: Math.round(500 + kappa * 9500),          // Monte Carlo spese: 500 → 10.000
      capitalTrials: Math.round(500 + kappa * 3500),  // Monte Carlo capitale: 500 → 4.000
    },
    // soglia bassa di proposito: il benchmark gira durante il boot (CPU
    // contesa dal parsing/rendering) e sottostima anche di 3-5x — misurato
    // κ≈0.27 su un Mac Apple Silicon. Sotto 0.1 il dispositivo è debole davvero.
    enable3D: kappa > 0.1 && !lowMemory,
    retrainEveryTx: kappa > 0.5 ? 1 : 3,              // rete locale: ogni tx o ogni 3
    // tier discreto per il dispatcher (§3.1 del documento architetturale):
    // decide SOLO la profondità di calcolo aggiuntiva (Monte Carlo, GARCH),
    // mai la correttezza del risultato base — quella è identica su ogni tier.
    tier: kappa > 0.7 ? 'massimo' : kappa >= 0.3 ? 'medio' : 'minimo',
  };
}

async function initDeviceProfile() {
  // riusa il profilo persistito se recente (<24h): il benchmark costa ~40ms
  try {
    const cached = await DurableStore.get('state', 'device_profile');
    if (cached && Date.now() - cached.measuredAt < 864e5) {
      window.momentumDeviceProfile = cached;
      return cached;
    }
  } catch {}
  const [webgpu, webnn] = await Promise.all([detectWebGPU(), detectWebNN()]);
  const caps = { webgpu, webnn, simd: detectWasmSimd(), threaded: typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated };
  const profile = computeProfile(benchmarkOpsPerMs(), caps);
  window.momentumDeviceProfile = profile;
  try { await DurableStore.put('state', profile, 'device_profile'); } catch {}
  console.log(`Device profile: ${profile.opsPerMs} ops/ms, κ=${profile.kappa} (tier ${profile.tier}), webgpu=${profile.webgpu}, webnn=${profile.webnn}, simd=${profile.simd}, MC paths=${profile.forecastBudget.paths}`);
  return profile;
}

export { initDeviceProfile, benchmarkOpsPerMs, computeProfile, detectWebGPU, detectWebNN, detectWasmSimd };
