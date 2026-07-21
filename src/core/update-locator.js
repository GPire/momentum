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

import { rankSources, recordDiscovery } from './discovery-memory.js';

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

// ============================================================
// GENERAZIONE DETERMINISTICA DEGLI INDIRIZZI (rendezvous algoritmico)
// ============================================================
// L'idea proprietaria: NON serve elencare i nuovi indirizzi. Publisher e app,
// dallo STESSO seme condiviso, derivano gli STESSI indirizzi-candidato per il
// "periodo" corrente (epoch). Il publisher puo' cambiare host/dominio/nome ogni
// volta: basta che pubblichi su UNO degli indirizzi che l'algoritmo genera per
// quell'epoch, e l'app lo ritrova da sola. La "traccia" e' l'algoritmo + il seme
// incorporato nell'app, non un server fisso. Rotante nel tempo (imprevedibile a
// chi non ha il seme) e combinato con la FIRMA → resiliente e sicuro.
// Ispirato ai domain-generation algorithm, ma per un uso benigno e firmato.

// Epoch corrente: finestra temporale (default settimanale). Publisher e app
// devono usare la stessa finestra per calcolare gli stessi candidati.
export function currentEpoch(now = Date.now(), windowMs = 7 * 24 * 3600 * 1000) {
  return Math.floor(now / windowMs);
}

