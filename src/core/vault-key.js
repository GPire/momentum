// Chiave dei dati a riposo. Una chiave casuale di 32 byte (quella che cifra)
// è conservata SOLO avvolta:
// - modo 'device': da una chiave del dispositivo generata non esportabile
//   (WebCrypto), nessun codice può leggerne i byte, nemmeno il nostro;
// - modo 'pin': da una chiave derivata dal PIN (PBKDF2-SHA256, 600.000
//   iterazioni, raccomandazione OWASP), senza il PIN i dati non si aprono
//   nemmeno con accesso completo al disco.
// Cambiare modo riavvolge la stessa chiave: i dati non vanno ricifrati.
'use strict';

import { idbKeyStore } from '../mesh/exchange-identity.js';
import { conTimeout } from './con-timeout.js';

export const RECORD_ID = 'vault-dek';
export const KEK_RECORD_ID = 'vault-kek';
export const PBKDF2_ITERATIONS = 600_000;
export const PIN_MIN_LENGTH = 6;

const subtle = () => globalThis.crypto.subtle;

async function wrapWith(kek, keyBytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, kek, keyBytes));
  return { iv, wrapped };
}

async function unwrapWith(kek, iv, wrapped) {
  const bytes = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv }, kek, wrapped));
  if (bytes.length !== 32) throw new Error('vault key length');
  return bytes;
}

async function pinKek(pin, salt, iterations) {
  const base = await subtle().importKey('raw', new TextEncoder().encode(String(pin).normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const sameBytes = (a, b) => a?.length === b?.length && a.every((x, i) => x === b[i]);

// status: 'ready' (chiave pronta) · 'pin' (serve il PIN) · 'none' (mai creata)
// · 'broken' (record presente ma non apribile) · 'unavailable' (deposito
// irraggiungibile). Solo 'ready' permette di leggere e scrivere dati cifrati.
export async function loadVaultKey(store = idbKeyStore(), { timeoutMs = 5000 } = {}) {
  if (!store?.disponibile) return { status: 'unavailable' };
  let rec;
  try { rec = await conTimeout(store.get(RECORD_ID), timeoutMs, 'vault key store'); }
  catch { return { status: 'unavailable' }; }
  if (!rec) return { status: 'none' };
  if (rec.mode === 'pin') return { status: 'pin', record: rec };
  if (rec.mode !== 'device') return { status: 'broken' };
  try {
    const kek = await conTimeout(store.get(KEK_RECORD_ID), timeoutMs, 'vault kek');
    if (!kek) return { status: 'broken' };
    return { status: 'ready', mode: 'device', key: await unwrapWith(kek, rec.iv, rec.wrapped) };
  } catch { return { status: 'broken' }; }
}

// Salva la chiave avvolta dal dispositivo e la rilegge: una chiave che non si
// è potuta conservare non deve MAI cifrare dati (sarebbero persi al riavvio).
export async function storeDeviceWrapped(store, keyBytes) {
  const kek = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const { iv, wrapped } = await wrapWith(kek, keyBytes);
  await store.put(KEK_RECORD_ID, kek);
  await store.put(RECORD_ID, { v: 1, mode: 'device', iv, wrapped });
  const back = await loadVaultKey(store);
  if (back.status !== 'ready' || !sameBytes(back.key, keyBytes)) throw new Error('vault key not retained');
}

export async function createVaultKey(store = idbKeyStore()) {
  const key = crypto.getRandomValues(new Uint8Array(32));
  await storeDeviceWrapped(store, key);
  return key;
}

export async function unlockWithPin(record, pin) {
  try {
    const kek = await pinKek(pin, record.salt, record.iterations);
    return await unwrapWith(kek, record.iv, record.wrapped);
  } catch { return null; }
}

export async function enablePin(store = idbKeyStore(), keyBytes, pin, { iterations = PBKDF2_ITERATIONS } = {}) {
  if (String(pin).length < PIN_MIN_LENGTH) throw new Error('pin_too_short');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { iv, wrapped } = await wrapWith(await pinKek(pin, salt, iterations), keyBytes);
  const record = { v: 1, mode: 'pin', salt, iterations, iv, wrapped };
  if (!sameBytes(await unlockWithPin(record, pin), keyBytes)) throw new Error('pin wrap failed');
  await store.put(RECORD_ID, record);
  const back = await loadVaultKey(store);
  if (back.status !== 'pin' || !sameBytes(await unlockWithPin(back.record, pin), keyBytes)) throw new Error('pin record not retained');
  // La copia avvolta dal dispositivo sparisce solo dopo che quella col PIN è verificata.
  try { await store.del(KEK_RECORD_ID); } catch { /* il record principale è già in modo pin */ }
}

export async function disablePin(store = idbKeyStore(), keyBytes) {
  await storeDeviceWrapped(store, keyBytes);
}

export async function destroyVaultKey(store = idbKeyStore()) {
  try { await store.del(RECORD_ID); } catch { /* cancellazione richiesta dall'utente: si prosegue */ }
  try { await store.del(KEK_RECORD_ID); } catch { /* idem */ }
}

// Face ID / impronta come scorciatoia del PIN (mai al suo posto): il flag sta
// nel record avvolto dal PIN, la chiave vera nel Keychain/Keystore di sistema.
export async function setBiometricFlag(store = idbKeyStore(), on) {
  const rec = await store.get(RECORD_ID);
  if (rec?.mode !== 'pin') throw new Error('biometric requires pin');
  await store.put(RECORD_ID, { ...rec, biometric: !!on });
}
