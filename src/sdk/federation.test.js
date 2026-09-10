import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity } from '../mesh/device-trust.js';
import { createGradientUpdate, aggregateGradientRound } from './federation.js';

const manifest = { modelId: 'linear-demo', baseVersion: 'v1', roundId: 'round-1', dimensions: 2, clipNorm: 1, minContributors: 3, maxContributors: 20 };
const identities = await Promise.all(Array.from({ length: 4 }, generateIdentity));
const trustedKeys = identities.map(i => i.publicKey);
const make = (i, gradient = [0.3, -0.4], config = manifest) => createGradientUpdate({ manifest: config, identity: identities[i], gradient, consent: true });

test('gradient SDK requires consent and emits only a signed numerical update', async () => {
  await assert.rejects(createGradientUpdate({ manifest, identity: identities[0], gradient: [1, 2] }), /consent/i);
  const message = await make(0, [3, 4]);
  assert.deepEqual(Object.keys(message).sort(), ['baseVersion', 'contributorKey', 'format', 'gradient', 'modelId', 'roundId', 'signature'].sort());
  assert.ok(Math.abs(Math.hypot(...message.gradient) - 1) < 1e-9);
  assert.ok(Math.abs(message.gradient[0] - 0.6) < 1e-9);
});

test('gradient SDK: authenticated distinct contributors form a bounded median update', async () => {
  const updates = await Promise.all([make(0), make(1), make(2, [-100, 100])]);
  const result = await aggregateGradientRound({ manifest, trustedKeys, updates });
  assert.equal(result.accepted, true);
  assert.equal(result.contributors, 3);
  assert.deepEqual(result.gradient, [0.3, -0.4]);
});

test('gradient SDK: no quorum from replay, unregistered key, modified signature or another round', async () => {
  const good = await make(0);
  const changed = { ...await make(1), gradient: [0, 0] };
  const otherRound = await make(2, [0.3, -0.4], { ...manifest, roundId: 'round-2' });
  const result = await aggregateGradientRound({ manifest, trustedKeys: trustedKeys.slice(0, 3), updates: [good, good, changed, otherRound, await make(3)] });
  assert.equal(result.accepted, false);
  assert.equal(result.contributors, 1);
  assert.equal(result.gradient, undefined);
});

test('gradient SDK rejects invalid dimensions, non-finite values, extra fields and unbounded rounds', async () => {
  for (const gradient of [[1], [NaN, 0], [Infinity, 0]]) await assert.rejects(make(0, gradient));
  const update = { ...await make(0), transactions: [{ amount: 10 }] };
  assert.equal((await aggregateGradientRound({ manifest, trustedKeys, updates: [update] })).contributors, 0);
  await assert.rejects(aggregateGradientRound({ manifest: { ...manifest, minContributors: 1 }, trustedKeys, updates: [] }));
  await assert.rejects(aggregateGradientRound({ manifest, trustedKeys, updates: Array(21).fill(update) }));
});

test('real numerical gradients from three synthetic clients improve held-out squared error', async () => {
  // A small executable integration example, not a benchmark on banking data.
  const base = [0, 0];
  const trainingX = [1, 2, 3];
  const updates = await Promise.all(trainingX.map((x, i) => {
    const error = base[0] * x + base[1] - (2 * x + 1);
    return make(i, [2 * error * x, 2 * error]);
  }));
  const round = await aggregateGradientRound({ manifest, trustedKeys, updates });
  const candidate = base.map((w, i) => w - 0.1 * round.gradient[i]);
  const loss = weights => [4, 5].reduce((sum, x) => sum + (weights[0] * x + weights[1] - (2 * x + 1)) ** 2, 0) / 2;
  assert.equal(round.accepted, true);
  assert.ok(loss(candidate) < loss(base));
  assert.deepEqual(base, [0, 0], 'Aggregation must not silently promote a model');
});
