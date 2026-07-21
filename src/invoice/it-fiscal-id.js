// ============================================================
// IT FISCAL ID — validazione con CIFRA DI CONTROLLO reale (v10)
// ============================================================
// Gli algoritmi UFFICIALI di controllo di Partita IVA (11 cifre, checksum Luhn
// pesato) e Codice Fiscale persona fisica (16 caratteri, carattere di controllo
// da tabelle pari/dispari). Servono a intercettare gli ERRORI DI BATTITURA prima
// che lo SdI/registro scarti la fattura — la causa piu' comune di scarto. 100%
// on-device, funzioni pure, nessuna rete. Onesto: verificano la COERENZA del
// codice (matematica), non l'ESISTENZA anagrafica (quella la sa solo il registro).
'use strict';

// Partita IVA italiana: 11 cifre. Checksum: raddoppia le cifre in posizione pari
// (0-indexed dispari), sottrai 9 se >9, somma tutto incluso il controllo → %10==0.
export function isValidPartitaIva(v) {
  const s = String(v || '').replace(/\s/g, '');
  if (!/^\d{11}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    let n = +s[i];
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

// Tabelle ufficiali del Codice Fiscale (carattere di controllo).
const CF_ODD = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
const CF_EVEN = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10, L: 11, M: 12,
  N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19, U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};

// Codice Fiscale persona fisica: 16 caratteri alfanumerici. Verifica il carattere
// di controllo finale dalle prime 15 posizioni (dispari→CF_ODD, pari→CF_EVEN).
export function isValidCodiceFiscale(v) {
  const s = String(v || '').toUpperCase().replace(/\s/g, '');
  if (!/^[A-Z0-9]{16}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const ch = s[i];
    sum += (i % 2 === 0) ? CF_ODD[ch] : CF_EVEN[ch]; // posizione 1-indexed dispari = i pari
  }
  const control = String.fromCharCode(65 + (sum % 26));
  return control === s[15];
}

// Un identificativo fiscale del CLIENTE può essere una P.IVA (11 cifre, aziende)
// o un Codice Fiscale (16 char, persone). Ritorna { ok, kind, reason }:
//  ok=true se coerente; ok=false con motivo se la cifra di controllo non torna.
// Se il formato non è né 11 né 16 → { ok:true, kind:'unknown' } (non è compito
// di questa funzione bocciare formati esteri; lo fa il validatore a monte).
export function checkFiscalId(v) {
  const s = String(v || '').toUpperCase().replace(/\s/g, '');
  if (/^\d{11}$/.test(s)) {
    return isValidPartitaIva(s)
      ? { ok: true, kind: 'piva' }
      : { ok: false, kind: 'piva', reason: 'la Partita IVA sembra contenere un errore di battitura (cifra di controllo errata)' };
  }
  if (/^[A-Z0-9]{16}$/.test(s)) {
    return isValidCodiceFiscale(s)
      ? { ok: true, kind: 'cf' }
      : { ok: false, kind: 'cf', reason: 'il Codice Fiscale sembra contenere un errore di battitura (carattere di controllo errato)' };
  }
  return { ok: true, kind: 'unknown' };
}
