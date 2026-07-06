import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { suggestMonthlyBudget, isBudgetStale } = await import("./budget-advisor.js");

function monthTx(mk, total) {
  return { [mk]: [{ id: mk, date: `${mk}-15T10:00:00Z`, amount: total, type: 'uscita', category: 'spesa', description: 'test' }] };
}

test("suggerisce la media degli ultimi 3 mesi completi con margine di sicurezza", () => {
  // riferimento: 15 luglio 2026. Ultimi 3 mesi completi: giugno, maggio, aprile
  const transactions = {
    ...monthTx("2026-06", 900),
    ...monthTx("2026-05", 1000),
    ...monthTx("2026-04", 1100),
  };
  const result = suggestMonthlyBudget(transactions, new Date(2026, 6, 15));
  assert.equal(result.rawAverage, 1000);
  assert.ok(result.suggested >= 1040 && result.suggested <= 1060); // 1000 * 1.05 = 1050, arrotondato ai 10
  assert.equal(result.basedOnMonths, 3);
});

test("ignora il mese corrente (parziale) nel calcolo della media", () => {
  const transactions = {
    ...monthTx("2026-06", 1000),
    "2026-07": [{ id: "partial", date: "2026-07-01T10:00:00Z", amount: 5, type: 'uscita', category: 'spesa', description: 'test' }], // solo 1 giorno di luglio
  };
  const result = suggestMonthlyBudget(transactions, new Date(2026, 6, 3));
  assert.equal(result.rawAverage, 1000); // il quasi-zero di luglio non deve abbassare la media
});

test("nessuno storico disponibile: nessun suggerimento (onesto, non un numero a caso)", () => {
  const result = suggestMonthlyBudget({}, new Date(2026, 6, 15));
  assert.equal(result, null);
});

test("isBudgetStale segnala quando il budget è molto sotto la spesa reale", () => {
  const transactions = { ...monthTx("2026-06", 2000), ...monthTx("2026-05", 2100), ...monthTx("2026-04", 1900) };
  const result = isBudgetStale(1000, transactions, new Date(2026, 6, 15));
  assert.equal(result.stale, true);
  assert.equal(result.direction, 'sotto'); // il budget è sotto la spesa reale
});

test("isBudgetStale non segnala nulla quando budget e spesa reale sono vicini", () => {
  const transactions = { ...monthTx("2026-06", 1020), ...monthTx("2026-05", 980), ...monthTx("2026-04", 1000) };
  const result = isBudgetStale(1000, transactions, new Date(2026, 6, 15));
  assert.equal(result.stale, false);
});

test("isBudgetStale non esplode con budget non impostato o storico assente", () => {
  assert.equal(isBudgetStale(0, {}, new Date()).stale, false);
  assert.equal(isBudgetStale(1000, {}, new Date()).stale, false);
});
