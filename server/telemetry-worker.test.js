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
