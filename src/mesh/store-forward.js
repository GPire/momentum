// ============================================================
// TRASPORTO A STAFFETTA — arrivare a chi ora non c'è, senza un server
// ============================================================
// Il limite che restava, detto con onestà: due dispositivi devono essere
// accesi NELLO STESSO MOMENTO perché i dati passino. È la differenza vera
// tra Momentum e chi ha un server: il server tiene il messaggio finché il
// destinatario torna. Noi non ce l'abbiamo — e non lo vogliamo, perché un
// server che conserva i messaggi è anche un server che può leggerli,
// consegnarli a qualcun altro o essere sequestrato.
//
// La soluzione esiste ed è un campo di ricerca serio: le reti a TOLLERANZA
// DI RITARDO (delay-tolerant networking), quelle usate dove un collegamento
// continuo non esiste — sonde spaziali, zone colpite da disastri, villaggi
// senza copertura. Il principio è semplice e forte:
//
//   un dispositivo TRASPORTA un pacchetto per un terzo, SENZA POTERLO LEGGERE.
//
// Il tuo tablet incontra il telefono di tua sorella oggi; il tuo portatile lo
// incontra domani. Il pacchetto arriva, e chi lo ha trasportato non ha mai
// saputo cosa contenesse. Non è fiducia mal riposta: è matematica.
//
// COME, in concreto:
//  - il contenuto è cifrato con una chiave che nasce dall'incontro tra la
//    chiave privata di chi manda e quella PUBBLICA di chi riceve (ECDH).
//    Solo il destinatario può ricostruirla. Il portatore ha in mano rumore.
//  - la cifratura è AUTENTICATA (AES-GCM): se un portatore malevolo cambia
//    anche un solo byte, l'apertura fallisce invece di consegnare dati
//    manomessi. Non serve fidarsi di chi trasporta.
//  - ogni pacchetto ha una SCADENZA e una dimensione massima: un relay non
//    deve poter essere usato come deposito gratuito infinito da un
//    malintenzionato. Chi trasporta decide quanto spazio prestare.
//
// LIMITE DICHIARATO: serve comunque una catena di incontri. Se nessun
// dispositivo incontra mai il destinatario, il pacchetto scade e muore —
// e questo va detto all'utente, non nascosto dietro una rotella che gira.
// La consegna non è garantita: è probabile, e la probabilità cresce con il
// numero di dispositivi che si incontrano.
'use strict';

export const DEFAULT_TTL_MS = 14 * 24 * 3600 * 1000; // due settimane
export const MAX_BUNDLE_BYTES = 64 * 1024;           // 64 KB per pacchetto
export const MAX_CARRIED = 50;                       // quanti se ne trasportano

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => (globalThis.crypto && globalThis.crypto.subtle) || null;

const b64u = (buf) => {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (str) => {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s.padEnd(s.length + ((4 - (s.length % 4)) % 4), '=')), (c) => c.charCodeAt(0));
};

// Identità di SCAMBIO, separata da quella di firma (device-trust.js): una
// chiave serve a dimostrare chi sei, l'altra a metterti d'accordo su un
// segreto. Tenerle distinte è prassi crittografica, non pignoleria.
export async function generateExchangeIdentity() {
  const s = subtle();
  if (!s) throw new Error('Crittografia non disponibile su questo dispositivo');
  const kp = await s.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
  return { publicKey: b64u(await s.exportKey('raw', kp.publicKey)), privateKey: kp.privateKey };
}

