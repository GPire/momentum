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

// ---- Recupero SENZA passphrase: la chiave divisa in pezzi ----
// La passphrase è il punto debole vero di ogni backup cifrato: è l'unica cosa
// che l'utente deve ricordare per anni, ed è la prima che perde. Qui la chiave
// è casuale (mai una password umana) e viene divisa in pezzi da tenere in posti
// diversi: ne bastano `threshold` per tornare dentro, uno solo non rivela nulla.
// Vedi recovery-shares.js per la matematica e le sue verifiche.

async function importRawKey(keyBytes) {
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// Crea il kit: busta cifrata + i pezzi da custodire.
// Il kit NON viene mai restituito senza aver prima RIAPERTO la busta con i
// pezzi appena creati e confrontato il contenuto con l'originale. Un backup
// che dice "salvato" ma non si riapre è peggio di nessun backup: dà sicurezza
// falsa fino al giorno in cui serve davvero.
export async function createRecoveryKit(stateObj, { threshold = 2, total = 3 } = {}) {
  const { splitSecret, encodeShare, shareLabel } = await import('./recovery-shares.js');
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importRawKey(keyBytes);
  const plaintext = enc.encode(JSON.stringify(stateObj));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));

  const envelope = {
    format: 'momentum-backup-v2',
    recovery: { scheme: 'shamir-gf256', threshold, total },
    cipher: 'AES-GCM-256',
    iv: toB64(iv),
    data: toB64(ciphertext),
    createdAt: new Date().toISOString(),
  };

  const parts = splitSecret(keyBytes, { threshold, total });
  const shares = parts.map((p) => ({ index: p.index, text: encodeShare(p), label: shareLabel(p) }));

  // Prova di ripristino reale, con i pezzi che riceverà l'utente (non con la
  // chiave che abbiamo già in mano: verificherebbe la cosa sbagliata).
  const probe = await restoreFromShares(envelope, shares.slice(0, threshold).map((s) => s.text));
  if (JSON.stringify(probe) !== JSON.stringify(stateObj)) {
    throw new Error('Verifica fallita: il backup appena creato non si riapre identico. Non è stato consegnato nulla.');
  }
  return { envelope, shares, verified: true };
}

// Riapre una busta v2 dai pezzi. I pezzi possono essere incollati come capita
// (spazi, minuscole, righe intere copiate): il parser è tollerante sulla forma
// e severo sul contenuto.
export async function restoreFromShares(envelope, shareTexts = []) {
  if (!envelope || envelope.format !== 'momentum-backup-v2') throw new Error('File di backup non riconosciuto.');
  const { decodeShare, combineShares } = await import('./recovery-shares.js');
  const parts = shareTexts.filter((t) => String(t || '').trim()).map(decodeShare);
  const need = envelope.recovery?.threshold ?? 2;
  if (parts.length < need) throw new Error(`Servono ${need} pezzi diversi: finora ne hai inserito ${parts.length}.`);
  const keyBytes = combineShares(parts);
  const key = await importRawKey(keyBytes);
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(envelope.iv) }, key, fromB64(envelope.data));
    return JSON.parse(dec.decode(plaintext));
  } catch {
    // AES-GCM autentica: se arriviamo qui i pezzi erano formalmente validi ma
    // non sono quelli di QUESTO backup (o il file è stato manomesso).
    throw new Error('Questi pezzi non aprono questo backup: controlla di usare i pezzi dello stesso kit e il file giusto.');
  }
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
