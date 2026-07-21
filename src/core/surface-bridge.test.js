import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectSurface, announcePresence, readPresence, isPwaInstalled,
  publishUpdateFinding, readUpdateFinding, publishVaultHandoff, pendingHandoff,
  publishCoreLearning, absorbCoreLearning, bridgeStatus, BRIDGE_CACHE,
} from './surface-bridge.js';
import { initHierarchical, observeHierarchical, predictHierarchical, mergeHierarchical } from '../ai/hierarchical-bandit.js';

const T0 = Date.parse('2026-07-21T10:00:00Z');
const DAY = 86_400_000;

// CacheStorage finta ma fedele: e' l'unico canale che su iOS attraversa il
// confine tra PWA installata e Safari, quindi va simulato davvero.
function fakeCaches() {
  const store = new Map();
  return {
    _store: store,
    async open(name) {
      if (!store.has(name)) store.set(name, new Map());
      const c = store.get(name);
      return {
        async put(url, res) { c.set(url, await res.text()); },
        async match(url) {
          if (!c.has(url)) return undefined;
          const body = c.get(url);
          return { json: async () => JSON.parse(body) };
        },
      };
    },
  };
}
const asPwa = { matchMediaImpl: () => ({ matches: true }) };
const asBrowser = { matchMediaImpl: () => ({ matches: false }), navigatorImpl: {} };

test('detectSurface: PWA vs browser, e iOS storico (navigator.standalone)', () => {
  assert.equal(detectSurface(asPwa).surface, 'pwa');
  assert.equal(detectSurface(asBrowser).surface, 'browser');
  assert.equal(detectSurface({ matchMediaImpl: () => ({ matches: false }), navigatorImpl: { standalone: true } }).surface, 'pwa');
  // ambiente senza matchMedia: prudente, non esplode
  assert.equal(detectSurface({ matchMediaImpl: null, navigatorImpl: null }).surface, 'browser');
});

test('il canale NON usa il prefisso che il service worker cancella', () => {
  assert.ok(!BRIDGE_CACHE.startsWith('momentum-vault-'),
    'sw.js elimina le cache momentum-vault-*: il ponte verrebbe distrutto');
});

