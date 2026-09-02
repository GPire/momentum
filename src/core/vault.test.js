import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.indexedDB = undefined;
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem: () => {} };

const { runSchemaMigrations, tryReadIosHandoff, VaultDAO, DurableStore, reconstructMissingFromTxLog } = await import("./vault.js");

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

// ── Recupero da tx_log per chi ha GIÀ subito il bug di perdita dati sopra
// (2026-08-29): tx_log è uno store IndexedDB append-only separato dallo
// snapshot "state"/"main" colpito dal bug — queste transazioni possono
// essere ancora lì anche quando lo snapshot le ha "perse". ──
test('reconstructMissingFromTxLog: transazioni in tx_log ma assenti dallo stato attuale vengono recuperate', () => {
  const currentState = { transactions: { '2026-08': [{ id: 'a' }] }, deletedTx: {} };
  const log = [
    { month: '2026-08', tx: { id: 'a' } }, // già presente, non deve contare
    { month: '2026-08', tx: { id: 'b' } }, // mancante
  ];
  const { recovered, addedCount } = reconstructMissingFromTxLog(log, currentState);
  assert.equal(addedCount, 1);
  assert.deepEqual(recovered['2026-08'].map(t => t.id), ['b']);
});

test("reconstructMissingFromTxLog: una transazione cancellata di proposito (lapide in deletedTx) non viene MAI resuscitata", () => {
  const currentState = { transactions: {}, deletedTx: { x: '2026-08-20T00:00:00Z' } };
  const log = [{ month: '2026-08', tx: { id: 'x' } }];
  const { addedCount } = reconstructMissingFromTxLog(log, currentState);
  assert.equal(addedCount, 0);
});

test('reconstructMissingFromTxLog: duplicati nello stesso log vengono contati una sola volta', () => {
  const currentState = { transactions: {}, deletedTx: {} };
  const log = [
    { month: '2026-08', tx: { id: 'd' } },
    { month: '2026-08', tx: { id: 'd' } },
  ];
  const { addedCount, recovered } = reconstructMissingFromTxLog(log, currentState);
  assert.equal(addedCount, 1);
  assert.equal(recovered['2026-08'].length, 1);
});

test('reconstructMissingFromTxLog: voci senza "month" ma con una data valida derivano il mese dalla data della transazione', () => {
  const currentState = { transactions: {}, deletedTx: {} };
  const log = [{ tx: { id: 'e', date: '2026-05-14T10:00:00Z' } }]; // niente month esplicito
  const { recovered, addedCount } = reconstructMissingFromTxLog(log, currentState);
  assert.equal(addedCount, 1);
  assert.deepEqual(recovered['2026-05'].map(t => t.id), ['e']);
});

test('reconstructMissingFromTxLog: voci malformate (senza tx, senza id, senza mese né data) vengono ignorate senza crash', () => {
  const currentState = { transactions: {}, deletedTx: {} };
  const log = [null, {}, { tx: {} }, { tx: { id: 'f' } }]; // l'ultima non ha né month né date: scartata
  assert.doesNotThrow(() => {
    const { addedCount } = reconstructMissingFromTxLog(log, currentState);
    assert.equal(addedCount, 0);
  });
});

test('reconstructMissingFromTxLog: log o stato vuoti/assenti non fanno crashare nulla', () => {
  assert.deepEqual(reconstructMissingFromTxLog([], {}), { recovered: {}, addedCount: 0 });
  assert.deepEqual(reconstructMissingFromTxLog(null, null), { recovered: {}, addedCount: 0 });
});

test('VaultDAO.checkTxLogRecovery: legge tx_log e ritorna SOLO cosa manca, senza scrivere nulla nello stato (pura rispetto allo stato)', async () => {
  const savedGetAll = DurableStore.getAll;
  const savedState = VaultDAO.state;
  try {
    VaultDAO.state = { ...VaultDAO.state, transactions: { '2026-08': [{ id: 'a', amount: 1 }] }, deletedTx: {} };
    DurableStore.getAll = async (store) => {
      assert.equal(store, 'tx_log');
      return [
        { month: '2026-08', tx: { id: 'a', amount: 1 } },
        { month: '2026-08', tx: { id: 'b', amount: 20 } },
        { month: '2026-07', tx: { id: 'c', amount: 30 } },
      ];
    };
    const { recovered, addedCount } = await VaultDAO.checkTxLogRecovery();
    assert.equal(addedCount, 2);
    assert.deepEqual(recovered['2026-08'].map(t => t.id), ['b']);
    assert.deepEqual(recovered['2026-07'].map(t => t.id), ['c']);
    assert.equal(VaultDAO._countTx(VaultDAO.state), 1, 'check non deve modificare lo stato reale, solo apply');
  } finally {
    DurableStore.getAll = savedGetAll;
    VaultDAO.state = savedState;
  }
});

