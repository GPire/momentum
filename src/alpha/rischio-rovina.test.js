import test from 'node:test';
import assert from 'node:assert/strict';
import { rischioDiRovina, rischioDiRovinaText, SOGLIA_ROVINA_DEFAULT } from './rischio-rovina.js';

test('rischioDiRovina: stesso seme produce sempre lo stesso risultato (deterministico)', () => {
  const a = rischioDiRovina({ rischioPerOperazione: 0.02, seed: 7 });
  const b = rischioDiRovina({ rischioPerOperazione: 0.02, seed: 7 });
  assert.deepEqual(a, b);
});

test('rischioDiRovina: input non valido si dichiara, non crasha e non inventa un numero', () => {
  assert.equal(rischioDiRovina({ rischioPerOperazione: 0 }).disponibile, false);
  assert.equal(rischioDiRovina({ rischioPerOperazione: 1 }).disponibile, false);
  assert.equal(rischioDiRovina({ rischioPerOperazione: -0.1 }).disponibile, false);
  assert.equal(rischioDiRovina({ rischioPerOperazione: NaN }).disponibile, false);
  assert.equal(rischioDiRovina({}).disponibile, false);
});

test('rischioDiRovina: rischiare di più per operazione non riduce MAI la probabilità di rovina (monotono)', () => {
  const basso = rischioDiRovina({ rischioPerOperazione: 0.005, seed: 1 });
  const medio = rischioDiRovina({ rischioPerOperazione: 0.02, seed: 1 });
  const alto = rischioDiRovina({ rischioPerOperazione: 0.05, seed: 1 });
  assert.ok(basso.probabilitaRovina <= medio.probabilitaRovina, `0,5% (${basso.probabilitaRovina}) doveva rovinare meno del 2% (${medio.probabilitaRovina})`);
  assert.ok(medio.probabilitaRovina <= alto.probabilitaRovina, `2% (${medio.probabilitaRovina}) doveva rovinare meno del 5% (${alto.probabilitaRovina})`);
});

test('rischioDiRovina: MISURATO su ipotesi edge-neutre (tasso di vincita 50%, rapporto 1:1) — ordine di grandezza verificato, non citato da un manuale', () => {
  // 2% per operazione: rischio sostanziale, probabilità di rovina alta ma non certa.
  const r2 = rischioDiRovina({ rischioPerOperazione: 0.02, seed: 42 });
  assert.ok(r2.probabilitaRovina > 0.2 && r2.probabilitaRovina < 0.6, `atteso fra 20% e 60%, misurato ${r2.probabilitaRovina}`);
  // 1% per operazione: molto più prudente, probabilità di rovina bassa.
  const r1 = rischioDiRovina({ rischioPerOperazione: 0.01, seed: 42 });
  assert.ok(r1.probabilitaRovina < 0.1, `atteso sotto 10%, misurato ${r1.probabilitaRovina}`);
});

test('rischioDiRovina: un edge positivo (vince più spesso) riduce la probabilità di rovina rispetto a un edge neutro', () => {
  const neutro = rischioDiRovina({ rischioPerOperazione: 0.02, tassoVincita: 0.5, seed: 3 });
  const conEdge = rischioDiRovina({ rischioPerOperazione: 0.02, tassoVincita: 0.55, seed: 3 });
  assert.ok(conEdge.probabilitaRovina < neutro.probabilitaRovina);
});

test('rischioDiRovina: meno operazioni simulate danno meno occasioni di rovinarsi', () => {
  const poche = rischioDiRovina({ rischioPerOperazione: 0.02, operazioni: 50, seed: 9 });
  const molte = rischioDiRovina({ rischioPerOperazione: 0.02, operazioni: 1000, seed: 9 });
  assert.ok(poche.probabilitaRovina <= molte.probabilitaRovina);
});

test('rischioDiRovina: chi si rovina lo fa in una mediana di operazioni positiva e finita', () => {
  const r = rischioDiRovina({ rischioPerOperazione: 0.05, seed: 5 });
  assert.ok(r.tradeMedianiAllaRovina === null || (r.tradeMedianiAllaRovina > 0 && r.tradeMedianiAllaRovina <= r.operazioni));
});

test('rischioDiRovina: sogliaRovina di default è 0,5 (metà del capitale iniziale)', () => {
  assert.equal(SOGLIA_ROVINA_DEFAULT, 0.5);
  assert.equal(rischioDiRovina({ rischioPerOperazione: 0.02 }).sogliaRovina, 0.5);
});

// ── Il testo ──

test('rischioDiRovinaText: dati insufficienti restituisce il motivo, non un testo inventato', () => {
  assert.equal(rischioDiRovinaText({ disponibile: false, motivo: 'x' }), 'x');
});

test('rischioDiRovinaText: con un capitale reale lo traduce in euro', () => {
  const r = rischioDiRovina({ rischioPerOperazione: 0.02, seed: 1 });
  const t = rischioDiRovinaText(r, { capitale: 10000 });
  assert.match(t, /10\.000€/);
  assert.match(t, /5000€|5\.000€/); // metà, la soglia di default
});

test('rischioDiRovinaText: senza capitale non inventa una cifra', () => {
  const r = rischioDiRovina({ rischioPerOperazione: 0.02, seed: 1 });
  const t = rischioDiRovinaText(r);
  assert.ok(!/€/.test(t) || !/tuo capitale/.test(t));
});

test('rischioDiRovinaText: non promette e non consiglia, dichiara che è matematica generale', () => {
  const r = rischioDiRovina({ rischioPerOperazione: 0.02, seed: 1 });
  const t = rischioDiRovinaText(r);
  assert.match(t, /non è una previsione/i);
  assert.ok(!/dovresti|conviene|ti consiglio/i.test(t));
});
