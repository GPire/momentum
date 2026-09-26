// Sblocco con Face ID / Touch ID / impronta (app Capacitor). La chiave dei dati
// è conservata dal plugin @capgo/capacitor-native-biometric nel Keychain iOS
// (SecAccessControl biometryCurrentSet) o nel Keystore Android
// (setUserAuthenticationRequired + CryptoObject, nessuna finestra di validità):
// il sistema la rilascia solo dopo una verifica biometrica riuscita, e la
// invalida se cambiano i volti o le impronte registrate. Il PIN resta sempre
// la riserva. Il plugin è iniettato: questo modulo è testabile senza telefono.
'use strict';

export const BIOMETRIC_DATA_KEY = 'momentum.vault.key.v1';
const BIOMETRY_CURRENT_SET = 1;
const FACE = new Set([2, 4]);
const FINGER = new Set([1, 3]);

const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function biometricAvailability(plugin) {
  try {
    const r = await plugin.isAvailable({ useFallback: false });
    if (!r?.isAvailable || !r.strongBiometryIsAvailable) return { available: false, kind: null };
    return { available: true, kind: FACE.has(r.biometryType) ? 'face' : FINGER.has(r.biometryType) ? 'fingerprint' : 'other' };
  } catch { return { available: false, kind: null }; }
}

export async function enableBiometric(plugin, keyBytes, { title, negativeButtonText } = {}) {
  if (!(keyBytes instanceof Uint8Array) || keyBytes.length !== 32) throw new Error('vault key must be 32 bytes');
  await plugin.setData({ key: BIOMETRIC_DATA_KEY, value: toB64(keyBytes), accessControl: BIOMETRY_CURRENT_SET, authValidityDuration: 0, title, negativeButtonText });
}

// null se annullato, fallito, invalidato dal sistema o dato non valido: chi
// chiama passa al PIN, mai un errore bloccante.
export async function unlockWithBiometric(plugin, { reason, title, negativeButtonText } = {}) {
  try {
    const { value } = await plugin.getSecureData({ key: BIOMETRIC_DATA_KEY, reason, title, negativeButtonText });
    const bytes = fromB64(value);
    return bytes.length === 32 ? bytes : null;
  } catch { return null; }
}

export async function disableBiometric(plugin) {
  try { await plugin.deleteData({ key: BIOMETRIC_DATA_KEY }); } catch { /* già assente */ }
}
