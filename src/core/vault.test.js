import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.indexedDB = undefined;
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem: () => {} };

const { runSchemaMigrations, tryReadIosHandoff, VaultDAO } = await import("./vault.js");

// Semplice localStorage in-memory per i test sotto — supporta anche
// removeItem e un limite di quota opzionale (simula QuotaExceededError).
function fakeLocalStorage({ quota = Infinity } = {}) {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      if (String(v).length > quota) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
      store.set(k, String(v));
    },
    removeItem: (k) => store.delete(k),
    _store: store,
  };
}
const encodeShadow = (payload) => Buffer.from(payload, 'utf8').toString('base64');
function payloadWithTx(n) {
  const transactions = { '2026-08': Array.from({ length: n }, (_, i) => ({ id: `t${i}`, amount: 10 + i, category: 'spesa' })) };
  return JSON.stringify({ schemaVersion: 50.0, transactions, currentDate: new Date().toISOString() });
}

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

// ── Ponte iOS Safari→PWA (2026-08-28, tryReadIosHandoff) — best-effort, mai
// l'unica via di ripristino (quella resta il backup-file manuale). Qui si
// verifica solo che la funzione sia sicura in ogni condizione: senza Cache
// Storage disponibile, con la cache vuota, e col dato davvero presente. ──
test("tryReadIosHandoff: senza Cache Storage disponibile (browser/contesto che non la supporta) → null, mai un errore", async () => {
  const savedCaches = globalThis.caches;
  delete globalThis.caches;
  try {
    const r = await tryReadIosHandoff();
    assert.equal(r, null);
  } finally {
    if (savedCaches !== undefined) globalThis.caches = savedCaches;
  }
});

test("tryReadIosHandoff: Cache Storage disponibile ma nessuna istantanea salvata → null", async () => {
  const savedCaches = globalThis.caches;
  globalThis.caches = { open: async () => ({ match: async () => undefined }) };
  try {
    const r = await tryReadIosHandoff();
    assert.equal(r, null);
  } finally {
    globalThis.caches = savedCaches;
  }
});

test("tryReadIosHandoff: istantanea presente → la ritorna decodificata (nessuna sovrascrittura qui: quella è responsabilità di chi chiama, solo dopo conferma esplicita dell'utente)", async () => {
  const savedCaches = globalThis.caches;
  const stato = { schemaVersion: 50, transactions: { "2026-08": [{ id: 1, amount: 12.5 }] } };
  globalThis.caches = {
    open: async () => ({
      match: async () => ({ text: async () => JSON.stringify(stato) }),
    }),
  };
  try {
    const r = await tryReadIosHandoff();
    assert.deepEqual(r, stato);
  } finally {
    globalThis.caches = savedCaches;
  }
});

test("tryReadIosHandoff: un'istantanea corrotta (JSON non valido) → null, mai un crash", async () => {
  const savedCaches = globalThis.caches;
  globalThis.caches = {
    open: async () => ({
      match: async () => ({ text: async () => "{questo non è JSON valido" }),
    }),
  };
  try {
    const r = await tryReadIosHandoff();
    assert.equal(r, null);
  } finally {
    globalThis.caches = savedCaches;
  }
});

// ── BUG CRITICO REALE (2026-08-29): utenti che perdevano le transazioni
// "ogni tot tempo o al rilascio di una nuova versione" e si ritrovavano coi
// dati dimostrativi del primo avvio. Causa verificata: init() si fidava
// ciecamente della copia "shadow" a un mismatch di checksum con "main", e se
// quel fallback falliva l'eccezione scartava in silenzio ANCHE "main", già
// analizzata con successo. Questi test riproducono lo scenario prima del fix
// (avrebbero fallito) e lo confermano risolto dopo. ──
test('VaultDAO.init: "shadow" corrotta ma "main" valida → i dati REALI di main non vengono scartati (bug reale: prima l\'eccezione sulla shadow buttava via anche main già letta con successo)', () => {
  const savedLS = globalThis.localStorage;
  globalThis.window = { ...globalThis.window };
  try {
    const ls = fakeLocalStorage();
    ls.setItem('omega_core_db', payloadWithTx(5));
    ls.setItem('omega_shadow_vault', 'questo-non-e-base64-json-valido!!!');
    globalThis.localStorage = ls;
    VaultDAO.init();
    assert.equal(VaultDAO._countTx(VaultDAO.state), 5, 'le 5 transazioni reali in "main" devono sopravvivere a una "shadow" corrotta');
  } finally {
    globalThis.localStorage = savedLS;
  }
});

