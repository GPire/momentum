'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mesiComuni, differenzaDistinguibile, confronta, testoConfronto,
  MIN_MESI_CONFRONTO,
} from './confronto-titoli.js';

const seme = (s) => () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const rumore = (rng) => (rng() + rng() + rng() + rng() + rng() + rng() - 3) / 3;

// Costruisce mensili consecutivi a partire da un mese.
const mensili = (da, rendimenti) => {
  const [a0, m0] = da.split('-').map(Number);
  return rendimenti.map((r, i) => {
    const t = (m0 - 1) + i;
    return { mese: `${a0 + Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`, rendimento: r };
  });
};

test('mesiComuni interseca per MESE, non per posizione', () => {
  // Il bug che previene: due serie che partono da anni diversi, confrontate
  // per posizione, misurerebbero mesi completamente diversi.
  const a = mensili('2020-01', [0.1, 0.2, 0.3]);
  const b = mensili('2020-03', [0.9, 0.8, 0.7]);
  const c = mesiComuni(a, b);
  assert.deepEqual(c.mesi, ['2020-03']);
  assert.deepEqual(c.a, [0.3]);
  assert.deepEqual(c.b, [0.9]);
});

test('storia in comune troppo corta: si rifiuta il confronto', () => {
  const rng = seme(1);
  const r = () => Array.from({ length: 12 }, () => rumore(rng) * 0.05);
  const out = confronta(
    { nome: 'A', mensili: mensili('2020-01', r()) },
    { nome: 'B', mensili: mensili('2020-01', r()) },
  );
  assert.equal(out.disponibile, false);
  assert.equal(out.mesiComuni, 12);
  assert.match(out.motivo, /storia in comune/);
});

// ── IL CUORE: distinguere una differenza da una fortuna ──
test('due serie SENZA differenza vera: la differenza NON e distinguibile', () => {
  const rng = seme(2);
  const a = Array.from({ length: 120 }, () => rumore(rng) * 0.05);
  const b = Array.from({ length: 120 }, () => rumore(rng) * 0.05);
  const d = differenzaDistinguibile(a, b, { rng: seme(3), permutazioni: 999 });
  assert.equal(d.distinguibile, false, `p=${d.p}`);
  assert.ok(d.p > 0.05);
});

test('una differenza VERA e grande viene riconosciuta', () => {
  const rng = seme(4);
  const b = Array.from({ length: 120 }, () => rumore(rng) * 0.03);
  // +2% al mese di differenza sistematica: enorme, deve emergere.
  const a = b.map((x) => x + 0.02);
  const d = differenzaDistinguibile(a, b, { rng: seme(5), permutazioni: 999 });
  assert.equal(d.distinguibile, true, `p=${d.p}`);
  assert.ok(Math.abs(d.differenzaMediaMensile - 2) < 0.01);
});

