# Momentum federation SDK — pilot

This module is executable, transport-independent infrastructure for signed numerical
gradient contributions. It is not a production banking SDK or a privacy certification.
It does not send anything by itself, access a vault, enroll clients, charge users,
or replace the app's local models. The web app continues using public-probe distillation
when the user enables shared learning.

## Integration contract

1. The institution defines a manifest: `modelId`, `baseVersion`, unique `roundId`,
   `dimensions`, `clipNorm`, `minContributors` (at least 3), `maxContributors` (at most 100).
   `baseVersion` must identify the exact shared tensor ordering, architecture and baseline.
2. Train locally and calculate a real gradient using that baseline and tensor ordering.
3. Call `createGradientUpdate({ manifest, identity, gradient, consent: true })`.
   Explicit consent is required. The returned vector is clipped and signed with ECDSA P-256.
4. Send the returned object through the institution's authenticated, encrypted transport.
   Enroll public keys independently; never derive an allowlist from incoming messages.
5. Call `aggregateGradientRound({ manifest, trustedKeys, updates })`. It rejects unknown
   signers, tampering, wrong rounds/versions/shapes, extra fields, non-finite values,
   excessive norms and oversized batches. One key contributes at most once in a batch.
6. A quorum returns a coordinate-wise median gradient, clipped again. The caller applies
   it to a **candidate** model, evaluates a held-out dataset and every supported category,
   and promotes only after validation. Keep the baseline and rollback record.

The test `federation.test.js` includes a real linear-model gradient calculation across
three synthetic clients and verifies reduced loss on separate synthetic examples.
This is an integration demonstration, not measured banking-model accuracy.

## Required before a banking deployment

- Tenant isolation, enrollment/revocation, authenticated model manifests, key custody,
  durable round IDs and replay records across process restarts.
- Per-tenant training agreements, retention policy, consent management and release budgets.
- Secure aggregation and/or calibrated differential privacy with a privacy accountant,
  threat analysis and measurement of privacy/utility tradeoffs. **Clipping and signing
  do not make gradients anonymous.** The aggregator currently sees individual gradients.
- Transport-level payload caps before JSON parsing, authenticated sessions, rate limits,
  availability and recovery testing.
- Representative evaluation, canary promotion, persistent audit records and rollback.
- Multidimensional poisoning/collusion tests and independent security review. A median is
  robust to some outliers; it is not a guarantee against malicious or colluding participants.

No bank integrations, DP guarantees, independent identities or store-ready distribution
are claimed by this pilot. Raw private-model mesh synchronization remains closed by
default until session-bound authentication is integrated into the app.

## Dataset integration SDK — pilot

`src/sdk/datasets.js` adds a pure, transport-independent contract for historical numerical datasets. It is already called by `bench/fetch-ofr-stress.mjs`; it does not change Vault, the federation protocol, or app models.

```js
import { prepareScenarioDataset } from './datasets.js';
const dataset = {
  id: 'credit', source: 'my-verified-source', unit: 'index-points', frequency: 'daily',
  knowledgeBasis: 'point-in-time',
  observations: [
    { date: '2020-01-01', availableAt: '2020-01-02', value: -0.3 },
    { date: '2020-01-02', availableAt: '2020-01-03', value: 0.1 },
  ],
};
const result = prepareScenarioDataset([dataset], {
  asOf: '2020-01-03', purpose: 'backtest', minCommonDates: 2,
  policies: {
    credit: { source: 'my-verified-source', unit: 'index-points', frequency: 'daily',
      knowledgeBasis: 'point-in-time', allowedPurposes: ['backtest'] },
  },
});
// result.available === true; result.rows contains only dates shared by every input.
```

`prepareDataset` validates one series and reuses `macroVintageSnapshot` to select the latest known revision by cutoff. `prepareScenarioDataset` intersects actual observation dates and reports retained coverage per column. Frequencies must match; there is no interpolation, currency conversion, implicit lag correction, normalization or causal estimation. `asOf` is an end-of-day date, not an intraday timestamp. Monthly/annual rows must supply an explicit calendar date; use a dedicated temporal adapter when sources have different period labels or release calendars.

Trusted application policies bind source, unit, frequency, knowledge basis and allowed purpose. Do **not** construct policies from an incoming dataset. Supported purposes are research, backtest and training; the latter two require point-in-time inputs in this historical-financial contract. Revised snapshots are research-only. A caller can permit research without claiming the data is licensed for redistribution.

These checks do not authenticate an external party, prove a publisher's statements, establish a license, or grant commercial use. The integrating service still needs verified provider provenance, access controls, tenant isolation and storage/transport protections. This is not a production banking API or a deployed endpoint.

Limits: up to 100 input series; up to one million observations per input; minimum shared dates defaults to 30. Negative values and zero remain valid. Conflicting observations are excluded rather than silently selecting one. Model fitting, missingness analysis, revision histories with withdrawals, exchange calendars, freshness policies and train/test separation remain responsibilities of downstream pipelines.
