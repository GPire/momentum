// Chiamate dell'app al servizio licenze (server/license). Solo chi compra o
// ha già una licenza le fa: un utente gratuito non contatta mai il servizio.
// Nessun dato del Vault viaggia: solo codice dispositivo, piano e licenza.
'use strict';

import { verifyRevocationList } from './license.js';

const BASE = '/api/license';
export const REFRESH_WINDOW_MS = 7 * 86_400_000;
export const REVOCATIONS_EVERY_MS = 86_400_000;

const json = async (res) => { try { return await res.json(); } catch { return {}; } };

export async function paymentsAvailable({ fetchImpl = fetch } = {}) {
  try {
    const r = await fetchImpl(`${BASE}/readiness`, { cache: 'no-store' });
    return r.ok && (await json(r)).operational === true;
  } catch { return false; }
}

export async function startCheckout({ deviceCode, tier, period }, { fetchImpl = fetch } = {}) {
  const r = await fetchImpl(`${BASE}/checkout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceCode, tier, period }) });
  const body = await json(r);
  if (!r.ok || typeof body.url !== 'string' || !body.url.startsWith('https://checkout.stripe.com/')) throw new Error('checkout_unavailable');
  return body.url;
}

// Dopo il ritorno da Stripe la conferma di pagamento può arrivare qualche
// secondo dopo: si riprova fino a `timeoutMs`, poi si dichiara l'attesa.
export async function claimLicense(sessionId, { fetchImpl = fetch, intervalMs = 2000, timeoutMs = 60_000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = () => Date.now() } = {}) {
  const fine = now() + timeoutMs;
  while (true) {
    try {
      const r = await fetchImpl(`${BASE}/claim?session=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
      const body = await json(r);
      if (r.ok && body.status === 'ready' && typeof body.license === 'string') return body.license;
      if (r.status === 400) return null;
    } catch { /* rete assente: si riprova */ }
    if (now() >= fine) return null;
    await sleep(intervalMs);
  }
}

export function needsRefresh(license, now = Date.now()) {
  return Number.isFinite(license?.exp) && license.exp - now < REFRESH_WINDOW_MS && !!license?.key;
}

export async function refreshLicense(licenseKey, { fetchImpl = fetch } = {}) {
  try {
    const r = await fetchImpl(`${BASE}/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ license: licenseKey }) });
    const body = await json(r);
    return r.ok && body.status === 'renewed' && typeof body.license === 'string' ? body.license : null;
  } catch { return null; }
}

// Ritorna il nuovo elenco verificato, oppure quello già noto: mai uno più
// vecchio, mai uno con firma sbagliata.
export async function updateRevocations(stored, { fetchImpl = fetch, publicKeyB64, now = Date.now() } = {}) {
  if (stored?.checkedAt && now - stored.checkedAt < REVOCATIONS_EVERY_MS) return stored;
  try {
    const r = await fetchImpl(`${BASE}/revocations`, { cache: 'no-store' });
    const { token } = await json(r);
    const v = await verifyRevocationList(token, { ...(publicKeyB64 ? { publicKeyB64 } : {}), notBefore: stored?.issuedAt || 0 });
    if (v.valid) return { token, issuedAt: v.issuedAt, ids: v.ids, checkedAt: now };
  } catch { /* offline: resta l'elenco già verificato */ }
  return stored || null;
}
