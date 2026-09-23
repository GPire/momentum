import test from 'node:test';
import assert from 'node:assert/strict';
import { bindVaultDurability, inspectLocalStorageHealth, requestLocalStoragePersistence } from './storage-resilience.js';

function surface() {
  const handlers = new Map();
  return {
    visibilityState: 'visible',
    addEventListener(name, fn) { handlers.set(name, fn); },
    removeEventListener(name, fn) { if (handlers.get(name) === fn) handlers.delete(name); },
    fire(name) { handlers.get(name)?.(); },
  };
}

test('storage health reports quota and persistence without claiming unsupported browsers are safe', async () => {
  assert.deepEqual(await inspectLocalStorageHealth(null), { supported: false, persistent: false, usage: null, quota: null });
  assert.deepEqual(await inspectLocalStorageHealth({ persisted: async () => true, estimate: async () => ({ usage: 24, quota: 100 }), persist: async () => true }), {
    supported: true, persistent: true, usage: 24, quota: 100,
  });
});

test('persistent storage is requested only after a gesture on an archive with data', async () => {
  const doc = surface(), win = surface();
  let data = false, requests = 0, flushes = 0, resumes = 0;
  const remove = bindVaultDurability({
    doc, win, vault: { flushDurable: async () => { flushes++; } }, hasPersonalData: () => data,
    storageManager: { persisted: async () => false, persist: async () => { requests++; return true; } },
    onResume: () => { resumes++; },
  });
  doc.fire('pointerdown');
  assert.equal(requests, 0);
  data = true;
  doc.fire('pointerdown');
  await new Promise(resolve => setImmediate(resolve));
  doc.fire('pointerdown');
  assert.equal(requests, 1);
  doc.visibilityState = 'hidden'; doc.fire('visibilitychange'); win.fire('pagehide');
  doc.visibilityState = 'visible'; doc.fire('visibilitychange');
  assert.equal(flushes, 2);
  assert.equal(resumes, 1);
  remove();
});

test('persistence denial remains explicit and never interrupts the vault', async () => {
  assert.equal(await requestLocalStoragePersistence({ persisted: async () => false, persist: async () => false }), false);
  assert.equal(await requestLocalStoragePersistence({ persist: async () => { throw new Error('denied'); } }), false);
});
