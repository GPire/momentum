import { PrivateSyncSessions } from './private-sync-sessions.js';
const CONTROL = new Set(['private_sync_challenge', 'private_sync_proof', 'private_sync_ready']);
const DATA = new Set(['sync_digest', 'sync_sketch', 'sync_need_digest', 'sync_txs', 'sync_receipt', 'archive_manifest', 'archive_patch', 'archive_receipt', 'archive_chunk']);

// Wiring for authenticated personal sync. Only the explicitly authorised
// transaction and portable-archive protocols pass this boundary.
export function bindPrivateSync(node, options) {
  const sessions = new PrivateSyncSessions(options);
  const status = options.status || (() => {});
  const pending = new WeakSet();
  const requests = new WeakMap(), retried = new WeakSet();
  const announced = new WeakSet();
  const readyReceived = new WeakSet();
  const timers = new Map();
  const schedule = options.schedule || ((fn, ms) => { const timer=setTimeout(fn,ms); timer.unref?.(); return timer; });
  const cancel = options.cancel || clearTimeout;
  const stop = peer => { if(timers.has(peer)) cancel(timers.get(peer)); timers.delete(peer); };
  const retry = (peer, entry, key, attempt = 0) => {
    stop(peer);
    const timer = schedule(() => {
      if (timers.get(peer) !== timer) return;
      timers.delete(peer);
      if (sessions.allows(peer,entry)) return;
      if (node.peers.get(peer)!==entry || entry.channel?.readyState!=='open' || options.consent(key)!==true || !options.trusted().some(d => d.publicKey === key)) {
        pending.delete(entry); sessions.revoke(peer); status(peer,'disconnected'); return;
      }
      if (attempt>=2) { pending.delete(entry); sessions.revoke(peer); status(peer,'timeout'); return; }
      send(peer,entry,'private_sync_challenge',requests.get(entry));
      retry(peer,entry,key,attempt+1);
    },10000);
    timers.set(peer, timer);
  };
  const send = (peer, entry, type, payload) => {
    if (node.peers.get(peer) !== entry || entry.channel?.readyState !== 'open') return false;
    try { entry.channel.send(JSON.stringify({type, ...payload})); return true; } catch { return false; }
  };
  const start = (peer, key) => {
    const entry = node.peers.get(peer);
    if (!entry || pending.has(entry)) return false;
    stop(peer);
    retried.delete(entry); announced.delete(entry); readyReceived.delete(entry);
    const request = sessions.begin(peer, entry, key);
    if (!request) { status(peer, 'needs-consent'); return false; }
    pending.add(entry); requests.set(entry,request); status(peer, 'authenticating');
    const sent=send(peer, entry, 'private_sync_challenge', request);
    retry(peer,entry,key);
    return sent;
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
      stop(peer);
      status(peer, 'authenticated');
      if (!announced.has(entry)) { announced.add(entry); send(peer, entry, 'private_sync_ready', {}); }
      node.requestSync(peer, {forceDigest:true});
      node.requestArchiveSync?.(peer);
    } else if (sessions.allows(peer, entry) && !readyReceived.has(entry)) {
      readyReceived.add(entry);
      // A peer may have authenticated after our first digest was sent. Retry once.
      if (!announced.has(entry)) { announced.add(entry); send(peer, entry, 'private_sync_ready', {}); }
      node.requestSync(peer, {forceDigest:true});
      node.requestArchiveSync?.(peer);
    }
  };
  return { start, sessions, dispose() { for(const peer of timers.keys()) stop(peer); sessions.sessions.clear(); }, revoke(peer) { stop(peer); const entry=node.peers.get(peer); if(entry) { pending.delete(entry); requests.delete(entry); retried.delete(entry); announced.delete(entry); readyReceived.delete(entry); } sessions.revoke(peer); status(peer,'revoked'); } };
}
