import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, handleRequest } from './telemetry-worker.js';

// KV finta, stessa forma dell'API reale di Cloudflare Workers KV (get/put/list
// con cursor) — sufficiente per testare la logica senza un account cloud.
function fakeKv() {
  const store = new Map();
  return {
    store,
    async get(key) { return store.get(key) ?? null; },
    async put(key, value) { store.set(key, value); },
    async list({ prefix = '', cursor } = {}) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name }));
      return { keys, list_complete: true, cursor: null };
    },
  };
}

test('computeStats: nessun dato → tutto a zero, mai un numero inventato', async () => {
  const kv = fakeKv();
  const r = await computeStats(kv, { now: new Date('2026-07-27') });
  assert.equal(r.totalInstallsEver, 0);
  assert.equal(r.currentMonthActive, 0);
  assert.equal(r.retentionRateMonthOverMonth, null);
});

test('computeStats: conta installazioni uniche per id, non per evento', async () => {
  const kv = fakeKv();
  await kv.put('install:a', '1');
  await kv.put('install:a', '2'); // stesso id, sovrascrive: non raddoppia
  await kv.put('install:b', '1');
  const r = await computeStats(kv, { now: new Date('2026-07-27') });
  assert.equal(r.totalInstallsEver, 2);
});

test('computeStats: attivi del mese corretti, mesi diversi non si mischiano', async () => {
  const kv = fakeKv();
  await kv.put('active:2026-07:a', '1');
  await kv.put('active:2026-07:b', '1');
  await kv.put('active:2026-06:a', '1');
  const r = await computeStats(kv, { now: new Date('2026-07-27') });
  assert.equal(r.activeByMonth['2026-07'], 2);
  assert.equal(r.activeByMonth['2026-06'], 1);
  assert.equal(r.currentMonthActive, 2);
});

test('computeStats: retention = quota di id attivi anche il mese dopo', async () => {
  const kv = fakeKv();
  // giugno: a,b,c attivi. luglio: a,b attivi (c non torna), d nuovo.
  await kv.put('active:2026-06:a', '1'); await kv.put('active:2026-06:b', '1'); await kv.put('active:2026-06:c', '1');
  await kv.put('active:2026-07:a', '1'); await kv.put('active:2026-07:b', '1'); await kv.put('active:2026-07:d', '1');
  const r = await computeStats(kv, { now: new Date('2026-07-27') });
  assert.equal(r.retentionRateMonthOverMonth, 0.667); // 2 di 3 (a,b su a,b,c)
});

test('handleRequest: POST install → salva, GET /stats col token corretto → lo conta', async () => {
  const kv = fakeKv();
  const env = { MOMENTUM_TELEMETRY: kv, STATS_TOKEN: 'segreto' };
  const post = await handleRequest(new Request('https://x.test/', { method: 'POST', body: JSON.stringify({ id: 'dev-1', event: 'install' }) }), env);
  assert.equal(post.status, 200);
  const stats = await handleRequest(new Request('https://x.test/stats?token=segreto'), env);
  const json = await stats.json();
  assert.equal(json.totalInstallsEver, 1);
});

test('handleRequest: GET /stats senza token corretto → 401, mai i numeri esposti', async () => {
  const kv = fakeKv();
  const env = { MOMENTUM_TELEMETRY: kv, STATS_TOKEN: 'segreto' };
  const r = await handleRequest(new Request('https://x.test/stats?token=sbagliato'), env);
  assert.equal(r.status, 401);
});

test('handleRequest: POST senza id o con event non valido → 400, mai salvato in silenzio', async () => {
  const kv = fakeKv();
  const env = { MOMENTUM_TELEMETRY: kv, STATS_TOKEN: 'segreto' };
  const r1 = await handleRequest(new Request('https://x.test/', { method: 'POST', body: JSON.stringify({ event: 'install' }) }), env);
  assert.equal(r1.status, 400);
  const r2 = await handleRequest(new Request('https://x.test/', { method: 'POST', body: JSON.stringify({ id: 'x', event: 'boh' }) }), env);
  assert.equal(r2.status, 400);
  assert.equal(kv.store.size, 0);
});

