// ============================================================
// FIDUCIA TRA DISPOSITIVI — la rete dice CHI C'È, mai CHI SEI
// ============================================================
// Il problema, posto bene: due dispositivi sulla stessa rete possono essere
// i due telefoni della stessa persona… oppure il tuo telefono e quello di uno
// sconosciuto nello stesso bar, ufficio o palazzo. Stessa rete NON significa
// stessa persona, e trattarla come tale sarebbe una falla grave: chiunque
// condivida il Wi-Fi potrebbe farsi passare per un tuo dispositivo e
// ricevere i tuoi dati finanziari.
//
// La difesa non è rendere difficile il collegamento: è separare due cose che
// vengono spesso confuse.
//
//   SCOPERTA  = "qui c'è un dispositivo con Momentum".  Può usare la rete.
//   FIDUCIA   = "questo dispositivo è MIO".             Non può, mai.
//
// Il registro precedente (peer-registry.js: TrustStore) si fidava di un
// peerId DICHIARATO. Un id non è un segreto: chi lo scopre può affermare di
// essere quel dispositivo. Qui la fiducia è legata al possesso di una CHIAVE
// PRIVATA, che non lascia mai il dispositivo e non può essere dichiarata: va
// dimostrata firmando una sfida diversa ogni volta.
//
// Il primo aggancio richiede UN gesto umano, e non è pigrizia: è l'unica cosa
// che distingue "il mio secondo telefono" da "il telefono di un altro". Le
// TRE PAROLE mostrate sui due schermi derivano da ENTRAMBE le chiavi: se in
// mezzo si infila qualcuno, le parole non coincidono e si vede subito. Non
// serve leggere un codice lungo: si guarda se sono uguali.
//
// Dopo il primo aggancio, ogni riconnessione è automatica e silenziosa —
// perché a quel punto i due dispositivi si riconoscono da soli, senza rete
// di mezzo che possa mentire.
'use strict';

const enc = new TextEncoder();
const subtle = () => (globalThis.crypto && globalThis.crypto.subtle) || null;

const b64u = (buf) => {
  const b = new Uint8Array(buf);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64u = (str) => {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.padEnd(s.length + ((4 - (s.length % 4)) % 4), '=');
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
};

// Parole corte, comuni e foneticamente distinte: vanno lette ad alta voce o
// confrontate a colpo d'occhio da chiunque, anche da un bambino. Sono 64,
// quindi tre parole valgono 18 bit: abbastanza perché un attaccante non
// possa far coincidere le parole per tentativi durante un aggancio dal vivo,
// e poche abbastanza da restare leggibili.
export const PAROLE = [
  'albero', 'barca', 'casa', 'dado', 'erba', 'fiore', 'gatto', 'isola',
  'luna', 'mare', 'nave', 'oro', 'pane', 'quadro', 'rosa', 'sole',
  'tavolo', 'uva', 'vento', 'zucca', 'ago', 'bosco', 'campo', 'dente',
  'elmo', 'fuoco', 'gioco', 'lago', 'mano', 'nido', 'occhio', 'porta',
  'ramo', 'sedia', 'torre', 'vaso', 'zaino', 'ancora', 'burro', 'cielo',
  'disco', 'faro', 'ghiaccio', 'letto', 'monte', 'nube', 'ombra', 'pesce',
  'radio', 'scala', 'treno', 'vela', 'penna', 'ponte', 'riva', 'sabbia',
  'tetto', 'valle', 'bosso', 'corda', 'fiume', 'grano', 'muro', 'pietra',
];

// Identità del dispositivo: una coppia di chiavi che nasce e resta qui. La
// privata non viene mai esportata né trasmessa — è ciò che rende impossibile
// a chiunque altro "essere" questo dispositivo.
export async function generateIdentity() {
  const s = subtle();
  if (!s) throw new Error('Crittografia non disponibile su questo dispositivo');
  const kp = await s.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const pub = await s.exportKey('raw', kp.publicKey);
  return { publicKey: b64u(pub), privateKey: kp.privateKey, _pub: kp.publicKey };
}

// Le TRE PAROLE di verifica. Derivano da entrambe le chiavi e sono
// ORDINE-INDIPENDENTI: i due dispositivi calcolano la stessa terna senza
// doversi mettere d'accordo su chi è "il primo". Se un terzo si infila nel
// mezzo, le due terne divergono — ed è quello che l'occhio nota.
export async function verificationWords(pubA, pubB) {
  const s = subtle();
  if (!s) throw new Error('Crittografia non disponibile su questo dispositivo');
  const [x, y] = [String(pubA), String(pubB)].sort(); // indipendente dall'ordine
  const digest = new Uint8Array(await s.digest('SHA-256', enc.encode(`${x}|${y}`)));
  return [0, 1, 2].map((i) => PAROLE[digest[i] % PAROLE.length]);
}

// Una sfida è un numero casuale usa-e-getta: firmarla dimostra il possesso
// della chiave privata ADESSO. Riusare una vecchia firma non funziona, ed è
// il motivo per cui non basta "aver visto una volta" un dispositivo fidato.
export function newChallenge() {
  const b = new Uint8Array(32);
  globalThis.crypto.getRandomValues(b);
  return b64u(b);
}

export async function signChallenge(privateKey, challenge) {
  const s = subtle();
  const sig = await s.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, enc.encode(String(challenge)));
  return b64u(sig);
}

export async function verifyChallenge(publicKeyB64, challenge, signatureB64) {
  const s = subtle();
  if (!s || !publicKeyB64 || !challenge || !signatureB64) return false;
  try {
    const key = await s.importKey('raw', fromB64u(publicKeyB64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await s.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromB64u(signatureB64), enc.encode(String(challenge)));
  } catch (_) {
    return false; // chiave o firma malformata: non fidato, mai un'eccezione che sembri un errore tecnico
  }
}

// ── Registro dei dispositivi fidati ──
// Si indicizza per CHIAVE PUBBLICA, non per id dichiarato: è la differenza
// tra "dice di chiamarsi così" e "ha dimostrato di essere lui".
export function addTrustedDevice(list, { publicKey, label = '', now = Date.now() }) {
  const cur = Array.isArray(list) ? list : [];
  if (!publicKey) return cur;
  if (cur.some((d) => d.publicKey === publicKey)) return cur;
  return [...cur, { publicKey, label: String(label || '').slice(0, 40), pairedAt: now }];
}

export function removeTrustedDevice(list, publicKey) {
  return (Array.isArray(list) ? list : []).filter((d) => d.publicKey !== publicKey);
}

export function isTrustedKey(list, publicKey) {
  if (!publicKey) return false;
  return (Array.isArray(list) ? list : []).some((d) => d.publicKey === publicKey);
}

// Il controllo completo che si fa ad ogni riconnessione: conosco questa
// chiave? E il dispositivo sa firmare adesso? Servono ENTRAMBE. Conoscere la
// chiave senza la firma è il caso dell'impostore che l'ha copiata; la firma
// senza conoscerla è uno sconosciuto qualsiasi, per quanto legittimo.
export async function authenticatePeer(list, { publicKey, challenge, signature }) {
  if (!isTrustedKey(list, publicKey)) {
    return { ok: false, reason: 'dispositivo non tra quelli che hai collegato' };
  }
  const firmaValida = await verifyChallenge(publicKey, challenge, signature);
  if (!firmaValida) {
    return { ok: false, reason: 'non ha dimostrato di possedere la chiave: potrebbe essere qualcun altro che ne usa il nome' };
  }
  return { ok: true, reason: 'riconosciuto' };
}
