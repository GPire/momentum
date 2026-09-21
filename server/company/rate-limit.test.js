import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { checkRateLimit } from './rate-limit.js';

function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('./rate-limit.sql', import.meta.url), 'utf8'));
  const db = { prepare(query) { return { bind(...args) { return { async first() { return sql.prepare(query).get(...args) || null; } }; } }; } };
  return { sql, db };
}

test('nessun limite (0/assente/db mancante) non blocca mai', async () => {
  const { db } = fixture();
  assert.equal((await checkRateLimit(db, 's', 0)).allowed, true);
  assert.equal((await checkRateLimit(null, 's', 100)).allowed, true);
  assert.equal((await checkRateLimit(db, null, 100)).allowed, true);
});

test('sotto il limite: sempre consentito', async () => {
  const { db } = fixture();
  for (let i = 0; i < 5; i++) assert.equal((await checkRateLimit(db, 's', 5, 1000)).allowed, true);
});

test('oltre il limite nella stessa finestra: bloccato con un retryAfterMs positivo', async () => {
  const { db } = fixture();
  for (let i = 0; i < 5; i++) await checkRateLimit(db, 's', 5, 1000);
  const sesto = await checkRateLimit(db, 's', 5, 1500);
  assert.equal(sesto.allowed, false);
  assert.ok(sesto.retryAfterMs > 0);
});

test('finestra successiva: il contatore riparte da uno, mai un blocco permanente', async () => {
  const { db } = fixture();
  for (let i = 0; i < 5; i++) await checkRateLimit(db, 's', 5, 1000);
  assert.equal((await checkRateLimit(db, 's', 5, 1000)).allowed, false);
  const dopo = await checkRateLimit(db, 's', 5, 1000 + 60000);
  assert.equal(dopo.allowed, true);
});

test('soggetti diversi hanno contatori indipendenti: uno non affama l\'altro', async () => {
  const { db } = fixture();
  for (let i = 0; i < 5; i++) await checkRateLimit(db, 'affamatore', 5, 1000);
  assert.equal((await checkRateLimit(db, 'affamatore', 5, 1000)).allowed, false);
  assert.equal((await checkRateLimit(db, 'collega', 5, 1000)).allowed, true);
});
