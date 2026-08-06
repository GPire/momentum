// ============================================================
// RIFERIMENTO QRR SVIZZERO — verificato al 100%, non un frammento
// ============================================================
// La QR-bill svizzera (obbligatoria su ogni fattura dal 2022) richiede un
// riferimento di pagamento a 27 cifre (QRR) con una cifra di controllo
// calcolata con l'algoritmo "modulo 10 ricorsivo" — la stessa identica
// famiglia usata per decenni dai bollettini ISR/BVR svizzeri, prima
// dell'introduzione della QR-bill.
//
// A differenza della struttura COMPLETA del payload QR-bill (42 campi,
// ordine rigido — non ancora verificato qui con la certezza che questo
// progetto richiede prima di generare un codice usato per un pagamento
// reale: servirebbe le Implementation Guidelines ufficiali SIX in PDF,
// non raggiungibili in modo affidabile da qui), QUESTO algoritmo è
// piccolo, autoconclusivo, e VERIFICATO CONTRO UN RIFERIMENTO REALE
// pubblicato da SIX Group stessa: "210000000003139471430009017"
// (base 26 cifre "21000000000313947143000901" + cifra di controllo "7",
// calcolo eseguito e confermato corretto). Fonti incrociate su algoritmo
// e tabella: dnando.github.io, boessu/SwissQRBill, chqr (balsigergil).
'use strict';

// Tabella di transizione modulo-10 ricorsiva (fissa, parte della specifica).
const TABELLA_MODULO_10 = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];

function statoFinale(cifre) {
  let stato = 0;
  for (const ch of String(cifre)) {
    const d = +ch;
    stato = TABELLA_MODULO_10[(stato + d) % 10];
  }
  return stato;
}

// Calcola la cifra di controllo per una base numerica (qualunque lunghezza:
// l'algoritmo è ricorsivo, non richiede esattamente 26 cifre in ingresso).
export function computeQrrCheckDigit(baseDigits) {
  const s = String(baseDigits || '').replace(/\D/g, '');
  if (!s) return null;
  return (10 - statoFinale(s)) % 10;
}

// Genera un riferimento QRR completo (27 cifre) da una base scelta
// dall'utente (es. numero fattura, ID cliente): la riempie a sinistra con
// zeri fino a 26 cifre e aggiunge la cifra di controllo. Se la base supera
// 26 cifre, errore esplicito — mai un riferimento troncato in silenzio.
export function generateQrrReference(baseDigits) {
  const s = String(baseDigits || '').replace(/\D/g, '');
  if (!s) return { ok: false, reason: 'Nessuna cifra fornita per generare il riferimento.' };
  if (s.length > 26) return { ok: false, reason: 'La base è troppo lunga: il riferimento QRR ha al massimo 26 cifre prima del controllo.' };
  const base26 = s.padStart(26, '0');
  const check = computeQrrCheckDigit(base26);
  return { ok: true, reference: base26 + check };
}

// Valida un riferimento QRR completo (27 cifre): ricontrolla la cifra di
// controllo contro le prime 26 — intercetta un typo prima che la fattura
// venga inviata con un riferimento che nessuna banca svizzera accetterebbe.
export function validateQrrReference(reference) {
  const s = String(reference || '').replace(/\D/g, '');
  if (s.length !== 27) return { ok: false, reason: `Un riferimento QRR ha esattamente 27 cifre (ricevute ${s.length}).` };
  const base26 = s.slice(0, 26);
  const checkFornito = +s[26];
  const checkAtteso = computeQrrCheckDigit(base26);
  if (checkFornito !== checkAtteso) {
    return { ok: false, reason: `Cifra di controllo non valida: attesa ${checkAtteso}, ricevuta ${checkFornito}. Probabile errore di trascrizione.` };
  }
  return { ok: true };
}

// Formattazione leggibile (gruppi di 5 cifre, come sui bollettini svizzeri
// reali): "21 00000 00003 13947 14300 09017" invece di una stringa unica.
export function formatQrrReference(reference) {
  const s = String(reference || '').replace(/\D/g, '');
  return s.replace(/(.{2})(.{5})(.{5})(.{5})(.{5})(.{5})/, '$1 $2 $3 $4 $5 $6').trim();
}
