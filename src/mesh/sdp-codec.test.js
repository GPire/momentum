'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packSdp, unpackSdp, packStats, SDP_CODEC_VERSION } from './sdp-codec.js';

// SDP REALE catturato da Chrome (RTCPeerConnection con un DataChannel e uno
// STUN pubblico). Non un esempio inventato: è la forma vera che il codec
// deve reggere.
const SDP_REALE = [
  'v=0',
  'o=- 5610131859799852397 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 27262 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 109.55.84.191',
  'a=candidate:110042555 1 udp 2113937151 e9ac9133-d8dd-41b1-b281-804669624f8d.local 52458 typ host generation 0 network-cost 999',
  'a=candidate:1922871388 1 udp 1677729535 109.55.84.191 27262 typ srflx raddr 0.0.0.0 rport 0 generation 0 network-cost 999',
  'a=ice-ufrag:s0Ks',
  'a=ice-pwd:SyvqGOiaExPMrMcF98wSRU66',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 19:79:E9:4D:11:13:2C:9C:DF:45:86:70:BC:C2:82:B4:25:FA:BC:84:4C:E5:0E:B8:F2:B5:42:3C:9F:73:0C:47',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
  '',
].join('\r\n');

test('il codice è abbastanza corto da stare in un messaggio (non solo in un QR)', () => {
  const s = packStats(SDP_REALE);
  assert.ok(s.compresso < 120, `atteso sotto 120 caratteri, ottenuto ${s.compresso}`);
  assert.ok(s.rapporto > 5, `atteso oltre 5×, ottenuto ${s.rapporto}×`);
});

test('round-trip: l\'impronta DTLS torna IDENTICA (è ciò che lega la crittografia)', () => {
  const out = unpackSdp(packSdp(SDP_REALE));
  const attesa = SDP_REALE.match(/a=fingerprint:sha-256 (.+)/)[1].trim();
  const ottenuta = out.match(/a=fingerprint:sha-256 (.+)/)[1].trim();
  assert.equal(ottenuta, attesa, 'un solo byte diverso e la connessione non si stabilisce');
});

test('round-trip: credenziali ICE identiche', () => {
  const out = unpackSdp(packSdp(SDP_REALE));
  assert.match(out, /a=ice-ufrag:s0Ks/);
  assert.match(out, /a=ice-pwd:SyvqGOiaExPMrMcF98wSRU66/);
});

test('round-trip: l\'indirizzo pubblico e la porta sopravvivono', () => {
  const out = unpackSdp(packSdp(SDP_REALE));
  assert.match(out, /109\.55\.84\.191/);
  assert.match(out, /27262/);
});

test('i candidati .local (mDNS) vengono scartati: inutili a un peer remoto e lunghissimi', () => {
  const out = unpackSdp(packSdp(SDP_REALE));
  assert.ok(!out.includes('.local'), 'un nome mDNS non è risolvibile dall\'altra parte del mondo');
  assert.ok(!out.includes('e9ac9133'), 'e costerebbe 60 caratteri per niente');
});

test('l\'SDP ricostruito ha tutte le righe obbligatorie di un DataChannel', () => {
  const out = unpackSdp(packSdp(SDP_REALE));
  for (const r of ['v=0', 'm=application', 'a=ice-ufrag:', 'a=ice-pwd:', 'a=fingerprint:sha-256 ', 'a=setup:', 'a=sctp-port:5000']) {
    assert.ok(out.includes(r), `manca la riga obbligatoria: ${r}`);
  }
  assert.ok(out.endsWith('\r\n'), 'un SDP deve terminare con una riga vuota');
});

test('il ruolo setup viene conservato (chi apre e chi risponde)', () => {
  for (const ruolo of ['actpass', 'active', 'passive']) {
    const sdp = SDP_REALE.replace('a=setup:actpass', `a=setup:${ruolo}`);
    assert.match(unpackSdp(packSdp(sdp)), new RegExp(`a=setup:${ruolo}`));
  }
});

test('un SDP senza impronta o credenziali viene RIFIUTATO, non compresso a metà', () => {
  assert.throws(() => packSdp('v=0\r\ns=-\r\n'), /incompleto/);
  assert.throws(() => packSdp(SDP_REALE.replace(/a=ice-pwd:.*/, '')), /incompleto/);
});

test('un\'impronta malformata viene rifiutata invece di produrre un codice inutile', () => {
  assert.throws(() => packSdp(SDP_REALE.replace(/a=fingerprint:sha-256 .*/, 'a=fingerprint:sha-256 AA:BB')), /Impronta/);
});

test('un codice di versione diversa dice di aggiornare, invece di rompersi in silenzio', () => {
  const codice = packSdp(SDP_REALE);
  const bytes = Uint8Array.from(atob(codice.replace(/-/g, '+').replace(/_/g, '/').padEnd(codice.length + ((4 - codice.length % 4) % 4), '=')), (c) => c.charCodeAt(0));
  bytes[0] = SDP_CODEC_VERSION + 9; // finge un formato futuro
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  const alterato = btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.throws(() => unpackSdp(alterato), /versione diversa/);
});

test('senza candidati utili il codice si genera comunque (i candidati possono arrivare dopo)', () => {
  const senzaCand = SDP_REALE.split('\r\n').filter((r) => !r.startsWith('a=candidate:')).join('\r\n');
  const out = unpackSdp(packSdp(senzaCand));
  assert.match(out, /a=fingerprint:sha-256 /);
  assert.match(out, /m=application /);
});
