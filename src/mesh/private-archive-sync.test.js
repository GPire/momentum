import test from 'node:test';
import assert from 'node:assert/strict';
import { PRIVATE_ARCHIVE_FIELDS, applyPrivateArchivePatch, privateArchiveManifest, privateArchivePatch, resolvePrivateArchiveConflict, recordPrivateArchiveReceipt } from './private-archive-sync.js';
import { MeshNode } from './mesh-signaling.js';

const vault = (deviceId, extra = {}) => ({ deviceId, monthlyBudget: 1000, savingsGoals: [], ...extra });

test('only explicitly portable personal domains enter the archive', () => {
  const a = vault('a', { trustedDevices: [{ publicKey: 'secret' }], privateSyncConsents: { secret: 'scope' }, liveDataKeys: { api: 'secret' } });
  const patch = privateArchivePatch(a, {});
  assert.equal(patch.fields.monthlyBudget.value, 1000);
  for (const field of ['trustedDevices', 'privateSyncConsents', 'liveDataKeys', 'deviceId', 'transactions', 'splitGroups']) assert.equal(patch.fields[field], undefined);
  assert.ok(PRIVATE_ARCHIVE_FIELDS.length > 40);
});

test('remote-only changes apply and converge without conflicts', () => {
  const a = vault('a'), b = vault('b');
  const ma = privateArchiveManifest(a), mb = privateArchiveManifest(b);
  applyPrivateArchivePatch(a, privateArchivePatch(b, ma));
  applyPrivateArchivePatch(b, privateArchivePatch(a, mb));
  b.monthlyBudget = 1400;
  const result = applyPrivateArchivePatch(a, privateArchivePatch(b, privateArchiveManifest(a)), { peerId: 'b' });
  assert.equal(result.changed, true); assert.equal(result.conflicted, false); assert.equal(a.monthlyBudget, 1400);
  assert.deepEqual(privateArchivePatch(a, privateArchiveManifest(b)).fields, {});
});

test('concurrent changes remain visible until the user chooses', () => {
  const a = vault('a'), b = vault('b');
  const ma = privateArchiveManifest(a), mb = privateArchiveManifest(b);
  a.monthlyBudget = 1200; b.monthlyBudget = 1500;
  const result = applyPrivateArchivePatch(a, privateArchivePatch(b, ma), { peerId: 'b', now: 10 });
  assert.equal(result.conflicted, true); assert.equal(a.monthlyBudget, 1200);
  const conflict = a.privateArchiveMeta.conflicts[0];
  assert.equal(resolvePrivateArchiveConflict(a, conflict.id, 'remote'), true);
  assert.equal(a.monthlyBudget, 1500); assert.equal(a.privateArchiveMeta.conflicts.length, 0);
  assert.equal(Object.keys(mb.fields).length > 0, true);
});

test('tampered values and unknown fields fail closed', () => {
  const a = vault('a'); privateArchiveManifest(a);
  const result = applyPrivateArchivePatch(a, { fields: {
    monthlyBudget: { value: 999, revision: { hash: 'wrong', versions: { b: 2 } } },
    trustedDevices: { value: ['x'], revision: { hash: 'x', versions: { b: 2 } } },
  }});
  assert.equal(a.monthlyBudget, 1000); assert.deepEqual(result.results.map(r => r.status), ['rejected', 'rejected']);
});

test('legacy metadata and explicitly empty portable fields remain safe', () => {
  const a = vault('a', { monthlyBudget: undefined, privateArchiveMeta: { version: 1, deviceId: 'a', fields: {} } });
  assert.doesNotThrow(() => privateArchiveManifest(a));
  assert.deepEqual(a.privateArchiveMeta.conflicts, []);
  assert.deepEqual(a.privateArchiveMeta.receipts, []);
});

test('delivery receipts are bounded and never import arbitrary fields', () => {
  const a = vault('a');
  for (let i = 0; i < 105; i++) recordPrivateArchiveReceipt(a, 'b', { results: [{ field: 'monthlyBudget', status: 'applied', hash: String(i) }, { field: 'deviceId', status: 'applied' }] }, i);
  recordPrivateArchiveReceipt(a, 'b', { results: [{ field: 'monthlyBudget', status: 'invented', hash: 'x'.repeat(1_000) }] });
  assert.equal(a.privateArchiveMeta.receipts.length, 100);
  assert.equal(a.privateArchiveMeta.receipts.at(-1).results.length, 1);
});

test('large archive fields are chunked, reassembled and acknowledged', () => {
  const source = vault('a', { voiceLearning: { sample: 'x'.repeat(30_000) } });
  const target = vault('b'); privateArchiveManifest(target);
  const sender = new MeshNode('a', null, { authorizePrivatePeer: () => true });
  const receiver = new MeshNode('b', null, { authorizePrivatePeer: () => true });
  const receipts = [];
  const receiverChannel = { readyState: 'open', send: raw => receipts.push(JSON.parse(raw)) };
  receiver.peers.set('a', { channel: receiverChannel });
  receiver.onArchivePatch = (_peer, patch) => ({ results: applyPrivateArchivePatch(target, patch, { peerId: 'a' }).results });
  const senderChannel = { readyState: 'open', send: raw => {
    const message = JSON.parse(raw);
    if (message.type === 'archive_chunk') receiver._handleArchiveChunk('a', message);
    else receiver._handleArchivePatch('a', message);
  }};
  sender.peers.set('b', { channel: senderChannel });
  const patch = privateArchivePatch(source, privateArchiveManifest(target));
  assert.equal(sender._sendArchive(sender.peers.get('b'), { type: 'archive_patch', patch: { version: 1, fields: { voiceLearning: patch.fields.voiceLearning } } }), true);
  assert.equal(target.voiceLearning.sample.length, 30_000);
  assert.equal(receipts.at(-1).type, 'archive_receipt');
  assert.equal(receipts.at(-1).receipt.results[0].status, 'applied');
});

