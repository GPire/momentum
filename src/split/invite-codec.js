// ============================================================
// INVITE CODEC — il codice d'invito, corto e non spaventoso (v10)
// ============================================================
// PROBLEMA REALE (segnalato dall'utente, misurato prima di toccare il codice):
// l'invito che finisce su WhatsApp era lungo 1.759 caratteri. Da quando
// l'invito porta con se' anche l'offerta di collegamento diretto (WebRTC), il
// link e' diventato un muro di caratteri casuali: illeggibile, impossibile da
// trasformare in QR (limite fisico ~900 caratteri, quindi il QR spariva
// proprio negli inviti piu' utili), e soprattutto DIFFIDENTE — un link cosi'
// somiglia a quelli delle truffe, e chi lo riceve non lo tocca. Un'app che
// cresce col passaparola non puo' permettersi un invito che fa paura.
//
// COSA CAMBIA QUI, in tre mosse:
//  1. COMPRESSIONE. Il contenuto (nomi + offerta di collegamento) e' testo
//     ripetitivo: si comprime benissimo. deflate-raw + base64url misurato sul
//     caso reale: 1.728 → 738 caratteri, il 57% in meno, e il QR torna
//     generabile. Nessuna libreria: CompressionStream e' nel browser e in Node.
//  2. IL PAYLOAD VA NEL FRAGMENT (dopo #). Tutto cio' che sta dopo # non viene
//     MAI inviato al server da nessun browser: non finisce nei log di accesso,
//     non nel Referer, non nelle statistiche di chi ospita l'app. Prima stava
//     in ?join=, cioe' passava dal server a ogni apertura. E' privacy vera,
//     non un'etichetta: il gruppo e i nomi restano tra le due persone.
//  3. LA PARTE VISIBILE DEL LINK DICE COSA E'. Prima dell'#, il link porta il
//     nome del gruppo leggibile ("...?g=cena-in-pizzeria"): chi lo riceve vede
//     di cosa si tratta prima di toccarlo. E' la differenza tra un link che
//     sembra spam e uno che sembra un invito.
//
// ONESTA': il nome del gruppo nella parte visibile e' un'informazione in
// chiaro (lo vede chi intercetta il link, e il server che ospita l'app). E'
// una scelta consapevole: senza, il link resta anonimo e nessuno lo apre. Chi
// non lo vuole puo' generare l'invito senza nome (`readableName: false`) e il
// link resta muto. Nomi dei membri, spese e importi non sono MAI nella parte
// visibile: stanno nel fragment, compressi.
'use strict';

// Formati riconosciuti. MSPLIT1 (base64 semplice) resta letto per sempre: i
// link gia' mandati a qualcuno devono continuare a funzionare, anche fra anni.
export const CODE_V1 = 'MSPLIT1:';   // storico, non compresso
export const CODE_V2 = 'MSPLIT2.';   // compresso; il punto evita che i client di
                                     // posta spezzino il link sui due punti

const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder().decode(b);

