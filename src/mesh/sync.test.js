import test from 'node:test';
import assert from 'node:assert/strict';
const { computeSyncDigest, transactionsMissingFromPeer, mergeTransactions, reconcileHead, planSync } = await import('./sync.js');

const tx = (id, date, amount, hash) => ({ id, date, amount, category: 'spesa', description: 'x', hash: hash || 'h' + id, prevHash: 'p' + id });

test('digest: compatto, solo id+hash per mese', () => {
  const d = computeSyncDigest({ '2026-07': [tx(1, '2026-07-01', 10), tx(2, '2026-07-02', 20)] });
  assert.equal(d['2026-07'].length, 2);
  assert.deepEqual(d['2026-07'][0], { id: 1, hash: 'h1' });
});

test('missing: invia solo ciò che il peer non ha', () => {
  const mine = { '2026-07': [tx(1, '2026-07-01', 10), tx(2, '2026-07-02', 20), tx(3, '2026-07-03', 30)] };
  const peerDigest = computeSyncDigest({ '2026-07': [tx(1, '2026-07-01', 10)] });
  const toSend = transactionsMissingFromPeer(mine, peerDigest);
  assert.equal(toSend['2026-07'].length, 2); // 2 e 3
});

test('merge: unione per id, non tocca le esistenti (hash chain intatta)', () => {
  const local = { '2026-07': [tx(1, '2026-07-01', 10, 'HASH1')] };
  const incoming = { '2026-07': [tx(1, '2026-07-01', 999, 'DIVERSO'), tx(2, '2026-07-02', 20)] };
  const { merged, added, skipped } = mergeTransactions(local, incoming);
  assert.equal(added, 1);   // solo la 2
  assert.equal(skipped, 1); // la 1 già presente
  const t1 = merged['2026-07'].find(t => t.id === 1);
  assert.equal(t1.amount, 10);      // NON sovrascritto
  assert.equal(t1.hash, 'HASH1');   // hash chain intatta
});

test('merge order-independent (CRDT-like): A∪B == B∪A', () => {
  const A = { '2026-07': [tx(1, '2026-07-01', 10), tx(2, '2026-07-02', 20)] };
  const B = { '2026-07': [tx(2, '2026-07-02', 20), tx(3, '2026-07-03', 30)] };
  const ab = mergeTransactions(A, B).merged['2026-07'].map(t => t.id).sort();
  const ba = mergeTransactions(B, A).merged['2026-07'].map(t => t.id).sort();
  assert.deepEqual(ab, ba);
  assert.deepEqual(ab, [1, 2, 3]);
});

test('recupero da perdita: merge da vuoto = ripristino completo', () => {
  const remote = { '2026-06': [tx(1, '2026-06-01', 10)], '2026-07': [tx(2, '2026-07-01', 20)] };
  const { merged, added } = mergeTransactions({}, remote);
  assert.equal(added, 2);
  assert.equal(merged['2026-06'].length, 1);
  assert.equal(merged['2026-07'].length, 1);
});

test('reconcileHead: lastHash = hash della tx più recente', () => {
  const merged = { '2026-07': [tx(1, '2026-07-01', 10, 'OLD'), tx(2, '2026-07-20', 20, 'NEW')] };
  assert.equal(reconcileHead(merged), 'NEW');
});

test('planSync: mostra il costo del delta', () => {
  const mine = { '2026-07': [tx(1, '2026-07-01', 10), tx(2, '2026-07-02', 20)] };
  const p = planSync(mine, computeSyncDigest({ '2026-07': [tx(1, '2026-07-01', 10)] }));
  assert.equal(p.count, 1);
  assert.ok(/mancanti/.test(p.note));
});

// Integrazione con VaultDAO.applySyncMerge (shim minimo del vault)
test('VaultDAO.applySyncMerge: unisce e riallinea la testa senza toccare le esistenti', async () => {
  globalThis.window = globalThis.window || {}; globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
  const { VaultDAO } = await import('../core/vault.js');
  VaultDAO.state.transactions = { '2026-07': [tx(1, '2026-07-01', 10, 'H1')] };
  VaultDAO.state.lastHash = 'H1';
  VaultDAO.save = () => {}; // no-op in test
  const added = VaultDAO.applySyncMerge({ '2026-07': [tx(1, '2026-07-01', 999, 'X'), tx(2, '2026-07-20', 20, 'H2')] });
  assert.equal(added, 1);
  assert.equal(VaultDAO.state.transactions['2026-07'].find(t => t.id === 1).amount, 10); // intatta
  assert.equal(VaultDAO.state.lastHash, 'H2'); // testa riallineata alla più recente
});

test('SYNC mesh: N dispositivi (10/20/30) convergono — commutativo, idempotente, senza duplicati', () => {
  const dev = (d, k) => { const bm = {}; for (let i = 0; i < k; i++) { const mo = `2026-0${1 + (i % 6)}`; (bm[mo] = bm[mo] || []).push(tx(`d${d}_${i}`, `${mo}-1${i % 9}`, (i + 1) * 3)); } return bm; };
  for (const N of [10, 20, 30]) {
    const devices = Array.from({ length: N }, (_, d) => dev(d, 4)); // N*4 tx totali
    let a = {}; for (const x of devices) a = mergeTransactions(a, x).merged;
    let b = {}; for (const x of devices.slice().reverse()) b = mergeTransactions(b, x).merged;
    for (const x of devices) a = mergeTransactions(a, x).merged; // re-merge → idempotente
    const flatA = Object.values(a).flat(), flatB = Object.values(b).flat();
    assert.equal(flatA.length, N * 4, `N=${N}: tutte le tx unite`);
    assert.equal(flatA.length, flatB.length, `N=${N}: convergenza ordine-indipendente`);
    assert.equal(new Set(flatA.map(t => t.id)).size, flatA.length, `N=${N}: nessun duplicato`);
  }
});