test('handleRequest: rotta sconosciuta → 404', async () => {
  const kv = fakeKv();
  const env = { MOMENTUM_TELEMETRY: kv, STATS_TOKEN: 'segreto' };
  const r = await handleRequest(new Request('https://x.test/altro'), env);
  assert.equal(r.status, 404);
});

// ── event: 'feature' (2026-08-26) — pietre miliari anonime, elenco chiuso ──

test('handleRequest: POST feature con chiave valida → salva, conta unico per (chiave,mese,id)', async () => {
  const kv = fakeKv();
  const env = { MOMENTUM_TELEMETRY: kv, STATS_TOKEN: 'segreto' };
  const post = async (body) => handleRequest(new Request('https://x.test/', { method: 'POST', body: JSON.stringify(body) }), env);
  assert.equal((await post({ id: 'a', event: 'feature', key: 'onboarding_completed', month: '2026-07' })).status, 200);
  assert.equal((await post({ id: 'a', event: 'feature', key: 'onboarding_completed', month: '2026-07' })).status, 200); // stesso id, sovrascrive
  assert.equal((await post({ id: 'b', event: 'feature', key: 'onboarding_completed', month: '2026-07' })).status, 200);
  const stats = await (await handleRequest(new Request('https://x.test/stats?token=segreto'), env)).json();
  assert.equal(stats.featureByMonth['2026-07'].onboarding_completed, 2);
});

test('handleRequest: POST feature con chiave NON in whitelist → 400, mai salvato (difesa in profondità sul server)', async () => {
  const kv = fakeKv();
  const env = { MOMENTUM_TELEMETRY: kv, STATS_TOKEN: 'segreto' };
  const r = await handleRequest(new Request('https://x.test/', { method: 'POST', body: JSON.stringify({ id: 'a', event: 'feature', key: 'chiave_mai_vista', month: '2026-07' }) }), env);
  assert.equal(r.status, 400);
  assert.equal(kv.store.size, 0);
});

test('handleRequest: POST feature senza mese valido → 400', async () => {
  const kv = fakeKv();
  const env = { MOMENTUM_TELEMETRY: kv, STATS_TOKEN: 'segreto' };
  const r = await handleRequest(new Request('https://x.test/', { method: 'POST', body: JSON.stringify({ id: 'a', event: 'feature', key: 'onboarding_completed', month: 'non-un-mese' }) }), env);
  assert.equal(r.status, 400);
});

test('computeStats: featureByMonth separa chiavi e mesi diversi, mai un totale mischiato', async () => {
  const kv = fakeKv();
  await kv.put('feature:onboarding_completed:2026-07:a', '1');
  await kv.put('feature:onboarding_completed:2026-07:b', '1');
  await kv.put('feature:analysis_tensor_opened:2026-07:a', '1');
  await kv.put('feature:onboarding_completed:2026-06:a', '1');
  const r = await computeStats(kv, { now: new Date('2026-07-27') });
  assert.equal(r.featureByMonth['2026-07'].onboarding_completed, 2);
  assert.equal(r.featureByMonth['2026-07'].analysis_tensor_opened, 1);
  assert.equal(r.featureByMonth['2026-06'].onboarding_completed, 1);
});

// ── DAU/piattaforma/provenienza (2026-08-28, richiesto esplicitamente
// dall'utente/investitori: "utenti attivi al giorno" + "cos'altro chiederebbero
// gli investitori") ──

test('handleRequest: POST active_day → salva, computeStats lo conta come currentDayActive (per la data giusta)', async () => {
  const kv = fakeKv();
  const env = { MOMENTUM_TELEMETRY: kv, STATS_TOKEN: 'segreto' };
  await handleRequest(new Request('https://x.test/', { method: 'POST', body: JSON.stringify({ id: 'a', event: 'active_day', day: '2026-07-27' }) }), env);
  await handleRequest(new Request('https://x.test/', { method: 'POST', body: JSON.stringify({ id: 'b', event: 'active_day', day: '2026-07-27' }) }), env);
  // /stats (via handleRequest) non accetta una data finta: usa sempre "ora"
  // vero — qui si verifica computeStats direttamente con la data del test,
  // stesso pattern già in uso sopra per gli altri test sensibili alla data.
  const stats = await computeStats(kv, { now: new Date('2026-07-27') });
  assert.equal(stats.currentDayActive, 2);
});

