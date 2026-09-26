import test from 'node:test';
import assert from 'node:assert/strict';
import { gaussianEpsilon, gaussianNoise, privatize, generateMaskingKeys, maskUpdate, secureSum, SECURE_SCALE } from './private-aggregation.js';

test('privacy differenziale: ε dichiarato dal rumore scelto, e mai spacciato per prova fuori dal teorema', () => {
  const forte = gaussianEpsilon(5, 1e-5);
  assert.ok(Math.abs(forte.epsilon - Math.sqrt(2 * Math.log(1.25e5)) / 5) < 1e-12);
  assert.equal(forte.proven, true);
  assert.equal(gaussianEpsilon(1, 1e-5).proven, false);
  assert.throws(() => gaussianEpsilon(0, 1e-5));
});

test('rumore gaussiano con la deviazione standard dichiarata', () => {
  const n = 20000;
  const xs = Array.from({ length: n }, () => gaussianNoise(2));
  const media = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - media) ** 2, 0) / n);
  assert.ok(Math.abs(media) < 0.08, `media ${media}`);
  assert.ok(Math.abs(sd - 2) < 0.08, `sd ${sd}`);
});

test('un aggiornamento privatizzato non coincide con quello vero', () => {
  const vero = [0.3, -0.4, 0.1];
  const p = privatize(vero, 1, 3);
  assert.equal(p.length, 3);
  assert.ok(p.some((x, i) => Math.abs(x - vero[i]) > 1e-6));
});

test('aggregazione sicura: la somma delle maschere torna la somma vera, i singoli restano illeggibili', async () => {
  const valori = [[0.25, -1.5, 3], [1, 0.5, -2], [-0.75, 2, 0.125], [0.5, 0.5, 0.5]];
  const chiavi = await Promise.all(valori.map(() => generateMaskingKeys()));
  const peers = chiavi.map((k) => ({ publicRaw: k.publicRaw }));
  const mascherati = await Promise.all(valori.map((v, i) => maskUpdate({ values: v, keys: chiavi[i], peers, roundId: 'r1' })));
  const quantizzato = valori[0].map((x) => Math.round(x * SECURE_SCALE) >>> 0);
  assert.notDeepEqual(mascherati[0], quantizzato);
  const r = secureSum(mascherati, { expected: 4 });
  assert.equal(r.ok, true);
  const atteso = [1, 1.5, 1.625];
  r.sum.forEach((x, i) => assert.ok(Math.abs(x - atteso[i]) < 1e-4, `${x} vs ${atteso[i]}`));
});

test('aggregazione sicura: se manca un partecipante previsto il round si scarta, mai un totale sbagliato usato', async () => {
  const chiavi = await Promise.all([0, 1, 2, 3].map(() => generateMaskingKeys()));
  const peers = chiavi.map((k) => ({ publicRaw: k.publicRaw }));
  const m = await Promise.all(chiavi.map((k) => maskUpdate({ values: [1, 2], keys: k, peers, roundId: 'r2' })));
  assert.deepEqual(secureSum(m.slice(0, 3), { expected: 4 }), { ok: false, reason: 'partecipanti' });
});

test('maschere legate al round: lo stesso aggiornamento in un altro round ha un aspetto diverso', async () => {
  const chiavi = await Promise.all([0, 1, 2].map(() => generateMaskingKeys()));
  const peers = chiavi.map((k) => ({ publicRaw: k.publicRaw }));
  const a = await maskUpdate({ values: [1, 2], keys: chiavi[0], peers, roundId: 'r1' });
  const b = await maskUpdate({ values: [1, 2], keys: chiavi[0], peers, roundId: 'r2' });
  assert.notDeepEqual(a, b);
});
