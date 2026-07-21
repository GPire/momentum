// ============================================================
// UPDATE LOCATOR — scoperta resiliente + firmata degli aggiornamenti (v10)
// ============================================================
// Problema: se cambio server/dominio/nome del sito, un'app gia' installata deve
// comunque TROVARE e scaricare la versione aggiornata — e senza rischiare che
// qualcuno le inietti un falso aggiornamento.
// Soluzione onesta (non si scarica "dal nulla", serve una fonte raggiungibile,
// ma la si rende resiliente e sicura):
//  1) SCOPERTA ridondante: una lista di "fari" (beacon URL indipendenti) + i
//     puntatori che i PEER si passano sulla mesh. Basta che UNO sia vivo (o che
//     un amico conosca il nuovo indirizzo) per ritrovare la versione.
//  2) FIDUCIA crittografica: ogni manifest e' FIRMATO (ECDSA) dalla chiave
//     privata dello sviluppatore; l'app ha solo la chiave PUBBLICA e adotta
//     l'update SOLO se la firma e' valida → host ostile o compromesso non puo'
//     spacciare un falso. Mai un DOWNGRADE (solo versioni piu' recenti).
// Funzioni pure/asincrone, nessun DOM. La firma reale usa WebCrypto (Node/browser).
'use strict';

// Confronto versioni semver-lite: "50.2.0" > "50.1.9". Ritorna >0,0,<0.
export function compareVersions(a, b) {
  const pa = String(a || '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}
const isNewer = (v, cur) => compareVersions(v, cur) > 0;

// Messaggio canonico firmato: SOLO i campi che contano, in ordine stabile, così
// la firma non dipende dalla formattazione. Un attaccante che cambia url/hash
// invalida la firma.
export function canonicalMessage(mf) {
  return JSON.stringify({ version: String(mf.version || ''), url: String(mf.url || ''), sha256: String(mf.sha256 || '') });
}

// Crea un verificatore di firma ECDSA (P-256/SHA-256) dalla chiave pubblica (JWK).
// Ritorna async (manifest) => bool. In test si puo' iniettare un verificatore stub.
export function makeEcdsaVerifier(publicKeyJwk) {
  let keyPromise = null;
  const subtle = (globalThis.crypto && globalThis.crypto.subtle) || null;
  return async (mf) => {
    if (!subtle || !mf || !mf.sig) return false;
    try {
      if (!keyPromise) keyPromise = subtle.importKey('jwk', publicKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const key = await keyPromise;
      const data = new TextEncoder().encode(canonicalMessage(mf));
      const sig = base64ToBytes(mf.sig);
      return await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, data);
    } catch (_) { return false; }
  };
}

function base64ToBytes(b64) {
  const bin = (typeof atob !== 'undefined') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Sceglie il MIGLIOR manifest tra i candidati: firmato valido E versione piu'
// recente dell'attuale. verifyImpl e' async (firma reale) o sincrono (stub test).
// Ritorna il manifest scelto o null. Anti-downgrade + anti-firma-falsa.
export async function pickBestManifest(candidates, { currentVersion, verifyImpl }) {
  let best = null;
  for (const mf of candidates || []) {
    if (!mf || typeof mf.version !== 'string') continue;
    if (!isNewer(mf.version, currentVersion)) continue;        // solo piu' recenti
    let ok = false; try { ok = await verifyImpl(mf); } catch (_) { ok = false; }
    if (!ok) continue;                                          // firma non valida → scartato
    if (!best || isNewer(mf.version, best.version)) best = mf;
  }
  return best;
}

// SCOPERTA: prova i fari (beacon URL) in sequenza, unisce i puntatori ricevuti
// dai PEER (mesh gossip), verifica le firme e ritorna il piu' recente valido.
// Se tutti i fari sono morti ma un peer conosce il nuovo indirizzo, funziona
// lo stesso. Se non c'e' NIENTE di raggiungibile, ritorna { found:false } (onesto:
// nessuna magia, ma nessun single point of failure e nessun update non firmato).
export async function resolveUpdate({ beacons = [], fetchImpl, verifyImpl, currentVersion, peerManifests = [] } = {}) {
  const candidates = Array.isArray(peerManifests) ? peerManifests.slice() : [];
  for (const url of beacons) {
    if (typeof fetchImpl !== 'function') break;
    try {
      const res = await fetchImpl(url);
      if (res && res.ok) { const mf = await res.json(); if (mf) candidates.push({ ...mf, _via: url }); }
    } catch (_) { /* faro morto → prova il prossimo */ }
  }
  const best = await pickBestManifest(candidates, { currentVersion, verifyImpl });
  return best
    ? { found: true, manifest: best, via: best._via || 'peer' }
    : { found: false, reason: 'nessun aggiornamento firmato piu\' recente trovato (fari/peer non raggiungibili o firme non valide)' };
}
