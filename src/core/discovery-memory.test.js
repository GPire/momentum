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
