import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window ||= {};
globalThis.navigator ||= { maxTouchPoints: 0 };
const { MeshNode } = await import('./mesh-signaling.js');

function fixture(authorizePrivatePeer) {
  const sent = [];
  const node = new MeshNode('local', { model: { serialize: () => ({ secret: 'merchant' }) } }, { authorizePrivatePeer });
  const channel = { readyState: 'open', send: value => sent.push(JSON.parse(value)) };
  node.peers.set('peer', { channel });
  node._wireChannel('peer', channel);
  return { node, channel, sent };
}

test('unidentified peers cannot request or receive transactions, budgets or learned words', async () => {
  const { node, channel, sent } = fixture();
  node.getSyncDigest = node.getMissingForPeer = node.getSyncSketch = node.reconcileSketch = () => assert.fail('Private vault read');
  node.onSyncReceived = node.onUserDataReceived = node.onCustomCategoriesReceived = () => assert.fail('Private vault mutation');
  for (const type of ['weights', 'sync_digest', 'sync_sketch', 'sync_need_digest', 'sync_txs', 'user_data_share', 'custom_categories_share']) {
    await channel.onmessage({ data: JSON.stringify({ type, txs: {}, digest: {}, dati: { monthlyBudget: 1 } }) });
  }
  node.requestSync('peer');
  node.broadcastTransactions({ '2026-09': [{ amount: 12 }] });
  node.broadcastLearning();
  node.shareUserData({ monthlyBudget: 1000 }, () => true);
  node.shareCustomCategories([{ id: 'private' }], () => true);
  node.shareBusinessTrips([{ id: 'trip' }], () => true);
  node.shareSplitGroups([{ id: 'group' }], () => true);
  node.shareMorphology({ tokens: { private: 1 } });
  node.shareReliability({ private: 1 });
  assert.deepEqual(sent, []);
  node.sharePrices({ BTC: { close: 1 } });
  assert.equal(sent[0].type, 'price_share');
});

test('authorization is explicit, channel-aware and revocable in both directions', async () => {
  let allowed = true;
  const { node, channel, sent } = fixture((peerId, type, entry) => allowed && peerId === 'peer' && entry.channel === channel);
  let received = 0;
  node.onSyncReceived = () => ++received;
  node.broadcastTransactions({ month: [{}] });
  await channel.onmessage({ data: '{"type":"sync_txs","txs":{}}' });
  assert.equal(sent.length, 1);
  assert.equal(received, 1);
  allowed = false;
  node.broadcastTransactions({ month: [{}] });
  await channel.onmessage({ data: '{"type":"sync_txs","txs":{}}' });
  assert.equal(sent.length, 1);
  assert.equal(received, 1);
});

test('broken and asynchronous authorization policies fail closed', () => {
  for (const policy of [() => { throw Error('unavailable'); }, async () => true]) {
    const { node, sent } = fixture(policy);
    assert.equal(node.broadcastTransactions({ month: [{}] }), 0);
    assert.deepEqual(sent, []);
  }
});

test('an old channel cannot inherit authorization from a replacement session', async () => {
  const { node, channel } = fixture(() => true);
  node.onSyncReceived = () => assert.fail('Old session inherited authorization');
  node.peers.set('peer', { channel: { readyState: 'open' } });
  await channel.onmessage({ data: '{"type":"sync_txs","txs":{}}' });
});
