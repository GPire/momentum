import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentsAvailable, startCheckout, openBillingPortal, claimLicense, needsRefresh, refreshLicense, updateRevocations, REVOCATIONS_EVERY_MS } from './license-client.js';

async function firmatore() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKeyB64 = Buffer.from(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))).toString('base64url');
  const firma = async (payload) => {
    const bytes = Buffer.from(JSON.stringify(payload));
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, bytes);
    return `${bytes.toString('base64url')}.${Buffer.from(sig).toString('base64url')}`;
  };
  return { publicKeyB64, firma };
}

test('paymentsAvailable: solo se il servizio si dichiara operativo; errore di rete = non disponibile, mai un pulsante che non funziona', async () => {
  assert.equal(await paymentsAvailable({ fetchImpl: async () => Response.json({ operational: true }) }), true);
  assert.equal(await paymentsAvailable({ fetchImpl: async () => Response.json({ operational: false }) }), false);
  assert.equal(await paymentsAvailable({ fetchImpl: async () => { throw new Error('offline'); } }), false);
});

test('startCheckout: accetta solo un indirizzo di Stripe Checkout, mai un redirect altrove', async () => {
  const ok = await startCheckout({ deviceCode: 'X', tier: 'PRO', period: 'year' }, { fetchImpl: async () => Response.json({ url: 'https://checkout.stripe.com/c/pay/cs_1' }) });
  assert.equal(ok, 'https://checkout.stripe.com/c/pay/cs_1');
  await assert.rejects(startCheckout({}, { fetchImpl: async () => Response.json({ url: 'https://evil.example/pay' }) }));
});

test('claimLicense: aspetta la conferma del pagamento e si arrende con onestà dopo il timeout', async () => {
  let n = 0;
  const lic = await claimLicense('cs_test_1', { sleep: async () => {}, fetchImpl: async () => Response.json(++n < 3 ? { status: 'pending' } : { status: 'ready', license: 'a.b' }) });
  assert.equal(lic, 'a.b');
  let t = 0;
  const niente = await claimLicense('cs_test_1', { sleep: async () => { t += 2000; }, now: () => t, timeoutMs: 6000, fetchImpl: async () => Response.json({ status: 'pending' }) });
  assert.equal(niente, null);
});

test('needsRefresh: solo licenze a tempo vicine alla scadenza; a vita mai', () => {
  const now = 1_000_000_000_000;
  assert.equal(needsRefresh({ key: 'k', exp: now + 3 * 86_400_000 }, now), true);
  assert.equal(needsRefresh({ key: 'k', exp: now + 30 * 86_400_000 }, now), false);
  assert.equal(needsRefresh({ key: 'k', exp: null }, now), false);
});

test('refreshLicense: consegna solo una licenza rinnovata; errori o risposte vuote = nessun cambiamento', async () => {
  assert.equal(await refreshLicense('a.b', { fetchImpl: async () => Response.json({ status: 'renewed', license: 'c.d' }) }), 'c.d');
  assert.equal(await refreshLicense('a.b', { fetchImpl: async () => Response.json({ status: 'current' }) }), null);
  assert.equal(await refreshLicense('a.b', { fetchImpl: async () => { throw new Error('offline'); } }), null);
});

test('updateRevocations: accetta un elenco firmato più recente, rifiuta falsi e copie vecchie, offline tiene quello noto', async () => {
  const { publicKeyB64, firma } = await firmatore();
  const estraneo = await firmatore();
  const nuovo = await firma({ v: 1, issuedAt: 200, ids: ['x'] });
  const r1 = await updateRevocations(null, { publicKeyB64, now: 1e12, fetchImpl: async () => Response.json({ token: nuovo }) });
  assert.deepEqual(r1.ids, ['x']);
  const falso = await estraneo.firma({ v: 1, issuedAt: 999, ids: [] });
  const r2 = await updateRevocations({ ...r1, checkedAt: 0 }, { publicKeyB64, now: 1e12, fetchImpl: async () => Response.json({ token: falso }) });
  assert.deepEqual(r2.ids, ['x']);
  const vecchio = await firma({ v: 1, issuedAt: 100, ids: [] });
  const r3 = await updateRevocations({ ...r1, checkedAt: 0 }, { publicKeyB64, now: 1e12, fetchImpl: async () => Response.json({ token: vecchio }) });
  assert.deepEqual(r3.ids, ['x']);
  let chiamate = 0;
  await updateRevocations({ ...r1, checkedAt: 1e12 }, { publicKeyB64, now: 1e12 + REVOCATIONS_EVERY_MS - 1, fetchImpl: async () => { chiamate++; return Response.json({}); } });
  assert.equal(chiamate, 0);
});

test('portale: accetta solo indirizzi del portale Stripe', async () => {
  assert.equal(await openBillingPortal('a.b', { fetchImpl: async () => Response.json({ url: 'https://billing.stripe.com/p/session/x' }) }), 'https://billing.stripe.com/p/session/x');
  assert.equal(await openBillingPortal('a.b', { fetchImpl: async () => Response.json({ url: 'https://evil.example/' }) }), null);
  assert.equal(await openBillingPortal('a.b', { fetchImpl: async () => Response.json({ error: 'no_subscription' }, { status: 404 }) }), null);
});
