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
