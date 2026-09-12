// Fixed synthetic data-generating processes, not real user data or proof of identification.
import { olsWithSE } from '../src/predict/causal-effects.js';
import { writeFileSync } from 'node:fs';

function random(seed) {
  let state = seed >>> 0;
  const uniform = () => ((state = (1664525 * state + 1013904223) >>> 0) + 1) / 4294967297;
  return () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
}
const repetitions = 200, results = [];
for (const n of [52, 260]) {
  for (const scenario of ['null', 'direct', 'serial-noise', 'observed-confounder', 'hidden-confounder']) {
    const metrics = { classicCovered: 0, guardedCovered: 0, classicZeroExcluded: 0, guardedZeroExcluded: 0, bias: 0, fitted: 0 };
    const truth = scenario === 'null' || scenario.includes('confounder') ? 0 : 0.8;
    for (let seed = 1; seed <= repetitions; seed++) {
      const gaussian = random(seed), x = [], y = [], u = [];
      let noise = 0;
      for (let i = 0; i < n + 100; i++) {
        const common = gaussian(), predictor = (scenario.includes('confounder') ? common : 0) + gaussian();
        noise = (scenario === 'serial-noise' ? 0.8 : 0) * noise + gaussian();
        if (i < 100) continue;
        x.push(predictor); u.push(common);
        y.push(truth * predictor + (scenario.includes('confounder') ? common : 0) + noise);
      }
      const fit = olsWithSE(y, scenario === 'observed-confounder' ? [x, u] : [x]);
      if (!fit) continue;
      metrics.fitted++; metrics.bias += fit.beta[1] - truth;
      for (const [key, se] of [['classic', fit.se[1]], ['guarded', Math.max(fit.se[1], fit.seHac[1])]]) {
        if (Math.abs(fit.beta[1] - truth) <= 1.96 * se) metrics[`${key}Covered`]++;
        if (Math.abs(fit.beta[1]) > 1.96 * se) metrics[`${key}ZeroExcluded`]++;
      }
    }
    results.push({ n, scenario, truth, ...metrics, meanBias: metrics.bias / metrics.fitted,
      classicCoverage: metrics.classicCovered / metrics.fitted, guardedCoverage: metrics.guardedCovered / metrics.fitted });
  }
}
const report = { repetitions, results, limitations: ['synthetic-data', 'known-adjustment-set-except-hidden-confounder',
  'not-a-discovery-benchmark', 'normal-intervals-not-exact-small-sample', 'no-competitor-comparison', 'seeds-fixed-no-hyperparameter-selection'] };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
console.table(results.map(({ n, scenario, classicCoverage, guardedCoverage, meanBias }) => ({ n, scenario, classicCoverage, guardedCoverage, meanBias })));
