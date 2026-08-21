'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.document = globalThis.document || { querySelector: () => null, addEventListener: () => {}, getElementById: () => null };
const { VaultDAO } = await import('./vault.js');

// ── updateTransactionCategory: la funzione che sblocca la correzione ──
// Prima di questo lavoro, l'unica azione su un movimento della lista era
// eliminarlo. Questi test coprono il pezzo di stato (il pezzo di UI si
// verifica dal vivo in Chrome, essendo main.js non modulare).

test('cambia la categoria e restituisce prima/dopo', () => {
  VaultDAO.state.transactions = { '2026-08': [{ id: 'a', amount: 30, category: 'spesa', type: 'uscita', description: 'Esselunga', date: '2026-08-01' }] };
  VaultDAO.save = () => {};
  const esito = VaultDAO.updateTransactionCategory('2026-08', 'a', 'ristoranti');
  assert.deepEqual(esito, { id: 'a', prima: 'spesa', dopo: 'ristoranti' });
  assert.equal(VaultDAO.state.transactions['2026-08'][0].category, 'ristoranti');
});

test('nessun cambiamento reale (stessa categoria) → null, nessun save inutile', () => {
  VaultDAO.state.transactions = { '2026-08': [{ id: 'a', amount: 30, category: 'spesa', type: 'uscita', description: 'x', date: '2026-08-01' }] };
  let saves = 0;
  VaultDAO.save = () => { saves++; };
  const esito = VaultDAO.updateTransactionCategory('2026-08', 'a', 'spesa');
  assert.equal(esito, null);
  assert.equal(saves, 0, 'non deve salvare se non è cambiato nulla');
});

test('id inesistente → null, nessun crash', () => {
  VaultDAO.state.transactions = { '2026-08': [] };
  VaultDAO.save = () => {};
  assert.equal(VaultDAO.updateTransactionCategory('2026-08', 'inesistente', 'spesa'), null);
});

test('mese inesistente → null, nessun crash', () => {
  VaultDAO.state.transactions = {};
  VaultDAO.save = () => {};
  assert.equal(VaultDAO.updateTransactionCategory('2099-01', 'a', 'spesa'), null);
});

test('non tocca amount, description, date, hash — SOLO la categoria', () => {
  const originale = { id: 'a', amount: 42.5, category: 'spesa', type: 'uscita', description: 'Farmacia', date: '2026-08-05', hash: 'h1', prevHash: 'h0' };
  VaultDAO.state.transactions = { '2026-08': [{ ...originale }] };
  VaultDAO.save = () => {};
  VaultDAO.updateTransactionCategory('2026-08', 'a', 'salute');
  const tx = VaultDAO.state.transactions['2026-08'][0];
  assert.equal(tx.amount, originale.amount);
  assert.equal(tx.description, originale.description);
  assert.equal(tx.date, originale.date);
  assert.equal(tx.hash, originale.hash, 'la hash chain non va toccata: il sync mesh identifica per id, non per hash');
  assert.equal(tx.category, 'salute');
});

test('due transazioni con lo stesso id in mesi diversi: cambia solo quella del mese giusto', () => {
  VaultDAO.state.transactions = {
    '2026-07': [{ id: 'dup', amount: 10, category: 'spesa', type: 'uscita', description: 'x', date: '2026-07-31' }],
    '2026-08': [{ id: 'dup', amount: 10, category: 'spesa', type: 'uscita', description: 'x', date: '2026-08-01' }],
  };
  VaultDAO.save = () => {};
  VaultDAO.updateTransactionCategory('2026-08', 'dup', 'trasporti');
  assert.equal(VaultDAO.state.transactions['2026-07'][0].category, 'spesa');
  assert.equal(VaultDAO.state.transactions['2026-08'][0].category, 'trasporti');
});