test('VaultDAO.checkTxLogRecovery: IndexedDB non disponibile/errore → nessun crash, nessuna transazione recuperata', async () => {
  const savedGetAll = DurableStore.getAll;
  try {
    DurableStore.getAll = async () => { throw new Error('IndexedDB non disponibile'); };
    const { recovered, addedCount } = await VaultDAO.checkTxLogRecovery();
    assert.equal(addedCount, 0);
    assert.deepEqual(recovered, {});
  } finally {
    DurableStore.getAll = savedGetAll;
  }
});

test('VaultDAO.applyTxLogRecovery: applica SOLO dopo la chiamata esplicita (mai automatica), è puramente additiva e salva', () => {
  const savedState = VaultDAO.state;
  const savedLS = globalThis.localStorage;
  try {
    VaultDAO.state = { ...VaultDAO.state, transactions: { '2026-08': [{ id: 'a', amount: 1 }] }, currentDate: new Date() };
    const ls = fakeLocalStorage();
    globalThis.localStorage = ls;
    const added = VaultDAO.applyTxLogRecovery({ '2026-08': [{ id: 'b', amount: 20 }], '2026-07': [{ id: 'c', amount: 30 }] });
    assert.equal(added, 2);
    assert.equal(VaultDAO._countTx(VaultDAO.state), 3, 'la transazione "a" già presente resta, "b" e "c" si aggiungono');
    assert.ok(ls.getItem('omega_core_db'), 'deve salvare dopo aver applicato il recupero');
  } finally {
    VaultDAO.state = savedState;
    globalThis.localStorage = savedLS;
  }
});

test('scenario reale segnalato dall\'utente: chi ha già reinserito a mano NUOVE transazioni prima del fix, al recupero deve ritrovare ANCHE le vecchie perse — mai una sovrascrittura, mai un doppione, mai perdere le nuove', async () => {
  const savedState = VaultDAO.state;
  const savedLS = globalThis.localStorage;
  const savedGetAll = DurableStore.getAll;
  try {
    // Stato ATTUALE: l'utente, dopo aver perso i dati vecchi per il bug, ha
    // già reinserito a mano una transazione nuova prima che arrivasse il fix.
    VaultDAO.state = {
      ...VaultDAO.state,
      transactions: { '2026-08': [{ id: 'nuova1', amount: 25, description: 'Reinserita a mano dopo il bug' }] },
      deletedTx: {},
      currentDate: new Date(),
    };
    const ls = fakeLocalStorage();
    globalThis.localStorage = ls;
    // tx_log (mai toccato dal bug): ha ANCORA le due transazioni vecchie
    // perse, registrate PRIMA del bug.
    DurableStore.getAll = async () => [
      { month: '2026-08', tx: { id: 'vecchia1', amount: 55.9, description: 'Vecchia persa 1' } },
      { month: '2026-08', tx: { id: 'vecchia2', amount: 999, description: 'Stipendio vecchio perso' } },
    ];
    const { recovered, addedCount } = await VaultDAO.checkTxLogRecovery();
    assert.equal(addedCount, 2, 'deve trovare le 2 vecchie perse, "nuova1" è già nello stato e non va ricontata');
    const applied = VaultDAO.applyTxLogRecovery(recovered);
    assert.equal(applied, 2);
    const ids = VaultDAO.state.transactions['2026-08'].map(t => t.id).sort();
    assert.deepEqual(ids, ['nuova1', 'vecchia1', 'vecchia2'], 'la nuova reinserita a mano resta, le due vecchie perse si aggiungono, nessun doppione');
    assert.equal(VaultDAO._countTx(VaultDAO.state), 3);
  } finally {
    VaultDAO.state = savedState;
    globalThis.localStorage = savedLS;
    DurableStore.getAll = savedGetAll;
  }
});

test('VaultDAO.applyTxLogRecovery: un recupero vuoto non chiama save() (nessuna scrittura inutile)', () => {
  const savedState = VaultDAO.state;
  const savedLS = globalThis.localStorage;
  try {
    VaultDAO.state = { ...VaultDAO.state, transactions: {}, currentDate: new Date() };
    const ls = fakeLocalStorage();
    globalThis.localStorage = ls;
    const added = VaultDAO.applyTxLogRecovery({});
    assert.equal(added, 0);
    assert.equal(ls.getItem('omega_core_db'), null);
  } finally {
    VaultDAO.state = savedState;
    globalThis.localStorage = savedLS;
  }
});