test('handleRequest: POST active_day con giorno non valido → 400', async () => {
  const kv = fakeKv();
  const env = { MOMENTUM_TELEMETRY: kv, STATS_TOKEN: 'segreto' };
  const r = await handleRequest(new Request('https://x.test/', { method: 'POST', body: JSON.stringify({ id: 'a', event: 'active_day', day: 'non-un-giorno' }) }), env);
  assert.equal(r.status, 400);
});

test('computeStats: dauMauRatio = attivi oggi / attivi questo mese, null se nessuno attivo questo mese', async () => {
  const kv = fakeKv();
  const r0 = await computeStats(kv, { now: new Date('2026-07-27') });
  assert.equal(r0.dauMauRatio, null);
  await kv.put('active:2026-07:a', '1'); await kv.put('active:2026-07:b', '1'); await kv.put('active:2026-07:c', '1'); await kv.put('active:2026-07:d', '1');
  await kv.put('active_day:2026-07-27:a', '1');
  const r1 = await computeStats(kv, { now: new Date('2026-07-27') });
  assert.equal(r1.currentDayActive, 1);
  assert.equal(r1.currentMonthActive, 4);
  assert.equal(r1.dauMauRatio, 0.25);
});

test('handleRequest: POST install con platform/source validi → contati in installsByPlatform/installsBySource', async () => {
  const kv = fakeKv();
  const env = { MOMENTUM_TELEMETRY: kv, STATS_TOKEN: 'segreto' };
  const post = (body) => handleRequest(new Request('https://x.test/', { method: 'POST', body: JSON.stringify(body) }), env);
  await post({ id: 'a', event: 'install', platform: 'ios', source: 'invito' });
  await post({ id: 'b', event: 'install', platform: 'ios', source: 'diretto' });
  await post({ id: 'c', event: 'install', platform: 'android', source: 'diretto' });
  const stats = await (await handleRequest(new Request('https://x.test/stats?token=segreto'), env)).json();
  assert.equal(stats.totalInstallsEver, 3);
  assert.deepEqual(stats.installsByPlatform, { ios: 2, android: 1 });
  assert.deepEqual(stats.installsBySource, { invito: 1, diretto: 2 });
  assert.equal(stats.viralShare, 0.333);
});

test('handleRequest: POST install SENZA platform/source (client vecchio) → salva comunque, nessun errore, contatori platform/source assenti per quell\'id', () => {
  return (async () => {
    const kv = fakeKv();
    const env = { MOMENTUM_TELEMETRY: kv, STATS_TOKEN: 'segreto' };
    const r = await handleRequest(new Request('https://x.test/', { method: 'POST', body: JSON.stringify({ id: 'a', event: 'install' }) }), env);
    assert.equal(r.status, 200);
    const stats = await (await handleRequest(new Request('https://x.test/stats?token=segreto'), env)).json();
    assert.equal(stats.totalInstallsEver, 1);
    assert.deepEqual(stats.installsByPlatform, {});
    assert.equal(stats.viralShare, null);
  })();
});

test('handleRequest: POST install con platform/source FUORI whitelist → scartati in silenzio, install comunque salvato', async () => {
  const kv = fakeKv();
  const env = { MOMENTUM_TELEMETRY: kv, STATS_TOKEN: 'segreto' };
  const r = await handleRequest(new Request('https://x.test/', { method: 'POST', body: JSON.stringify({ id: 'a', event: 'install', platform: 'linux-hackerato', source: 'boh' }) }), env);
  assert.equal(r.status, 200);
  const stats = await (await handleRequest(new Request('https://x.test/stats?token=segreto'), env)).json();
  assert.equal(stats.totalInstallsEver, 1);
  assert.deepEqual(stats.installsByPlatform, {});
  assert.deepEqual(stats.installsBySource, {});
});
