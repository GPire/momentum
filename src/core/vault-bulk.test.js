import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.document = globalThis.document || { querySelector: () => null, addEventListener: () => {}, getElementById: () => null };
const { VaultDAO } = await import('./vault.js');

test('bulk: N inserimenti → 1 solo save (non O(n²)) e tutte presenti', () => {
  VaultDAO.state.transactions = {};
  VaultDAO.state.lastHash = 'GENESIS';
  let saves = 0;
  const realSave = VaultDAO.save; VaultDAO.save = () => { saves++; };
  const N = 1500;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    VaultDAO.addTransaction('2025-01', { id: 'b' + i, amount: 10 + i, category: 'spesa', type: 'uscita', description: 'tx ' + i, date: '2025-01-15' }, { bulk: true });
  }
  VaultDAO.save(); // il flush finale che fa l'import
  const ms = Date.now() - t0;
  VaultDAO.save = realSave;
  assert.equal(saves, 1, 'in bulk deve esserci UN solo save, non uno per riga');
  assert.equal(VaultDAO.state.transactions['2025-01'].length, N);
  assert.ok(ms < 3000, `1500 inserimenti bulk devono essere veloci (${ms}ms)`);
});

test('non-bulk: comportamento invariato (salva a ogni inserimento)', () => {
  VaultDAO.state.transactions = {};
  VaultDAO.state.lastHash = 'GENESIS';
  let saves = 0;
  const realSave = VaultDAO.save; VaultDAO.save = () => { saves++; };
  VaultDAO.addTransaction('2025-02', { id: 'x1', amount: 5, category: 'spesa', type: 'uscita', description: 'a', date: '2025-02-01' });
  VaultDAO.addTransaction('2025-02', { id: 'x2', amount: 9, category: 'spesa', type: 'uscita', description: 'b', date: '2025-02-02' });
  VaultDAO.save = realSave;
  assert.equal(saves, 2); // un save per inserimento (default)
});

test('noDedup: due transazioni distinte di pari importo/giorno NON vengono fuse (id fidato)', () => {
  VaultDAO.state.transactions = {};
  VaultDAO.state.lastHash = 'GENESIS';
  VaultDAO.save = () => {};
  // stesse identiche (importo/data/descrizione) ma con externalId diversi = distinte
  const a = { id: 'a', amount: 40, category: 'etf', type: 'invest', description: 'Acquisto Snowflake', date: '2024-10-16', externalId: 'ID_A' };
  const b = { id: 'b', amount: 40, category: 'etf', type: 'invest', description: 'Acquisto Snowflake', date: '2024-10-16', externalId: 'ID_B' };
  VaultDAO.addTransaction('2024-10', a, { bulk: true, noDedup: true });
  VaultDAO.addTransaction('2024-10', b, { bulk: true, noDedup: true });
  assert.equal(VaultDAO.state.transactions['2024-10'].length, 2); // entrambe, non fuse

  // senza noDedup, la fuzzy le fonderebbe (comportamento per screenshot/manuale)
  VaultDAO.state.transactions = {}; VaultDAO.state.lastHash = 'GENESIS';
  VaultDAO.addTransaction('2024-10', { ...a, externalId: '' }, { bulk: true });
  const r = VaultDAO.addTransaction('2024-10', { ...b, externalId: '' }, { bulk: true });
  assert.equal(r.duplicate, true);
  assert.equal(VaultDAO.state.transactions['2024-10'].length, 1);
});

// ── LA FINESTRA DI DEDUPLICA RISTRETTA PER I TOCCHI MANUALI ──
// Bug reale, trovato aggiungendo tre spese identiche dal modulo dell'app e
// vedendone salvate solo una: la finestra di 48 ore di findDuplicate (pensata
// per fondere la stessa operazione descritta da fonti diverse, es. import
// bancario) fondeva anche due caffè genuinamente comprati in due giorni
// diversi — e proprio quella fusione toglieva al motore delle abitudini le
// occorrenze ripetute di cui ha bisogno per riconoscere un pattern.
test('addTransaction: SENZA una finestra dedicata, due spese identiche a un giorno di distanza si fondono (comportamento import, invariato)', () => {
  VaultDAO.state.transactions = {};
  VaultDAO.state.lastHash = 'GENESIS';
  VaultDAO.save = () => {};
  VaultDAO.addTransaction('2026-08', { id: 1, amount: 1.5, category: 'ristoranti', type: 'uscita', description: 'Bar Centrale', date: '2026-08-10T08:00:00.000Z' });
  const r = VaultDAO.addTransaction('2026-08', { id: 2, amount: 1.5, category: 'ristoranti', type: 'uscita', description: 'Bar Centrale', date: '2026-08-11T08:00:00.000Z' });
  assert.equal(r.duplicate, true, 'senza finestra dedicata resta il comportamento di sempre: 48 ore, pensato per gli import');
  assert.equal(VaultDAO.state.transactions['2026-08'].length, 1);
});

test('addTransaction: CON dedupWindowHours ristretta, due spese identiche a un giorno di distanza restano DUE', () => {
  VaultDAO.state.transactions = {};
  VaultDAO.state.lastHash = 'GENESIS';
  VaultDAO.save = () => {};
  VaultDAO.addTransaction('2026-08', { id: 1, amount: 1.5, category: 'ristoranti', type: 'uscita', description: 'Bar Centrale', date: '2026-08-10T08:00:00.000Z' }, { dedupWindowHours: 0.25 });
  const r = VaultDAO.addTransaction('2026-08', { id: 2, amount: 1.5, category: 'ristoranti', type: 'uscita', description: 'Bar Centrale', date: '2026-08-11T08:00:00.000Z' }, { dedupWindowHours: 0.25 });
  assert.ok(!r.duplicate, 'un giorno dopo è un\'abitudine reale, non un doppione — deve restare una seconda spesa');
  assert.equal(VaultDAO.state.transactions['2026-08'].length, 2);
});

test('addTransaction: la finestra ristretta protegge ANCORA dal vero doppio tocco (due secondi dopo)', () => {
  VaultDAO.state.transactions = {};
  VaultDAO.state.lastHash = 'GENESIS';
  VaultDAO.save = () => {};
  VaultDAO.addTransaction('2026-08', { id: 1, amount: 1.5, category: 'ristoranti', type: 'uscita', description: 'Bar Centrale', date: '2026-08-10T08:00:00.000Z' }, { dedupWindowHours: 0.25 });
  const r = VaultDAO.addTransaction('2026-08', { id: 2, amount: 1.5, category: 'ristoranti', type: 'uscita', description: 'Bar Centrale', date: '2026-08-10T08:00:02.000Z' }, { dedupWindowHours: 0.25 });
  assert.equal(r.duplicate, true, 'due secondi dopo è quasi certamente un doppio tocco per errore, non una seconda abitudine');
  assert.equal(VaultDAO.state.transactions['2026-08'].length, 1);
});
