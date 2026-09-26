import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyLicenseKey, verifyRevocationList, deviceLicenseCode, LEGACY_UNBOUND_BEFORE } from './license.js';

const DEV = 'ABCD-EFGH-JKMN-PQRS';

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
  const licenza = await firma(privateKey, { tier: 'PRO', iat: Date.now(), exp: null, dev: DEV });
  const r = await verifyLicenseKey(licenza, { publicKeyB64, deviceCode: DEV });
  assert.equal(r.valid, true);
  assert.equal(r.tier, 'PRO');
  assert.equal(r.exp, null);
  assert.equal(r.dev, DEV);
});

test('verifyLicenseKey: licenza firmata correttamente, non ancora scaduta -> valida', async () => {
  const { privateKey, publicKeyB64 } = await coppiaDiTest();
  const tra30giorni = Date.now() + 30 * 86_400_000;
  const licenza = await firma(privateKey, { tier: 'PRO_INVESTOR', iat: Date.now(), exp: tra30giorni, dev: DEV });
  const r = await verifyLicenseKey(licenza, { publicKeyB64, deviceCode: DEV });
  assert.equal(r.valid, true);
  assert.equal(r.tier, 'PRO_INVESTOR');
});

test('verifyLicenseKey: licenza scaduta -> non valida, ma tier ed exp comunque dichiarati (onesto sul perché)', async () => {
  const { privateKey, publicKeyB64 } = await coppiaDiTest();
  const ieri = Date.now() - 86_400_000;
  const licenza = await firma(privateKey, { tier: 'PRO', iat: Date.now() - 2 * 86_400_000, exp: ieri, dev: DEV });
  const r = await verifyLicenseKey(licenza, { publicKeyB64, deviceCode: DEV });
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

test('dispositivo: la stessa licenza usata su un ALTRO Momentum è rifiutata', async () => {
  const { privateKey, publicKeyB64 } = await coppiaDiTest();
  const licenza = await firma(privateKey, { tier: 'PRO', iat: Date.now(), exp: null, dev: DEV });
  const r = await verifyLicenseKey(licenza, { publicKeyB64, deviceCode: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ' });
  assert.equal(r.valid, false);
  assert.equal(r.codice, 'altro_dispositivo');
});

test('dispositivo: senza il codice del dispositivo corrente una licenza legata non si accetta mai "sulla fiducia"', async () => {
  const { privateKey, publicKeyB64 } = await coppiaDiTest();
  const licenza = await firma(privateKey, { tier: 'PRO', iat: Date.now(), exp: null, dev: DEV });
  const r = await verifyLicenseKey(licenza, { publicKeyB64 });
  assert.equal(r.valid, false);
  assert.equal(r.codice, 'dispositivo_non_verificabile');
});

test('dispositivo: il confronto ignora maiuscole, spazi e trattini (codice dettato o ricopiato a mano)', async () => {
  const { privateKey, publicKeyB64 } = await coppiaDiTest();
  const licenza = await firma(privateKey, { tier: 'PRO', iat: Date.now(), exp: null, dev: DEV });
  const r = await verifyLicenseKey(licenza, { publicKeyB64, deviceCode: ' abcd efgh-jkmn pqrs ' });
  assert.equal(r.valid, true);
});

test('dispositivo: una nuova licenza NON legata a un dispositivo è rifiutata (non si può condividere)', async () => {
  const { privateKey, publicKeyB64 } = await coppiaDiTest();
  const licenza = await firma(privateKey, { tier: 'PRO', iat: LEGACY_UNBOUND_BEFORE, exp: null });
  const r = await verifyLicenseKey(licenza, { publicKeyB64, deviceCode: DEV });
  assert.equal(r.valid, false);
  assert.equal(r.codice, 'non_legata');
});

test('dispositivo: una licenza emessa PRIMA dell\'introduzione del legame resta valida (mai togliere ciò che è già stato dato)', async () => {
  const { privateKey, publicKeyB64 } = await coppiaDiTest();
  const licenza = await firma(privateKey, { tier: 'PRO', iat: LEGACY_UNBOUND_BEFORE - 1, exp: null });
  const r = await verifyLicenseKey(licenza, { publicKeyB64, deviceCode: DEV });
  assert.equal(r.valid, true);
  assert.equal(r.dev, null);
});

test('deviceLicenseCode: deterministico, 16 caratteri leggibili in 4 gruppi, diverso per chiavi diverse', async () => {
  const a = (await coppiaDiTest()).publicKeyB64;
  const b = (await coppiaDiTest()).publicKeyB64;
  const ca = await deviceLicenseCode(a);
  assert.match(ca, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  assert.equal(await deviceLicenseCode(a), ca);
  assert.notEqual(await deviceLicenseCode(b), ca);
});

test('revoca: una licenza il cui id è nell\'elenco revocato non sblocca più nulla', async () => {
  const { privateKey, publicKeyB64 } = await coppiaDiTest();
  const licenza = await firma(privateKey, { tier: 'PRO', iat: Date.now(), exp: null, dev: DEV, id: 'lic-1' });
  assert.equal((await verifyLicenseKey(licenza, { publicKeyB64, deviceCode: DEV, revokedIds: new Set(['altra']) })).valid, true);
  const r = await verifyLicenseKey(licenza, { publicKeyB64, deviceCode: DEV, revokedIds: new Set(['lic-1']) });
  assert.equal(r.valid, false);
  assert.equal(r.codice, 'revocata');
});

test('elenco revoche: valido solo se firmato dalla chiave giusta e non più vecchio di quello già noto', async () => {
  const { privateKey, publicKeyB64 } = await coppiaDiTest();
  const estranea = await coppiaDiTest();
  const elenco = await firma(privateKey, { v: 1, issuedAt: 2000, ids: ['a', 'b'] });
  const ok = await verifyRevocationList(elenco, { publicKeyB64 });
  assert.deepEqual([ok.valid, ok.ids], [true, ['a', 'b']]);
  assert.equal((await verifyRevocationList(elenco, { publicKeyB64: estranea.publicKeyB64 })).valid, false);
  assert.equal((await verifyRevocationList(elenco, { publicKeyB64, notBefore: 3000 })).valid, false);
  assert.equal((await verifyRevocationList(await firma(privateKey, { v: 1, issuedAt: 1, ids: [1] }), { publicKeyB64 })).valid, false);
});
