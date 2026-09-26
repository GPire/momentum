import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLicenseRequest, verifyStripeSignature, readiness, GRACE_MS } from './worker.js';
import { verifyLicenseKey, verifyRevocationList } from '../../src/core/license.js';

const DEV = 'ABCD-EFGH-JKMN-PQRS';
const WHSEC = 'whsec_test_segreto';
const NOW = Date.UTC(2026, 8, 26, 12);

async function setup() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicKeyB64 = Buffer.from(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))).toString('base64url');
  const store = new Map();
  const opzioni = new Map();
  const stripeCalls = [];
  const stripeSubs = {};
  const env = {
    STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: WHSEC, LICENSE_SIGNING_JWK: JSON.stringify(jwk), LICENSE_ADMIN_TOKEN: 'admin-token-lungo',
    STRIPE_PRICE_PRO_MONTH: 'price_pm', STRIPE_PRICE_PRO_YEAR: 'price_py', STRIPE_PRICE_INVESTOR_MONTH: 'price_im', STRIPE_PRICE_INVESTOR_YEAR: 'price_iy',
    APP_ORIGIN: 'https://momentum.example',
    LICENSES: { get: async (k) => store.get(k) ?? null, put: async (k, v, o) => { store.set(k, v); opzioni.set(k, o); } },
    now: () => NOW,
    fetchImpl: async (url, init) => {
      stripeCalls.push({ url, init });
      if (url.endsWith('/checkout/sessions')) return Response.json({ id: 'cs_test_123456789', url: 'https://checkout.stripe.com/c/pay/cs_test_123456789' });
      if (url.endsWith('/billing_portal/sessions')) return Response.json({ url: 'https://billing.stripe.com/p/session/test_123' });
      const m = url.match(/subscriptions\/(.+)$/);
      if (m) return Response.json(stripeSubs[decodeURIComponent(m[1])] || {});
      return Response.json({ error: { message: 'unexpected' } }, { status: 400 });
    },
  };
  return { env, store, opzioni, stripeCalls, stripeSubs, publicKeyB64 };
}

