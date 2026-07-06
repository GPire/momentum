import test from 'node:test';
import assert from 'node:assert/strict';

// Node ≥16 espone Web Crypto come globalThis.crypto (stesso API del browser).
const { encryptBackup, decryptBackup } = await import('./backup.js');

const sampleState = {
  transactions: { '2026-07': [{ id: 1, amount: 32.5, category: 'spesa', description: 'Esselunga' }] },
  monthlyBudget: 1000,
  savingsGoals: [{ id: 9, name: 'Vacanza', target: 1000 }],
  lastHash: 'abc123',
};

test('round-trip: cifra e decifra restituisce lo stato identico', async () => {
  const env = await encryptBackup(sampleState, 'passphrase-forte');
  const restored = await decryptBackup(env, 'passphrase-forte');
  assert.deepEqual(restored, sampleState);
});

test('la busta è versionata e non contiene lo stato in chiaro', async () => {
  const env = await encryptBackup(sampleState, 'passphrase-forte');
  assert.equal(env.format, 'momentum-backup-v1');
  assert.equal(env.cipher, 'AES-GCM-256');
  const raw = JSON.stringify(env);
  assert.ok(!raw.includes('Esselunga'), 'i dati NON devono comparire in chiaro nel file');
  assert.ok(!raw.includes('Vacanza'));
});

test('passphrase errata → errore, mai spazzatura', async () => {
  const env = await encryptBackup(sampleState, 'giusta');
  await assert.rejects(() => decryptBackup(env, 'sbagliata'), /Passphrase errata o file danneggiato/);
});

test('file manomesso → decifratura fallisce (autenticità AES-GCM)', async () => {
  const env = await encryptBackup(sampleState, 'giusta');
  const tampered = { ...env, data: env.data.slice(0, -4) + 'AAAA' };
  await assert.rejects(() => decryptBackup(tampered, 'giusta'));
});

test('passphrase troppo corta → rifiutata subito', async () => {
  await assert.rejects(() => encryptBackup(sampleState, 'abc'), /troppo corta/);
});

test('formato sconosciuto → errore chiaro', async () => {
  await assert.rejects(() => decryptBackup({ format: 'altro' }, 'x'), /non riconosciuto/);
});

test('due backup della stessa cosa hanno salt/iv diversi (non deterministici)', async () => {
  const a = await encryptBackup(sampleState, 'passphrase');
  const b = await encryptBackup(sampleState, 'passphrase');
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.data, b.data);
});
