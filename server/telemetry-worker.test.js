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

test('diagnostica senza identità: viene contata separatamente dagli utenti attivi', async () => {
  const kv = fakeKv();
  const env = { MOMENTUM_TELEMETRY: kv };
  const response = await handleRequest(new Request('https://x.test/', {
    method: 'POST', body: JSON.stringify({ event: 'diagnostic', key: 'app_ready',
      day: '2026-09-08', platform: 'ios', appVersion: '50.1.0' }),
  }), env);
  assert.equal(response.status, 200);
  const stats = await computeStats(kv, { now: new Date('2026-09-08') });
  assert.deepEqual(stats.diagnosticByDay, { '2026-09-08': { app_ready: 1 } });
  assert.equal(stats.totalInstallsEver, 0);
  assert.equal(stats.currentMonthActive, 0);
});

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

test('trip events travel from client to worker without trip contents', async () => {
 const { sendFeatureEvent } = await import('../src/core/telemetry.js');
 const { TRIP_TELEMETRY_EVENTS } = await import('../src/core/trip-telemetry-events.js');
 const values = new Map([['momentum_anon_id','test-device']]);
 const storage = {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const kv = fakeKv(); const now=new Date('2026-09-20');
 const fetchImpl=async(url,options)=>{
  assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(),['event','id','key','month']);
  return handleRequest(new Request(url,options),{MOMENTUM_TELEMETRY:kv});
 };
 for(const key of TRIP_TELEMETRY_EVENTS) assert.equal((await sendFeatureEvent('https://x.test/',key,{storage,fetchImpl,now})).sent,true);
 const stats=await computeStats(kv,{now});
 assert.equal(Object.keys(stats.featureByMonth['2026-09']).length,TRIP_TELEMETRY_EVENTS.length);
});

test('PWA JSON preflight succeeds only for configured origins and never exposes stats', async()=>{
 const {fetchTelemetry}=await import('./telemetry-worker.js');
 const env={MOMENTUM_TELEMETRY:fakeKv()};
 const headers={Origin:'https://momentum-finance.pages.dev','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'};
 const pre=await fetchTelemetry(new Request('https://collector.test/',{method:'OPTIONS',headers}),env);
 assert.equal(pre.status,204); assert.equal(pre.headers.get('Access-Control-Allow-Origin'),headers.Origin);
 const bad=await fetchTelemetry(new Request('https://collector.test/',{method:'OPTIONS',headers:{...headers,Origin:'https://evil.test'}}),env);
 assert.equal(bad.status,403);
 const stats=await fetchTelemetry(new Request('https://collector.test/stats',{headers}),env);
 assert.equal(stats.headers.get('Access-Control-Allow-Origin'),null);
});
test('all product keys accepted; arbitrary feature text rejected',async()=>{
 const {PRODUCT_TELEMETRY_EVENTS}=await import('../src/core/product-telemetry-events.js');
 const env={MOMENTUM_TELEMETRY:fakeKv()};
 for(const key of [...PRODUCT_TELEMETRY_EVENTS,'private words']) {
  const result=await handleRequest(new Request('https://collector.test/',{method:'POST',body:JSON.stringify({id:'test-device',event:'feature',key,month:'2026-09'})}),env);
  assert.equal(result.status,key==='private words'?400:200);
 }
});

test('first visit is distinct from confirmed installation; presence expires by server timestamp',async()=>{
 const kv=fakeKv();const metadata=new Map(); const put=kv.put;const list=kv.list;
 kv.put=async(key,value,options)=>{await put(key,value);metadata.set(key,options?.metadata)};
 kv.list=async(options)=>{const result=await list(options);result.keys=result.keys.map(key=>({...key,metadata:metadata.get(key.name)}));return result};
 const env={MOMENTUM_TELEMETRY:kv};
 for(const event of ['install','pwa_installed','pwa_installed','standalone_opened','presence'])
  assert.equal((await handleRequest(new Request('https://x.test/',{method:'POST',body:JSON.stringify({id:'a',event})}),env)).status,200);
 const stats=await computeStats(kv);
 assert.equal(stats.firstSeenDevices,1);assert.equal(stats.confirmedPwaInstallDevices,1);assert.equal(stats.standaloneObservedDevices,1);assert.equal(stats.recentlyVisibleDevices,1);
 const stale=await computeStats(kv,{now:new Date(Date.now()+301000)});assert.equal(stale.recentlyVisibleDevices,0);
});

test('legacy first starts stay historical; existing installed apps are recognized without double counting',async()=>{
 const kv=fakeKv();await kv.put('install:old-browser','1');
 const before=await computeStats(kv);assert.equal(before.firstSeenDevices,1);assert.equal(before.installedDevicesObserved,0);
 await kv.put('standalone_opened:old-browser','1');
 await kv.put('pwa_installed:old-browser','1');
 await kv.put('standalone_opened:other-browser','1');
 const after=await computeStats(kv);
 assert.equal(after.firstSeenDevices,1);assert.equal(after.installedDevicesObserved,2);
 assert.equal(after.confirmedPwaInstallDevices,1);assert.equal(after.standaloneObservedDevices,2);
});
