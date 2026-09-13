// ============================================================
// IMPEGNO DI PAIRING — il canale laterale non è segreto, e non deve esserlo
// ============================================================
// Sciame (docs/sciame-discovery-2026-09-13.md) fa il primo aggancio su canali
// che chiunque nella stanza o sul relay può leggere: suono, BLE, QR, un relay
// pubblico. La letteratura è netta (IEEE TIFS 2013, WiSec 2020): un canale
// acustico si intercetta e si manipola. Quindi via canale laterale NON viaggia
// mai un segreto — viaggia un IMPEGNO pubblico:
//
//     C = SHA-256( fingerprintDTLS_A ‖ nonce )
//
// Chi riceve l'offerta WebRTC di A (da relay, gossip, rendezvous, o via suono
// intera) ricalcola C dal fingerprint contenuto nell'offerta: se non combacia,
// qualcuno in mezzo ha sostituito l'offerta con la propria. La riservatezza
// la dà poi DTLS-SRTP end-to-end; l'impegno serve a legare la connessione alla
// persona fisicamente presente (o a chi ha mostrato il QR).
//
// Replay: inutile dopo la scadenza (TTL breve). Intercettazione: rivela solo
// un hash pubblico e un nonce. Il controllo umano finale riusa le TRE PAROLE
// di device-trust.js (derivate da entrambe le identità): stessa esperienza
// già nota all'utente, nessun secondo meccanismo da imparare.
//
// Puro: nessun DOM, nessuna rete, nessuno stato globale. Il canale che
// trasporta i byte è un problema di src/mesh/discovery/, non di questo file.
'use strict';

export const TTL_IMPEGNO_MS = 60 * 1000;
export const BYTE_NONCE = 8;
export const BYTE_IMPEGNO = 16;   // SHA-256 troncato: 128 bit bastano contro la sostituzione dal vivo
export const BYTE_ID = 4;
export const BYTE_TOTALI = BYTE_NONCE + BYTE_IMPEGNO + BYTE_ID; // 28: pochi secondi anche via suono

const enc = new TextEncoder();

function subtle() {
  return (globalThis.crypto && globalThis.crypto.subtle) || null;
}

// Il fingerprint DTLS è l'unica cosa nell'SDP che identifica davvero il peer:
// chi non ha la chiave privata corrispondente non può completare l'handshake.
// Si legge sia dall'SDP verboso ("a=fingerprint:sha-256 AB:CD:…") sia dalla
// forma compatta prodotta da sdp-codec.js, che conserva la stessa riga.
export function estraiFingerprint(sdp) {
  const m = /a=fingerprint:sha-256\s+([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){31})/.exec(String(sdp || ''));
  return m ? m[1].toUpperCase() : null;
}

export function nuovoNonce(randomFn = null) {
  const b = new Uint8Array(BYTE_NONCE);
  if (randomFn) { for (let i = 0; i < b.length; i++) b[i] = randomFn(i) & 0xff; }
  else globalThis.crypto.getRandomValues(b);
  return b;
}

async function digestImpegno(fingerprint, nonce) {
  const s = subtle();
  if (!s) throw new Error('Crittografia non disponibile su questo dispositivo');
  const testo = enc.encode(`${fingerprint}|`);
  const dati = new Uint8Array(testo.length + nonce.length);
  dati.set(testo, 0); dati.set(nonce, testo.length);
  return new Uint8Array(await s.digest('SHA-256', dati)).slice(0, BYTE_IMPEGNO);
}

// Crea l'impegno da trasmettere sul canale laterale. `idBreve` identifica
// l'offerta presso relay/gossip/rendezvous (4 byte: abbastanza per non
// collidere fra le poche offerte aperte in una stanza, poco per costare
// secondi via suono). `creatoIl` iniettabile per test deterministici.
export async function creaImpegno(sdpOfferta, { nonce = null, idBreve = null, creatoIl = Date.now() } = {}) {
  const fingerprint = estraiFingerprint(sdpOfferta);
  if (!fingerprint) return { ok: false, motivo: 'Offerta senza fingerprint DTLS: non può essere legata a nessuno.' };
  const n = nonce || nuovoNonce();
  const id = idBreve || nuovoNonce().slice(0, BYTE_ID);
  const impegno = await digestImpegno(fingerprint, n);
  const byte = new Uint8Array(BYTE_TOTALI);
  byte.set(n, 0); byte.set(impegno, BYTE_NONCE); byte.set(id, BYTE_NONCE + BYTE_IMPEGNO);
  return { ok: true, byte, nonce: n, impegno, idBreve: id, fingerprint, creatoIl, scadeIl: creatoIl + TTL_IMPEGNO_MS };
}

export function decodificaImpegno(byte) {
  const b = byte instanceof Uint8Array ? byte : new Uint8Array(byte || []);
  if (b.length !== BYTE_TOTALI) return { ok: false, motivo: `Impegno di ${b.length} byte, attesi ${BYTE_TOTALI}.` };
  return {
    ok: true,
    nonce: b.slice(0, BYTE_NONCE),
    impegno: b.slice(BYTE_NONCE, BYTE_NONCE + BYTE_IMPEGNO),
    idBreve: b.slice(BYTE_NONCE + BYTE_IMPEGNO),
  };
}

function ugualiCostanti(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

// Verifica che l'offerta ricevuta sia QUELLA promessa sul canale laterale.
// Ogni rifiuto dice il motivo: un pairing che fallisce in silenzio sembra un
// bug dell'app, e l'utente riproverebbe proprio con l'impostore in mezzo.
export async function verificaImpegno(sdpOfferta, byteImpegno, { ricevutoIl = Date.now(), creatoIl = null } = {}) {
  const dec = decodificaImpegno(byteImpegno);
  if (!dec.ok) return dec;
  if (Number.isFinite(creatoIl) && ricevutoIl - creatoIl > TTL_IMPEGNO_MS) {
    return { ok: false, motivo: 'Impegno scaduto: ripeti l\'aggancio, non riusare quello vecchio.' };
  }
  const fingerprint = estraiFingerprint(sdpOfferta);
  if (!fingerprint) return { ok: false, motivo: 'Offerta senza fingerprint DTLS.' };
  const atteso = await digestImpegno(fingerprint, dec.nonce);
  if (!ugualiCostanti(atteso, dec.impegno)) {
    return { ok: false, motivo: 'L\'offerta ricevuta non è quella annunciata: qualcuno in mezzo l\'ha sostituita. Aggancio rifiutato.' };
  }
  return { ok: true, fingerprint, idBreve: dec.idBreve };
}

// Codifica testuale per i canali che trasportano stringhe (QR, relay JSON):
// base64url senza padding, 38 caratteri. Il suono e il BLE usano i byte grezzi.
export function impegnoATesto(byte) {
  let s = '';
  for (const b of byte) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function testoAImpegno(testo) {
  try {
    const b64 = String(testo || '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const s = atob(pad);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch (_) {
    return new Uint8Array(0); // decodificaImpegno dirà "attesi 28 byte", con il motivo
  }
}
