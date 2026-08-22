import test from 'node:test';
import assert from 'node:assert/strict';
import { bordoMarchenkoPastur, classificaAutovalori, testoRumoreCorrelazione } from './rumore-correlazione.js';
import { PANNELLO_SETTORI } from './historical-panel.js';

const seme = (s) => () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const gauss = (rng) => Math.sqrt(-2 * Math.log(Math.max(1e-12, rng()))) * Math.cos(2 * Math.PI * rng());

// ── bordoMarchenkoPastur ──

test('bordoMarchenkoPastur: coincide con il valore misurato sul pannello reale (9 settori, 330 mesi)', () => {
  assert.ok(Math.abs(bordoMarchenkoPastur(9, 330) - 1.358) < 0.005);
});

test('bordoMarchenkoPastur: input non valido ritorna null, mai NaN silenzioso', () => {
  assert.equal(bordoMarchenkoPastur(0, 100), null);
  assert.equal(bordoMarchenkoPastur(9, 0), null);
  assert.equal(bordoMarchenkoPastur(-1, 100), null);
});

test('bordoMarchenkoPastur: più storia (T grande) abbassa il bordo verso 1 (il rumore pesa meno)', () => {
  const pocaStoria = bordoMarchenkoPastur(9, 50);
  const moltaStoria = bordoMarchenkoPastur(9, 5000);
  assert.ok(moltaStoria < pocaStoria);
  assert.ok(moltaStoria > 1); // resta sempre sopra 1, mai sotto
});

// ── classificaAutovalori: su serie SINTETICHE di verità nota ──

test('classificaAutovalori: N serie totalmente INDIPENDENTI -> zero fattori distinguibili dal rumore (per costruzione)', () => {
  const rng = seme(11);
  const serie = Array.from({ length: 8 }, () => Array.from({ length: 400 }, () => gauss(rng)));
  const r = classificaAutovalori(serie);
  assert.ok(r.disponibile);
  assert.equal(r.fattoriDistinguibili, 0, `atteso 0 fattori su rumore puro, trovati ${r.fattoriDistinguibili}`);
});

test('classificaAutovalori: un fattore comune FORTE iniettato in tutte le serie -> esattamente un fattore distinguibile', () => {
  const rng = seme(22);
  const T = 400, N = 8;
  const fattoreComune = Array.from({ length: T }, () => gauss(rng));
  // Ogni serie = 80% del fattore comune + 20% rumore proprio: una struttura
  // forte e nota, non lasciata al caso.
  const serie = Array.from({ length: N }, () =>
    fattoreComune.map((f) => 0.8 * f + 0.2 * gauss(rng)));
  const r = classificaAutovalori(serie);
  assert.ok(r.disponibile);
  assert.equal(r.fattoriDistinguibili, 1, `atteso 1 fattore su una struttura a un solo fattore, trovati ${r.fattoriDistinguibili}`);
  assert.ok(r.varianzaSpiegataDalPrimo > 0.5, `il fattore iniettato deve spiegare la maggioranza della varianza, misurato ${r.varianzaSpiegataDalPrimo}`);
});

test('classificaAutovalori: troppo poca storia rispetto al numero di serie si dichiara, non inventa un bordo inaffidabile', () => {
  const rng = seme(33);
  const serie = Array.from({ length: 9 }, () => Array.from({ length: 10 }, () => gauss(rng)));
  const r = classificaAutovalori(serie);
  assert.equal(r.disponibile, false);
  assert.match(r.motivo, /poca storia/);
});

test('classificaAutovalori: meno di 2 serie si dichiara', () => {
  assert.equal(classificaAutovalori([[1, 2, 3]]).disponibile, false);
  assert.equal(classificaAutovalori([]).disponibile, false);
});

// ── Sul pannello VERO: riproduce i numeri misurati e citati nel piano ──

test('classificaAutovalori: sul pannello reale (9 settori) riproduce i numeri misurati — un solo fattore, 61% della varianza', () => {
  const serie = PANNELLO_SETTORI.map((s) => s.r);
  const r = classificaAutovalori(serie);
  assert.ok(r.disponibile);
  assert.equal(r.n, 9);
  assert.equal(r.fattoriDistinguibili, 1, `atteso 1 (il modo di mercato), trovati ${r.fattoriDistinguibili}: autovalori ${JSON.stringify(r.autovalori.map((a) => a.autovalore))}`);
  assert.ok(Math.abs(r.varianzaSpiegataDalPrimo - 0.614) < 0.01, `atteso ~61,4%, misurato ${r.varianzaSpiegataDalPrimo * 100}%`);
  assert.ok(Math.abs(r.bordo - 1.358) < 0.01);
});

// ── Il testo ──

test('testoRumoreCorrelazione: dati insufficienti restituisce il motivo, non un testo inventato', () => {
  assert.equal(testoRumoreCorrelazione({ disponibile: false, motivo: 'poca storia' }), 'poca storia');
});

test('testoRumoreCorrelazione: sul pannello reale menziona il modo di mercato e la quota di varianza, mai un consiglio', () => {
  const serie = PANNELLO_SETTORI.map((s) => s.r);
  const t = testoRumoreCorrelazione(classificaAutovalori(serie));
  assert.match(t, /mercato/i);
  assert.match(t, /61%/);
  assert.ok(!/dovresti|conviene|ti consiglio|diversifica/i.test(t));
});

test('testoRumoreCorrelazione: zero fattori distinguibili produce un testo onesto sul rumore puro', () => {
  const rng = seme(44);
  const serie = Array.from({ length: 6 }, () => Array.from({ length: 300 }, () => gauss(rng)));
  const t = testoRumoreCorrelazione(classificaAutovalori(serie));
  assert.match(t, /non si distingue da coincidenza/);
});
