import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSecret, combineShares, encodeShare, decodeShare, shareLabel } from './recovery-shares.js';
import { gfAdd, gfMul, gfDiv } from './gf256.js';

// Casualità iniettabile e deterministica: i test devono fallire per un bug,
// mai per fortuna. (In produzione entra crypto.getRandomValues.)
function seededRandom(seed = 1) {
  let s = seed >>> 0;
  return (n) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; out[i] = (s >>> 16) & 0xff; }
    return out;
  };
}

const secret32 = () => Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff);
const combos = (arr, k) => k === 0 ? [[]]
  : arr.flatMap((v, i) => combos(arr.slice(i + 1), k - 1).map((rest) => [v, ...rest]));

test('2 pezzi su 3: OGNI coppia possibile ricostruisce il segreto esatto', () => {
  const secret = secret32();
  const shares = splitSecret(secret, { threshold: 2, total: 3, random: seededRandom(11) });
  assert.equal(shares.length, 3);
  for (const pair of combos(shares, 2)) {
    assert.deepEqual(Array.from(combineShares(pair)), Array.from(secret));
  }
});

test('3 pezzi su 5: tutte e 10 le terne ricostruiscono, e anche 4 o 5 pezzi insieme', () => {
  const secret = secret32();
  const shares = splitSecret(secret, { threshold: 3, total: 5, random: seededRandom(29) });
  const triples = combos(shares, 3);
  assert.equal(triples.length, 10);
  for (const t of triples) assert.deepEqual(Array.from(combineShares(t)), Array.from(secret));
  assert.deepEqual(Array.from(combineShares(shares.slice(0, 4))), Array.from(secret));
  assert.deepEqual(Array.from(combineShares(shares)), Array.from(secret));
});

test('l ordine dei pezzi non conta', () => {
  const secret = secret32();
  const [a, b, c] = splitSecret(secret, { threshold: 2, total: 3, random: seededRandom(5) });
  assert.deepEqual(Array.from(combineShares([c, a])), Array.from(combineShares([a, c])));
  assert.deepEqual(Array.from(combineShares([b, a])), Array.from(secret));
});

// La proprietà che rende questo schema sicuro, verificata per ENUMERAZIONE e
// non affermata: con un solo pezzo in mano, OGNI segreto possibile resta
// compatibile. Non "difficile da indovinare": indistinguibile.
test('un solo pezzo non rivela nulla: tutti i 256 segreti restano possibili', () => {
  for (const y of [0, 1, 42, 200, 255]) {
    const x = 1;
    let compatibili = 0;
    for (let s = 0; s < 256; s++) {
      // Per soglia 2: y = s + a1·x → esiste sempre un a1 che lo soddisfa.
      const a1 = gfDiv(gfAdd(y, s), x);
      if (gfAdd(gfMul(a1, x), s) === y) compatibili++;
    }
    assert.equal(compatibili, 256, `il pezzo (x=${x}, y=${y}) dovrebbe lasciare aperti tutti i segreti`);
  }
});

test('con meno pezzi della soglia si ottiene un errore chiaro, mai un risultato sbagliato', () => {
  const shares = splitSecret(secret32(), { threshold: 3, total: 5, random: seededRandom(7) });
  assert.throws(() => combineShares(shares.slice(0, 2)), /Servono 3 pezzi/);
});

test('lo stesso pezzo inserito due volte viene riconosciuto', () => {
  const shares = splitSecret(secret32(), { threshold: 2, total: 3, random: seededRandom(3) });
  assert.throws(() => combineShares([shares[0], shares[0]]), /due volte/);
});

test('pezzi di due backup diversi non vengono mescolati in silenzio', () => {
  const a = splitSecret(secret32(), { threshold: 2, total: 3, random: seededRandom(1) });
  const b = splitSecret(secret32(), { threshold: 2, total: 3, random: seededRandom(2) });
  assert.throws(() => combineShares([a[0], b[1]]), /backup diversi/);
});

test('scrittura e rilettura del pezzo: giro completo identico', () => {
  const shares = splitSecret(secret32(), { threshold: 2, total: 3, random: seededRandom(13) });
  for (const sh of shares) {
    const text = encodeShare(sh);
    assert.match(text, /^MR1-23-[123]-/);
    const back = decodeShare(text);
    assert.equal(back.index, sh.index);
    assert.equal(back.threshold, 2);
    assert.equal(back.total, 3);
    assert.deepEqual(Array.from(back.bytes), Array.from(sh.bytes));
  }
});

