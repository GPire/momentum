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