async function signedWebhook(env, event, { t = Math.floor(NOW / 1000), secret = WHSEC } = {}) {
  const body = JSON.stringify(event);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`))).toString('hex');
  return handleLicenseRequest(new Request('https://momentum.example/api/license/webhook', { method: 'POST', body, headers: { 'stripe-signature': `t=${t},v1=${mac}` } }), env);
}

const post = (env, path, body, headers = {}) => handleLicenseRequest(new Request(`https://momentum.example/api/license/${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } }), env);
const get = (env, path) => handleLicenseRequest(new Request(`https://momentum.example/api/license/${path}`), env);

const completed = (sub = 'sub_1', tier = 'PRO_INVESTOR') => ({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_123456789', mode: 'subscription', subscription: sub, metadata: { deviceCode: DEV, tier } } } });
const paid = (sub = 'sub_1', endSec = Math.floor(NOW / 1000) + 30 * 86_400) => ({ type: 'invoice.paid', data: { object: { subscription: sub, lines: { data: [{ period: { end: endSec } }] } } } });

test('readiness: senza configurazione il servizio risponde chiuso e dice cosa manca', async () => {
  const r = readiness({});
  assert.equal(r.operational, false);
  assert.ok(r.missing.includes('STRIPE_SECRET_KEY') && r.missing.includes('LICENSES (KV binding)'));
  const res = await handleLicenseRequest(new Request('https://x.example/api/license/checkout', { method: 'POST', body: '{}' }), {});
  assert.equal(res.status, 503);
});

test('firma Stripe: valida, sbagliata, o troppo vecchia (replay)', async () => {
  const body = '{"a":1}';
  const t = Math.floor(NOW / 1000);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(WHSEC), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`))).toString('hex');
  assert.equal(await verifyStripeSignature(body, `t=${t},v1=${mac}`, WHSEC, { now: NOW }), true);
  assert.equal(await verifyStripeSignature(body, `t=${t},v1=${mac}`, 'altro', { now: NOW }), false);
  assert.equal(await verifyStripeSignature('{"a":2}', `t=${t},v1=${mac}`, WHSEC, { now: NOW }), false);
  assert.equal(await verifyStripeSignature(body, `t=${t},v1=${mac}`, WHSEC, { now: NOW + 10 * 60_000 }), false);
});

test('checkout: crea la sessione Stripe col prezzo giusto e il codice dispositivo nei metadati', async () => {
  const { env, stripeCalls } = await setup();
  const res = await post(env, 'checkout', { deviceCode: 'abcd efgh jkmn pqrs', tier: 'PRO_INVESTOR', period: 'year' });
  assert.equal(res.status, 200);
  assert.match((await res.json()).url, /^https:\/\/checkout\.stripe\.com\//);
  const params = new URLSearchParams(stripeCalls[0].init.body);
  assert.equal(params.get('line_items[0][price]'), 'price_iy');
  assert.equal(params.get('mode'), 'subscription');
  assert.equal(params.get('subscription_data[metadata][deviceCode]'), DEV);
  assert.equal(params.get('success_url'), 'https://momentum.example/?license_session={CHECKOUT_SESSION_ID}');
  assert.equal((await post(env, 'checkout', { deviceCode: 'corto', tier: 'PRO', period: 'year' })).status, 400);
  assert.equal((await post(env, 'checkout', { deviceCode: DEV, tier: 'GOD', period: 'year' })).status, 400);
});

test('flusso completo: pagamento → licenza legata al dispositivo, valida nell\'app fino a fine periodo + tolleranza', async () => {
  const { env, publicKeyB64 } = await setup();
  assert.equal((await get(env, 'claim?session=cs_test_123456789').then((r) => r.json())).status, 'pending');
  assert.equal((await signedWebhook(env, completed())).status, 200);
  const endSec = Math.floor(NOW / 1000) + 30 * 86_400;
  assert.equal((await signedWebhook(env, paid('sub_1', endSec))).status, 200);
  const claim = await get(env, 'claim?session=cs_test_123456789').then((r) => r.json());
  assert.equal(claim.status, 'ready');
  const r = await verifyLicenseKey(claim.license, { publicKeyB64, deviceCode: DEV, now: NOW });
  assert.equal(r.valid, true);
  assert.equal(r.tier, 'PRO_INVESTOR');
  assert.equal(r.exp, endSec * 1000 + GRACE_MS);
  assert.equal((await verifyLicenseKey(claim.license, { publicKeyB64, deviceCode: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ', now: NOW })).valid, false);
});

test('webhook con firma falsa: rifiutato, nessuna licenza emessa', async () => {
  const { env, store } = await setup();
  assert.equal((await signedWebhook(env, paid(), { secret: 'falso' })).status, 400);
  assert.equal(store.size, 0);
});

test('fattura pagata prima della conferma checkout: i metadati si leggono dall\'abbonamento Stripe', async () => {
  const { env, stripeSubs, publicKeyB64 } = await setup();
  stripeSubs.sub_2 = { metadata: { deviceCode: DEV, tier: 'PRO' } };
  await signedWebhook(env, paid('sub_2'));
  await signedWebhook(env, completed('sub_2', 'PRO'));
  const claim = await get(env, 'claim?session=cs_test_123456789').then((r) => r.json());
  assert.equal((await verifyLicenseKey(claim.license, { publicKeyB64, deviceCode: DEV, now: NOW })).tier, 'PRO');
});

test('rinnovo: fattura duplicata non crea una seconda licenza; il periodo nuovo sì, e refresh la consegna', async () => {
  const { env } = await setup();
  await signedWebhook(env, completed());
  const end1 = Math.floor(NOW / 1000) + 30 * 86_400;
  await signedWebhook(env, paid('sub_1', end1));
  const prima = (await get(env, 'claim?session=cs_test_123456789').then((r) => r.json())).license;
  await signedWebhook(env, paid('sub_1', end1));
  assert.equal((await get(env, 'claim?session=cs_test_123456789').then((r) => r.json())).license, prima);
  assert.equal((await post(env, 'refresh', { license: prima }).then((r) => r.json())).status, 'current');
  await signedWebhook(env, paid('sub_1', end1 + 30 * 86_400));
  const ref = await post(env, 'refresh', { license: prima }).then((r) => r.json());
  assert.equal(ref.status, 'renewed');
  assert.notEqual(ref.license, prima);
});

test('refresh: una licenza non firmata dal server viene rifiutata', async () => {
  const { env } = await setup();
  assert.equal((await post(env, 'refresh', { license: 'eyJ0aWVyIjoiUFJPIn0.AAAA' })).status, 400);
});

test('admin: senza token niente; regalo a tempo emesso; cambio durata revoca la precedente; elenco firmato', async () => {
  const { env, publicKeyB64 } = await setup();
  assert.equal((await post(env, 'admin/issue', { deviceCode: DEV, tier: 'PRO', days: 30 })).status, 401);
  assert.equal((await post(env, 'admin/issue', { deviceCode: DEV, tier: 'PRO', days: 30 }, { authorization: 'Bearer sbagliato' })).status, 401);
  const auth = { authorization: 'Bearer admin-token-lungo' };
  const regalo = await post(env, 'admin/issue', { deviceCode: DEV, tier: 'PRO', days: 30 }, auth).then((r) => r.json());
  const v = await verifyLicenseKey(regalo.license, { publicKeyB64, deviceCode: DEV, now: NOW });
  assert.equal(v.exp, NOW + 30 * 86_400_000);
  const lunga = await post(env, 'admin/issue', { deviceCode: DEV, tier: 'PRO', days: 365, replaces: regalo.id }, auth).then((r) => r.json());
  const { token } = await get(env, 'revocations').then((r) => r.json());
  const elenco = await verifyRevocationList(token, { publicKeyB64 });
  assert.deepEqual(elenco.ids, [regalo.id]);
  const revocate = new Set(elenco.ids);
  assert.equal((await verifyLicenseKey(regalo.license, { publicKeyB64, deviceCode: DEV, now: NOW, revokedIds: revocate })).codice, 'revocata');
  assert.equal((await verifyLicenseKey(lunga.license, { publicKeyB64, deviceCode: DEV, now: NOW, revokedIds: revocate })).valid, true);
});

test('admin revoke su una licenza di abbonamento: niente più claim né rinnovi', async () => {
  const { env } = await setup();
  await signedWebhook(env, completed());
  await signedWebhook(env, paid());
  const lic = (await get(env, 'claim?session=cs_test_123456789').then((r) => r.json())).license;
  const id = JSON.parse(Buffer.from(lic.split('.')[0], 'base64url').toString()).id;
  assert.equal((await post(env, 'admin/revoke', { id }, { authorization: 'Bearer admin-token-lungo' })).status, 200);
  assert.equal((await get(env, 'claim?session=cs_test_123456789').then((r) => r.json())).status, 'pending');
  assert.equal((await post(env, 'refresh', { license: lic }).then((r) => r.json())).status, 'none');
  await signedWebhook(env, paid('sub_1', Math.floor(NOW / 1000) + 60 * 86_400));
  assert.equal((await post(env, 'refresh', { license: lic }).then((r) => r.json())).status, 'none');
});

test('conservazione: i collegamenti abbonamento-dispositivo scadono 13 mesi dopo il periodo pagato', async () => {
  const { env, opzioni } = await setup();
  await signedWebhook(env, completed());
  assert.equal(opzioni.get('sub:sub_1').expirationTtl, 30 * 86_400);
  const endSec = Math.floor(NOW / 1000) + 30 * 86_400;
  await signedWebhook(env, paid('sub_1', endSec));
  const attesa = Math.floor((endSec * 1000 + 395 * 86_400_000) / 1000);
  assert.equal(opzioni.get('sub:sub_1').expiration, attesa);
  const licenza = [...opzioni.keys()].find((k) => k.startsWith('license:'));
  assert.equal(opzioni.get(licenza).expiration, attesa);
});

test('checkout: nota su rinnovo, disdetta e recesso nella lingua dell\'app', async () => {
  const { env, stripeCalls } = await setup();
  await post(env, 'checkout', { deviceCode: DEV, tier: 'PRO', period: 'year', lang: 'de' });
  const p = new URLSearchParams(stripeCalls[0].init.body);
  assert.equal(p.get('locale'), 'de');
  assert.match(p.get('custom_text[submit][message]'), /Widerruf innerhalb von 14 Tagen/);
});

test('portale clienti: solo con una licenza emessa dal server per un abbonamento', async () => {
  const { env, stripeSubs } = await setup();
  stripeSubs.sub_1 = { customer: 'cus_123' };
  await signedWebhook(env, completed());
  await signedWebhook(env, paid());
  const lic = (await get(env, 'claim?session=cs_test_123456789').then((r) => r.json())).license;
  const r = await post(env, 'portal', { license: lic }).then((x) => x.json());
  assert.equal(r.url, 'https://billing.stripe.com/p/session/test_123');
  const regalo = await post(env, 'admin/issue', { deviceCode: DEV, tier: 'PRO', days: 30 }, { authorization: 'Bearer admin-token-lungo' }).then((x) => x.json());
  assert.equal((await post(env, 'portal', { license: regalo.license })).status, 404);
  assert.equal((await post(env, 'portal', { license: 'a.b' })).status, 404);
});
