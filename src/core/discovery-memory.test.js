import test from 'node:test';
import assert from 'node:assert/strict';
const { initDiscoveryMemory, recordDiscovery, sourceScore, rankSources, sourceKey } = await import('./discovery-memory.js');
const { resolveUpdate, canonicalMessage, makeEcdsaVerifier } = await import('./update-locator.js');

test('sourceKey: normalizza all\'host (impara per host/sotto-dominio, non per path)', () => {
  assert.equal(sourceKey('https://momentum-lala.com/u.json'), 'momentum-lala.com');
  assert.equal(sourceKey('https://a.momentum.it/deep/path?x=1'), 'a.momentum.it');
});

test('APPRENDIMENTO: una fonte che funziona sale, una che fallisce scende', () => {
  let mem = initDiscoveryMemory();
  for (let i = 0; i < 10; i++) mem = recordDiscovery(mem, 'https://buono.com/u', true);
  for (let i = 0; i < 10; i++) mem = recordDiscovery(mem, 'https://rotto.com/u', false);
  assert.ok(sourceScore(mem, 'https://buono.com/u') > 0.8);
  assert.ok(sourceScore(mem, 'https://rotto.com/u') < 0.2);
  const ranked = rankSources(['https://rotto.com/u', 'https://buono.com/u'], mem);
  assert.equal(ranked[0], 'https://buono.com/u'); // la buona provata per prima
});

test('PREDITTIVO: l\'ultimo indirizzo buono viene provato per primo (localita\')', () => {
  let mem = initDiscoveryMemory();
  mem = recordDiscovery(mem, 'https://ultimo-buono.com/u', true);
  const ranked = rankSources(['https://a.com/u', 'https://b.com/u', 'https://ultimo-buono.com/u'], mem);
  assert.equal(ranked[0], 'https://ultimo-buono.com/u');
});

test('GARANZIA integrazione: resolveUpdate impara e alla 2a volta prova prima la fonte giusta', async () => {
  const subtle = globalThis.crypto.subtle;
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const verify = makeEcdsaVerifier(await subtle.exportKey('jwk', kp.publicKey));
  const b64 = (u8) => Buffer.from(u8).toString('base64');
  const sign = async (mf) => { const s = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, new TextEncoder().encode(canonicalMessage(mf))); return { ...mf, sig: b64(new Uint8Array(s)) }; };
  const mf = await sign({ version: '60.0.0', url: 'https://vivo.com/app.js', sha256: 'h' });

  const probed = [];
  const fetchImpl = async (url) => { probed.push(url); if (url === 'https://vivo.com/u') return { ok: true, json: async () => mf }; throw new Error('morto'); };

  const mem = initDiscoveryMemory();
  const beacons = ['https://morto1.com/u', 'https://morto2.com/u', 'https://vivo.com/u'];
  const r1 = await resolveUpdate({ beacons, fetchImpl, verifyImpl: verify, currentVersion: '59.0.0', memory: mem });
  assert.equal(r1.found, true);

  // 2a chiamata: 'vivo.com' e' l'ultimo buono → provato per PRIMO (meno tentativi)
  probed.length = 0;
  const r2 = await resolveUpdate({ beacons, fetchImpl, verifyImpl: verify, currentVersion: '59.0.0', memory: mem });
  assert.equal(r2.found, true);
  assert.equal(probed[0], 'https://vivo.com/u', 'la 2a volta prova subito la fonte che funziona');
});

// ── v11: gerarchia dei sotto-domini ─────────────────────────────────────────
const { domainPath, sourceReliability, explainSource, mergeDiscoveryMemory } = await import('./discovery-memory.js');

test('domainPath: gerarchia DNS dalla radice registrabile alla foglia', () => {
  assert.deepEqual(domainPath('https://eu.cdn.momentum.it/x.json'),
    ['it', 'momentum.it', 'cdn.momentum.it', 'eu.cdn.momentum.it']);
  // suffisso multi-parte: 'co.uk' non e' un dominio "parente"
  assert.deepEqual(domainPath('https://cdn.momentum.co.uk'),
    ['co.uk', 'momentum.co.uk', 'cdn.momentum.co.uk']);
});

