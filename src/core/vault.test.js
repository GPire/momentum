import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.indexedDB = undefined;
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem: () => {} };

const { runSchemaMigrations } = await import("./vault.js");

test("senza migrazioni registrate, i dati passano invariati (nessuna trasformazione inventata)", () => {
  const loaded = { schemaVersion: 50.0, transactions: { "2026-07": [{ id: 1, amount: 10 }] } };
  const result = runSchemaMigrations(loaded, {});
  assert.deepEqual(result.transactions, loaded.transactions);
});

test("una migrazione registrata trasforma i dati e aggiorna schemaVersion", () => {
  const loaded = { schemaVersion: 50.0, monthlyBudget: 1000 };
  const migrations = {
    51.0: (state) => ({ ...state, weeklyBudgetEnabled: true }), // esempio di trasformazione additiva realistica
  };
  const result = runSchemaMigrations(loaded, migrations);
  assert.equal(result.weeklyBudgetEnabled, true);
  assert.equal(result.schemaVersion, 51.0);
  assert.equal(result.monthlyBudget, 1000); // il resto dei dati non va perso
});

test("più migrazioni si applicano IN ORDINE, non a caso", () => {
  const loaded = { schemaVersion: 50.0, log: [] };
  const migrations = {
    52.0: (state) => ({ ...state, log: [...state.log, "step52"] }),
    51.0: (state) => ({ ...state, log: [...state.log, "step51"] }), // registrata "fuori ordine" apposta
  };
  const result = runSchemaMigrations(loaded, migrations);
  assert.deepEqual(result.log, ["step51", "step52"]); // deve rispettare l'ordine numerico, non quello di dichiarazione
});

test("migrazioni con versione minore o uguale ai dati caricati NON vengono riapplicate", () => {
  const loaded = { schemaVersion: 52.0, log: [] };
  const migrations = {
    51.0: (state) => ({ ...state, log: [...state.log, "non-deve-girare"] }),
    52.0: (state) => ({ ...state, log: [...state.log, "non-deve-girare-neanche-questa"] }),
    53.0: (state) => ({ ...state, log: [...state.log, "questa-si"] }),
  };
  const result = runSchemaMigrations(loaded, migrations);
  assert.deepEqual(result.log, ["questa-si"]);
});

test("dati senza schemaVersion (utente molto vecchio) vengono trattati come versione 0 e ricevono tutte le migrazioni", () => {
  const loaded = { transactions: {} }; // nessun campo schemaVersion, mai salvato con una versione recente
  const migrations = { 51.0: (state) => ({ ...state, migrated: true }) };
  const result = runSchemaMigrations(loaded, migrations);
  assert.equal(result.migrated, true);
});

test("simulazione realistica: rinominare un campo tra due versioni non perde i dati esistenti", () => {
  // scenario concreto: una futura v51 rinomina monthlyBudget -> budget.monthly
  const oldUserData = { schemaVersion: 50.0, monthlyBudget: 1500, transactions: { "2026-06": [{ id: 1 }] } };
  const migrations = {
    51.0: (state) => {
      const { monthlyBudget, ...rest } = state;
      return { ...rest, budget: { monthly: monthlyBudget } };
    },
  };
  const result = runSchemaMigrations(oldUserData, migrations);
  assert.equal(result.budget.monthly, 1500);
  assert.equal(result.monthlyBudget, undefined);
  assert.deepEqual(result.transactions, oldUserData.transactions); // le transazioni non sono mai state toccate
});