test('large receipt attachments use the bounded transport instead of one oversized data-channel message', () => {
  const sender = new MeshNode('a', null, { authorizePrivatePeer: () => true });
  const receiver = new MeshNode('b', null, { authorizePrivatePeer: () => true });
  let received, acknowledgement;
  receiver.onSyncReceived = txs => { received = txs; return 1; };
  receiver.peers.set('a', { channel: { readyState: 'open', send(raw) { acknowledgement = JSON.parse(raw); } } });
  sender.peers.set('b', { channel: { readyState: 'open', send(raw) {
    const message = JSON.parse(raw);
    if (message.type === 'archive_chunk') receiver._handleArchiveChunk('a', message);
    else receiver.onSyncReceived(message.txs);
  } } });
  const receiptImage = `data:image/jpeg;base64,${'a'.repeat(40_000)}`;
  assert.equal(sender.broadcastTransactions({ '2026-09': [{ id: 'tx-receipt', receiptImage }] }), 1);
  assert.equal(received['2026-09'][0].receiptImage, receiptImage);
  assert.equal(acknowledgement.type, 'sync_receipt');
  assert.equal(acknowledgement.receipt.results[0].field, 'transactions');
});

test('malformed transaction bundles fail closed without callbacks or receipts', () => {
  const receiver = new MeshNode('b', null, { authorizePrivatePeer: () => true });
  let callbacks = 0, sent = 0;
  receiver.onSyncReceived = () => { callbacks++; return 1; };
  receiver.peers.set('a', { channel: { readyState: 'open', send() { sent++; } } });
  for (const malformed of [null, 'transactions', 42, []]) assert.equal(receiver._handleSyncTransactions('a', malformed), 0);
  assert.equal(callbacks, 0);
  assert.equal(sent, 0);
});

test('archive fields retry until an application receipt arrives', () => {
  const scheduled = [], cancelled = new Set(), sent = [];
  const sender = new MeshNode('a', null, {
    authorizePrivatePeer: () => true,
    archiveReceiptTimeoutMs: 1,
    scheduleFn: fn => { scheduled.push(fn); return scheduled.length - 1; },
    cancelFn: id => cancelled.add(id),
  });
  sender.peers.set('b', { channel: { readyState: 'open', send: raw => sent.push(JSON.parse(raw)) } });
  const data = { value: 1200, revision: { hash: 'hash-1', versions: { a: 1 } } };
  assert.equal(sender._sendArchiveField('b', 'monthlyBudget', data), true);
  assert.equal(sent.length, 1);
  scheduled[0]();
  assert.equal(sent.length, 2);
  sender._handleArchiveReceipt('b', { results: [{ field: 'monthlyBudget', status: 'applied', hash: 'hash-1' }] });
  assert.equal(sender._pendingArchiveReceipts.size, 0);
  assert.ok(cancelled.size > 0);
});

test('a deeply nested portable field keeps its data and validates on the other device', () => {
  const nested = {}; let current = nested;
  for (let index = 0; index < 5_000; index++) { current.next = {}; current = current.next; }
  current.name = 'ultimo livello';
  const source = vault('a', { watchlist: nested });
  const target = vault('b');
  const patch = privateArchivePatch(source, privateArchiveManifest(target));
  assert.ok(patch.fields.watchlist.revision.hash);
  const result = applyPrivateArchivePatch(target, { fields: { watchlist: patch.fields.watchlist } });
  assert.equal(result.results[0].status, 'applied');
  let restored = target.watchlist;
  for (let index = 0; index < 5_000; index++) restored = restored.next;
  assert.equal(restored.name, 'ultimo livello');
});

test('large archive fields are sent one at a time and only a matching receipt advances the queue', () => {
  const sent = [], timers = [];
  const sender = new MeshNode('a', null, {
    authorizePrivatePeer: () => true,
    scheduleFn: fn => { timers.push(fn); return timers.length - 1; },
    cancelFn: () => {},
  });
  sender.peers.set('b', { channel: { readyState: 'open', send: raw => sent.push(JSON.parse(raw)) } });
  sender.getArchivePatch = () => ({ fields: {
    monthlyBudget: { value: 1200, revision: { hash: 'budget-hash', versions: { a: 1 } } },
    salaryProfile: { value: { day: 27 }, revision: { hash: 'salary-hash', versions: { a: 1 } } },
  } });
  sender._handleArchiveManifest('b', { fields: {} });
  assert.deepEqual(sent.map(packet => Object.keys(packet.patch.fields)[0]), ['monthlyBudget']);
  sender._handleArchiveReceipt('b', { results: [{ field: 'monthlyBudget', status: 'applied', hash: 'wrong' }] });
  assert.equal(sent.length, 1);
  sender._handleArchiveReceipt('b', { results: [{ field: 'monthlyBudget', status: 'applied', hash: 'budget-hash' }] });
  assert.deepEqual(sent.map(packet => Object.keys(packet.patch.fields)[0]), ['monthlyBudget', 'salaryProfile']);
});

test('archive packets respect a small negotiated SCTP message size', () => {
  const packets = [];
  const node = new MeshNode('a', null);
  const entry = { pc: { sctp: { maxMessageSize: 1024 } }, channel: {
    readyState: 'open',
    send(raw) { assert.ok(new TextEncoder().encode(raw).byteLength <= 1024); packets.push(raw); },
  } };
  assert.equal(node._sendArchive(entry, { type: 'archive_patch', patch: { fields: { voiceLearning: { value: '€'.repeat(1000) } } } }), true);
  assert.ok(packets.length > 1);
});