async function derivaChiave(privateKey, altruiPubB64) {
  const s = subtle();
  const pub = await s.importKey('raw', unb64u(altruiPubB64), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  return s.deriveKey({ name: 'ECDH', public: pub }, privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// Sigilla un contenuto per UN destinatario. Chi lo trasporta vede solo:
// per chi è, da chi viene, quando scade — mai cosa contiene.
export async function sealFor(destinatarioPubB64, mittente, payload, { ttlMs = DEFAULT_TTL_MS, now = Date.now() } = {}) {
  const s = subtle();
  if (!s) throw new Error('Crittografia non disponibile su questo dispositivo');
  const chiave = await derivaChiave(mittente.privateKey, destinatarioPubB64);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const testo = enc.encode(JSON.stringify(payload));
  if (testo.byteLength > MAX_BUNDLE_BYTES) throw new Error('Contenuto troppo grande per essere trasportato');
  const cifrato = await s.encrypt({ name: 'AES-GCM', iv }, chiave, testo);
  return {
    v: 1,
    to: destinatarioPubB64,
    from: mittente.publicKey,
    iv: b64u(iv),
    ct: b64u(cifrato),
    exp: now + Math.max(0, ttlMs),
  };
}

// Apre un pacchetto SE è per me. Ritorna null in ogni altro caso — non è un
// errore da mostrare: la maggior parte dei pacchetti che si trasportano non
// sono per noi, ed è normale.
export async function openSealed(mio, bundle, { now = Date.now() } = {}) {
  if (!bundle || bundle.v !== 1) return null;
  if (bundle.to !== mio.publicKey) return null;   // non è per me
  if (bundle.exp && bundle.exp < now) return null; // scaduto
  try {
    const chiave = await derivaChiave(mio.privateKey, bundle.from);
    const chiaro = await subtle().decrypt({ name: 'AES-GCM', iv: unb64u(bundle.iv) }, chiave, unb64u(bundle.ct));
    return JSON.parse(dec.decode(chiaro));
  } catch (_) {
    // Firma/contenuto manomessi, oppure mittente diverso da quello
    // dichiarato: si scarta. Meglio nessun dato che un dato alterato.
    return null;
  }
}

// ── Il sacco di chi trasporta ──
// Un dispositivo accetta di portare pacchetti altrui entro limiti che decide
// lui. Si scartano prima i più vicini alla scadenza: sono quelli con meno
// probabilità residua di arrivare comunque.
export function acceptForCarry(sacco, bundle, { max = MAX_CARRIED, now = Date.now() } = {}) {
  const cur = Array.isArray(sacco) ? sacco : [];
  if (!bundle || bundle.v !== 1 || !bundle.to || !bundle.ct) return cur;
  if (bundle.exp && bundle.exp < now) return cur;                       // già scaduto
  if (JSON.stringify(bundle).length > MAX_BUNDLE_BYTES * 2) return cur; // fuori misura
  if (cur.some((b) => b.iv === bundle.iv && b.to === bundle.to)) return cur; // già in sacco
  const nuovo = [...cur, bundle].sort((a, b) => (b.exp || 0) - (a.exp || 0));
  return nuovo.slice(0, max);
}

// Cosa consegnare a un dispositivo che ho appena incontrato: ciò che è per
// lui, più — se si vuole propagare oltre — ciò che lui può portare avanti.
export function bundlesFor(sacco, destinatarioPubB64, { now = Date.now() } = {}) {
  return (Array.isArray(sacco) ? sacco : [])
    .filter((b) => b.to === destinatarioPubB64 && (!b.exp || b.exp >= now));
}

// Igiene del sacco: si buttano gli scaduti. Senza questo un dispositivo
// diventerebbe una discarica che cresce per sempre.
export function pruneExpired(sacco, { now = Date.now() } = {}) {
  return (Array.isArray(sacco) ? sacco : []).filter((b) => !b.exp || b.exp >= now);
}

// Cosa dire all'utente, onestamente: la consegna non è garantita.
export function carryStatus(sacco, { now = Date.now() } = {}) {
  const vivi = pruneExpired(sacco, { now });
  return {
    inTransito: vivi.length,
    capienza: MAX_CARRIED,
    messaggio: vivi.length
      ? (vivi.length === 1
        ? 'Stai portando 1 pacchetto per un altro dispositivo. Non puoi leggerlo, e nemmeno noi: arriverà quando incontrerai chi lo aspetta.'
        : `Stai portando ${vivi.length} pacchetti per altri dispositivi. Non puoi leggerli, e nemmeno noi: arriveranno quando incontrerai chi li aspetta.`)
      : null,
  };
}