function toB64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = (typeof btoa !== 'undefined') ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(s) {
  const b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = (typeof atob !== 'undefined') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// La compressione c'e' in ogni browser che regge una PWA moderna e in Node 18+.
// Se manca (browser vecchio, contesto insolito) NON si fallisce: si torna al
// formato v1, piu' lungo ma funzionante. Meglio un link brutto di nessun link.
export const canCompress = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

// Nota (bug trovato scrivendo i test, non in teoria): con un codice troncato —
// un link spezzato a meta' da una chat, cosa che succede davvero — l'errore di
// decompressione NON emerge dalla lettura che stiamo aspettando, ma dal lato
// scrittura dello stream, in modo asincrono. Senza catturarlo li', nel browser
// diventa un "unhandledrejection": un errore rosso in console per un link
// storpiato, cioe' per un caso previsto e innocuo. Per questo entrambe le
// estremita' dello stream vengono gestite esplicitamente.
async function pumpStream(stream, bytes) {
  const w = stream.writable.getWriter();
  w.closed.catch(() => {});
  const scrittura = (async () => { try { await w.write(bytes); await w.close(); } catch (_) { /* lo riporta la lettura */ } })();
  try {
    return new Uint8Array(await new Response(stream.readable).arrayBuffer());
  } finally {
    await scrittura;
  }
}

async function deflate(str) { return pumpStream(new CompressionStream('deflate-raw'), enc(str)); }
async function inflate(bytes) { return dec(await pumpStream(new DecompressionStream('deflate-raw'), bytes)); }

// Base64 UTF-8 sicuro (formato v1), identico a quello storico di split-engine.
function b64encodeUtf8(str) {
  const bytes = enc(str); let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return (typeof btoa !== 'undefined') ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
}
function b64decodeUtf8(b64) {
  const bin = (typeof atob !== 'undefined') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return dec(bytes);
}

// Impacchetta un oggetto nel codice piu' corto possibile. Ritorna sempre una
// stringa valida: compressa se si puo', altrimenti nel vecchio formato.
export async function packShare(obj) {
  const json = JSON.stringify(obj);
  if (!canCompress()) return CODE_V1 + b64encodeUtf8(json);
  try {
    const packed = CODE_V2 + toB64Url(await deflate(json));
    // Su contenuti minuscoli la compressione puo' allungare (intestazioni):
    // in quel caso si tiene il piu' corto dei due. Nessun caso peggiorato.
    const plain = CODE_V1 + b64encodeUtf8(json);
    return packed.length <= plain.length ? packed : plain;
  } catch (_) {
    return CODE_V1 + b64encodeUtf8(json);
  }
}

// Legge un codice di QUALSIASI formato (v1 o v2). Ritorna null se non e'
// leggibile, mai un'eccezione: un link storpiato da un client di posta non
// deve rompere l'app, deve solo non aprire niente.
export async function unpackShare(code) {
  const s = String(code || '').trim();
  try {
    if (s.startsWith(CODE_V2)) return JSON.parse(await inflate(fromB64Url(s.slice(CODE_V2.length))));
    if (s.startsWith(CODE_V1)) return JSON.parse(b64decodeUtf8(s.slice(CODE_V1.length)));
  } catch (_) { /* codice non valido o troncato */ }
  return null;
}

// Estrae il codice da qualsiasi cosa: il codice nudo, un link intero incollato,
// con o senza percent-encoding, da qualunque dominio, e sia dal fragment (#)
// sia dal vecchio parametro ?join=. Il riconoscimento e' per CONTENUTO, non per
// indirizzo: un link generato da un'altra istanza di Momentum, o da un dominio
// che domani non esiste piu', continua a funzionare se incollato a mano.
export function extractShareCode(input) {
  let s = String(input || '').trim();
  if (!s) return null;
  if (s.startsWith(CODE_V2) || s.startsWith(CODE_V1)) return s;
  let decoded = s;
  try { decoded = decodeURIComponent(s); } catch (_) { /* non era percent-encoded */ }
  const re2 = /MSPLIT2\.[A-Za-z0-9_-]+/;
  const re1 = /MSPLIT1:[A-Za-z0-9+/=_-]+/;
  const m = decoded.match(re2) || decoded.match(re1) || s.match(re2) || s.match(/MSPLIT1:[A-Za-z0-9+/=_%-]+/);
  if (!m) return null;
  try { return decodeURIComponent(m[0]); } catch (_) { return m[0]; }
}

// Nome del gruppo reso leggibile dentro un URL ("Cena in pizzeria 🍕" →
// "cena-in-pizzeria"). Accenti tolti, niente caratteri strani, massimo 40
// caratteri: serve a far capire di cosa si tratta, non a trasportare dati.
export function slugify(name) {
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

// Il link completo da mandare. Struttura scelta apposta:
//   https://base/percorso?g=cena-in-pizzeria#MSPLIT2.xxxxx
//   └─ parte visibile: dice cosa e' ──┘  └─ dati, mai al server ─┘
export function buildInviteUrl({ base, path = '/', code, groupName = '', readableName = true }) {
  const p = String(path || '/').replace(/index\.html$/, '') || '/';
  const root = `${String(base || '').replace(/\/+$/, '')}${p.startsWith('/') ? p : '/' + p}`.replace(/([^:])\/\/+/g, '$1/');
  const slug = readableName ? slugify(groupName) : '';
  return `${root}${slug ? `?g=${slug}` : ''}#${code}`;
}