test('IL CASO CHE INGANNA: totali molto diversi, differenza non distinguibile', () => {
  // Il motivo per cui questo modulo esiste. Due serie senza alcun vantaggio
  // sistematico possono finire con totali composti molto lontani: e' l'effetto
  // del comporre il rumore. Chi guarda solo i totali conclude che uno e'
  // migliore; il test appaiato dice che non si distinguono.
  const rng = seme(11);
  const a = Array.from({ length: 60 }, () => rumore(rng) * 0.09);
  const b = Array.from({ length: 60 }, () => rumore(rng) * 0.09);
  const out = confronta(
    { nome: 'A', mensili: mensili('2018-01', a) },
    { nome: 'B', mensili: mensili('2018-01', b) },
    { rng: seme(12), permutazioni: 999 },
  );
  assert.equal(out.disponibile, true);
  const differenzaTotali = Math.abs(out.totali.A - out.totali.B);
  assert.ok(differenzaTotali > 10, `i totali differiscono di ${differenzaTotali} punti`);
  assert.equal(out.test.distinguibile, false, `eppure p=${out.test.p}`);
  assert.match(testoConfronto(out), /NON e' distinguibile dal rumore/);
});

test('due titoli che sono la STESSA scommessa vengono dichiarati tali', () => {
  const rng = seme(6);
  const base = Array.from({ length: 80 }, () => rumore(rng) * 0.05);
  const quasiUguale = base.map((x) => x + rumore(rng) * 0.004);
  const out = confronta(
    { nome: 'A', mensili: mensili('2018-01', base) },
    { nome: 'B', mensili: mensili('2018-01', quasiUguale) },
    { rng: seme(7), permutazioni: 299 },
  );
  assert.ok(out.insieme > 0.9, `correlazione ${out.insieme}`);
  assert.match(testoConfronto(out), /stessa scommessa due volte/);
});

test('col mercato: due titoli che sono solo mercato non si distinguono sulla parte loro', () => {
  const rng = seme(8);
  const mkt = Array.from({ length: 100 }, () => rumore(rng) * 0.04);
  // Entrambi seguono il mercato con un po' di rumore proprio.
  const a = mkt.map((m) => 1.1 * m + rumore(rng) * 0.01);
  const b = mkt.map((m) => 0.9 * m + rumore(rng) * 0.01);
  const out = confronta(
    { nome: 'A', mensili: mensili('2018-01', a) },
    { nome: 'B', mensili: mensili('2018-01', b) },
    { mercato: mensili('2018-01', mkt), rng: seme(9), permutazioni: 499 },
  );
  assert.ok(out.scelta, 'la scomposizione col mercato deve esserci');
  assert.ok(out.scelta.a.quotaSua < 30, `quota sua di A: ${out.scelta.a.quotaSua}%`);
  assert.equal(out.scelta.sullaParteSua.distinguibile, false);
  assert.match(testoConfronto(out), /stessa cosa/);
});

test('senza serie di mercato la scomposizione non viene inventata', () => {
  const rng = seme(10);
  const a = Array.from({ length: 60 }, () => rumore(rng) * 0.04);
  const b = Array.from({ length: 60 }, () => rumore(rng) * 0.04);
  const out = confronta(
    { nome: 'A', mensili: mensili('2018-01', a) },
    { nome: 'B', mensili: mensili('2018-01', b) },
    { rng: seme(11), permutazioni: 199 },
  );
  assert.equal(out.scelta, null);
});

test('mercato con mesi mancanti: si rinuncia alla scomposizione invece di rattopparla', () => {
  const rng = seme(13);
  const a = Array.from({ length: 60 }, () => rumore(rng) * 0.04);
  const b = Array.from({ length: 60 }, () => rumore(rng) * 0.04);
  const mkt = mensili('2018-01', Array.from({ length: 30 }, () => rumore(rng) * 0.04));
  const out = confronta(
    { nome: 'A', mensili: mensili('2018-01', a) },
    { nome: 'B', mensili: mensili('2018-01', b) },
    { mercato: mkt, rng: seme(14), permutazioni: 199 },
  );
  assert.equal(out.scelta, null, 'meglio niente che una scomposizione su mesi inventati');
});

test('il testo non raccomanda quale scegliere', () => {
  const rng = seme(15);
  const a = Array.from({ length: 60 }, () => rumore(rng) * 0.04);
  const b = Array.from({ length: 60 }, () => rumore(rng) * 0.04);
  const t = testoConfronto(confronta(
    { nome: 'Alfa', mensili: mensili('2018-01', a) },
    { nome: 'Beta', mensili: mensili('2018-01', b) },
    { rng: seme(16), permutazioni: 199 },
  ));
  assert.ok(!/\b(scegli|preferisci|conviene|meglio comprare|ti consiglio|dovresti)\b/i.test(t), t);
  assert.match(t, /non un consiglio/);
});

test('il periodo confrontato viene sempre dichiarato', () => {
  const rng = seme(17);
  const a = Array.from({ length: 40 }, () => rumore(rng) * 0.04);
  const out = confronta(
    { nome: 'A', mensili: mensili('2019-05', a) },
    { nome: 'B', mensili: mensili('2019-05', a.map((x) => x * 0.9)) },
    { rng: seme(18), permutazioni: 199 },
  );
  assert.equal(out.da, '2019-05');
  assert.equal(out.mesiComuni, 40);
  assert.match(testoConfronto(out), /2019-05/);
});
