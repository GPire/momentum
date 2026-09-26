// ============================================================
// VERIFICA LICENZE PRO — interamente on-device, MAI una chiamata server
// ============================================================
// Momentum ha UN SOLO pezzo di infrastruttura server dichiarato (la
// telemetria anonima, vedi server/telemetry-worker.js) — aggiungerne uno
// per "verificare se l'utente ha pagato" romperebbe quel principio e
// aggiungerebbe un punto di fallimento (server giù = nessuno può usare le
// feature PRO che ha già comprato, anche offline). Soluzione standard per
// software offline-first: firma asimmetrica. Lo sviluppatore firma una
// licenza col PROPRIO computer (bench/issue-license.mjs, chiave privata
// MAI nel repo, MAI su un server) dopo un pagamento reale; l'app verifica
// la firma con la sola chiave PUBBLICA, incorporata qui — la verifica
// funziona sempre, anche offline, anche a vita.
//
// Stesso algoritmo già in uso nel progetto per l'identità dei dispositivi
// mesh (src/mesh/device-signing-identity.js): ECDSA P-256/SHA-256 — non
// una scelta nuova, coerenza con quanto già verificato funzionare su Web
// Crypto sia in Node (bench/issue-license.mjs) sia nel browser.
//
// Formato della licenza (stringa compatta, incollabile a mano):
//   base64url(payload JSON).base64url(firma)
//   payload = { tier: 'PRO'|'PRO_INVESTOR', iat: <ms>, exp: <ms>|null, dev: <codice dispositivo> }
//
// Legame al dispositivo (2026-09-26): `dev` è l'impronta della chiave di firma
// NON esportabile del dispositivo (mesh/device-signing-identity.js). La stessa
// licenza incollata su un altro Momentum ha un'impronta diversa e viene
// rifiutata, anche offline, senza nessun server che registri le attivazioni.
'use strict';

// Licenze emesse prima del legame al dispositivo: restano valide, mai
// togliere ciò che è già stato dato. Ogni licenza più recente deve avere `dev`.
export const LEGACY_UNBOUND_BEFORE = Date.UTC(2026, 8, 27);

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function normalizeDeviceCode(code) {
  return String(code || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

// 80 bit dell'SHA-256 della chiave pubblica, in base32 Crockford (niente
// I/L/O/U: si detta e si ricopia senza ambiguità).
export async function deviceLicenseCode(publicKeyB64url) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', b64urlDecode(publicKeyB64url)));
  let bits = 0, acc = 0, out = '';
  for (const byte of hash.subarray(0, 10)) {
    acc = (acc << 8) | byte; bits += 8;
    while (bits >= 5) { out += CROCKFORD[(acc >> (bits - 5)) & 31]; bits -= 5; }
  }
  return out.match(/.{4}/g).join('-');
}

// Chiave PUBBLICA reale, generata il 2026-08-30 con
// bench/generate-license-keypair.mjs (la chiave PRIVATA corrispondente
// resta SOLO in bench/license-signing-key.json, mai committata — vedi
// .gitignore). Questa è l'unica metà che deve stare nel repo: serve a
// VERIFICARE una licenza, mai a firmarne una nuova.
export const LICENSE_PUBLIC_KEY_B64 = 'BPXEMluqylxtSDr1iDDDRXkQcgiWnXaW04l54exQcGPehvMfHsBbzUEWk0p9DjKLHGg3x3dTysBpjqQEu1wgGZo';

const TIERS_VALIDI = ['PRO', 'PRO_INVESTOR'];

function b64urlDecode(s) {
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
}

async function importPublicKey(b64) {
  return crypto.subtle.importKey('raw', b64urlDecode(b64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
}

// Verifica pura: MAI un side-effect, MAI una scrittura di stato — chi
// chiama (subscription.js) decide cosa fare col risultato. `publicKeyB64`
// iniettabile per i test (mai testare contro la chiave reale di
// produzione, che non deve mai comparire nel codice sorgente dei test).
export async function verifyLicenseKey(licenseKey, { publicKeyB64 = LICENSE_PUBLIC_KEY_B64, now = Date.now(), deviceCode = null } = {}) {
  if (!licenseKey || typeof licenseKey !== 'string') return { valid: false, motivo: 'Codice di attivazione mancante.' };
  const parti = licenseKey.trim().split('.');
  if (parti.length !== 2) return { valid: false, motivo: 'Formato del codice non riconosciuto.' };
  const [payloadB64, sigB64] = parti;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
  } catch (_) {
    return { valid: false, motivo: 'Codice corrotto o incompleto.' };
  }
  if (!TIERS_VALIDI.includes(payload?.tier)) return { valid: false, motivo: 'Codice non valido per nessun piano riconosciuto.' };

  let pub;
  try {
    pub = await importPublicKey(publicKeyB64);
  } catch (_) {
    return { valid: false, motivo: 'Verifica non disponibile su questo dispositivo.' };
  }

  // bench/issue-license.mjs firma i BYTE UTF-8 del JSON (prima di
  // base64url-codificarli in payloadB64) — la verifica deve controllare
  // la firma contro quegli STESSI byte, non contro la stringa base64url:
  // un confronto sui byte sbagliati farebbe fallire ogni licenza reale.
  let firmaValida = false;
  try {
    firmaValida = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64urlDecode(sigB64), b64urlDecode(payloadB64));
  } catch (_) {
    return { valid: false, motivo: 'Firma non verificabile.' };
  }
  if (!firmaValida) return { valid: false, motivo: 'Codice non autentico.' };

  const dev = payload.dev ? normalizeDeviceCode(payload.dev) : null;
  if (dev) {
    if (!normalizeDeviceCode(deviceCode)) return { valid: false, codice: 'dispositivo_non_verificabile', motivo: 'Impossibile verificare questo dispositivo.' };
    if (normalizeDeviceCode(deviceCode) !== dev) return { valid: false, codice: 'altro_dispositivo', motivo: 'Questo codice è legato a un altro dispositivo.' };
  } else if (!(Number(payload.iat) < LEGACY_UNBOUND_BEFORE)) {
    return { valid: false, codice: 'non_legata', motivo: 'Codice non legato a nessun dispositivo.' };
  }

  if (Number.isFinite(payload.exp) && payload.exp !== null && now > payload.exp) {
    return { valid: false, codice: 'scaduto', motivo: 'Codice scaduto.', tier: payload.tier, exp: payload.exp, scaduto: true };
  }
  return { valid: true, tier: payload.tier, exp: payload.exp ?? null, iat: payload.iat ?? null, dev: payload.dev ?? null };
}
