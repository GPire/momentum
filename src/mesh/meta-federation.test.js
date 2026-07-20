import test from 'node:test';
import assert from 'node:assert/strict';
const { exportReliabilityDigest, mergeReliabilityDigest } = await import('./meta-federation.js');
const { initBandit, banditObserve, armMean } = await import('../predict/advisor-bandit.js');
const { appendUpdate } = await import('./update-ledger.js');

test('exportReliabilityDigest: solo medie arrotondate, mai a/b grezzi', () => {
  let s = initBandit();
  for (let i = 0; i < 20; i++) s = banditObserve(s, { context: 'spesa|mid|medio', kind: 'nano', reward: 1 });
  const { digest } = exportReliabilityDigest(s);
  const keys = Object.keys(digest);
  assert.equal(keys.length, 1);
  assert.equal(typeof digest[keys[0]], 'number');
  assert.ok(digest[keys[0]] > 0.9); // media alta, ma è SOLO un numero 0..1
  // nessun campo a/b/conteggi nell'output: il digest è {chiave: numero}
  assert.deepEqual(Object.keys(digest[keys[0]] ?? {}), []);
});

test('exportReliabilityDigest: stato vuoto -> digest vuoto', () => {
  const { digest } = exportReliabilityDigest(initBandit());
  assert.deepEqual(digest, {});
});

test('mergeReliabilityDigest: un peer con buona reputazione sposta il bandit locale verso il suo digest', () => {
  const local = initBandit();
  const ledger = [{ peerId: 'p1', accepted: true }, { peerId: 'p1', accepted: true }, { peerId: 'p1', accepted: true }]
    .reduce((l, u) => appendUpdate(l, { peerId: u.peerId, accepted: u.accepted, examplesBefore: 0, examplesAfter: 1 }), []);
  const peerDigests = [{ peerId: 'p1', digest: { 'spesa|mid|medio|nano': 0.95 } }];
  const merged = mergeReliabilityDigest(local, peerDigests, ledger);
  const mean = armMean(merged, { context: 'spesa|mid|medio', kind: 'nano' });
  assert.ok(mean > 0.5, `atteso >0.5, avuto ${mean}`);
});

test('mergeReliabilityDigest: un peer a bassa reputazione (storico di rifiuti) non sposta quasi nulla', () => {
  const local = initBandit();
  let ledger = [];
  for (let i = 0; i < 10; i++) ledger = appendUpdate(ledger, { peerId: 'bad', accepted: false, examplesBefore: 0, examplesAfter: 0 });
  const peerDigests = [{ peerId: 'bad', digest: { 'spesa|mid|medio|nano': 0.99 } }];
  const merged = mergeReliabilityDigest(local, peerDigests, ledger);
  const mean = armMean(merged, { context: 'spesa|mid|medio', kind: 'nano' });
  assert.ok(mean < 0.6, `atteso vicino al prior 0.5, avuto ${mean}`); // reputazione ~0 -> n=0 osservazioni sintetiche
});

test('mergeReliabilityDigest: nessun digest -> stato locale invariato', () => {
  const local = initBandit();
  const merged = mergeReliabilityDigest(local, [], []);
  assert.deepEqual(merged, local);
});

test('mergeReliabilityDigest: context con più segmenti (pipe multipli) viene separato correttamente dal kind', () => {
  const local = initBandit();
  let ledger = [];
  for (let i = 0; i < 5; i++) ledger = appendUpdate(ledger, { peerId: 'p2', accepted: true, examplesBefore: 0, examplesAfter: 1 });
  const peerDigests = [{ peerId: 'p2', digest: { 'ristoranti|long|minimo|meso': 0.9 } }];
  const merged = mergeReliabilityDigest(local, peerDigests, ledger);
  const mean = armMean(merged, { context: 'ristoranti|long|minimo', kind: 'meso' });
  assert.ok(mean > 0.5, `il context multi-segmento deve essere ricostruito correttamente, avuto ${mean}`);
});

test('mergeReliabilityDigest: mai una singola osservazione enorme (maxWeight limita l\'influenza per peer)', () => {
  let local = initBandit();
  // il locale ha GIÀ una storia forte e consolidata (100 osservazioni negative)
  for (let i = 0; i < 100; i++) local = banditObserve(local, { context: 'spesa|mid|medio', kind: 'nano', reward: 0 });
  let ledger = [];
  for (let i = 0; i < 10; i++) ledger = appendUpdate(ledger, { peerId: 'p3', accepted: true, examplesBefore: 0, examplesAfter: 1 });
  const peerDigests = [{ peerId: 'p3', digest: { 'spesa|mid|medio|nano': 1.0 } }];
  const merged = mergeReliabilityDigest(local, peerDigests, ledger);
  const mean = armMean(merged, { context: 'spesa|mid|medio', kind: 'nano' });
  assert.ok(mean < 0.3, `un solo peer non deve ribaltare una storia locale consolidata, avuto ${mean}`);
});
