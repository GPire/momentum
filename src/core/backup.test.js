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

// ---- Recupero a pezzi (kit senza passphrase) ----

test('kit di recupero: 2 pezzi su 3 riaprono il backup identico', async () => {
  const { createRecoveryKit, restoreFromShares } = await import('./backup.js');
  const state = { tx: [{ id: 'a', amount: 12.34, desc: 'Caffè' }], goals: { fondo: 500 } };
  const kit = await createRecoveryKit(state, { threshold: 2, total: 3 });
  assert.equal(kit.shares.length, 3);
  assert.equal(kit.verified, true);
  assert.equal(kit.envelope.format, 'momentum-backup-v2');
  const restored = await restoreFromShares(kit.envelope, [kit.shares[2].text, kit.shares[0].text]);
  assert.deepEqual(restored, state);
});

test('kit di recupero: con un solo pezzo non si apre, e lo dice chiaramente', async () => {
  const { createRecoveryKit, restoreFromShares } = await import('./backup.js');
  const kit = await createRecoveryKit({ tx: [] }, { threshold: 2, total: 3 });
  await assert.rejects(
    () => restoreFromShares(kit.envelope, [kit.shares[0].text]),
    /Servono 2 pezzi/
  );
});

test('kit di recupero: i pezzi di un altro kit non aprono questo backup', async () => {
  const { createRecoveryKit, restoreFromShares } = await import('./backup.js');
  const kitA = await createRecoveryKit({ tx: [{ id: 'a' }] }, { threshold: 2, total: 3 });
  const kitB = await createRecoveryKit({ tx: [{ id: 'b' }] }, { threshold: 2, total: 3 });
  await assert.rejects(
    () => restoreFromShares(kitA.envelope, [kitB.shares[0].text, kitB.shares[1].text]),
    /non aprono questo backup/
  );
});

test('kit di recupero: una busta manomessa viene rifiutata, mai importata a meta', async () => {
  const { createRecoveryKit, restoreFromShares } = await import('./backup.js');
  const kit = await createRecoveryKit({ tx: [{ id: 'a', amount: 10 }] }, { threshold: 2, total: 3 });
  const manomessa = { ...kit.envelope, data: kit.envelope.data.slice(0, -6) + 'AAAAAA' };
  await assert.rejects(
    () => restoreFromShares(manomessa, [kit.shares[0].text, kit.shares[1].text]),
    /non aprono questo backup/
  );
});

// ---- Il lettore unico, e il salvataggio dei file "DNA" gia esportati ----
// Il guasto che questi test bloccano: l'app produceva un file .momentum che
// l'app stessa non sapeva rileggere. Chi lo scopriva, lo scopriva cambiando
// telefono — cioe' nel momento in cui non c'era piu' rimedio.

const { exportPlain, readBackupFile } = await import('./backup.js');

test('export in chiaro: si riapre, ed e la stessa cosa', () => {
  const busta = exportPlain(sampleState);
  const letto = readBackupFile(JSON.stringify(busta));
  assert.equal(letto.serve, 'niente');
  assert.equal(letto.cifrato, false);
  assert.deepEqual(letto.state, sampleState);
});

test('export in chiaro: il file DICE di non essere cifrato', () => {
  // L'avviso sta dentro il file, non solo nella schermata che l'ha prodotto:
  // chi lo ritrova fra due anni deve capirlo dal file.
  const busta = exportPlain(sampleState);
  assert.equal(busta.cifrato, false);
  assert.match(busta.avviso, /NON e cifrato/);
});

test('il lettore riconosce i tre formati e dice cosa serve, PRIMA di chiedere', async () => {
  const cifrato = await encryptBackup(sampleState, 'passphrase-forte');
  assert.equal(readBackupFile(JSON.stringify(cifrato)).serve, 'passphrase');

  const { createRecoveryKit } = await import('./backup.js');
  const kit = await createRecoveryKit(sampleState, { threshold: 2, total: 3 });
  assert.equal(readBackupFile(JSON.stringify(kit.envelope)).serve, 'pezzi');

  assert.equal(readBackupFile(JSON.stringify(exportPlain(sampleState))).serve, 'niente');
});

test('IL SALVATAGGIO: un vecchio file "DNA" si riapre invece di essere respinto', () => {
  // Riproduco ESATTAMENTE cio' che produceva la vecchia exportOmegaDNA:
  // Base64 grezzo, movimenti appiattiti, nessun campo `format`.
  const flat = [
    { id: 1, amount: 32.5, category: 'spesa', description: 'Esselunga', date: '2026-07-14T10:00:00.000Z' },
    { id: 2, amount: 9.9, category: 'abbonamenti', description: 'Netflix', date: '2026-08-02T08:00:00.000Z' },
  ];
  const vecchio = btoa(unescape(encodeURIComponent(JSON.stringify({
    meta: { schema: 50.0, generatedAt: '2026-08-01T00:00:00.000Z' },
    transactions: flat, budget: 1500, aggression: 'advisor',
  }))));

  const letto = readBackupFile(vecchio);
  assert.equal(letto.format, 'momentum-dna-legacy');
  assert.equal(letto.serve, 'niente');
  // La chiave del mese era stata PERSA dall'appiattimento: si ricostruisce
  // dalla data, che c'e' sempre.
  assert.deepEqual(Object.keys(letto.state.transactions).sort(), ['2026-07', '2026-08']);
  assert.equal(letto.state.transactions['2026-07'][0].description, 'Esselunga');
  assert.equal(letto.state.monthlyBudget, 1500);
});

test('un vecchio file "DNA" dichiara cosa NON riporta indietro', () => {
  // Era un backup parziale spacciato per completo. Ripristinarlo in silenzio
  // farebbe credere di aver recuperato anche obiettivi e fatture.
  const vecchio = btoa(unescape(encodeURIComponent(JSON.stringify({
    meta: { schema: 50.0 }, transactions: [], budget: 1200,
  }))));
  assert.match(readBackupFile(vecchio).parziale, /NON obiettivi, fatture/);
});

test('movimenti senza data non spariscono: finiscono in "sconosciuto"', () => {
  const vecchio = btoa(unescape(encodeURIComponent(JSON.stringify({
    transactions: [{ id: 7, amount: 5, description: 'senza data' }],
  }))));
  const letto = readBackupFile(vecchio);
  assert.equal(letto.state.transactions['sconosciuto'].length, 1);
});

test('spazzatura → errore chiaro, mai uno stato mezzo costruito', () => {
  assert.throws(() => readBackupFile('non sono un backup'), /non riconosciuto/);
  assert.throws(() => readBackupFile('{"format":"qualcos-altro"}'), /non riconosciuto/);
  assert.throws(() => readBackupFile(''), /vuoto/);
  // Base64 valido ma senza l'elenco dei movimenti: non e' un file DNA.
  assert.throws(() => readBackupFile(btoa('{"ciao":1}')), /non riconosciuto/);
});

test('kit di recupero: ogni pezzo si spiega da solo, senza gergo', async () => {
  const { createRecoveryKit } = await import('./backup.js');
  const kit = await createRecoveryKit({ tx: [] }, { threshold: 2, total: 3 });
  for (const s of kit.shares) {
    assert.match(s.label, /Ne servono 2 diversi/);
    assert.match(s.label, /non apre niente e non rivela niente/);
    assert.ok(!/AES|GCM|Shamir|GF\(256\)|entropia/i.test(s.label), `gergo nel foglio: ${s.label}`);
  }
});
