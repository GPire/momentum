import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.document = globalThis.document || { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} };
globalThis.indexedDB = undefined; // forza VaultDAO.DurableStore.available = false, niente IndexedDB reale in Node
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem: () => {} };

const { VaultDAO } = await import("../core/vault.js");
const { PredictiveOracle } = await import("./oracle.js");
const { monthKey } = await import("../core/constants.js");

// Vecchia implementazione (scan completo su tutta la cronologia) tenuta qui
// SOLO per il confronto in questo test — non deve più esistere nel codice
// di produzione, ma serve a dimostrare che l'ottimizzazione in oracle.js
// non ha cambiato il risultato, solo il costo per ottenerlo.
function legacyDailyExpenses(transactions) {
  const dailyExpenses = new Array(60).fill(0);
  const now = Date.now();
  Object.values(transactions).flat().forEach(t => {
    if (t.type !== 'uscita') return;
    const daysAgo = Math.floor((now - new Date(t.date).getTime()) / 864e5);
    if (daysAgo >= 0 && daysAgo < 60) dailyExpenses[59 - daysAgo] += t.amount;
  });
  return dailyExpenses;
}

function buildLongHistory() {
  // 3 anni di transazioni sintetiche, una ogni 5 giorni, per avere una
  // cronologia "vecchio utente" molto più lunga della finestra di 60 giorni
  const transactions = {};
  const start = new Date();
  start.setFullYear(start.getFullYear() - 3);
  for (let i = 0; i < 220; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 5);
    if (d > new Date()) break;
    const mk = monthKey(d);
    if (!transactions[mk]) transactions[mk] = [];
    transactions[mk].push({ id: `t${i}`, date: d.toISOString(), amount: 10 + (i % 7) * 3, type: 'uscita', category: 'spesa', description: 'test' });
  }
  return transactions;
}

test("gatherSeries().dailyExpenses (scan limitato a 3 mesi) è identico allo scan completo su tutta la cronologia", () => {
  VaultDAO.state.transactions = buildLongHistory();
  const optimized = PredictiveOracle.gatherSeries().dailyExpenses;
  const legacy = legacyDailyExpenses(VaultDAO.state.transactions);
  assert.deepEqual(optimized, legacy);
});

test("con una cronologia di soli pochi giorni, il risultato resta corretto (edge case: utente nuovo)", () => {
  const mk = monthKey(new Date());
  VaultDAO.state.transactions = { [mk]: [{ id: "a", date: new Date().toISOString(), amount: 42, type: 'uscita', category: 'spesa', description: 'test' }] };
  const result = PredictiveOracle.gatherSeries().dailyExpenses;
  assert.equal(result[59], 42); // oggi = ultima posizione della finestra
  assert.equal(result.reduce((a, b) => a + b, 0), 42);
});

test("una transazione a cavallo del cambio mese/anno viene comunque inclusa correttamente", () => {
  const now = new Date();
  const twoMonthsAgo = new Date(now); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2); twoMonthsAgo.setDate(1);
  const mk = monthKey(twoMonthsAgo);
  const daysAgo = Math.floor((now - twoMonthsAgo) / 864e5);
  VaultDAO.state.transactions = { [mk]: [{ id: "b", date: twoMonthsAgo.toISOString(), amount: 77, type: 'uscita', category: 'spesa', description: 'test' }] };
  const result = PredictiveOracle.gatherSeries().dailyExpenses;
  if (daysAgo < 60) {
    assert.equal(result[59 - daysAgo], 77);
  } else {
    assert.equal(result.reduce((a, b) => a + b, 0), 0); // fuori dalla finestra di 60gg, correttamente escluso
  }
});
