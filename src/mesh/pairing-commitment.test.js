'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estraiFingerprint, creaImpegno, verificaImpegno, decodificaImpegno,
  impegnoATesto, testoAImpegno, nuovoNonce, BYTE_TOTALI, TTL_IMPEGNO_MS,
} from './pairing-commitment.js';

const FP_A = 'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89';
const FP_X = '00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF';
const sdp = (fp) => `v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\na=fingerprint:sha-256 ${fp}\r\na=setup:actpass\r\n`;

test('estrae il fingerprint DTLS e lo normalizza in maiuscolo', () => {
  assert.equal(estraiFingerprint(sdp(FP_A.toLowerCase())), FP_A);
  assert.equal(estraiFingerprint('v=0\r\na=setup:actpass\r\n'), null);
  assert.equal(estraiFingerprint(null), null);
});

test('un\'offerta senza fingerprint non può essere impegnata, con motivo', async () => {
  const r = await creaImpegno('v=0\r\n');
  assert.equal(r.ok, false);
  assert.match(r.motivo, /fingerprint/);
});

test('l\'impegno è di 28 byte e verifica la STESSA offerta', async () => {
  const c = await creaImpegno(sdp(FP_A));
  assert.equal(c.ok, true);
  assert.equal(c.byte.length, BYTE_TOTALI);
  const v = await verificaImpegno(sdp(FP_A), c.byte, { creatoIl: c.creatoIl, ricevutoIl: c.creatoIl + 5000 });
  assert.equal(v.ok, true);
  assert.equal(v.fingerprint, FP_A);
  assert.deepEqual(Array.from(v.idBreve), Array.from(c.idBreve));
});

test('un\'offerta sostituita in mezzo (altro fingerprint) viene rifiutata con motivo', async () => {
  const c = await creaImpegno(sdp(FP_A));
  const v = await verificaImpegno(sdp(FP_X), c.byte, { creatoIl: c.creatoIl, ricevutoIl: c.creatoIl + 100 });
  assert.equal(v.ok, false);
  assert.match(v.motivo, /sostituita/);
});

test('un impegno riusato dopo la scadenza è rifiutato (replay inutile)', async () => {
  const c = await creaImpegno(sdp(FP_A));
  const v = await verificaImpegno(sdp(FP_A), c.byte, { creatoIl: c.creatoIl, ricevutoIl: c.creatoIl + TTL_IMPEGNO_MS + 1 });
  assert.equal(v.ok, false);
  assert.match(v.motivo, /scaduto/);
});

test('un nonce diverso cambia l\'impegno: l\'hash non è un identificatore permanente del dispositivo', async () => {
  const a = await creaImpegno(sdp(FP_A), { nonce: nuovoNonce((i) => i) });
  const b = await creaImpegno(sdp(FP_A), { nonce: nuovoNonce((i) => i + 1) });
  assert.notDeepEqual(Array.from(a.impegno), Array.from(b.impegno));
});

test('byte malformati: motivo esplicito, mai un\'eccezione', async () => {
  assert.equal(decodificaImpegno(new Uint8Array(5)).ok, false);
  const v = await verificaImpegno(sdp(FP_A), new Uint8Array(3));
  assert.equal(v.ok, false);
  assert.match(v.motivo, /attesi 28/);
});

test('andata e ritorno testuale (QR/relay) senza perdita, e testo spazzatura non esplode', async () => {
  const c = await creaImpegno(sdp(FP_A));
  const t = impegnoATesto(c.byte);
  assert.equal(t.length, 38);
  assert.doesNotMatch(t, /[+/=]/);
  assert.deepEqual(Array.from(testoAImpegno(t)), Array.from(c.byte));
  assert.equal(decodificaImpegno(testoAImpegno('%%%non-base64%%%')).ok, false);
});
