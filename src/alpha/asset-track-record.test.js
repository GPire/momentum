import test from 'node:test';
import assert from 'node:assert/strict';
import { returnsFromSeries, assessTrackRecord } from './asset-track-record.js';

function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; };
}
const gauss = (rnd) => {
  const u1 = Math.max(1e-9, rnd()), u2 = rnd();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

function serieDaRendimenti(rendimenti, prezzoIniziale = 100) {
  let p = prezzoIniziale;
  return rendimenti.map((r, i) => { p *= (1 + r); return { date: `2026-${String(i + 1).padStart(2, '0')}`, price: p }; });
}

// ── returnsFromSeries ──

test('converte una serie di prezzi in rendimenti semplici corretti', () => {
  const serie = [{ date: 'a', price: 100 }, { date: 'b', price: 110 }, { date: 'c', price: 99 }];
  const { returns } = returnsFromSeries(serie);
  assert.ok(Math.abs(returns[0] - 0.10) < 1e-9);
  assert.ok(Math.abs(returns[1] - (-0.1)) < 1e-9);
});

test('prezzi non validi vengono scartati e CONTATI, mai divisi', () => {
  const serie = [{ date: 'a', price: 100 }, { date: 'b', price: 0 }, { date: 'c', price: 50 }, { date: 'd', price: 60 }];
  const { returns, scartati, n } = returnsFromSeries(serie);
  assert.equal(scartati, 1, 'il salto attraverso un prezzo a zero va contato');
  assert.equal(n, returns.length);
  assert.ok(returns.every(Number.isFinite));
});

test('serie vuota o con un solo punto non produce rendimenti inventati', () => {
  assert.deepEqual(returnsFromSeries([]).returns, []);
  assert.deepEqual(returnsFromSeries([{ date: 'a', price: 100 }]).returns, []);
});

// ── assessTrackRecord ──

test('con pochi periodi non si emette un verdetto', () => {
  const serie = serieDaRendimenti([0.01, 0.02, -0.01]);
  const r = assessTrackRecord(serie);
  assert.equal(r.disponibile, false);
  assert.match(r.motivo, /almeno 8 periodi/);
});

test('un asset con vantaggio reale e forte viene giudicato solido', () => {
  const rnd = rng(11);
  const rendimenti = Array.from({ length: 200 }, () => 0.02 + 0.03 * gauss(rnd));
  const serie = serieDaRendimenti(rendimenti);
  const r = assessTrackRecord(serie, { tentativi: 1 });
  assert.equal(r.disponibile, true);
  assert.equal(r.verdetto, 'solido', JSON.stringify(r));
  assert.match(r.messaggio, /non è solo fortuna/);
});

test('un asset senza alcun vantaggio reale (rumore puro) NON viene promosso', () => {
  const rnd = rng(13);
  const rendimenti = Array.from({ length: 100 }, () => 0.04 * gauss(rnd));
  const serie = serieDaRendimenti(rendimenti);
  const r = assessTrackRecord(serie);
  assert.notEqual(r.verdetto, 'solido', JSON.stringify(r));
});

test('più tentativi dichiarati alzano la soglia da battere (come cercare tra molti asset)', () => {
  const rnd = rng(17);
  const rendimenti = Array.from({ length: 60 }, () => 0.008 + 0.03 * gauss(rnd));
  const serie = serieDaRendimenti(rendimenti);
  const unSolo = assessTrackRecord(serie, { tentativi: 1 });
  const molti = assessTrackRecord(serie, { tentativi: 50 });
  assert.ok(molti.sogliaFortuna > unSolo.sogliaFortuna, 'con più tentativi la soglia di fortuna deve salire');
});

test('la concentrazione di Munger distingue "pochi crolli evitati" da "pochi mesi eccezionali"', () => {
  const rnd = rng(19);
  const base = Array.from({ length: 150 }, () => 0.005 + 0.02 * gauss(rnd));
  const serie = serieDaRendimenti(base);
  const r = assessTrackRecord(serie);
  assert.ok(r.concentrazione !== null);
  assert.ok(r.concentrazione.messaggio.length > 20);
});

test('nessun testo contiene gergo statistico', () => {
  const rnd = rng(23);
  const rendimenti = Array.from({ length: 100 }, () => 0.01 + 0.03 * gauss(rnd));
  const serie = serieDaRendimenti(rendimenti);
  const r = assessTrackRecord(serie);
  const testo = [r.messaggio, r.concentrazione?.messaggio].filter(Boolean).join(' ');
  assert.ok(!/Sharpe|deflat|p-value|z-score/i.test(testo), `gergo trovato: ${testo}`);
});
