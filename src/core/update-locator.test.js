import test from 'node:test';
import assert from 'node:assert/strict';
const { compareVersions, canonicalMessage, makeEcdsaVerifier, resolveUpdate, pickBestManifest } = await import('./update-locator.js');

const subtle = globalThis.crypto.subtle;
const bytesToB64 = (u8) => Buffer.from(u8).toString('base64');

// Firma un manifest con la chiave privata (come farebbe lo sviluppatore al rilascio).
async function signManifest(privateKey, mf) {
  const data = new TextEncoder().encode(canonicalMessage(mf));
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, data);
  return { ...mf, sig: bytesToB64(new Uint8Array(sig)) };
}

async function setup() {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pubJwk = await subtle.exportKey('jwk', kp.publicKey);
  return { kp, verify: makeEcdsaVerifier(pubJwk) };
}

test('compareVersions: semver-lite corretto', () => {
  assert.ok(compareVersions('50.2.0', '50.1.9') > 0);
  assert.ok(compareVersions('50.1.0', '50.1.0') === 0);
  assert.ok(compareVersions('49.9.9', '50.0.0') < 0);
});

test('firma ECDSA reale: manifest firmato valido → accettato; manomesso → rifiutato', async () => {
  const { kp, verify } = await setup();
  const mf = await signManifest(kp.privateKey, { version: '50.2.0', url: 'https://a/app.js', sha256: 'abc' });
  assert.equal(await verify(mf), true);
  // manomissione dell'url (redirect ostile) → firma non valida
  assert.equal(await verify({ ...mf, url: 'https://evil/app.js' }), false);
  // firma assente
  assert.equal(await verify({ version: '50.2.0', url: 'x', sha256: 'y' }), false);
});

test('resolveUpdate: faro con manifest firmato piu\' recente → trovato', async () => {
  const { kp, verify } = await setup();
  const mf = await signManifest(kp.privateKey, { version: '50.2.0', url: 'https://cdn2/app.js', sha256: 'h' });
  const fetchImpl = async () => ({ ok: true, json: async () => mf });
  const r = await resolveUpdate({ beacons: ['https://faro1'], fetchImpl, verifyImpl: verify, currentVersion: '50.1.0' });
  assert.equal(r.found, true);
  assert.equal(r.manifest.version, '50.2.0');
});

test('resolveUpdate: ANTI-DOWNGRADE — versione piu\' vecchia firmata → NON adottata', async () => {
  const { kp, verify } = await setup();
  const old = await signManifest(kp.privateKey, { version: '49.0.0', url: 'x', sha256: 'h' });
  const fetchImpl = async () => ({ ok: true, json: async () => old });
  const r = await resolveUpdate({ beacons: ['https://faro'], fetchImpl, verifyImpl: verify, currentVersion: '50.1.0' });
  assert.equal(r.found, false);
});

test('resolveUpdate: ANTI-INIEZIONE — versione altissima ma firma FALSA → scartata', async () => {
  const { verify } = await setup();
  const fake = { version: '99.0.0', url: 'https://evil/app.js', sha256: 'h', sig: 'ZmFrZQ==' }; // firma non valida
  const fetchImpl = async () => ({ ok: true, json: async () => fake });
  const r = await resolveUpdate({ beacons: ['https://evil'], fetchImpl, verifyImpl: verify, currentVersion: '50.1.0' });
  assert.equal(r.found, false, 'un update non firmato non passa mai, anche se piu\' recente');
});

test('resolveUpdate: FALLBACK — primo faro morto, secondo vivo → trovato', async () => {
  const { kp, verify } = await setup();
  const mf = await signManifest(kp.privateKey, { version: '50.3.0', url: 'x', sha256: 'h' });
  let call = 0;
  const fetchImpl = async () => { call++; if (call === 1) throw new Error('DNS fail'); return { ok: true, json: async () => mf }; };
  const r = await resolveUpdate({ beacons: ['https://morto', 'https://vivo'], fetchImpl, verifyImpl: verify, currentVersion: '50.1.0' });
  assert.equal(r.found, true);
  assert.equal(r.manifest.version, '50.3.0');
});

test('resolveUpdate: GOSSIP MESH — nessun faro raggiungibile, ma un peer conosce l\'indirizzo → trovato', async () => {
  const { kp, verify } = await setup();
  const peerMf = await signManifest(kp.privateKey, { version: '50.4.0', url: 'https://nuovo-dominio/app.js', sha256: 'h' });
  const fetchImpl = async () => { throw new Error('tutti i domini cambiati/morti'); };
  const r = await resolveUpdate({ beacons: ['https://morto1', 'https://morto2'], fetchImpl, verifyImpl: verify, currentVersion: '50.1.0', peerManifests: [peerMf] });
  assert.equal(r.found, true);
  assert.equal(r.manifest.version, '50.4.0'); // trovato via peer, senza server
});

test('resolveUpdate: niente di raggiungibile e nessun peer → found:false onesto', async () => {
  const { verify } = await setup();
  const fetchImpl = async () => { throw new Error('offline'); };
  const r = await resolveUpdate({ beacons: ['https://x'], fetchImpl, verifyImpl: verify, currentVersion: '50.1.0' });
  assert.equal(r.found, false);
});

test('pickBestManifest: sceglie il piu\' recente tra piu\' validi', async () => {
  const { kp, verify } = await setup();
  const a = await signManifest(kp.privateKey, { version: '50.2.0', url: 'a', sha256: 'h' });
  const b = await signManifest(kp.privateKey, { version: '50.5.0', url: 'b', sha256: 'h' });
  const best = await pickBestManifest([a, b], { currentVersion: '50.1.0', verifyImpl: verify });
  assert.equal(best.version, '50.5.0');
});