test('IL CASO CHIESTO: apro dal browser e Momentum si riconosce come gia installata', async () => {
  const cachesImpl = fakeCaches();
  // giorno 1: l'utente usa la PWA installata
  await announcePresence({ ...asPwa, cachesImpl, now: T0, version: '10.0.0' });
  // giorno 5: ci arriva da una ricerca nel browser
  const stato = await bridgeStatus({ ...asBrowser, cachesImpl, now: T0 + 4 * DAY });
  assert.equal(stato.surface, 'browser');
  assert.equal(stato.pwaInstalled, true, 'deve riconoscere la PWA installata');
  assert.match(stato.message, /gia' Momentum installata/);
});

test('la traccia della PWA scade se non si fa piu viva (disinstallata)', async () => {
  const cachesImpl = fakeCaches();
  await announcePresence({ ...asPwa, cachesImpl, now: T0 });
  assert.equal(await isPwaInstalled({ ...asBrowser, cachesImpl, now: T0 + 10 * DAY }), true);
  assert.equal(await isPwaInstalled({ ...asBrowser, cachesImpl, now: T0 + 400 * DAY }), false);
});

test('AGGIORNAMENTO: chi lo trova lo passa all\'altra superficie', async () => {
  const cachesImpl = fakeCaches();
  // il browser scopre la versione nuova firmata
  await publishUpdateFinding({ version: '10.4.0', url: 'https://cdn.momentum.it/u.json' },
    { ...asBrowser, cachesImpl, now: T0 });
  // la PWA, alla sua prossima apertura, la trova gia' pronta
  const f = await readUpdateFinding({ ...asPwa, cachesImpl });
  assert.equal(f.version, '10.4.0');
  assert.equal(f.foundBy, 'browser');
});

test('l\'annuncio di aggiornamento non retrocede mai', async () => {
  const cachesImpl = fakeCaches();
  await publishUpdateFinding({ version: '10.4.0' }, { ...asBrowser, cachesImpl, now: T0 });
  const ok = await publishUpdateFinding({ version: '10.1.0' }, { ...asPwa, cachesImpl, now: T0 + 1000 });
  assert.equal(ok, false, 'una versione piu vecchia non deve sovrascrivere');
  assert.equal((await readUpdateFinding({ cachesImpl })).version, '10.4.0');
});

test('STESSI DATI: handoff cifrato disponibile all\'altra superficie', async () => {
  const cachesImpl = fakeCaches();
  await publishVaultHandoff({ envelope: { ct: 'xxx', iv: 'yyy' }, digest: 'D1', txCount: 1777 },
    { ...asPwa, cachesImpl, now: T0 });

  const daBrowser = await pendingHandoff('D0', { ...asBrowser, cachesImpl });
  assert.ok(daBrowser, 'il browser deve vedere che c\'e\' da recuperare');
  assert.equal(daBrowser.txCount, 1777);
  assert.equal(daBrowser.envelope.ct, 'xxx');

  // gia' allineati: non si tocca nulla
  assert.equal(await pendingHandoff('D1', { ...asBrowser, cachesImpl }), null);
  // e non ci si recupera da soli
  assert.equal(await pendingHandoff('D0', { ...asPwa, cachesImpl }), null);
});

test('AUTO-ADDESTRAMENTO: cio che il Core impara nel browser arriva alla PWA', async () => {
  const cachesImpl = fakeCaches();

  // nel browser l'utente categorizza tre punti vendita di una catena
  const nelBrowser = initHierarchical();
  for (const p of ['esselunga via a', 'esselunga via b', 'esselunga via c']) {
    observeHierarchical(nelBrowser, ['esselunga', p], 'spesa', T0, 4);
  }
  await publishCoreLearning({ merchantHierarchy: nelBrowser }, { ...asBrowser, cachesImpl, now: T0 });

  // la PWA parte senza saperne nulla
  const nellaPwa = { merchantHierarchy: initHierarchical() };
  assert.equal(predictHierarchical(nellaPwa.merchantHierarchy, ['esselunga', 'esselunga via z'], T0).label, null);

  const res = await absorbCoreLearning(nellaPwa, mergeHierarchical, { ...asPwa, cachesImpl });
  assert.equal(res.merged, true);
  assert.equal(res.from, 'browser');

  // ora la PWA generalizza su un punto vendita mai visto da NESSUNA delle due
  const p = predictHierarchical(nellaPwa.merchantHierarchy, ['esselunga', 'esselunga via z'], T0);
  assert.equal(p.label, 'spesa', 'l\'apprendimento ha attraversato la superficie');
  assert.ok(p.p > 0.7);
});

test('non si assorbe il proprio stesso annuncio (niente auto-conferma)', async () => {
  const cachesImpl = fakeCaches();
  const m = initHierarchical();
  observeHierarchical(m, ['x'], 'spesa', T0, 5);
  await publishCoreLearning({ merchantHierarchy: m }, { ...asPwa, cachesImpl, now: T0 });
  const res = await absorbCoreLearning({ merchantHierarchy: initHierarchical() }, mergeHierarchical,
    { ...asPwa, cachesImpl });
  assert.equal(res.merged, false, 'rileggersi da soli gonfierebbe i conteggi');
});

test('senza Cache Storage non esplode: degrada in silenzio', async () => {
  const opts = { ...asBrowser, cachesImpl: null };
  assert.equal(await readPresence(opts) && Object.keys(await readPresence(opts)).length, 0);
  assert.equal(await isPwaInstalled(opts), false);
  assert.equal(await readUpdateFinding(opts), null);
});
