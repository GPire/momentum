// Benchmark riproducibile dell'adaptive runtime — "npm run bench:adaptive".
// Mostra come lo stesso carico si auto-ottimizza su profili device diversi
// (sparse-MoE: meno esperti su hardware debole) e come il self-tuning reagisce
// al throttling. Regola #1: nessuna magia, solo il piano dedotto dalle capacità.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { adaptiveExecutionPlan, retune } = await import(pathToFileURL(join(root, 'src/device/adaptive-runtime.js')).href);

// Profili device simulati (come li vedrebbe profiler.js: capacità MISURATE).
const PROFILES = {
  'minimo (JS, 2 core, RAM bassa)': { tier: 'minimo', cores: 2, kappa: 0.4, lowMemory: true, forecastBudget: { paths: 500 } },
  'medio (SIMD, 4 core)':           { tier: 'medio', cores: 4, kappa: 1.0, simd: true, forecastBudget: { paths: 3000 } },
  'massimo (WebGPU, 8 core)':       { tier: 'massimo', cores: 8, kappa: 2.4, webgpu: true, forecastBudget: { paths: 10000 } },
};

const pad = (s, n) => String(s).padEnd(n);
console.log('\nMomentum adaptive runtime — stesso carico, auto-ottimizzato per device\n');
console.log(pad('Profilo device', 34) + pad('Esperti attivabili', 22) + pad('Backend', 10) + pad('Prec.', 7) + 'MC paths');
console.log('-'.repeat(88));
for (const [name, prof] of Object.entries(PROFILES)) {
  const p = adaptiveExecutionPlan(prof);
  console.log(pad(name, 34) + pad(p.experts.join('→'), 22) + pad(p.backend.backend, 10) + pad(p.quantize ? 'int8' : 'fp32', 7) + p.montecarloPaths.toLocaleString('it-IT'));
}

console.log('\nSparsità: su tier minimo si attiva solo il gatekeeper (Nano) → meno calcolo,');
console.log('mai crash; salendo di tier si sbloccano gli esperti pesanti (cascata completa).');

// Self-tuning reattivo: un device "massimo" che va in throttling si degrada da solo.
console.log('\nSelf-tuning sotto throttling (target 60ms), device massimo:');
let plan = adaptiveExecutionPlan(PROFILES['massimo (WebGPU, 8 core)']);
for (const latency of [40, 90, 130, 200]) {
  const r = retune(plan, latency, { targetMs: 60 });
  console.log(`  latenza ${pad(latency + 'ms', 7)} → esperti [${r.experts.join('→')}]${r.retuned ? ' (ridotto)' : ''}`);
  if (r.retuned) plan = r; // la degradazione si accumula finché non rientra
}
console.log('\nRegola: numeri/piani riproducibili. L\'AI si plasma sul device; non moltiplica le risorse.');
