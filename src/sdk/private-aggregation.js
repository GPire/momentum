// Apprendimento collettivo senza dati personali.
// 1) Privacy differenziale, meccanismo gaussiano: ogni dispositivo taglia il
//    proprio aggiornamento a norma C e aggiunge rumore N(0, (z·C)²) con
//    casualità crittografica. Garanzia per singolo aggiornamento:
//    ε = sqrt(2·ln(1.25/δ)) / z (Dwork & Roth, Teorema A.1, valida per ε ≤ 1;
//    oltre è dichiarata come stima, mai come prova).
// 2) Aggregazione sicura a maschere accoppiate (Bonawitz et al., CCS 2017,
//    senza recupero dei partecipanti caduti): ogni coppia deriva un segreto
//    ECDH, ne ricava una maschera; uno la somma, l'altro la sottrae. Nella
//    somma le maschere si annullano esattamente (aritmetica intera mod 2^32):
//    l'aggregatore vede solo il totale. Se un partecipante previsto manca, il
//    totale è inutilizzabile e il round si scarta (limite dichiarato).
'use strict';

const subtle = () => globalThis.crypto.subtle;

function uniformOpen() {
  const u = new Uint32Array(1);
  do { crypto.getRandomValues(u); } while (u[0] === 0);
  return u[0] / 2 ** 32;
}

export function gaussianNoise(sigma) {
  // Box-Muller con numeri da crypto.getRandomValues: il rumore di privacy non
  // deve mai venire da Math.random, prevedibile.
  return sigma * Math.sqrt(-2 * Math.log(uniformOpen())) * Math.cos(2 * Math.PI * uniformOpen());
}

export function gaussianEpsilon(noiseMultiplier, delta) {
  if (!(noiseMultiplier > 0) || !(delta > 0 && delta < 1)) throw new RangeError('invalid dp parameters');
  const epsilon = Math.sqrt(2 * Math.log(1.25 / delta)) / noiseMultiplier;
  return { epsilon, delta, proven: epsilon <= 1 };
}

export function privatize(clippedGradient, clipNorm, noiseMultiplier) {
  const sigma = clipNorm * noiseMultiplier;
  return clippedGradient.map((x) => x + gaussianNoise(sigma));
}

// ── Aggregazione sicura ─────────────────────────────────────────
export const SECURE_SCALE = 2 ** 16;

export async function generateMaskingKeys() {
  const pair = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const publicRaw = new Uint8Array(await subtle().exportKey('raw', pair.publicKey));
  return { privateKey: pair.privateKey, publicRaw };
}

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

async function pairMask(privateKey, theirPublicRaw, roundId, dimensions) {
  const theirs = await subtle().importKey('raw', theirPublicRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = await subtle().deriveBits({ name: 'ECDH', public: theirs }, privateKey, 256);
  const hkdfKey = await subtle().importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  const aes = await subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('momentum-secure-aggregation-v1'), info: new TextEncoder().encode(String(roundId)) },
    hkdfKey, { name: 'AES-CTR', length: 256 }, false, ['encrypt'],
  );
  const stream = await subtle().encrypt({ name: 'AES-CTR', counter: new Uint8Array(16), length: 64 }, aes, new Uint8Array(dimensions * 4));
  return new Uint32Array(stream);
}

export function quantize(values, scale = SECURE_SCALE) {
  return Uint32Array.from(values, (x) => Math.round(x * scale) >>> 0);
}

export async function maskUpdate({ values, keys, peers, roundId, scale = SECURE_SCALE }) {
  const out = quantize(values, scale);
  const mio = hex(keys.publicRaw);
  for (const peer of peers) {
    const loro = hex(peer.publicRaw);
    if (loro === mio) continue;
    const mask = await pairMask(keys.privateKey, peer.publicRaw, roundId, out.length);
    const somma = mio < loro;
    for (let i = 0; i < out.length; i++) out[i] = (somma ? out[i] + mask[i] : out[i] - mask[i]) >>> 0;
  }
  return Array.from(out);
}

// Somma sicura: servono esattamente tutti i partecipanti previsti.
export function secureSum(maskedUpdates, { expected, scale = SECURE_SCALE }) {
  if (!Array.isArray(maskedUpdates) || maskedUpdates.length !== expected || expected < 3) return { ok: false, reason: 'partecipanti' };
  const dims = maskedUpdates[0].length;
  if (!maskedUpdates.every((u) => Array.isArray(u) && u.length === dims)) return { ok: false, reason: 'dimensioni' };
  const acc = new Uint32Array(dims);
  for (const u of maskedUpdates) for (let i = 0; i < dims; i++) acc[i] = (acc[i] + (u[i] >>> 0)) >>> 0;
  return { ok: true, sum: Array.from(acc, (x) => (x | 0) / scale) };
}
