// Transport-independent pilot SDK. Raw numerical gradients require explicit consent.
// Clipping/signatures limit impact and authenticate origin. When the manifest
// declares `dp: { noiseMultiplier, delta }` each update is also privatized on the
// device (Gaussian mechanism, see private-aggregation.js); secure aggregation of
// sums is in private-aggregation.js. Colluding signers are still not handled.
import { signChallenge, verifyChallenge } from '../mesh/device-trust.js';
import { privatize, gaussianEpsilon } from './private-aggregation.js';

const FORMAT = 'momentum-gradient-v1';
const FIELDS = ['format', 'modelId', 'baseVersion', 'roundId', 'contributorKey', 'gradient', 'signature'];
const id = value => typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,128}$/.test(value);

function checkManifest(m) {
  if (!m || ![m.modelId, m.baseVersion, m.roundId].every(id)
    || !Number.isInteger(m.dimensions) || m.dimensions < 1 || m.dimensions > 65536
    || !Number.isFinite(m.clipNorm) || m.clipNorm <= 0 || m.clipNorm > 1e6
    || !Number.isInteger(m.minContributors) || m.minContributors < 3
    || !Number.isInteger(m.maxContributors) || m.maxContributors < m.minContributors || m.maxContributors > 100
    || (m.dp !== undefined && !(m.dp?.noiseMultiplier > 0 && m.dp?.delta > 0 && m.dp?.delta < 1))) {
    throw new TypeError('Invalid federation manifest');
  }
}

// Garanzia dichiarata del round, mai implicita.
export function roundPrivacy(manifest) {
  checkManifest(manifest);
  return manifest.dp ? gaussianEpsilon(manifest.dp.noiseMultiplier, manifest.dp.delta) : null;
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
  // Il rumore si aggiunge DOPO il taglio e PRIMA della firma: il gradiente vero
  // non lascia mai il dispositivo. Il risultato si ritaglia per restare nei limiti
  // controllati dall'aggregatore.
  if (manifest.dp) message.gradient = clipped(privatize(message.gradient, manifest.clipNorm, manifest.dp.noiseMultiplier), manifest.clipNorm);
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
