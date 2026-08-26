import test from 'node:test';
import assert from 'node:assert/strict';
import { isTelemetryEnabled, setTelemetryEnabled, getAnonId, sendTelemetryPings, needsTelemetryDisclosure, markTelemetryDisclosed, sendFeatureEvent, FEATURE_KEYS } from './telemetry.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v), _map: map };
}

test('isTelemetryEnabled/setTelemetryEnabled: ATTIVO di default (opt-out, non opt-in)', () => {
  const s = fakeStorage();
  assert.equal(isTelemetryEnabled(s), true); // nessuna preferenza salvata → attivo
  setTelemetryEnabled(false, s);
  assert.equal(isTelemetryEnabled(s), false);
  setTelemetryEnabled(true, s);
  assert.equal(isTelemetryEnabled(s), true);
});

test('needsTelemetryDisclosure: vero solo prima che l\'avviso sia stato mostrato', () => {
  const s = fakeStorage();
  assert.equal(needsTelemetryDisclosure(s), true);
  markTelemetryDisclosed(s);
  assert.equal(needsTelemetryDisclosure(s), false);
});

test('getAnonId: genera e persiste un id, mai un id diverso ad ogni chiamata', () => {
  const s = fakeStorage();
  const id1 = getAnonId(s, () => 'uuid-1');
  const id2 = getAnonId(s, () => 'uuid-2'); // non deve rigenerarlo
  assert.equal(id1, 'uuid-1');
  assert.equal(id2, 'uuid-1');
});

test('sendTelemetryPings: senza endpoint → no-op, mai un fetch', async () => {
  const s = fakeStorage({ momentum_telemetry_opt_in: '1' });
  let called = false;
  const r = await sendTelemetryPings(null, { storage: s, fetchImpl: async () => { called = true; } });
  assert.equal(called, false);
  assert.deepEqual(r.sent, []);
});

test('sendTelemetryPings: disattivato esplicitamente dall\'utente → no-op, mai un fetch', async () => {
  const s = fakeStorage({ momentum_telemetry_opt_in: '0' });
  let called = false;
  await sendTelemetryPings('https://x.test', { storage: s, fetchImpl: async () => { called = true; } });
  assert.equal(called, false);
});

test('sendTelemetryPings: primo avvio → invia install E active, poi mai più install', async () => {
  const s = fakeStorage({ momentum_telemetry_opt_in: '1' });
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push(JSON.parse(opts.body)); return { ok: true }; };
  const now = new Date('2026-07-27');
  const r1 = await sendTelemetryPings('https://x.test', { storage: s, fetchImpl, now });
  assert.deepEqual(r1.sent, ['install', 'active']);
  const r2 = await sendTelemetryPings('https://x.test', { storage: s, fetchImpl, now });
  assert.deepEqual(r2.sent, []); // stesso mese, già inviato tutto
  assert.equal(calls.length, 2);
  assert.equal(calls[0].event, 'install');
  assert.equal(calls[1].event, 'active');
});

test('sendTelemetryPings: mese nuovo → invia di nuovo "active" ma non "install"', async () => {
  const s = fakeStorage({ momentum_telemetry_opt_in: '1' });
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push(JSON.parse(opts.body)); return { ok: true }; };
  await sendTelemetryPings('https://x.test', { storage: s, fetchImpl, now: new Date('2026-07-27') });
  await sendTelemetryPings('https://x.test', { storage: s, fetchImpl, now: new Date('2026-08-03') });
  assert.equal(calls.length, 3); // install+active luglio, active agosto
  assert.deepEqual(calls.map(c => c.event), ['install', 'active', 'active']);
});

test('sendTelemetryPings: id mai cambia tra ping diversi', async () => {
  const s = fakeStorage({ momentum_telemetry_opt_in: '1' });
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push(JSON.parse(opts.body)); return { ok: true }; };
  await sendTelemetryPings('https://x.test', { storage: s, fetchImpl, now: new Date('2026-07-27') });
  const ids = new Set(calls.map(c => c.id));
  assert.equal(ids.size, 1);
});

