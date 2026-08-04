// Recupero a soglia: la chiave del backup divisa in N pezzi, ne bastano T.
//
// Il problema che risolve (l'obiezione numero uno a un'app senza cloud): se
// perdi il telefono perdi tutto, e l'unica difesa oggi è una passphrase che
// bisogna RICORDARE — cioè la cosa che le persone perdono per prima. Qui la
// passphrase non serve: la chiave viene divisa in pezzi da mettere in posti
// diversi (una mail a te stesso, una chiavetta, il telefono di chi ti fidi).
// Con 2 pezzi su 3 torni dentro; con 1 solo pezzo NON si ricava NULLA — non
// "è difficile": è matematicamente impossibile, un pezzo da solo è compatibile
// con ogni segreto possibile (Shamir, 1979).
//
// Nessun server, nessun deposito di chiavi, nessun singolo posto da rubare.
//
// Matematica: Shamir secret sharing su GF(256) (../core/gf256.js, lo stesso
// campo del Reed-Solomon dei QR di pagamento). Ogni byte del segreto è il
// termine noto di un polinomio di grado T-1 con coefficienti casuali; il
// pezzo i è il valore del polinomio in x=i; ricostruire = interpolazione di
// Lagrange in x=0.
//
// Funzioni PURE (la casualità entra come parametro, così i test sono
// deterministici e la proprietà "1 pezzo non rivela nulla" è verificabile).
// Nessun DOM, nessuna rete.
'use strict';

import { gfAdd, gfMul, gfDiv } from './gf256.js';

const PREFIX = 'MR1';

// Alfabeto Crockford base32: niente I, L, O, U — le lettere che si confondono
// con 1/0 quando un pezzo viene scritto a mano su un foglio o letto al telefono.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DEALIAS = { I: '1', L: '1', O: '0', U: 'V' };

const defaultRandom = (n) => crypto.getRandomValues(new Uint8Array(n));

