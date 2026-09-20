import { PrivateSyncSessions } from './private-sync-sessions.js';
const CONTROL = new Set(['private_sync_challenge', 'private_sync_proof', 'private_sync_ready']);
const DATA = new Set(['sync_digest', 'sync_sketch', 'sync_need_digest', 'sync_txs']);

// Wiring for authenticated movement sync. Other Vault domains remain denied.
export function bindPrivateSync(node, options) {
  const sessions = new PrivateSyncSessions(options);
  const status = options.status || (() => {});
  const pending = new WeakSet();
  const requests = new WeakMap(), retried = new WeakSet();
  const announced = new WeakSet();
  const readyReceived = new WeakSet();
  const send = (peer, entry, type, payload) => {
    if (node.peers.get(peer) !== entry || entry.channel?.readyState !== 'open') return false;
    try { entry.channel.send(JSON.stringify({type, ...payload})); return true; } catch { return false; }
  };
  const start = (peer, key) => {
    const entry = node.peers.get(peer);
    if (!entry || pending.has(entry)) return false;
    const request = sessions.begin(peer, entry, key);
    if (!request) { status(peer, 'needs-consent'); return false; }
    pending.add(entry); requests.set(entry,request); status(peer, 'authenticating');
    return send(peer, entry, 'private_sync_challenge', request);
  };
  node.authorizePrivatePeer = (peer, type, entry) => DATA.has(type) && sessions.allows(peer, entry);
  node.onPrivateSyncControl = async (peer, message, entry) => {
    if (!CONTROL.has(message?.type) || node.peers.get(peer) !== entry) return;
    if (message.type === 'private_sync_challenge') {
      // Possession alone is not consent. Never answer a request from an unapproved key.
      const key = options.peerKey(peer);
      if (!key || options.consent(key) !== true || !options.trusted().some(d => d.publicKey === key)) return;
      const proof = await sessions.answer(entry, message);
            if (proof) {
        send(peer, entry, 'private_sync_proof', proof);
        if (!pending.has(entry)) start(peer, key);
        else if (!sessions.allows(peer, entry) && !retried.has(entry)) {
          retried.add(entry); send(peer, entry, 'private_sync_challenge', requests.get(entry));
        }
      }
    } else if (message.type === 'private_sync_proof') {
      if (!await sessions.complete(peer, entry, message)) return;
      status(peer, 'authenticated');
      if (!announced.has(entry)) { announced.add(entry); send(peer, entry, 'private_sync_ready', {}); }
      node.requestSync(peer, {forceDigest:true});
    } else if (sessions.allows(peer, entry) && !readyReceived.has(entry)) {
      readyReceived.add(entry);
      // A peer may have authenticated after our first digest was sent. Retry once.
      if (!announced.has(entry)) { announced.add(entry); send(peer, entry, 'private_sync_ready', {}); }
      node.requestSync(peer, {forceDigest:true});
    }
  };
  return { start, sessions, revoke(peer) { const entry=node.peers.get(peer); if(entry) { pending.delete(entry); requests.delete(entry); retried.delete(entry); announced.delete(entry); readyReceived.delete(entry); } sessions.revoke(peer); status(peer,'revoked'); } };
}