// ── "Cancella tutti i dati" (window.nukeVault) deve significare davvero
// tutto (2026-08-29, bug reale segnalato dall'utente): prima cancellava
// SOLO localStorage — IndexedDB restava intatto e, al riavvio,
// initDurable() lo trovava ancora lì e lo ripristinava (prima solo se
// localStorage era vuoto, condizione ESATTAMENTE vera appena dopo un
// "cancella tutto"; con la riconciliazione "più transazioni vince" del fix
// di init()/save() sopra, IndexedDB avrebbe vinto SEMPRE contro un
// localStorage appena svuotato). Un utente che chiedeva la cancellazione
// completa si ritrovava i dati indietro — l'opposto di quello che chiedeva. ──
test('DurableStore.deleteAll: con IndexedDB disponibile, chiama indexedDB.deleteDatabase("momentum_vault") e chiude la connessione già aperta', async () => {
  const savedAvailable = DurableStore.available;
  const savedDb = DurableStore.db;
  const savedIDB = globalThis.indexedDB;
  try {
    DurableStore.available = true;
    let closedCalled = false;
    DurableStore.db = { close: () => { closedCalled = true; } };
    let deletedName = null;
    globalThis.indexedDB = {
      deleteDatabase: (name) => {
        deletedName = name;
        const req = {};
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      },
    };
    await DurableStore.deleteAll();
    assert.equal(deletedName, 'momentum_vault');
    assert.equal(closedCalled, true, 'deve chiudere la connessione aperta prima di cancellare, altrimenti il browser può bloccare la delete');
    assert.equal(DurableStore.db, null, 'la connessione va azzerata dopo la cancellazione');
  } finally {
    DurableStore.available = savedAvailable;
    DurableStore.db = savedDb;
    globalThis.indexedDB = savedIDB;
  }
});

test('DurableStore.deleteAll: IndexedDB non disponibile → no-op sicuro, mai un crash', async () => {
  const savedAvailable = DurableStore.available;
  try {
    DurableStore.available = false;
    await assert.doesNotReject(() => DurableStore.deleteAll());
  } finally {
    DurableStore.available = savedAvailable;
  }
});

test('DurableStore.deleteAll: un errore o un blocco di IndexedDB durante la cancellazione non deve MAI impedire il reset (mai bloccare una cancellazione richiesta esplicitamente dall\'utente per un dettaglio tecnico)', async () => {
  const savedAvailable = DurableStore.available;
  const savedIDB = globalThis.indexedDB;
  try {
    DurableStore.available = true;
    globalThis.indexedDB = {
      deleteDatabase: () => {
        const req = {};
        setTimeout(() => req.onerror && req.onerror(new Error('boom')), 0);
        return req;
      },
    };
    await assert.doesNotReject(() => DurableStore.deleteAll());
  } finally {
    DurableStore.available = savedAvailable;
    globalThis.indexedDB = savedIDB;
  }
});

// ── BUG CRITICO REALE trovato dal vivo (2026-08-29): indexedDB.open() può
// restare "in sospeso" INDEFINITAMENTE se un'altra scheda/connessione
// blocca l'apertura (es. un deleteDatabase() in coda altrove — vedi
// DurableStore.deleteAll sopra) — nessun evento onsuccess/onerror mai,
// solo silenzio. Effetto reale osservato: initDurable() non completava
// mai, `Promise.allSettled(...).finally()` nel boot di main.js non
// scattava mai, initApp() non partiva MAI — l'intera app restava sulla
// schermata iniziale statica, senza traduzioni, senza dati, senza un solo
// errore in console (il tipo di fallimento silenzioso più difficile da
// diagnosticare). Stessa disciplina già in con-timeout.js. ──
test('DurableStore.open: indexedDB.open() che non chiama mai onsuccess/onerror/onblocked (bloccato per sempre) non blocca il boot — risolve entro il timeout con null invece di restare in sospeso all\'infinito', async () => {
  const savedAvailable = DurableStore.available;
  const savedDb = DurableStore.db;
  const savedIDB = globalThis.indexedDB;
  try {
    DurableStore.available = true;
    DurableStore.db = null;
    globalThis.indexedDB = {
      open: () => ({}), // nessun onsuccess/onerror/onblocked chiamato MAI: simula un IndexedDB bloccato per sempre
    };
    const db = await DurableStore.open();
    assert.equal(db, null, 'deve ripiegare su null entro il timeout, mai restare in sospeso per sempre');
  } finally {
    DurableStore.available = savedAvailable;
    DurableStore.db = savedDb;
    globalThis.indexedDB = savedIDB;
  }
});

