// Aritmetica nel campo finito GF(256), polinomio 0x11D.
//
// Un solo posto per il campo, usato da due cose diverse che hanno bisogno
// esattamente della stessa matematica:
//   - Reed-Solomon per i QR di pagamento (src/pay/qr-encode.js)
//   - Shamir secret sharing per il recupero del backup (src/core/recovery-shares.js)
//
// Prima viveva dentro qr-encode.js: estratto qui invece di riscriverlo una
// seconda volta, così esiste UNA implementazione verificata e non due che
// possono divergere. Nessun comportamento cambiato: stesse tabelle, stesso
// polinomio, stessi risultati (i test esistenti di qr-encode lo verificano).
//
// Funzioni pure, nessun DOM, nessuna rete, nessuna dipendenza.
'use strict';

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

// Somma e sottrazione nel campo sono la stessa operazione: XOR.
export const gfAdd = (a, b) => (a ^ b) & 0xff;

export const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

// Inverso moltiplicativo. Zero non ha inverso: è un errore di programmazione,
// non un caso da mascherare con un valore finto (nascondere qui un bug lo
// farebbe ricomparire come un segreto ricostruito sbagliato, senza avviso).
export function gfInv(a) {
  if (a === 0) throw new Error('GF(256): 0 non ha inverso moltiplicativo.');
  return EXP[255 - LOG[a]];
}

export const gfDiv = (a, b) => (a === 0 ? 0 : gfMul(a, gfInv(b)));

// Esposte per Reed-Solomon, che lavora direttamente sulle tabelle.
export const gfExp = (i) => EXP[i];
export const gfLog = (a) => LOG[a];