test('IL SALTO v11: un sotto-dominio MAI VISTO di un dominio noto parte in cima', () => {
  const mem = initDiscoveryMemory();
  const now = Date.parse('2026-07-21T10:00:00Z');
  for (const h of ['cdn', 'eu', 'app']) {
    for (let i = 0; i < 4; i++) recordDiscovery(mem, `https://${h}.momentum.it/u.json`, true, now);
  }
  // dominio ostile, ripetutamente fallito
  for (let i = 0; i < 8; i++) recordDiscovery(mem, 'https://mirror.sconosciuto.net/u.json', false, now);

  const nuovo = 'https://backup7.momentum.it/u.json';   // MAI visto
  assert.ok(sourceReliability(mem, nuovo, now) > 0.75,
    'il sotto-dominio nuovo eredita la fiducia del ramo');

  const ordine = rankSources([
    'https://mirror.sconosciuto.net/u.json',
    nuovo,
    'https://mai-visto-del-tutto.org/u.json',
  ], mem, now);
  assert.equal(ordine[0], nuovo, 'si prova per primo, al primo colpo');

  const e = explainSource(mem, nuovo, now);
  assert.equal(e.inherited, true);
  assert.match(e.reason, /eredito da/);
});

test('il TIPO di fonte si impara a parte (CT vs algoritmo)', () => {
  const mem = initDiscoveryMemory();
  const now = Date.parse('2026-07-21T10:00:00Z');
  for (let i = 0; i < 6; i++) {
    recordDiscovery(mem, `https://a${i}.tizio.com/u.json`, true, now, 'ct');
    recordDiscovery(mem, `https://b${i}.caio.com/u.json`, false, now, 'algo');
  }
  const viaCt = { url: 'https://nuovo1.altro.org/u.json', type: 'ct' };
  const viaAlgo = { url: 'https://nuovo2.altro.org/u.json', type: 'algo' };
  const ordine = rankSources([viaAlgo, viaCt], mem, now);
  assert.equal(ordine[0], viaCt.url, 'a parita di host ignoto, vince il tipo che funziona');
});

test('vault v10 (piatto) adottato a caldo senza perdere l\'appreso', () => {
  const vecchio = { sources: { 'cdn.momentum.it': { a: 6, b: 1, last: 1 } }, lastGood: null, version: 1 };
  const now = Date.parse('2026-07-21T10:00:00Z');
  // nessun campo gerarchico: deve migrarsi da solo alla prima lettura
  assert.ok(sourceReliability(vecchio, 'https://cdn.momentum.it/u.json', now) > 0.6);
  assert.ok(sourceReliability(vecchio, 'https://nuovo.momentum.it/u.json', now) > 0.55,
    'e l\'eredita\' vale anche per i sotto-domini mai visti del vecchio vault');
});

test('mesh: si federano i metadati di affidabilita, con tetto anti-poisoning', () => {
  const now = Date.parse('2026-07-21T10:00:00Z');
  const locale = initDiscoveryMemory();
  for (let i = 0; i < 5; i++) recordDiscovery(locale, 'https://cdn.momentum.it/u.json', true, now);
  for (let i = 0; i < 15; i++) recordDiscovery(locale, 'https://cdn.momentum.it/u.json', true, now);
  const prima = sourceReliability(locale, 'https://cdn.momentum.it/u.json', now);

  // peer ostile che DICHIARA 5000 fallimenti: il tetto lo riduce a maxPeerWeight
  const peer = initDiscoveryMemory();
  for (let i = 0; i < 5000; i++) recordDiscovery(peer, 'https://cdn.momentum.it/u.json', false, now);
  mergeDiscoveryMemory(locale, peer, { maxPeerWeight: 5 });
  const dopo = sourceReliability(locale, 'https://cdn.momentum.it/u.json', now);
  assert.ok(dopo > 0.5, 'un peer da solo non ribalta l\'esperienza locale');

  // GARANZIA precisa: 5000 fallimenti dichiarati non pesano piu' di 5 veri
  const onesto = initDiscoveryMemory();
  for (let i = 0; i < 20; i++) recordDiscovery(onesto, 'https://cdn.momentum.it/u.json', true, now);
  for (let i = 0; i < 5; i++) recordDiscovery(onesto, 'https://cdn.momentum.it/u.json', false, now);
  const riferimento = sourceReliability(onesto, 'https://cdn.momentum.it/u.json', now);
  assert.ok(Math.abs(dopo - riferimento) < 0.05,
    `il peer da 5000 vale quanto 5 osservazioni vere (${dopo.toFixed(3)} vs ${riferimento.toFixed(3)})`);
  assert.ok(dopo < prima, 'ma il segnale del peer non viene ignorato del tutto');
});
