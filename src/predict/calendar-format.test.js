import test from "node:test";
import assert from "node:assert/strict";
import { eventLabel, isFinancialEvent, buildCalendarRows, calendarSummary } from "./calendar-format.js";

test("etichetta: usa title, altrimenti description (eventi da voce)", () => {
  assert.equal(eventLabel({ title: "Bolletta" }), "Bolletta");
  assert.equal(eventLabel({ description: "Dentista" }), "Dentista"); // evento vocale: solo description
  assert.equal(eventLabel({}), "Promemoria"); // fallback, mai vuoto
});

test("finanziario solo con importo positivo (un appuntamento NON lo è)", () => {
  assert.equal(isFinancialEvent({ amount: 40 }), true);
  assert.equal(isFinancialEvent({ amount: 0 }), false);   // appuntamento
  assert.equal(isFinancialEvent({}), false);
});

test("appuntamento da voce: etichetta corretta e NON finanziario (niente −0€)", () => {
  const rows = buildCalendarRows([
    { id: 1, intent: "appointment", description: "Dentista", amount: 0, date: "2026-08-01T15:00:00Z", hasTime: true },
  ], [], new Date("2026-07-25"));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, "Dentista");
  assert.equal(rows[0].isFinancial, false);
  assert.equal(rows[0].amount, 0);
  assert.equal(rows[0].kind, "appointment");
});

test("la descrizione estesa (nota) viene conservata", () => {
  const rows = buildCalendarRows([
    { id: 2, title: "Visita", note: "portare la tessera sanitaria", amount: 0, date: "2026-08-02T10:00:00Z" },
  ], []);
  assert.equal(rows[0].note, "portare la tessera sanitaria");
});

test("ordina per data crescente e mette i completati in fondo", () => {
  const rows = buildCalendarRows([
    { id: 1, title: "B", amount: 0, date: "2026-08-10T00:00:00Z" },
    { id: 2, title: "A", amount: 0, date: "2026-08-01T00:00:00Z" },
    { id: 3, title: "Fatto", amount: 0, date: "2026-08-02T00:00:00Z", completed: true },
  ], []);
  assert.deepEqual(rows.map(r => r.label), ["A", "B", "Fatto"]);
});

test("addebiti previsti si fondono con gli eventi reali e sono marcati", () => {
  const rows = buildCalendarRows(
    [{ id: 1, title: "Affitto", amount: 700, date: "2026-08-05T00:00:00Z" }],
    [{ title: "Netflix (previsto)", amount: 12.99, date: new Date("2026-08-03T00:00:00Z") }],
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].predicted, true); // il 3 agosto viene prima del 5
  assert.equal(rows[0].isFinancial, true);
});

test("riepilogo: conta attivi, fatti e previsti", () => {
  const rows = buildCalendarRows([
    { id: 1, title: "A", amount: 0, date: "2026-08-01T00:00:00Z" },
    { id: 2, title: "B", amount: 0, date: "2026-08-02T00:00:00Z", completed: true },
  ], [{ title: "P", amount: 10, date: new Date("2026-08-03") }]);
  const s = calendarSummary(rows);
  assert.equal(s.total, 3);
  assert.equal(s.active, 1);
  assert.equal(s.done, 1);
  assert.equal(s.predicted, 1);
});

test("date invalide non rompono l'ordinamento (finiscono in coda)", () => {
  const rows = buildCalendarRows([
    { id: 1, title: "Valida", amount: 0, date: "2026-08-01T00:00:00Z" },
    { id: 2, title: "Rotta", amount: 0, date: "non-una-data" },
  ], []);
  assert.equal(rows[0].label, "Valida");
});