// ---- CRC-16/CCITT-FALSE: intercetta i typo PRIMA di ricostruire ----
// Senza checksum un carattere sbagliato non dà errore: dà un segreto DIVERSO,
// e l'utente scoprirebbe il problema solo davanti a un backup che non si apre,
// senza sapere quale dei pezzi ha sbagliato a copiare.
function crc16(bytes) {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

function base32Encode(bytes) {
  let out = '', buffer = 0, bits = 0;
  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bits += 8;
    while (bits >= 5) { out += ALPHABET[(buffer >> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  let buffer = 0, bits = 0;
  const out = [];
  for (const ch of str) {
    const c = DEALIAS[ch] ?? ch;
    const v = ALPHABET.indexOf(c);
    if (v < 0) throw new Error(`Carattere non valido nel pezzo: "${ch}".`);
    buffer = (buffer << 5) | v;
    bits += 5;
    if (bits >= 8) { out.push((buffer >> (bits - 8)) & 0xff); bits -= 8; }
  }
  // Decodifica STRETTA. L'ultimo carattere porta dei bit di riempimento non
  // usati: se li si ignora, più caratteri diversi danno gli stessi byte e un
  // typo sull'ultimo carattere passa inosservato — trovato da un test che
  // prova tutti i typo possibili (7 su 1953 passavano). I bit di riempimento
  // devono essere zero, come li scrive encodeShare.
  if (bits > 0 && (buffer & ((1 << bits) - 1)) !== 0) {
    throw new Error('L\'ultimo carattere del pezzo non è valido: ricontrollalo.');
  }
  return Uint8Array.from(out);
}

// ---- Shamir ----

// Divide un segreto (byte) in `total` pezzi di cui ne bastano `threshold`.
// `kitId` (2 byte casuali) marca i pezzi nati insieme: mescolare i pezzi di
// due kit diversi darebbe un segreto sbagliato in silenzio, qui invece dà un
// errore chiaro.
export function splitSecret(secret, { threshold, total, random = defaultRandom } = {}) {
  const s = Uint8Array.from(secret || []);
  if (!s.length) throw new Error('Nessun segreto da dividere.');
  if (!Number.isInteger(threshold) || !Number.isInteger(total)) throw new Error('Soglia e numero di pezzi devono essere numeri interi.');
  // threshold = 1 è il FOGLIO UNICO, ammesso di proposito e solo su scelta
  // esplicita: il polinomio ha grado 0, quindi ogni pezzo È la chiave intera.
  // Matematicamente coerente, ma più debole — chi lo trova apre tutto e chi lo
  // perde perde tutto. La scelta resta della persona, il compromesso va detto.
  if (threshold < 1) throw new Error('La soglia minima è 1.');
  if (total < threshold) throw new Error('I pezzi totali non possono essere meno della soglia.');
  if (total > 9) throw new Error('Massimo 9 pezzi: oltre, nessuno riesce davvero a custodirli.');

  const kitId = random(2);
  // Coefficienti casuali: threshold-1 per ogni byte del segreto.
  const coeffs = random(s.length * (threshold - 1));

  const shares = [];
  for (let x = 1; x <= total; x++) {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) {
      // Horner dal grado più alto al termine noto: f(x) = s_i + a1·x + a2·x² ...
      let acc = 0;
      for (let d = threshold - 1; d >= 1; d--) {
        acc = gfAdd(gfMul(acc, x), coeffs[i * (threshold - 1) + (d - 1)]);
      }
      bytes[i] = gfAdd(gfMul(acc, x), s[i]);
    }
    shares.push({ index: x, threshold, total, kitId: Uint8Array.from(kitId), bytes });
  }
  return shares;
}

// Ricostruisce il segreto da `threshold` pezzi (o più). Interpolazione di
// Lagrange valutata in x=0.
export function combineShares(shares) {
  const list = Array.isArray(shares) ? shares.filter(Boolean) : [];
  if (list.length < 1) throw new Error('Non hai inserito nessun foglio.');

  const threshold = list[0].threshold;
  if (list.length < threshold) {
    throw new Error(`Servono ${threshold} pezzi per ricostruire: ne hai ${list.length}.`);
  }
  const kit = kitKey(list[0].kitId);
  for (const sh of list) {
    if (kitKey(sh.kitId) !== kit) throw new Error('Questi pezzi vengono da backup diversi: usa i pezzi dello stesso kit.');
  }
  const seen = new Set();
  for (const sh of list) {
    if (seen.has(sh.index)) throw new Error(`Il pezzo numero ${sh.index} è stato inserito due volte.`);
    seen.add(sh.index);
  }
  const len = list[0].bytes.length;
  if (list.some((sh) => sh.bytes.length !== len)) throw new Error('I pezzi hanno lunghezze diverse: uno è incompleto.');

  // Bastano esattamente `threshold` pezzi: usare gli altri non aggiunge nulla.
  const used = list.slice(0, threshold);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    let acc = 0;
    for (let j = 0; j < used.length; j++) {
      let num = 1, den = 1;
      for (let m = 0; m < used.length; m++) {
        if (m === j) continue;
        num = gfMul(num, used[m].index);                              // (0 - x_m) = x_m in GF(2^k)
        den = gfMul(den, gfAdd(used[j].index, used[m].index));        // (x_j - x_m)
      }
      acc = gfAdd(acc, gfMul(used[j].bytes[i], gfDiv(num, den)));
    }
    out[i] = acc;
  }
  return out;
}

const kitKey = (id) => Array.from(id || []).join('.');

// ---- Formato leggibile e trasportabile ----
// "MR1-23-1-XXXX-XXXX-..." → versione, soglia+totale, numero del pezzo, dati.
// Gruppi di 4 caratteri: si copia a mano senza perdere il segno.
export function encodeShare(share) {
  const head = Uint8Array.from([share.threshold, share.total, share.index, ...share.kitId]);
  const body = new Uint8Array(head.length + share.bytes.length);
  body.set(head, 0);
  body.set(share.bytes, head.length);
  const crc = crc16(body);
  const withCrc = new Uint8Array(body.length + 2);
  withCrc.set(body, 0);
  withCrc[body.length] = (crc >> 8) & 0xff;
  withCrc[body.length + 1] = crc & 0xff;
  const groups = base32Encode(withCrc).match(/.{1,4}/g) || [];
  return `${PREFIX}-${share.threshold}${share.total}-${share.index}-${groups.join('-')}`;
}

// Legge un pezzo scritto/incollato in qualunque modo (spazi, minuscole,
// trattini mancanti, "Pezzo 2 di 3:" davanti). Un typo NON passa: il CRC lo
// ferma e il messaggio dice quale pezzo riguarda, non "errore generico".
export function decodeShare(text) {
  const raw = String(text || '').toUpperCase();
  const at = raw.indexOf(PREFIX);
  if (at < 0) throw new Error('Questo non sembra un pezzo di recupero Momentum (manca la sigla MR1).');
  const coda = raw.slice(at + PREFIX.length);
  // Le persone incollano il foglio dentro una frase ("Foglio 2 — Momentum … grazie!").
  // Quello che viene PRIMA è escluso dalla sigla; quello che viene DOPO no: le
  // lettere della frase finivano dentro il codice e il pezzo veniva rifiutato
  // — trovato dalle simulazioni, non a tavolino. Qui si tiene traccia di dove
  // sta ogni carattere utile, così si può tagliare nel punto giusto.
  const cleaned = [];
  const posOrig = [];
  for (let i = 0; i < coda.length; i++) {
    if (/[0-9A-Z]/.test(coda[i])) { cleaned.push(coda[i]); posOrig.push(i); }
  }
  if (cleaned.length < 8) throw new Error('Pezzo troppo corto: sembra incompleto.');

  // Il taglio giusto è quello che finisce su un separatore (o a fine testo) E
  // supera il controllo di integrità: la frase intorno non può passare per caso.
  const tagli = [];
  for (let L = cleaned.length; L >= 8; L--) {
    const dopo = posOrig[L - 1] + 1;
    const finisceBene = dopo >= coda.length || !/[0-9A-Z]/.test(coda[dopo]);
    if (finisceBene) tagli.push(L);
  }

  let body = null, index = 0;
  for (const L of tagli) {
    // I primi 3 caratteri sono soglia, totale, indice in chiaro; il resto è base32.
    let p;
    try { p = base32Decode(cleaned.slice(3, L).join('')); } catch (_) { continue; }
    if (p.length < 8) continue;
    const b = p.slice(0, p.length - 2);
    const crc = (p[p.length - 2] << 8) | p[p.length - 1];
    if (crc16(b) === crc) { body = b; index = b[2]; break; }
  }
  const cleanedStr = cleaned.join('');
  if (!body) {
    // Un solo messaggio, sempre con il numero del foglio: alla persona non
    // interessa SE è saltato il riempimento o il controllo di integrità —
    // le interessa quale foglio ricontrollare.
    const visibile = cleanedStr[2];
    throw new Error(`Il pezzo numero ${/[1-9]/.test(visibile) ? visibile : '?'} ha un carattere sbagliato: ricontrollalo, non è ancora utilizzabile.`);
  }
  // I 3 caratteri leggibili in testa (soglia, totale, numero) sono una comodità
  // per chi guarda il foglio; i valori veri stanno nel corpo protetto dal CRC.
  // Se non coincidono, qualcuno ha copiato male l'intestazione: meglio dirlo
  // subito che lasciare in mano un pezzo che sembra un altro.
  const head = cleanedStr.slice(0, 3);
  if (head !== `${body[0]}${body[1]}${index}`) {
    throw new Error(`L'intestazione di questo pezzo dice "${head}" ma il contenuto dice "${body[0]}${body[1]}${index}": ricontrolla la copiatura.`);
  }
  return {
    threshold: body[0],
    total: body[1],
    index,
    kitId: body.slice(3, 5),
    bytes: body.slice(5),
  };
}

// Frase da stampare/incollare accanto al pezzo: chi lo trova tra un anno deve
// capire cos'è senza chiedere a nessuno.
export function shareLabel(share) {
  return `Momentum — pezzo di recupero ${share.index} di ${share.total}. `
    + `Ne servono ${share.threshold} diversi per riaprire il backup. `
    + `Da solo questo foglio non apre niente e non rivela niente.`;
}
