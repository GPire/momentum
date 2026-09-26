// Emissione automatica delle licenze dopo un pagamento Stripe.
// Il server conosce solo: codice dispositivo, piano, id abbonamento Stripe e
// id licenza. Mai dati del Vault, mai dati di carta (li gestisce Stripe
// Checkout sulla propria pagina). La verifica delle licenze resta offline
// nell'app: questo servizio serve solo a emetterle, rinnovarle e revocarle.
'use strict';

export const GRACE_MS = 3 * 86_400_000;
// Conservazione (GDPR art. 5.1.e): i collegamenti abbonamento ↔ dispositivo
// scadono 13 mesi dopo l'ultimo periodo pagato; le fatture restano su Stripe.
export const LINK_RETENTION_MS = 395 * 86_400_000;
const PENDING_TTL_S = 30 * 86_400;
const TIERS = ['PRO', 'PRO_INVESTOR'];
const PERIODS = ['month', 'year'];
const DEVICE_RE = /^[0-9A-HJKMNP-TV-Z]{16}$/;
const MAX_BODY = 64 * 1024;

const PRICE_ENV = {
  PRO: { month: 'STRIPE_PRICE_PRO_MONTH', year: 'STRIPE_PRICE_PRO_YEAR' },
  PRO_INVESTOR: { month: 'STRIPE_PRICE_INVESTOR_MONTH', year: 'STRIPE_PRICE_INVESTOR_YEAR' },
};
const REQUIRED_ENV = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'LICENSE_SIGNING_JWK', 'LICENSE_ADMIN_TOKEN',
  ...Object.values(PRICE_ENV).flatMap((p) => Object.values(p))];

const enc = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDecode = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));