async function hmacHex(seed, msg) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new Error('WebCrypto non disponibile');
  const enc = (s) => new TextEncoder().encode(s);
  const key = await subtle.importKey('raw', enc(seed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await subtle.sign('HMAC', key, enc(String(msg)));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Deriva gli indirizzi-candidato per un epoch: per ogni i in [0,count), un token
// deterministico HMAC(seed, "epoch:i") riempie i template URL (host multipli e
// indipendenti → piu' resilienza). Stesso seme+epoch ⇒ STESSO elenco ovunque.
// `templates` usa i segnaposto {t} (token), {i}, {epoch}.
export async function deriveCandidateLocations({ seed, templates = [], epoch, count = 4, tokenLen = 16 } = {}) {
  if (!seed || !templates.length) return [];
  const ep = (epoch == null) ? currentEpoch() : epoch;
  const out = [];
  for (let i = 0; i < count; i++) {
    const token = (await hmacHex(seed, `${ep}:${i}`)).slice(0, tokenLen);
    for (const t of templates) out.push(String(t).split('{t}').join(token).split('{i}').join(String(i)).split('{epoch}').join(String(ep)));
  }
  return out;
}

// Comodo: candidati per l'epoch corrente E per il precedente (tolleranza ai
// confini di finestra e ai ritardi di pubblicazione). Ordine: epoch corrente prima.
export async function resilientCandidates({ seed, templates, count = 4, now = Date.now(), windowMs } = {}) {
  const ep = currentEpoch(now, windowMs);
  const cur = await deriveCandidateLocations({ seed, templates, epoch: ep, count });
  const prev = await deriveCandidateLocations({ seed, templates, epoch: ep - 1, count });
  return [...cur, ...prev];
}

// ============================================================
// SCOPERTA via CERTIFICATE TRANSPARENCY (prefisso noto, suffisso arbitrario)
// ============================================================
// Caso: il dominio inizia sempre con un PREFISSO noto ("momentum-...") ma il
// resto cambia (momentum-lala.com, momentum-gpwpwp.pages.dev...). Non si possono
// indovinare i suffissi, MA ogni certificato HTTPS emesso finisce nei log
// pubblici di Certificate Transparency (CT), gestiti da molte organizzazioni
// indipendenti e immutabili. Registri un dominio col prefisso e ci metti HTTPS?
// Compare nei log CT. L'app interroga i log per "prefisso%", SCOPRE tutti i domini
// che iniziano cosi', li sonda e adotta quello col manifest FIRMATO. La traccia e'
// il log CT (difficilissimo da abbattere), la fiducia e' la firma.
// Onesta': (1) il log CT si interroga via un'API (una fonte, ma pubblica e
// ridondante: crt.sh, Google, Cloudflare...); (2) i sotto-domini sotto un
// certificato WILDCARD di piattaforma (*.netlify.app) NON compaiono singolarmente
// → per quelli usa la generazione algoritmica o l'ancora. Insieme coprono tutto.

// Estrae i domini che iniziano col prefisso da una risposta CT (formato crt.sh:
// array di { name_value } con nomi separati da newline, eventuali wildcard '*.').
export function extractCtDomains(ctJson, prefix) {
  const pfx = String(prefix || '').toLowerCase();
  const set = new Set();
  for (const row of Array.isArray(ctJson) ? ctJson : []) {
    const nv = String((row && row.name_value) || '');
    for (let name of nv.split(/\s+/)) {
      name = name.trim().toLowerCase().replace(/^\*\./, '');
      if (name && name.startsWith(pfx) && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(name)) set.add(name);
    }
  }
  return [...set];
}

// Interroga i log CT (endpoint che accettano il prefisso e rendono JSON stile
// crt.sh) e ritorna gli URL-candidato del manifest sui domini scoperti.
// `ctEndpoints` usa {prefix} come segnaposto (es. 'https://crt.sh/?q={prefix}%25&output=json').
export async function discoverViaCertTransparency({ prefix, ctEndpoints = [], fetchImpl, manifestPath = '/momentum-update.json' } = {}) {
  if (!prefix || typeof fetchImpl !== 'function') return [];
  const domains = new Set();
  for (const tpl of ctEndpoints) {
    try {
      const res = await fetchImpl(tpl.split('{prefix}').join(encodeURIComponent(prefix)));
      if (res && res.ok) { const json = await res.json(); for (const d of extractCtDomains(json, prefix)) domains.add(d); }
    } catch (_) { /* un log CT non risponde → prova il prossimo */ }
  }
  return [...domains].map(d => `https://${d}${manifestPath}`);
}

// SCOPERTA: prova i fari (beacon URL) in sequenza, unisce i puntatori ricevuti
// dai PEER (mesh gossip), verifica le firme e ritorna il piu' recente valido.
// Se tutti i fari sono morti ma un peer conosce il nuovo indirizzo, funziona
// lo stesso. Se non c'e' NIENTE di raggiungibile, ritorna { found:false } (onesto:
// nessuna magia, ma nessun single point of failure e nessun update non firmato).
// `memory` (opzionale, DiscoveryMemory): rende la scoperta PREDITTIVA — le fonti
// che hanno funzionato in passato (e l'ultimo indirizzo buono) vengono provate
// PER PRIME, e ogni esito le allena. Retro-compatibile: senza memory, ordine dato.
export async function resolveUpdate({ beacons = [], fetchImpl, verifyImpl, currentVersion, peerManifests = [], memory = null } = {}) {
  const candidates = Array.isArray(peerManifests) ? peerManifests.slice() : [];
  const ordered = memory ? rankSources(beacons, memory) : beacons;
  const failed = [];
  for (const url of ordered) {
    if (typeof fetchImpl !== 'function') break;
    try {
      const res = await fetchImpl(url);
      if (res && res.ok) { const mf = await res.json(); if (mf) { candidates.push({ ...mf, _via: url }); continue; } }
      failed.push(url);
    } catch (_) { failed.push(url); } // faro morto → prova il prossimo (e lo impara)
  }
  const best = await pickBestManifest(candidates, { currentVersion, verifyImpl });
  if (memory) {
    // APPRENDIMENTO: successo sulla fonte che ha dato l'update valido; fallimento
    // sui fari non raggiungibili → la prossima volta l'ordine e' piu' intelligente.
    for (const url of failed) recordDiscovery(memory, url, false);
    if (best && best._via) recordDiscovery(memory, best._via, true);
  }
  return best
    ? { found: true, manifest: best, via: best._via || 'peer' }
    : { found: false, reason: 'nessun aggiornamento firmato piu\' recente trovato (fari/peer non raggiungibili o firme non valide)' };
}

// ============================================================
// ORCHESTRATORE UNICO — "a ogni apertura, prendi l'ultima versione"
// ============================================================
// UN solo punto d'ingresso che l'app chiama a OGNI avvio (PWA installata O sito
// aperto dal browser dello stesso dispositivo): mette insieme TUTTE le fonti di
// scoperta — indirizzi algoritmici (seme, epoch corrente+precedente), domini
// scoperti via Certificate Transparency (prefisso), ancore fisse, e i manifest
// che i peer passano sulla mesh — le ordina con la memoria che apprende, e
// ritorna la versione firmata piu' recente. Cosi', comunque l'utente arrivi, se
// c'e' una versione nuova se la prende. Onesto: serve una fonte viva; qui ce ne
// sono tante indipendenti + la firma che blinda tutto.
export async function checkForLatest({ config = {}, memory = null, fetchImpl, verifyImpl, currentVersion, peerManifests = [], now = Date.now() } = {}) {
  const { prefix, ctEndpoints = [], seed, templates = [], anchors = [], manifestPath = '/momentum-update.json', candidateCount = 4, windowMs } = config;
  const candidates = new Set(anchors);
  if (seed && templates.length) { for (const u of await resilientCandidates({ seed, templates, count: candidateCount, now, windowMs })) candidates.add(u); }
  if (prefix && ctEndpoints.length && typeof fetchImpl === 'function') { for (const u of await discoverViaCertTransparency({ prefix, ctEndpoints, fetchImpl, manifestPath })) candidates.add(u); }
  return resolveUpdate({ beacons: [...candidates], fetchImpl, verifyImpl, currentVersion, peerManifests, memory });
}
