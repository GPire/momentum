// Cifratura a riposo dei dati personali (Vault, log movimenti, copie di
// sicurezza, originali delle fatture). Sincrona di proposito: si applica al
// confine con lo storage senza cambiare la logica di salvataggio, riconciliazione
// e sync già collaudata. XChaCha20-Poly1305 (@noble/ciphers, audit Cure53):
// nonce casuale di 24 byte, autenticazione che rifiuta ogni manomissione.
// La chiave arriva da vault-key.js prima che il Vault venga letto.
'use strict';

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';

export const SEAL_PREFIX = 'mv1:';
const AAD = new TextEncoder().encode('momentum-vault-v1');

let chiave = null;

export class VaultLockedError extends Error {
  constructor() { super('vault_locked'); this.name = 'VaultLockedError'; }
}

export function setVaultKey(bytes) {
  if (bytes != null && !(bytes instanceof Uint8Array && bytes.length === 32)) throw new Error('vault key must be 32 bytes');
  chiave = bytes ? new Uint8Array(bytes) : null;
}

export function vaultKeyActive() { return chiave !== null; }

export function isSealed(value) {
  return (typeof value === 'string' && value.startsWith(SEAL_PREFIX))
    || (!!value && typeof value === 'object' && typeof value.__sealed === 'string');
}

function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(text) {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Senza chiave attiva restituisce il testo invariato: è il comportamento di
// chi non ha ancora una chiave (primo avvio senza IndexedDB), mai un errore.
export function seal(plaintext) {
  if (!chiave) return plaintext;
  const nonce = crypto.getRandomValues(new Uint8Array(24));
  const ct = xchacha20poly1305(chiave, nonce, AAD).encrypt(new TextEncoder().encode(plaintext));
  const joined = new Uint8Array(24 + ct.length);
  joined.set(nonce); joined.set(ct, 24);
  return SEAL_PREFIX + toB64(joined);
}

// Testo non cifrato (dati precedenti alla cifratura) passa invariato: la
// migrazione avviene al primo salvataggio. Cifrato senza chiave: errore
// esplicito, mai un "vuoto" che poi verrebbe salvato sopra i dati veri.
export function open(stored) {
  if (typeof stored !== 'string' || !stored.startsWith(SEAL_PREFIX)) return stored;
  if (!chiave) throw new VaultLockedError();
  const joined = fromB64(stored.slice(SEAL_PREFIX.length));
  const pt = xchacha20poly1305(chiave, joined.subarray(0, 24), AAD).decrypt(joined.subarray(24));
  return new TextDecoder().decode(pt);
}

// Oggetti conservati in IndexedDB: i campi in `clear` restano leggibili
// (es. l'impronta usata per il confronto atomico fra schede), il resto è cifrato.
export function sealValue(value, clear = {}) {
  if (!chiave || value === undefined) return value;
  return { ...clear, __sealed: seal(JSON.stringify(value)) };
}

export function openValue(stored) {
  if (stored && typeof stored === 'object' && typeof stored.__sealed === 'string') return JSON.parse(open(stored.__sealed));
  if (isSealed(stored)) return JSON.parse(open(stored));
  return stored;
}
