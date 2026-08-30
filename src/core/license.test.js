import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyLicenseKey } from './license.js';

// Genera una coppia di test (mai la chiave reale di produzione, che non
// deve mai comparire nel codice sorgente) e firma una licenza esattamente
// come fa bench/issue-license.mjs — stessa forma, per provare la vera
// interoperabilità emissione↔verifica, non solo la funzione isolata.
async function coppiaDiTest() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const publicKeyB64 = Buffer.from(rawPub).toString('base64url');
  return { privateKey: pair.privateKey, publicKeyB64 };
}

async function firma(privateKey, payload) {
  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, payloadBytes);
  return `${Buffer.from(payloadBytes).toString('base64url')}.${Buffer.from(sig).toString('base64url')}`;
}

test('verifyLicenseKey: licenza firmata correttamente, a vita (exp null) -> valida', async () => {
  const { privateKey, publicKeyB64 } = await coppiaDiTest();
  const licenza = await firma(privateKey, { tier: 'PRO', iat: Date.now(), exp: null });
  const r = await verifyLicenseKey(licenza, { publicKeyB64 });
  assert.equal(r.valid, true);
  assert.equal(r.tier, 'PRO');
  assert.equal(r.exp, null);
});

test('verifyLicenseKey: licenza firmata correttamente, non ancora scaduta -> valida', async () => {
  const { privateKey, publicKeyB64 } = await coppiaDiTest();
  const tra30giorni = Date.now() + 30 * 86_400_000;
  const licenza = await firma(privateKey, { tier: 'PRO_INVESTOR', iat: Date.now(), exp: tra30giorni });
  const r = await verifyLicenseKey(licenza, { publicKeyB64 });
  assert.equal(r.valid, true);
  assert.equal(r.tier, 'PRO_INVESTOR');
});

test('verifyLicenseKey: licenza scaduta -> non valida, ma tier ed exp comunque dichiarati (onesto sul perché)', async () => {
  const { privateKey, publicKeyB64 } = await coppiaDiTest();
  const ieri = Date.now() - 86_400_000;
  const licenza = await firma(privateKey, { tier: 'PRO', iat: Date.now() - 2 * 86_400_000, exp: ieri });
  const r = await verifyLicenseKey(licenza, { publicKeyB64 });
  assert.equal(r.valid, false);
  assert.equal(r.scaduto, true);
  assert.equal(r.tier, 'PRO');
});

test('verifyLicenseKey: firmata con una chiave DIVERSA da quella pubblica attesa -> non valida (mai una licenza altrui accettata)', async () => {
  const { privateKey } = await coppiaDiTest();
  const { publicKeyB64: chiaveAltra } = await coppiaDiTest(); // chiave pubblica di un'altra coppia
  const licenza = await firma(privateKey, { tier: 'PRO', iat: Date.now(), exp: null });
  const r = await verifyLicenseKey(licenza, { publicKeyB64: chiaveAltra });
  assert.equal(r.valid, false);
});

test('verifyLicenseKey: payload manomesso dopo la firma -> non valida', async () => {
  const { privateKey, publicKeyB64 } = await coppiaDiTest();
  const licenza = await firma(privateKey, { tier: 'PRO', iat: Date.now(), exp: null });
  const [, sigB64] = licenza.split('.');
  const payloadManomesso = Buffer.from(JSON.stringify({ tier: 'PRO_INVESTOR', iat: Date.now(), exp: null }), 'utf8').toString('base64url');
  const r = await verifyLicenseKey(`${payloadManomesso}.${sigB64}`, { publicKeyB64 });
  assert.equal(r.valid, false);
});

test('verifyLicenseKey: tier non riconosciuto nel payload -> non valida, mai un piano inventato', async () => {
  const { privateKey, publicKeyB64 } = await coppiaDiTest();
  const licenza = await firma(privateKey, { tier: 'GOD_MODE', iat: Date.now(), exp: null });
  const r = await verifyLicenseKey(licenza, { publicKeyB64 });
  assert.equal(r.valid, false);
});

test('verifyLicenseKey: stringa vuota/malformata/senza il punto separatore -> non valida, mai un\'eccezione che rompe il chiamante', async () => {
  assert.equal((await verifyLicenseKey('')).valid, false);
  assert.equal((await verifyLicenseKey(null)).valid, false);
  assert.equal((await verifyLicenseKey('nonèunalicenza')).valid, false);
  assert.equal((await verifyLicenseKey('a.b.c')).valid, false);
  assert.equal((await verifyLicenseKey('###.###')).valid, false);
});

test('verifyLicenseKey: senza override, usa LICENSE_PUBLIC_KEY_B64 reale del progetto — una licenza NON firmata con la chiave privata corrispondente resta onestamente non valida', async () => {
  const { privateKey } = await coppiaDiTest(); // una chiave estranea, mai quella privata reale del progetto (che non deve mai comparire nel codice sorgente)
  const licenza = await firma(privateKey, { tier: 'PRO', iat: Date.now(), exp: null });
  const r = await verifyLicenseKey(licenza); // nessun publicKeyB64 passato -> usa quella reale incorporata
  assert.equal(r.valid, false);
});
