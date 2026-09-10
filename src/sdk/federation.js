// Transport-independent pilot SDK. Raw numerical gradients require explicit consent.
// Clipping/signatures limit impact and authenticate origin; they do not provide
// differential privacy, secure aggregation, or protection against colluding signers.
import { signChallenge, verifyChallenge } from '../mesh/device-trust.js';

const FORMAT = 'momentum-gradient-v1';
const FIELDS = ['format', 'modelId', 'baseVersion', 'roundId', 'contributorKey', 'gradient', 'signature'];
const id = value => typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,128}$/.test(value);

function checkManifest(m) {
  if (!m || ![m.modelId, m.baseVersion, m.roundId].every(id)
    || !Number.isInteger(m.dimensions) || m.dimensions < 1 || m.dimensions > 65536
    || !Number.isFinite(m.clipNorm) || m.clipNorm <= 0 || m.clipNorm > 1e6
    || !Number.isInteger(m.minContributors) || m.minContributors < 3
    || !Number.isInteger(m.maxContributors) || m.maxContributors < m.minContributors || m.maxContributors > 100) {
    throw new TypeError('Invalid federation manifest');
  }
}

function vector(value, dimensions) {
  return Array.isArray(value) && value.length === dimensions && value.every(Number.isFinite);
}

function norm(values) {
  // Stable for large finite values; no argument spreading for large tensors.
  const largest = values.reduce((max, x) => Math.max(max, Math.abs(x)), 0);
  return largest ? largest * Math.sqrt(values.reduce((sum, x) => sum + (x / largest) ** 2, 0)) : 0;
}

function clipped(values, bound) {
  const largest = values.reduce((max, x) => Math.max(max, Math.abs(x)), 0);
  if (!largest) return [...values];
  const scaledNorm = Math.sqrt(values.reduce((sum, x) => sum + (x / largest) ** 2, 0));
  return largest <= bound / scaledNorm ? [...values] : values.map(x => (x / largest) * (bound / scaledNorm));
}

// Canonical envelope binds the identity, exact tensor layout/version and round.
const signingText = m => JSON.stringify([m.format, m.modelId, m.baseVersion, m.roundId, m.contributorKey, m.gradient]);

export async function createGradientUpdate({ manifest, identity, gradient, consent = false }) {
  checkManifest(manifest);
  if (consent !== true) throw new Error('Explicit gradient-sharing consent required');
  if (!identity?.privateKey || !identity?.publicKey || !vector(gradient, manifest.dimensions)) throw new TypeError('Invalid identity or gradient');
  const message = {
    format: FORMAT, modelId: manifest.modelId, baseVersion: manifest.baseVersion,
    roundId: manifest.roundId, contributorKey: identity.publicKey,
    gradient: clipped(gradient, manifest.clipNorm),
  };
  message.signature = await signChallenge(identity.privateKey, signingText(message));
  return message;
}

export async function aggregateGradientRound({ manifest, trustedKeys, updates }) {
  checkManifest(manifest);
  if (!Array.isArray(trustedKeys) || !Array.isArray(updates) || updates.length > manifest.maxContributors) throw new TypeError('Invalid or oversized round');
  // Keys must be enrolled independently (e.g. bank tenant registry), never learned
  // from incoming messages. A network peer ID alone is not an identity.
  const trusted = new Set(trustedKeys);
  const seen = new Set();
  const valid = [];
  for (const update of updates) {
    if (!update || Object.keys(update).length !== FIELDS.length || FIELDS.some(k => !Object.hasOwn(update, k))
      || update.format !== FORMAT || update.modelId !== manifest.modelId
      || update.baseVersion !== manifest.baseVersion || update.roundId !== manifest.roundId
      || !trusted.has(update.contributorKey) || seen.has(update.contributorKey)
      || !vector(update.gradient, manifest.dimensions) || norm(update.gradient) > manifest.clipNorm * (1 + 1e-9)
      || typeof update.signature !== 'string' || update.signature.length > 128) continue;
    // Snapshot before asynchronous verification so caller mutation cannot replace a
    // gradient between verifying its signature and aggregating it.
    const candidate = { ...update, gradient: [...update.gradient] };
    if (!await verifyChallenge(candidate.contributorKey, signingText(candidate), candidate.signature)) continue;
    seen.add(candidate.contributorKey);
    valid.push(candidate.gradient);
  }
  if (valid.length < manifest.minContributors) return { accepted: false, reason: 'quorum', contributors: valid.length };
  const median = Array.from({ length: manifest.dimensions }, (_, i) => {
    const sorted = valid.map(v => v[i]).sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  });
  return { accepted: true, contributors: valid.length, modelId: manifest.modelId, baseVersion: manifest.baseVersion, roundId: manifest.roundId, gradient: clipped(median, manifest.clipNorm) };
}
