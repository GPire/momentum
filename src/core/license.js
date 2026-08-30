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
//   payload = { tier: 'PRO'|'PRO_INVESTOR', iat: <ms>, exp: <ms>|null }
'use strict';

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
export async function verifyLicenseKey(licenseKey, { publicKeyB64 = LICENSE_PUBLIC_KEY_B64, now = Date.now() } = {}) {
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

  if (Number.isFinite(payload.exp) && payload.exp !== null && now > payload.exp) {
    return { valid: false, motivo: 'Codice scaduto.', tier: payload.tier, exp: payload.exp, scaduto: true };
  }
  return { valid: true, tier: payload.tier, exp: payload.exp ?? null, iat: payload.iat ?? null };
}