test('DurableStore.open: caso normale (indexedDB.open() risponde subito) resta comunque veloce, il timeout non rallenta il percorso felice', async () => {
  const savedAvailable = DurableStore.available;
  const savedDb = DurableStore.db;
  const savedIDB = globalThis.indexedDB;
  try {
    DurableStore.available = true;
    DurableStore.db = null;
    const fakeDb = { name: 'momentum_vault' };
    globalThis.indexedDB = {
      open: () => {
        const req = {};
        setTimeout(() => { req.onsuccess && req.onsuccess(); }, 0);
        req.result = fakeDb;
        return req;
      },
    };
    const start = Date.now();
    const db = await DurableStore.open();
    assert.equal(db, fakeDb);
    assert.ok(Date.now() - start < 1000, 'il percorso felice non deve mai aspettare il timeout di sicurezza');
  } finally {
    DurableStore.available = savedAvailable;
    DurableStore.db = savedDb;
    globalThis.indexedDB = savedIDB;
  }
});

// ══════════════════════════════════════════════════════════════
// RECUPERO DATI DA tx_log — tutti gli scenari, perché qui si tocca
// il caso peggiore: transazioni di soldi che ricompaiono dal nulla.
// ══════════════════════════════════════════════════════════════
// La regola è una sola e vale in ogni caso qui sotto: il recupero può SOLO
// riportare indietro qualcosa che manca davvero. Mai un doppione, mai una
// transazione cancellata di proposito, mai un dato toccato di quelli che
// l'utente già vede.

const voceLog = (tx, month) => ({ month: month || String(tx.date).slice(0, 7), tx, ts: Date.now() });

test('recupero: propone SOLO le transazioni che mancano davvero', () => {
  const stato = { transactions: { '2026-08': [{ id: 'a', date: '2026-08-10', amount: 10, type: 'uscita', description: 'Caffè' }] } };
  const log = [
    voceLog({ id: 'a', date: '2026-08-10', amount: 10, type: 'uscita', description: 'Caffè' }),   // già presente
    voceLog({ id: 'b', date: '2026-08-11', amount: 42.5, type: 'uscita', description: 'Spesa' }), // manca
  ];
  const { recovered, addedCount } = reconstructMissingFromTxLog(log, stato);
  assert.equal(addedCount, 1);
  assert.equal(recovered['2026-08'][0].id, 'b');
});

test('recupero: una transazione cancellata di proposito NON risorge mai', () => {
  const stato = { transactions: {}, deletedTx: { 'b': Date.now() } };
  const log = [voceLog({ id: 'b', date: '2026-08-11', amount: 42.5, type: 'uscita', description: 'Spesa' })];
  assert.equal(reconstructMissingFromTxLog(log, stato).addedCount, 0);
});

// Il caso più probabile di tutti, e quello che prima passava: l'utente si
// accorge che manca una spesa e la RIMETTE A MANO. Id diverso, contenuto
// identico. Senza il controllo per contenuto se la ritrovava due volte, con
// il saldo sbagliato e nessuna spiegazione.
test('recupero: una spesa già reinserita a mano non viene riproposta (id diverso, stesso contenuto)', () => {
  const stato = { transactions: { '2026-08': [{ id: 'nuovo-id', date: '2026-08-11', amount: 42.5, type: 'uscita', description: 'Spesa supermercato' }] } };
  const log = [voceLog({ id: 'vecchio-id', date: '2026-08-11', amount: 42.5, type: 'uscita', description: 'Spesa supermercato' })];
  assert.equal(reconstructMissingFromTxLog(log, stato).addedCount, 0);
});

test('recupero: la descrizione si confronta ignorando maiuscole e spazi doppi', () => {
  const stato = { transactions: { '2026-08': [{ id: 'x', date: '2026-08-11', amount: 42.5, type: 'uscita', description: 'Spesa  Supermercato' }] } };
  const log = [voceLog({ id: 'y', date: '2026-08-11', amount: 42.5, type: 'uscita', description: 'spesa supermercato' })];
  assert.equal(reconstructMissingFromTxLog(log, stato).addedCount, 0);
});