test('sendTelemetryPings: fetch che fallisce → non segna come inviato, mai un crash', async () => {
  const s = fakeStorage({ momentum_telemetry_opt_in: '1' });
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  const r = await sendTelemetryPings('https://x.test', { storage: s, fetchImpl, now: new Date('2026-07-27') });
  assert.deepEqual(r.sent, []);
});

// ── sendFeatureEvent (2026-08-26): pietre miliari anonime, elenco chiuso ──

test('sendFeatureEvent: chiave fuori dall\'elenco chiuso → no-op, mai un fetch (mai testo libero)', async () => {
  const s = fakeStorage({ momentum_telemetry_opt_in: '1' });
  let called = false;
  const r = await sendFeatureEvent('https://x.test', 'qualcosa_mai_registrato', { storage: s, fetchImpl: async () => { called = true; } });
  assert.equal(called, false);
  assert.equal(r.sent, false);
});

test('sendFeatureEvent: senza endpoint o disattivato → no-op', async () => {
  const s1 = fakeStorage({ momentum_telemetry_opt_in: '1' });
  let called = false;
  await sendFeatureEvent(null, FEATURE_KEYS[0], { storage: s1, fetchImpl: async () => { called = true; } });
  assert.equal(called, false);
  const s2 = fakeStorage({ momentum_telemetry_opt_in: '0' });
  await sendFeatureEvent('https://x.test', FEATURE_KEYS[0], { storage: s2, fetchImpl: async () => { called = true; } });
  assert.equal(called, false);
});

test('sendFeatureEvent: chiave valida → invia una volta, idempotente nello stesso mese', async () => {
  const s = fakeStorage({ momentum_telemetry_opt_in: '1' });
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push(JSON.parse(opts.body)); return { ok: true }; };
  const now = new Date('2026-07-27');
  const r1 = await sendFeatureEvent('https://x.test', 'onboarding_completed', { storage: s, fetchImpl, now });
  assert.equal(r1.sent, true);
  const r2 = await sendFeatureEvent('https://x.test', 'onboarding_completed', { storage: s, fetchImpl, now });
  assert.equal(r2.sent, false, 'stesso mese, stessa chiave: non rimanda');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].event, 'feature');
  assert.equal(calls[0].key, 'onboarding_completed');
  assert.equal(calls[0].month, '2026-07');
});

test('sendFeatureEvent: mese nuovo → può rimandare la STESSA chiave', async () => {
  const s = fakeStorage({ momentum_telemetry_opt_in: '1' });
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push(JSON.parse(opts.body)); return { ok: true }; };
  await sendFeatureEvent('https://x.test', 'analysis_tensor_opened', { storage: s, fetchImpl, now: new Date('2026-07-27') });
  await sendFeatureEvent('https://x.test', 'analysis_tensor_opened', { storage: s, fetchImpl, now: new Date('2026-08-03') });
  assert.equal(calls.length, 2);
});

test('sendFeatureEvent: due chiavi diverse nello stesso mese sono entrambe indipendenti', async () => {
  const s = fakeStorage({ momentum_telemetry_opt_in: '1' });
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push(JSON.parse(opts.body)); return { ok: true }; };
  const now = new Date('2026-07-27');
  await sendFeatureEvent('https://x.test', 'onboarding_completed', { storage: s, fetchImpl, now });
  await sendFeatureEvent('https://x.test', 'analysis_tensor_opened', { storage: s, fetchImpl, now });
  assert.equal(calls.length, 2);
});

test('sendFeatureEvent: fetch che fallisce → non segna come inviato, mai un crash', async () => {
  const s = fakeStorage({ momentum_telemetry_opt_in: '1' });
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  const r = await sendFeatureEvent('https://x.test', 'onboarding_completed', { storage: s, fetchImpl, now: new Date('2026-07-27') });
  assert.equal(r.sent, false);
});
