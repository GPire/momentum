// Only the public workload with a shipped executor is accepted. A catalog
// entry alone is not proof that another workload has an implementation.
export const MAX_COMPUTE_BATCH = 256;
export function validComputeRequest(workloadId, units) {
  if (workloadId !== 'montecarlo-strategie' || !Array.isArray(units) || !units.length || units.length > MAX_COMPUTE_BATCH) return false;
  const ids = new Set();
  return units.every(u => {
    if (!u || !Number.isSafeInteger(u.index) || u.index < 0 || ids.has(u.index)
      || !Number.isInteger(u.seed) || u.seed < 0 || u.seed > 0xffffffff
      || (u.workloadId !== undefined && u.workloadId !== workloadId)
      || Object.keys(u).some(key => !['index', 'seed', 'workloadId'].includes(key))) return false;
    ids.add(u.index); return true;
  });
}

export function validComputeReply(units, results) {
  return results !== null && typeof results === 'object' && !Array.isArray(results)
    && Object.keys(results).length === units.length
    && units.every(u => Object.hasOwn(results, u.index) && Number.isFinite(results[u.index]));
}

export async function executePublicUnits(workloadId, units, {
  shouldContinue = () => true, yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)),
} = {}) {
  if (!validComputeRequest(workloadId, units)) return null;
  const out = {};
  for (let i = 0; i < units.length; i++) {
    if (i % 16 === 0) { await yieldControl(); if (!shouldContinue()) return null; }
    let seed = units[i].seed >>> 0;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    let value = 1;
    for (let year = 0; year < 10; year++) {
      const u1 = Math.max(1e-12, rnd()), u2 = rnd();
      value *= 1.05 + 0.15 * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
    out[units[i].index] = +value.toFixed(6);
  }
  return out;
}
