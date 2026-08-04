import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceCorrelation, nonlinearIndependenceTest, compareLinearVsNonlinear } from './nonlinear-dependence.js';
import { partialCorrelationTest } from './causal-discovery.js';

function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; };
}
const gauss = (rnd) => {
  const u1 = Math.max(1e-9, rnd()), u2 = rnd();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

// ── Proprietà fondamentali della correlazione di distanza ──

test('vale 0 tra variabili indipendenti e cresce col legame', () => {
  const rnd = rng(3);
  const x = Array.from({ length: 150 }, () => gauss(rnd));
  const indip = Array.from({ length: 150 }, () => gauss(rnd));
  const legato = x.map((v) => 2 * v + 0.2 * gauss(rnd));
  const dIndip = distanceCorrelation(x, indip);
  const dLegato = distanceCorrelation(x, legato);
  assert.ok(dIndip < 0.3, `atteso vicino a zero, ottenuto ${dIndip}`);
  assert.ok(dLegato > 0.8, `atteso vicino a uno, ottenuto ${dLegato}`);
});

test('resta sempre tra 0 e 1, e non ha segno', () => {
  const rnd = rng(5);
  const x = Array.from({ length: 100 }, () => gauss(rnd));
  const crescente = x.map((v) => 3 * v);
  const decrescente = x.map((v) => -3 * v);
  const a = distanceCorrelation(x, crescente);
  const b = distanceCorrelation(x, decrescente);
  assert.ok(a >= 0 && a <= 1 && b >= 0 && b <= 1);
  assert.ok(Math.abs(a - b) < 1e-6, 'misura la forza, non la direzione: salire e scendere pesano uguale');
});

test('con troppi pochi punti non produce un numero', () => {
  assert.equal(distanceCorrelation([1, 2], [3, 4]), null);
});

// ── IL TEST DECISIVO: il punto cieco della correlazione ──

test('LEGAME A U: la correlazione dice ZERO, il metodo non parametrico lo TROVA', () => {
  const rnd = rng(7);
  const n = 160;
  // X simmetrico intorno a zero, Y = X²: correlazione lineare esattamente ~0,
  // dipendenza totale. È il caso "spendo poco a casa, poco in vacanza, molto
  // nel mezzo".
  const x = Array.from({ length: n }, () => gauss(rnd));
  const y = x.map((v) => v * v + 0.05 * gauss(rnd));

  const lin = partialCorrelationTest(x, y);
  const nonlin = nonlinearIndependenceTest(x, y, [], { permutazioni: 199, seed: 1 });

  assert.ok(lin.p > 0.05, `la correlazione DEVE mancarlo (è il punto cieco): p=${lin.p}, r=${lin.r}`);
  assert.ok(nonlin.p <= 0.01, `il metodo non parametrico deve trovarlo: p=${nonlin.p}, dCor=${nonlin.dCor}`);
});

test('LEGAME A SOGLIA: nessun effetto sotto una cifra, forte sopra', () => {
  const rnd = rng(11);
  const n = 180;
  const x = Array.from({ length: n }, () => rnd() * 100);
  // Sotto 60 non succede niente; sopra, l'effetto esplode.
  const y = x.map((v) => (v > 60 ? (v - 60) * 3 : 0) + 2 * gauss(rnd));
  const nonlin = nonlinearIndependenceTest(x, y, [], { permutazioni: 199, seed: 2 });
  assert.ok(nonlin.p <= 0.01, `una soglia netta deve essere trovata: p=${nonlin.p}`);
});

// Su un SINGOLO campione un p-value al confine capita per definizione nel 5%
// dei casi: asserire su un solo seme sarebbe un test fragile che fallisce a
// caso. Si verifica la proprietà che conta davvero — che nella grande
// maggioranza dei campioni senza legame non ne venga trovato nessuno.
test('quando NON c\'è legame, il metodo non ne inventa uno (su più campioni)', () => {
  // Con 30 campioni e un tasso atteso del 5%, superare 4 avrebbe probabilità
  // sotto il 2%: è una soglia che coglie un metodo mal calibrato senza
  // fallire per il rumore normale del campionamento.
  let trovati = 0;
  const PROVE = 30;
  for (let k = 0; k < PROVE; k++) {
    const rnd = rng(13 + k * 101);
    const n = 150;
    const x = Array.from({ length: n }, () => gauss(rnd));
    const y = Array.from({ length: n }, () => gauss(rnd));
    const r = nonlinearIndependenceTest(x, y, [], { permutazioni: 99, seed: 3 + k * 17 });
    if (r.p !== null && r.p <= 0.05) trovati++;
  }
  assert.ok(trovati <= 4, `attesi al più 4 legami apparenti su ${PROVE} campioni senza legame, trovati ${trovati}`);
});

// ── Falsi positivi sotto controllo ──

test('su 60 coppie indipendenti i falsi positivi restano vicini al 5% dichiarato', () => {
  let falsi = 0;
  const PROVE = 60;
  for (let k = 0; k < PROVE; k++) {
    const rnd = rng(k * 977 + 41);
    const n = 90;
    const x = Array.from({ length: n }, () => gauss(rnd));
    const y = Array.from({ length: n }, () => gauss(rnd));
    const r = nonlinearIndependenceTest(x, y, [], { permutazioni: 99, seed: k * 31 + 7 });
    if (r.p !== null && r.p <= 0.05) falsi++;
  }
  const tasso = 100 * falsi / PROVE;
  // eslint-disable-next-line no-console
  console.log(`[nonlineare] falsi positivi su ${PROVE} coppie indipendenti: ${tasso.toFixed(1)}%`);
  assert.ok(tasso <= 15, `tasso troppo alto: ${tasso}%`);
});

// ── Riproducibilità: lo stesso dato deve dare la stessa risposta ──

test('il test è deterministico: stesso dato e stesso seme, stesso p-value', () => {
  const rnd = rng(17);
  const x = Array.from({ length: 80 }, () => gauss(rnd));
  const y = x.map((v) => v * v);
  const a = nonlinearIndependenceTest(x, y, [], { permutazioni: 99, seed: 42 });
  const b = nonlinearIndependenceTest(x, y, [], { permutazioni: 99, seed: 42 });
  assert.equal(a.p, b.p, 'un numero mostrato all\'utente non può cambiare a ogni apertura');
});

test('il p-value non è mai esattamente zero: non abbiamo certezze assolute', () => {
  const rnd = rng(19);
  const x = Array.from({ length: 120 }, () => gauss(rnd));
  const y = x.map((v) => v * v * v);
  const r = nonlinearIndependenceTest(x, y, [], { permutazioni: 99, seed: 5 });
  assert.ok(r.p > 0, 'con 99 permutazioni il minimo possibile è 1/100, mai 0');
});

// ── Controllo per variabili terze ──

test('un legame spiegato interamente da una terza variabile viene sciolto', () => {
  const rnd = rng(23);
  const n = 150;
  const z = Array.from({ length: n }, () => gauss(rnd));
  const x = z.map((v) => v + 0.3 * gauss(rnd));
  const y = z.map((v) => v + 0.3 * gauss(rnd));
  const senza = nonlinearIndependenceTest(x, y, [], { permutazioni: 199, seed: 9 });
  const con = nonlinearIndependenceTest(x, y, [z], { permutazioni: 199, seed: 9 });
  assert.ok(senza.p <= 0.05, 'senza controllo il legame apparente c\'è');
  assert.ok(con.p > senza.p, `controllando per la causa comune il legame deve indebolirsi: ${senza.p} → ${con.p}`);
  assert.equal(con.controlloLineare, true);
});

test('con troppi pochi periodi si dichiara, non si tira a indovinare', () => {
  const r = nonlinearIndependenceTest([1, 2, 3], [4, 5, 6], []);
  assert.equal(r.p, null);
  assert.match(r.motivo, /almeno 12 periodi/);
});

test('serie molto lunghe vengono campionate, e lo dichiarano', () => {
  const rnd = rng(29);
  const n = 800;
  const x = Array.from({ length: n }, () => gauss(rnd));
  const y = x.map((v) => v * v);
  const r = nonlinearIndependenceTest(x, y, [], { permutazioni: 49, seed: 3, maxN: 200 });
  assert.equal(r.campionato, true);
  assert.equal(r.n, 200);
});

// ── Il confronto che cambia il consiglio ──

test('CONFRONTO: un legame a U viene classificato come "nascosto", non come assente', () => {
  const rnd = rng(31);
  const n = 160;
  const x = Array.from({ length: n }, () => gauss(rnd));
  const y = x.map((v) => v * v + 0.05 * gauss(rnd));
  const c = compareLinearVsNonlinear(x, y, [], {
    testers: { partialCorrelationTest }, permutazioni: 199, seed: 4,
  });
  assert.equal(c.verdetto, 'legame-nascosto');
  assert.equal(c.discordi, true);
  assert.match(c.spiegazione, /NON è una linea retta/);
});

test('CONFRONTO: un legame lineare pulito viene classificato come tale', () => {
  const rnd = rng(37);
  const n = 150;
  const x = Array.from({ length: n }, () => gauss(rnd));
  const y = x.map((v) => 2 * v + 0.3 * gauss(rnd));
  const c = compareLinearVsNonlinear(x, y, [], {
    testers: { partialCorrelationTest }, permutazioni: 99, seed: 6,
  });
  assert.equal(c.verdetto, 'legame-lineare');
  assert.equal(c.discordi, false);
});

test('CONFRONTO: nessun legame resta nessun legame', () => {
  const rnd = rng(41);
  const n = 150;
  const x = Array.from({ length: n }, () => gauss(rnd));
  const y = Array.from({ length: n }, () => gauss(rnd));
  const c = compareLinearVsNonlinear(x, y, [], {
    testers: { partialCorrelationTest }, permutazioni: 99, seed: 8,
  });
  assert.equal(c.verdetto, 'nessun-legame');
});

test('le spiegazioni non contengono gergo statistico', () => {
  const rnd = rng(43);
  const x = Array.from({ length: 150 }, () => gauss(rnd));
  for (const y of [x.map((v) => v * v), x.map((v) => 2 * v), Array.from({ length: 150 }, () => gauss(rnd))]) {
    const c = compareLinearVsNonlinear(x, y, [], { testers: { partialCorrelationTest }, permutazioni: 49, seed: 2 });
    if (c.spiegazione) {
      assert.ok(!/p-value|dCor|permutazion|correlazione di distanza|non parametric/i.test(c.spiegazione),
        `gergo trovato: ${c.spiegazione}`);
    }
  }
});
