import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutoLock, autoLockMinutes } from './auto-lock.js';

function orologio() { let t = 0; return { now: () => t, avanza: (ms) => { t += ms; } }; }

test('in background oltre il limite: al ritorno si blocca, una sola volta', () => {
  const c = orologio(); let blocchi = 0;
  const a = createAutoLock({ timeoutMs: 60_000, onLock: () => blocchi++, now: c.now });
  a.hidden(); c.avanza(61_000); a.visible(); a.visible(); a.tick();
  assert.equal(blocchi, 1);
});

test('in background per poco: nessun blocco', () => {
  const c = orologio(); let blocchi = 0;
  const a = createAutoLock({ timeoutMs: 60_000, onLock: () => blocchi++, now: c.now });
  a.hidden(); c.avanza(20_000); a.visible(); c.avanza(50_000); a.tick();
  assert.equal(blocchi, 0);
});

test('in primo piano: ogni tocco rimanda il blocco; senza tocchi scatta', () => {
  const c = orologio(); let blocchi = 0;
  const a = createAutoLock({ timeoutMs: 300_000, onLock: () => blocchi++, now: c.now });
  for (let i = 0; i < 10; i++) { c.avanza(200_000); a.activity(); a.tick(); }
  assert.equal(blocchi, 0);
  c.avanza(300_000); a.tick();
  assert.equal(blocchi, 1);
});

test('"solo alla riapertura" (0): non scatta mai durante l\'uso', () => {
  const c = orologio(); let blocchi = 0;
  const a = createAutoLock({ timeoutMs: 0, onLock: () => blocchi++, now: c.now });
  a.hidden(); c.avanza(9e9); a.visible(); a.tick();
  assert.equal(blocchi, 0);
});

test('scelte valide soltanto; default 5 minuti', () => {
  assert.equal(autoLockMinutes(15), 15);
  assert.equal(autoLockMinutes(0), 0);
  assert.equal(autoLockMinutes(7), 5);
  assert.equal(autoLockMinutes(undefined), 5);
});