test('recupero: due spese uguali per importo ma di GIORNI diversi restano due spese distinte', () => {
  const stato = { transactions: { '2026-08': [{ id: 'x', date: '2026-08-11', amount: 1.5, type: 'uscita', description: 'Caffè' }] } };
  const log = [voceLog({ id: 'y', date: '2026-08-12', amount: 1.5, type: 'uscita', description: 'Caffè' })];
  assert.equal(reconstructMissingFromTxLog(log, stato).addedCount, 1, 'il caffè di ieri e quello di oggi sono due caffè');
});

test('recupero: stessa spesa e stesso giorno ma VERSO diverso non è la stessa cosa', () => {
  const stato = { transactions: { '2026-08': [{ id: 'x', date: '2026-08-11', amount: 100, type: 'uscita', description: 'Bonifico' }] } };
  const log = [voceLog({ id: 'y', date: '2026-08-11', amount: 100, type: 'entrata', description: 'Bonifico' })];
  assert.equal(reconstructMissingFromTxLog(log, stato).addedCount, 1);
});

test('recupero: un log append-only con la stessa voce ripetuta propone UNA sola transazione', () => {
  const tx = { id: 'b', date: '2026-08-11', amount: 42.5, type: 'uscita', description: 'Spesa' };
  const log = [voceLog(tx), voceLog(tx), voceLog(tx)];
  assert.equal(reconstructMissingFromTxLog(log, { transactions: {} }).addedCount, 1);
});

test('recupero: due transazioni DIVERSE con lo stesso id nel log: si tiene la prima, mai due', () => {
  const log = [
    voceLog({ id: 'dup', date: '2026-08-11', amount: 10, type: 'uscita', description: 'Prima' }),
    voceLog({ id: 'dup', date: '2026-08-12', amount: 20, type: 'uscita', description: 'Seconda' }),
  ];
  const { addedCount, recovered } = reconstructMissingFromTxLog(log, { transactions: {} });
  assert.equal(addedCount, 1);
  assert.equal(recovered['2026-08'][0].description, 'Prima');
});

test('recupero: le transazioni finiscono nel mese giusto anche se il log non lo dice', () => {
  const log = [
    { tx: { id: 'a', date: '2026-07-03', amount: 10, type: 'uscita', description: 'Luglio' }, ts: 1 },   // senza month
    voceLog({ id: 'b', date: '2026-08-03', amount: 20, type: 'uscita', description: 'Agosto' }),
  ];
  const { recovered } = reconstructMissingFromTxLog(log, { transactions: {} });
  assert.equal(recovered['2026-07'].length, 1);
  assert.equal(recovered['2026-08'].length, 1);
});

test('recupero: voci sporche del log (senza id, senza data, nulle) vengono saltate senza crash', () => {
  const log = [
    null, undefined, {}, { tx: null }, { tx: { amount: 5 } },                    // niente id
    { tx: { id: 'senza-data', amount: 5, type: 'uscita' }, ts: 1 },              // niente data né month
    voceLog({ id: 'buona', date: '2026-08-11', amount: 42.5, type: 'uscita', description: 'Spesa' }),
  ];
  const { addedCount, recovered } = reconstructMissingFromTxLog(log, { transactions: {} });
  assert.equal(addedCount, 1);
  assert.equal(recovered['2026-08'][0].id, 'buona');
});

test('recupero: un log vuoto o uno stato vuoto non propongono nulla e non esplodono', () => {
  assert.equal(reconstructMissingFromTxLog([], { transactions: {} }).addedCount, 0);
  assert.equal(reconstructMissingFromTxLog(null, null).addedCount, 0);
  assert.equal(reconstructMissingFromTxLog(undefined, { transactions: {} }).addedCount, 0);
});

// Scala: chi ha usato l'app per anni ha un log lungo, e il recupero non deve
// né rallentare né proporre migliaia di doppioni.
test('recupero a scala: 5000 voci nel log, di cui 4990 già presenti', () => {
  const presenti = [];
  const log = [];
  for (let i = 0; i < 5000; i++) {
    const tx = { id: `t${i}`, date: `2026-0${(i % 8) + 1}-1${i % 9}`, amount: 10 + (i % 90), type: i % 3 ? 'uscita' : 'entrata', description: `Spesa ${i}` };
    log.push(voceLog(tx));
    if (i >= 10) presenti.push(tx); // solo le prime 10 mancano davvero
  }
  const stato = { transactions: { tutte: presenti } };
  const inizio = Date.now();
  const { addedCount } = reconstructMissingFromTxLog(log, stato);
  assert.equal(addedCount, 10);
  assert.ok(Date.now() - inizio < 500, 'il controllo deve restare istantaneo anche su un log lungo');
});
