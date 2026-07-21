import test from 'node:test';
import assert from 'node:assert/strict';
const { compareVersions, canonicalMessage, makeEcdsaVerifier, resolveUpdate, pickBestManifest, deriveCandidateLocations, currentEpoch, resilientCandidates, extractCtDomains, discoverViaCertTransparency, checkForLatest } = await import('./update-locator.js');

test('checkForLatest: a ogni apertura mette insieme TUTTE le fonti (ancora+algoritmo+CT) e trova l\'ultima firmata', async () => {
  const subtle = globalThis.crypto.subtle;
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const verify = makeEcdsaVerifier(await subtle.exportKey('jwk', kp.publicKey));
  const b64 = (u8) => Buffer.from(u8).toString('base64');
  const sign = async (mf) => { const s = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, new TextEncoder().encode(canonicalMessage(mf))); return { ...mf, sig: b64(new Uint8Array(s)) }; };
  const mf = await sign({ version: '70.0.0', url: 'https://nuovo/app.js', sha256: 'h' });
  // il manifest e' pubblicato SOLO su un dominio scoperto via CT; ancore e algoritmo morti
  const fetchImpl = async (url) => {
    if (url.includes('crt')) return { ok: true, json: async () => [{ name_value: 'momentum-xyz.com' }] };
    if (url === 'https://momentum-xyz.com/m.json') return { ok: true, json: async () => mf };
    throw new Error('morto');
  };
  const config = { prefix: 'momentum', ctEndpoints: ['https://crt/{prefix}'], seed: 'seme', templates: ['https://{t}.dead/m.json'], anchors: ['https://ancora-morta/m.json'], manifestPath: '/m.json' };
  const r = await checkForLatest({ config, fetchImpl, verifyImpl: verify, currentVersion: '69.0.0', memory: null });
  assert.equal(r.found, true);
  assert.equal(r.manifest.version, '70.0.0'); // trovata via CT anche se ancora/algoritmo morti
});

test('CT: estrae i domini col prefisso (gestisce newline e wildcard *.)', () => {
  const ctJson = [
    { name_value: 'momentum-lala.com\nwww.momentum-lala.com' },
    { name_value: '*.momentum-gpwpwp.com' },
    { name_value: 'altro-sito.com' },              // non col prefisso → ignorato
    { name_value: 'momentum-evil.com' },
  ];
  const d = extractCtDomains(ctJson, 'momentum-');
  assert.ok(d.includes('momentum-lala.com'));
  assert.ok(d.includes('momentum-gpwpwp.com'));    // wildcard normalizzato
  assert.ok(d.includes('momentum-evil.com'));
  assert.ok(!d.includes('altro-sito.com'));
  assert.ok(!d.includes('www.momentum-lala.com')); // il www non inizia col prefisso
});

test('CT: scopre gli URL-candidato dai log di Certificate Transparency', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => [{ name_value: 'momentum-lala.com' }, { name_value: 'momentum-gpwpwp.com' }] });
  const urls = await discoverViaCertTransparency({ prefix: 'momentum-', ctEndpoints: ['https://crt.sh/?q={prefix}%25&output=json'], fetchImpl, manifestPath: '/u.json' });
  assert.ok(urls.includes('https://momentum-lala.com/u.json'));
  assert.ok(urls.includes('https://momentum-gpwpwp.com/u.json'));
});

test('SCENARIO: dominio nuovo momentum-lala.com scoperto via CT → trovato e verificato; impostore momentum-evil.com scartato', async () => {
  const subtle = globalThis.crypto.subtle;
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const verify = makeEcdsaVerifier(await subtle.exportKey('jwk', kp.publicKey));
  const bytesToB64 = (u8) => Buffer.from(u8).toString('base64');
  const sign = async (mf) => { const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, new TextEncoder().encode(canonicalMessage(mf))); return { ...mf, sig: bytesToB64(new Uint8Array(sig)) }; };

  const real = await sign({ version: '53.0.0', url: 'https://momentum-lala.com/app.js', sha256: 'h' });
  const fake = { version: '99.0.0', url: 'https://momentum-evil.com/app.js', sha256: 'h', sig: 'ZmFrZQ==' }; // impostore, firma non valida

  const ctFetch = async () => ({ ok: true, json: async () => [{ name_value: 'momentum-lala.com' }, { name_value: 'momentum-evil.com' }] });
  const candidates = await discoverViaCertTransparency({ prefix: 'momentum-', ctEndpoints: ['https://ct/{prefix}'], fetchImpl: ctFetch, manifestPath: '/u.json' });

  const fetchImpl = async (url) => {
    if (url === 'https://momentum-lala.com/u.json') return { ok: true, json: async () => real };
    if (url === 'https://momentum-evil.com/u.json') return { ok: true, json: async () => fake };
    throw new Error('non raggiungibile');
  };
  const r = await resolveUpdate({ beacons: candidates, fetchImpl, verifyImpl: verify, currentVersion: '52.0.0' });
  assert.equal(r.found, true);
  assert.equal(r.manifest.url, 'https://momentum-lala.com/app.js'); // il vero, firmato
  assert.equal(r.manifest.version, '53.0.0');                        // NON il 99 dell'impostore
});