export function normalizeDevice(code) {
  const c = String(code || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  return DEVICE_RE.test(c) ? c.match(/.{4}/g).join('-') : null;
}

function timingSafeEqual(a, b) {
  const x = enc.encode(String(a)), y = enc.encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function signToken(privateJwk, payload) {
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const bytes = enc.encode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, bytes);
  return `${b64url(bytes)}.${b64url(sig)}`;
}

function readToken(token) {
  try {
    const [p] = String(token).split('.');
    return JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
  } catch { return null; }
}

async function verifyOwnToken(privateJwk, token) {
  const [p, s] = String(token || '').split('.');
  if (!p || !s) return null;
  const { d, ...pub } = privateJwk;
  try {
    const key = await crypto.subtle.importKey('jwk', { ...pub, key_ops: ['verify'] }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64urlDecode(s), b64urlDecode(p)) ? readToken(token) : null;
  } catch { return null; }
}

// Stripe-Signature: t=<secondi>,v1=<hmac hex>[,v1=...]; firmato "t.body".
export async function verifyStripeSignature(rawBody, header, secret, { now = Date.now(), toleranceSec = 300 } = {}) {
  if (!header || !secret) return false;
  const parts = String(header).split(',').map((x) => x.split('='));
  const t = Number(parts.find(([k]) => k === 't')?.[1]);
  const firme = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isFinite(t) || !firme.length || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${rawBody}`)));
  const atteso = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
  return firme.some((f) => timingSafeEqual(f, atteso));
}

function formEncode(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') formEncode(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe(env, method, path, params) {
  const res = await (env.fetchImpl || fetch)(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: params ? formEncode(params).toString() : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`stripe ${res.status}: ${body?.error?.message || 'errore'}`);
  return body;
}

const reply = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra },
});

const kvGet = async (env, key) => { const v = await env.LICENSES.get(key); return v ? JSON.parse(v) : null; };
const kvPut = (env, key, value, opts) => env.LICENSES.put(key, JSON.stringify(value), opts);

// Segreto testuale (wrangler secret put) oppure variabile JSON già decodificata.
const signingJwk = (env) => (typeof env.LICENSE_SIGNING_JWK === 'string' ? JSON.parse(env.LICENSE_SIGNING_JWK) : env.LICENSE_SIGNING_JWK);

const scadenza = (paidUntilMs) => ({ expiration: Math.floor((paidUntilMs + LINK_RETENTION_MS) / 1000) });

// Testo sotto il pulsante di pagamento di Stripe, nella lingua dell'app.
const CHECKOUT_NOTE = {
  it: 'Rinnovo automatico, disdici quando vuoi. Recesso entro 14 giorni con rimborso completo. La licenza funziona su questo dispositivo.',
  en: 'Renews automatically, cancel anytime. Withdraw within 14 days for a full refund. The licence works on this device.',
  de: 'Verlängert sich automatisch, jederzeit kündbar. Widerruf innerhalb von 14 Tagen mit voller Erstattung. Die Lizenz gilt für dieses Gerät.',
  fr: 'Renouvellement automatique, résiliable à tout moment. Rétractation sous 14 jours avec remboursement intégral. La licence fonctionne sur cet appareil.',
  es: 'Renovación automática, cancela cuando quieras. Desistimiento en 14 días con reembolso completo. La licencia funciona en este dispositivo.',
  nl: 'Wordt automatisch verlengd, altijd opzegbaar. Herroeping binnen 14 dagen met volledige terugbetaling. De licentie werkt op dit apparaat.',
  pt: 'Renovação automática, cancele quando quiser. Livre resolução em 14 dias com reembolso total. A licença funciona neste dispositivo.',
};

function newId() {
  return b64url(crypto.getRandomValues(new Uint8Array(16)));
}

async function issueLicense(env, { tier, dev, exp, now = Date.now() }) {
  const id = newId();
  const license = await signToken(signingJwk(env), { tier, iat: now, exp, dev, id });
  return { id, license };
}

async function revocations(env) {
  return (await kvGet(env, 'revoked')) || { issuedAt: 0, ids: [] };
}

async function revoke(env, id, now = Date.now()) {
  const r = await revocations(env);
  if (!r.ids.includes(id)) r.ids.push(id);
  r.issuedAt = Math.max(now, r.issuedAt + 1);
  await kvPut(env, 'revoked', r);
  const link = await kvGet(env, `license:${id}`);
  if (link?.subscription) {
    const sub = await kvGet(env, `sub:${link.subscription}`);
    if (sub) await kvPut(env, `sub:${link.subscription}`, { ...sub, status: 'revoked' });
  }
}

function subscriptionIdOf(invoice) {
  return invoice?.subscription || invoice?.parent?.subscription_details?.subscription || null;
}

function periodEndOf(invoice) {
  const lines = invoice?.lines?.data || [];
  const fine = Math.max(0, ...lines.map((l) => Number(l?.period?.end) || 0));
  return (fine || Number(invoice?.period_end) || 0) * 1000;
}

async function handleWebhook(request, env) {
  const raw = await request.text();
  if (raw.length > MAX_BODY * 4) return reply({ error: 'too_large' }, 413);
  if (!(await verifyStripeSignature(raw, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET, { now: env.now?.() ?? Date.now() }))) {
    return reply({ error: 'bad_signature' }, 400);
  }
  const event = JSON.parse(raw);
  const obj = event?.data?.object || {};

  if (event.type === 'checkout.session.completed' && obj.mode === 'subscription' && obj.subscription) {
    const dev = normalizeDevice(obj.metadata?.deviceCode);
    const tier = TIERS.includes(obj.metadata?.tier) ? obj.metadata.tier : null;
    if (!dev || !tier) return reply({ ignored: 'metadata' });
    await kvPut(env, `session:${obj.id}`, { subscription: obj.subscription }, { expirationTtl: 7 * 86_400 });
    const sub = (await kvGet(env, `sub:${obj.subscription}`)) || {};
    await kvPut(env, `sub:${obj.subscription}`, { ...sub, dev, tier, status: sub.status || 'pending' }, sub.paidUntil ? scadenza(sub.paidUntil) : { expirationTtl: PENDING_TTL_S });
    return reply({ ok: true });
  }

  if (event.type === 'invoice.paid') {
    const subId = subscriptionIdOf(obj);
    const end = periodEndOf(obj);
    if (!subId || !end) return reply({ ignored: 'invoice' });
    let sub = (await kvGet(env, `sub:${subId}`)) || {};
    if (!sub.dev || !sub.tier) {
      const s = await stripe(env, 'GET', `subscriptions/${encodeURIComponent(subId)}`);
      sub = { ...sub, dev: normalizeDevice(s?.metadata?.deviceCode), tier: TIERS.includes(s?.metadata?.tier) ? s.metadata.tier : null };
    }
    if (!sub.dev || !sub.tier) return reply({ ignored: 'metadata' });
    if (sub.status === 'revoked') return reply({ ignored: 'revoked' });
    if (sub.paidUntil && sub.paidUntil >= end) return reply({ ok: true, duplicate: true });
    const { id, license } = await issueLicense(env, { tier: sub.tier, dev: sub.dev, exp: end + GRACE_MS, now: env.now?.() ?? Date.now() });
    await kvPut(env, `license:${id}`, { subscription: subId }, scadenza(end));
    await kvPut(env, `sub:${subId}`, { ...sub, status: 'active', paidUntil: end, licenseId: id, license }, scadenza(end));
    return reply({ ok: true });
  }

  if (event.type === 'customer.subscription.deleted' && obj.id) {
    const sub = await kvGet(env, `sub:${obj.id}`);
    // La licenza già emessa copre il periodo già pagato; semplicemente non si rinnova.
    if (sub && sub.status !== 'revoked') await kvPut(env, `sub:${obj.id}`, { ...sub, status: 'canceled' }, sub.paidUntil ? scadenza(sub.paidUntil) : { expirationTtl: PENDING_TTL_S });
    return reply({ ok: true });
  }
  return reply({ ignored: event.type || 'unknown' });
}

async function readJson(request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) throw new Error('too_large');
  return JSON.parse(raw || '{}');
}

function isAdmin(request, env) {
  const h = request.headers.get('authorization') || '';
  return !!env.LICENSE_ADMIN_TOKEN && h.startsWith('Bearer ') && timingSafeEqual(h.slice(7), env.LICENSE_ADMIN_TOKEN);
}

export function readiness(env) {
  const missing = REQUIRED_ENV.filter((k) => !env?.[k]);
  if (!env?.LICENSES) missing.push('LICENSES (KV binding)');
  return { operational: missing.length === 0, missing };
}

export async function handleLicenseRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/license\/?/, '');
  const ready = readiness(env);

  if (path === 'readiness' && request.method === 'GET') return reply(ready);
  if (!ready.operational) return reply({ error: 'not_configured' }, 503);

  try {
    if (path === 'webhook' && request.method === 'POST') return await handleWebhook(request, env);

    if (path === 'checkout' && request.method === 'POST') {
      const body = await readJson(request);
      const dev = normalizeDevice(body.deviceCode);
      const tier = TIERS.includes(body.tier) ? body.tier : null;
      const period = PERIODS.includes(body.period) ? body.period : null;
      if (!dev || !tier || !period) return reply({ error: 'invalid_request' }, 400);
      const origin = env.APP_ORIGIN || url.origin;
      const session = await stripe(env, 'POST', 'checkout/sessions', {
        mode: 'subscription',
        line_items: { 0: { price: env[PRICE_ENV[tier][period]], quantity: 1 } },
        success_url: `${origin}/?license_session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?license_cancel=1`,
        client_reference_id: dev,
        allow_promotion_codes: 'true',
        locale: CHECKOUT_NOTE[body.lang] ? body.lang : 'auto',
        custom_text: { submit: { message: CHECKOUT_NOTE[body.lang] || CHECKOUT_NOTE.en } },
        metadata: { deviceCode: dev, tier },
        subscription_data: { metadata: { deviceCode: dev, tier } },
        ...(env.STRIPE_AUTOMATIC_TAX === 'true' ? { automatic_tax: { enabled: 'true' } } : {}),
      });
      return reply({ url: session.url });
    }

    if (path === 'claim' && request.method === 'GET') {
      const sessionId = url.searchParams.get('session') || '';
      if (!/^cs_[A-Za-z0-9_]{8,200}$/.test(sessionId)) return reply({ error: 'invalid_request' }, 400);
      const s = await kvGet(env, `session:${sessionId}`);
      const sub = s ? await kvGet(env, `sub:${s.subscription}`) : null;
      if (!sub?.license || sub.status === 'revoked') return reply({ status: 'pending' });
      return reply({ status: 'ready', license: sub.license });
    }

    if (path === 'refresh' && request.method === 'POST') {
      const body = await readJson(request);
      const payload = await verifyOwnToken(signingJwk(env), body.license);
      if (!payload?.id) return reply({ error: 'invalid_license' }, 400);
      const link = await kvGet(env, `license:${payload.id}`);
      const sub = link ? await kvGet(env, `sub:${link.subscription}`) : null;
      if (!sub?.license || sub.status === 'revoked' || sub.dev !== normalizeDevice(payload.dev)) return reply({ status: 'none' });
      return reply(sub.licenseId === payload.id ? { status: 'current' } : { status: 'renewed', license: sub.license });
    }

    // Portale clienti di Stripe: disdetta, carta, fatture. Serve la licenza
    // emessa dal server: nessun altro può aprire il portale di quell'abbonamento.
    if (path === 'portal' && request.method === 'POST') {
      const body = await readJson(request);
      const payload = await verifyOwnToken(signingJwk(env), body.license);
      const link = payload?.id ? await kvGet(env, `license:${payload.id}`) : null;
      if (!link?.subscription) return reply({ error: 'no_subscription' }, 404);
      const sub = await stripe(env, 'GET', `subscriptions/${encodeURIComponent(link.subscription)}`);
      const customer = typeof sub?.customer === 'string' ? sub.customer : sub?.customer?.id;
      if (!customer) return reply({ error: 'no_subscription' }, 404);
      const origin = env.APP_ORIGIN || url.origin;
      const portal = await stripe(env, 'POST', 'billing_portal/sessions', { customer, return_url: `${origin}/` });
      return reply({ url: portal.url });
    }

    if (path === 'revocations' && request.method === 'GET') {
      const r = await revocations(env);
      const token = await signToken(signingJwk(env), { v: 1, issuedAt: r.issuedAt, ids: r.ids });
      return reply({ token }, 200, { 'cache-control': 'public, max-age=300' });
    }

    if (path === 'admin/issue' && request.method === 'POST') {
      if (!isAdmin(request, env)) return reply({ error: 'unauthorized' }, 401);
      const body = await readJson(request);
      const dev = normalizeDevice(body.deviceCode);
      const tier = TIERS.includes(body.tier) ? body.tier : null;
      const days = body.days == null ? null : Number(body.days);
      if (!dev || !tier || (days !== null && !(days > 0 && days <= 36_500))) return reply({ error: 'invalid_request' }, 400);
      const now = env.now?.() ?? Date.now();
      const { id, license } = await issueLicense(env, { tier, dev, exp: days === null ? null : now + days * 86_400_000, now });
      if (typeof body.replaces === 'string' && body.replaces) await revoke(env, body.replaces, now);
      return reply({ id, license });
    }

    if (path === 'admin/revoke' && request.method === 'POST') {
      if (!isAdmin(request, env)) return reply({ error: 'unauthorized' }, 401);
      const body = await readJson(request);
      if (typeof body.id !== 'string' || !body.id || body.id.length > 64) return reply({ error: 'invalid_request' }, 400);
      await revoke(env, body.id, env.now?.() ?? Date.now());
      return reply({ ok: true });
    }
  } catch (e) {
    return reply({ error: e.message === 'too_large' ? 'too_large' : 'server_error' }, e.message === 'too_large' ? 413 : 502);
  }
  return reply({ error: 'not_found' }, 404);
}

export default { fetch: handleLicenseRequest };