test('VaultDAO.init: "main" e "shadow" divergono (scrittura parziale) → vince la copia con PIÙ transazioni, mai "shadow" per definizione (bug reale: shadow è ~33% più grande per il base64, può restare indietro per quota superata mentre main si aggiorna)', () => {
  const savedLS = globalThis.localStorage;
  try {
    const ls = fakeLocalStorage();
    // main aggiornata con 8 transazioni reali, shadow rimasta indietro a 3
    // (simula: la scrittura di main è riuscita, quella di shadow no)
    ls.setItem('omega_core_db', payloadWithTx(8));
    ls.setItem('omega_shadow_vault', encodeShadow(payloadWithTx(3)));
    globalThis.localStorage = ls;
    VaultDAO.init();
    assert.equal(VaultDAO._countTx(VaultDAO.state), 8, 'deve vincere la copia con più transazioni (main), non la shadow più vecchia');
  } finally {
    globalThis.localStorage = savedLS;
  }
});

test('VaultDAO.init: checksum combaciano (caso normale) → usa main senza ambiguità', () => {
  const savedLS = globalThis.localStorage;
  try {
    const ls = fakeLocalStorage();
    const payload = payloadWithTx(4);
    ls.setItem('omega_core_db', payload);
    ls.setItem('omega_shadow_vault', encodeShadow(payload));
    globalThis.localStorage = ls;
    VaultDAO.init();
    assert.equal(VaultDAO._countTx(VaultDAO.state), 4);
  } finally {
    globalThis.localStorage = savedLS;
  }
});

test('VaultDAO.init: entrambe le copie corrotte → nessun crash, stato di default (mai peggio del comportamento precedente, ma senza inghiottire l\'errore in silenzio)', () => {
  const savedLS = globalThis.localStorage;
  try {
    const ls = fakeLocalStorage();
    ls.setItem('omega_core_db', '{questo non è JSON valido');
    ls.setItem('omega_shadow_vault', 'nemmeno-questo-lo-e!!!');
    globalThis.localStorage = ls;
    assert.doesNotThrow(() => VaultDAO.init());
  } finally {
    globalThis.localStorage = savedLS;
  }
});

test('VaultDAO.save: la scrittura di "shadow" fallisce per quota superata → "main" resta comunque salvata, e la shadow stantia viene rimossa invece di restare come falso mismatch (bug reale: shadow è più grande del payload vero per il base64, supera la quota per prima)', () => {
  const savedLS = globalThis.localStorage;
  const savedIDB = globalThis.indexedDB;
  const savedState = VaultDAO.state;
  try {
    VaultDAO.state = { ...VaultDAO.state, transactions: JSON.parse(payloadWithTx(50)).transactions, currentDate: new Date() };
    // Quota calcolata sul payload REALE che save() produce (stato intero,
    // non solo le transazioni) — abbastanza per "main" ma non per "shadow",
    // che è sempre ~33% più lunga per l'overhead base64: simula lo scenario
    // reale (main si salva, shadow no).
    const realPayload = JSON.stringify({ ...VaultDAO.state, currentDate: VaultDAO.state.currentDate.toISOString() });
    const ls = fakeLocalStorage({ quota: realPayload.length + 10 });
    globalThis.localStorage = ls;
    globalThis.indexedDB = undefined;
    VaultDAO.save();
    assert.ok(ls.getItem('omega_core_db'), '"main" deve essere stata scritta con successo');
    assert.equal(ls.getItem('omega_shadow_vault'), null, 'una "shadow" che non è riuscita a scriversi non deve restare stantia — va rimossa, mai lasciata a metà');
  } finally {
    VaultDAO.state = savedState;
    globalThis.localStorage = savedLS;
    globalThis.indexedDB = savedIDB;
  }
});