const TEMPLATES = ['https://{t}.pages.dev/m.json', 'https://cdn.x/{t}/m.json', 'https://ipfs.io/ipns/{t}'];

test('indirizzi derivati: DETERMINISTICI (stesso seme+epoch → stesso elenco, publisher e app concordano)', async () => {
  const app = await deriveCandidateLocations({ seed: 'seme-momentum', templates: TEMPLATES, epoch: 2900, count: 4 });
  const publisher = await deriveCandidateLocations({ seed: 'seme-momentum', templates: TEMPLATES, epoch: 2900, count: 4 });
  assert.deepEqual(app, publisher);            // le due parti calcolano lo STESSO set
  assert.equal(app.length, 4 * TEMPLATES.length);
});

test('indirizzi derivati: ROTANO nel tempo (epoch diverso → indirizzi diversi)', async () => {
  const a = await deriveCandidateLocations({ seed: 's', templates: ['https://{t}.x/m'], epoch: 100, count: 3 });
  const b = await deriveCandidateLocations({ seed: 's', templates: ['https://{t}.x/m'], epoch: 101, count: 3 });
  assert.notDeepEqual(a, b);
});

test('indirizzi derivati: seme diverso → indirizzi diversi (imprevedibili senza il seme)', async () => {
  const a = await deriveCandidateLocations({ seed: 'A', templates: ['https://{t}.x/m'], epoch: 1, count: 2 });
  const b = await deriveCandidateLocations({ seed: 'B', templates: ['https://{t}.x/m'], epoch: 1, count: 2 });
  assert.notDeepEqual(a, b);
});

test('GIRO COMPLETO: cambio host ogni volta → l\'app calcola gli indirizzi, ne trova UNO vivo e verifica la firma', async () => {
  const subtle = globalThis.crypto.subtle;
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const verify = makeEcdsaVerifier(await subtle.exportKey('jwk', kp.publicKey));
  const bytesToB64 = (u8) => Buffer.from(u8).toString('base64');
  const sign = async (mf) => { const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, new TextEncoder().encode(canonicalMessage(mf))); return { ...mf, sig: bytesToB64(new Uint8Array(sig)) }; };

  // app e publisher condividono seme+algoritmo → stessi candidati per l'epoch
  const seed = 'momentum-update-seed', epoch = currentEpoch();
  const candidates = await deriveCandidateLocations({ seed, templates: TEMPLATES, epoch, count: 4 });
  // il publisher ha pubblicato SU UN SOLO indirizzo (nuovo host, cambiato oggi):
  const liveUrl = candidates[5]; // uno qualsiasi dei derivati
  const manifest = await sign({ version: '51.0.0', url: 'https://qualunque-host-nuovo/app.js', sha256: 'h' });
  const fetchImpl = async (url) => (url === liveUrl) ? { ok: true, json: async () => manifest } : (() => { throw new Error('host cambiato/morto'); })();

  const r = await resolveUpdate({ beacons: candidates, fetchImpl, verifyImpl: verify, currentVersion: '50.0.0' });
  assert.equal(r.found, true, 'trova la versione anche se ho cambiato host: la calcola dall\'algoritmo');
  assert.equal(r.manifest.version, '51.0.0');
});

test('SCENARIO UTENTE: pippo.com cade → sposto su nello.it (nome ARBITRARIO): l\'ancora stabile ri-punta, l\'app segue', async () => {
  const subtle = globalThis.crypto.subtle;
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const verify = makeEcdsaVerifier(await subtle.exportKey('jwk', kp.publicKey));
  const bytesToB64 = (u8) => Buffer.from(u8).toString('base64');
  const sign = async (mf) => { const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, new TextEncoder().encode(canonicalMessage(mf))); return { ...mf, sig: bytesToB64(new Uint8Array(sig)) }; };

  // Oggi l'app era su pippo.com; lo faccio cadere e pubblico su nello.it (nome
  // arbitrario, non prevedibile). Tengo UN'ancora stabile che ri-punta al nuovo host.
  const anchor = 'https://ancora-stabile.example/pointer.json'; // l'unica cosa che non cambia mai
  const nuovoManifest = await sign({ version: '52.0.0', url: 'https://nello.it/app.js', sha256: 'h' });
  const fetchImpl = async (url) => {
    if (url === 'https://pippo.com/m.json') throw new Error('dominio caduto');   // vecchio host morto
    if (url === anchor) return { ok: true, json: async () => nuovoManifest };    // l'ancora conosce il nuovo indirizzo
    throw new Error('altro host non raggiungibile');
  };
  const r = await resolveUpdate({ beacons: ['https://pippo.com/m.json', anchor], fetchImpl, verifyImpl: verify, currentVersion: '51.0.0' });
  assert.equal(r.found, true, 'l\'app segue l\'ancora e trova il nuovo host arbitrario');
  assert.equal(r.manifest.url, 'https://nello.it/app.js');
  assert.equal(r.manifest.version, '52.0.0');
});

test('resilientCandidates: include epoch corrente E precedente (tolleranza ai confini)', async () => {
  const c = await resilientCandidates({ seed: 's', templates: ['https://{t}.x/m'], count: 2, now: Date.now() });
  assert.equal(c.length, 4); // 2 (curr) + 2 (prev)
});

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
