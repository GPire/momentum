import { newChallenge, signChallenge, verifyChallenge, isTrustedKey } from './device-trust.js';
import { estraiFingerprint } from './pairing-commitment.js';

// Only a direct WebRTC session with verified DTLS fingerprints can carry private sync.
// Consent is separate from discovery and from a historic trust entry.
export class PrivateSyncSessions {
  constructor({ identity, trusted, consent, scope = () => null, now = Date.now }) {
    Object.assign(this, { identity, trusted, consent, scope, now });
    this.sessions = new Map();
  }
  binding(entry) {
    const a = estraiFingerprint(entry?.pc?.localDescription?.sdp);
    const b = estraiFingerprint(entry?.pc?.remoteDescription?.sdp);
    return a && b ? [a, b].sort().join('|') : null;
  }
  begin(peerId, entry, publicKey) {
    this.sessions.delete(peerId);
    const binding = this.binding(entry);
    if (!binding || entry?.channel?.readyState !== 'open' || !isTrustedKey(this.trusted(), publicKey) || this.consent(publicKey) !== true) return null;
    const scope = this.scope();
    if (typeof scope !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(scope)) return null;
    const challenge = newChallenge();
    this.sessions.set(peerId, { entry, publicKey, binding, scope, challenge, expires: this.now() + 60000, verified: false });
    return { challenge, binding, scope };
  }
  async answer(entry, request) {
    const binding = this.binding(entry);
    if (!binding || !request?.scope || request.scope !== this.scope() || binding !== request?.binding || !/^[A-Za-z0-9_-]{43}$/.test(request?.challenge || '') || entry?.channel?.readyState !== 'open') return null;
    const identity = await this.identity();
    return { publicKey: identity.publicKey, challenge: request.challenge, binding, scope: request.scope,
      signature: await signChallenge(identity.privateKey, `momentum-private-sync-v1|${request.scope}|${binding}|${request.challenge}`) };
  }
  async complete(peerId, entry, response) {
    const session = this.sessions.get(peerId);
    if (!session || session.verified || session.entry !== entry || session.expires < this.now() || response?.publicKey !== session.publicKey || response?.challenge !== session.challenge || response?.binding !== session.binding || response?.scope !== session.scope) return false;
    // Consume first: a malformed or replayed proof cannot race a second attempt.
    session.challenge = null;
    const valid = await verifyChallenge(session.publicKey, `momentum-private-sync-v1|${session.scope}|${session.binding}|${response.challenge}`, response.signature);
    if (this.sessions.get(peerId) !== session || session.entry !== entry) return false;
    session.verified = valid;
    return this.allows(peerId, entry);
  }
  allows(peerId, entry) {
    const session = this.sessions.get(peerId);
    return !!(session?.verified && session.scope === this.scope() && session.entry === entry && entry?.channel?.readyState === 'open'
      && this.binding(entry) === session.binding && isTrustedKey(this.trusted(), session.publicKey)
      && this.consent(session.publicKey) === true);
  }
  revoke(peerId) { this.sessions.delete(peerId); }
}
