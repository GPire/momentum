// Backup cifrato del vault — il "DNA" di Momentum, esportabile e ripristinabile.
// Risolve il limite reale: se perdi il dispositivo, senza un export perdi
// tutto (i dati NON stanno su un server, per scelta di privacy). Questo dà
// un file .momentum cifrato che l'utente salva dove vuole (iCloud, Drive,
// chiavetta) e ripristina su un dispositivo nuovo con la sua passphrase.
//
// Crittografia REALE, non teatro: AES-GCM 256 bit con chiave derivata dalla
// passphrase via PBKDF2 (SHA-256, 210.000 iterazioni — soglia OWASP 2023+).
// Usa Web Crypto (browser e Node ≥16 lo hanno nativo). Nessuna dipendenza.
// Chi ottiene il file senza la passphrase NON può leggere nulla: nemmeno noi
// potremmo, perché la chiave non lascia mai il dispositivo.

const KDF_ITERATIONS = 210_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(passphrase, salt) {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function toB64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromB64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Cifra un oggetto stato → busta JSON portabile (versionata).
export async function encryptBackup(stateObj, passphrase) {
  if (!passphrase || passphrase.length < 6) throw new Error('Passphrase troppo corta (min 6 caratteri).');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plaintext = enc.encode(JSON.stringify(stateObj));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  return {
    format: 'momentum-backup-v1',
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: KDF_ITERATIONS },
    cipher: 'AES-GCM-256',
    salt: toB64(salt),
    iv: toB64(iv),
    data: toB64(ciphertext),
    createdAt: new Date().toISOString(),
  };
}

// Decifra una busta → oggetto stato. Passphrase sbagliata = errore chiaro
// (AES-GCM verifica l'autenticità: un file manomesso o la chiave errata
// falliscono, non restituiscono spazzatura).
export async function decryptBackup(envelope, passphrase) {
  if (!envelope || envelope.format !== 'momentum-backup-v1') throw new Error('File di backup non riconosciuto.');
  const salt = fromB64(envelope.salt);
  const iv = fromB64(envelope.iv);
  const key = await deriveKey(passphrase, salt);
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromB64(envelope.data));
    return JSON.parse(dec.decode(plaintext));
  } catch {
    throw new Error('Passphrase errata o file danneggiato.');
  }
}