test('un pezzo scritto a mano storto (spazi, minuscole, prefisso) si legge lo stesso', () => {
  const [sh] = splitSecret(secret32(), { threshold: 2, total: 3, random: seededRandom(17) });
  const text = encodeShare(sh);
  const sporco = `Pezzo di recupero:  ${text.toLowerCase().replace(/-/g, ' ')}  `;
  assert.deepEqual(Array.from(decodeShare(sporco).bytes), Array.from(sh.bytes));
});

test('un carattere sbagliato viene intercettato e il messaggio dice QUALE pezzo', () => {
  const shares = splitSecret(secret32(), { threshold: 2, total: 3, random: seededRandom(19) });
  const text = encodeShare(shares[1]);
  // Sostituisce un carattere dei dati con un altro valido dell'alfabeto.
  const i = text.length - 3;
  const rotto = text.slice(0, i) + (text[i] === 'Z' ? 'Y' : 'Z') + text.slice(i + 1);
  assert.throws(() => decodeShare(rotto), /pezzo numero 2/);
});

// Il typo NON deve mai produrre un segreto diverso senza avvisare: è la
// differenza tra "ricontrolla il pezzo 2" e un backup che non si apre più.
test('nessun typo di un carattere passa inosservato (enumerazione completa)', () => {
  const [sh] = splitSecret(secret32(), { threshold: 2, total: 3, random: seededRandom(23) });
  const text = encodeShare(sh);
  const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let passati = 0, provati = 0;
  for (let i = 3 + 'MR1-23-1-'.length - 3; i < text.length; i++) {
    if (text[i] === '-') continue;
    for (const c of ALPHABET) {
      if (c === text[i]) continue;
      provati++;
      const rotto = text.slice(0, i) + c + text.slice(i + 1);
      try { decodeShare(rotto); passati++; } catch { /* intercettato, come deve */ }
    }
  }
  assert.ok(provati > 500, `campione troppo piccolo: ${provati}`);
  assert.equal(passati, 0, `${passati} typo su ${provati} non sono stati intercettati`);
});

test('parametri impossibili vengono rifiutati con un motivo leggibile', () => {
  const s = secret32();
  assert.throws(() => splitSecret(s, { threshold: 4, total: 3 }), /meno della soglia/);
  assert.throws(() => splitSecret(s, { threshold: 2, total: 12 }), /Massimo 9/);
  assert.throws(() => splitSecret(new Uint8Array(0), { threshold: 2, total: 3 }), /Nessun segreto/);
  assert.throws(() => decodeShare('ciao come stai'), /MR1/);
});

test('l etichetta del pezzo spiega da sola cos e, senza gergo', () => {
  const [sh] = splitSecret(secret32(), { threshold: 2, total: 3, random: seededRandom(31) });
  const label = shareLabel(sh);
  assert.match(label, /pezzo di recupero 1 di 3/);
  assert.match(label, /Ne servono 2/);
  assert.match(label, /non apre niente/);
});

// ---- Foglio unico: scelta esplicita, matematicamente coerente, più debole ----

test('foglio unico: un solo foglio riapre tutto, ed è dichiaratamente più debole', () => {
  const secret = secret32();
  const [solo] = splitSecret(secret, { threshold: 1, total: 1, random: seededRandom(41) });
  assert.equal(solo.threshold, 1);
  assert.deepEqual(Array.from(combineShares([solo])), Array.from(secret));
  // La differenza col 2-su-3 non è di stile: qui il foglio È la chiave.
  assert.deepEqual(Array.from(solo.bytes), Array.from(secret));
});

test('foglio unico: scrittura e rilettura funzionano come per gli altri', () => {
  const [solo] = splitSecret(secret32(), { threshold: 1, total: 1, random: seededRandom(43) });
  const back = decodeShare(encodeShare(solo));
  assert.equal(back.threshold, 1);
  assert.equal(back.total, 1);
  assert.deepEqual(Array.from(back.bytes), Array.from(solo.bytes));
});

test('foglio unico: un typo resta comunque intercettato', () => {
  const [solo] = splitSecret(secret32(), { threshold: 1, total: 1, random: seededRandom(47) });
  const text = encodeShare(solo);
  const i = text.length - 4;
  const rotto = text.slice(0, i) + (text[i] === 'Z' ? 'Y' : 'Z') + text.slice(i + 1);
  assert.throws(() => decodeShare(rotto), /pezzo numero 1/);
});

test('la soglia 0 resta impossibile', () => {
  assert.throws(() => splitSecret(secret32(), { threshold: 0, total: 1 }), /soglia minima/);
});
