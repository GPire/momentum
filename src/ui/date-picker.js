// ============================================================
// SELETTORE DATA DI MOMENTUM — non quello del sistema
// ============================================================
// BUG REALE segnalato dall'utente: "clicco sul campo data e non riesco a
// cambiarla, non mi esce alcun selettore". La causa: il campo era un
// `<input type="date">` reso INVISIBILE (opacity 0) sopra una pillola
// disegnata — un espediente che funziona sul telefono, dove toccare l'input
// apre il selettore di sistema, ma NON sul desktop, dove per aprirlo bisogna
// colpire l'iconcina del calendario, che lì è invisibile. Risultato: il campo
// sembrava rotto.
//
// La seconda metà della segnalazione ("non è di design e integrato con
// Momentum") è la ragione per cui questo file esiste invece di una toppa: il
// selettore del sistema operativo è di un'altra app, con altri colori, altre
// animazioni e altre parole. Qui il calendario è lo stesso linguaggio del
// resto — le stesse celle del calendario di Analisi Tensor, gli stessi
// neurocolori, le stesse micro-animazioni.
//
// La parte PURA (che giorni mostrare in una griglia) sta qui sotto ed è
// testabile senza browser; il disegno lo fa chi chiama.
'use strict';

// Griglia di un mese come la vede l'utente: settimane da lunedì a domenica,
// con le celle vuote di inizio e fine per allineare i giorni al loro giorno
// della settimana. Ritorna un array piatto: `null` = cella vuota.
export function monthGrid(anno, mese0) {
  const primo = new Date(anno, mese0, 1);
  const giorniNelMese = new Date(anno, mese0 + 1, 0).getDate();
  // getDay(): 0 = domenica. In Europa la settimana inizia di lunedì, e
  // sbagliare questo allineamento sposta OGNI giorno di una colonna — un
  // errore che si vede solo guardando un calendario vero, mai leggendo il
  // codice.
  const offset = (primo.getDay() + 6) % 7;
  const celle = [];
  for (let i = 0; i < offset; i++) celle.push(null);
  for (let g = 1; g <= giorniNelMese; g++) celle.push(g);
  while (celle.length % 7 !== 0) celle.push(null);
  return celle;
}

// Data ISO senza passare da `new Date(stringa)`: quella legge la stringa come
// UTC e in mezzo mondo restituisce il giorno prima. Stesso motivo per cui
// altrove nell'app le date si compongono a mano.
export function isoDi(anno, mese0, giorno) {
  return `${anno}-${String(mese0 + 1).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

export function parseIso(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return { anno: y, mese0: m - 1, giorno: d };
}

// Un giorno è selezionabile? `min`/`max` sono ISO opzionali. Serve una sola
// funzione perché la stessa regola vale sia per disegnare la cella disattivata
// sia per rifiutare il tocco: due regole separate divergono sempre.
export function giornoAmmesso(iso, { min = null, max = null } = {}) {
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}

// Mese precedente/successivo senza mai passare da giorni fuori range (il 31
// gennaio meno un mese, con l'aritmetica ingenua sulle date, diventa il 3
// marzo).
export function mesePrecedente(anno, mese0) {
  return mese0 === 0 ? { anno: anno - 1, mese0: 11 } : { anno, mese0: mese0 - 1 };
}
export function meseSuccessivo(anno, mese0) {
  return mese0 === 11 ? { anno: anno + 1, mese0: 0 } : { anno, mese0: mese0 + 1 };
}

// C'è almeno un giorno raggiungibile nel mese indicato? Serve a spegnere la
// freccia invece di lasciarla premere per finire su un mese tutto disattivato
// — un pulsante che non fa niente è peggio di un pulsante che non c'è.
export function meseHaGiorniAmmessi(anno, mese0, limiti = {}) {
  const giorni = new Date(anno, mese0 + 1, 0).getDate();
  const primo = isoDi(anno, mese0, 1);
  const ultimo = isoDi(anno, mese0, giorni);
  if (limiti.max && primo > limiti.max) return false;
  if (limiti.min && ultimo < limiti.min) return false;
  return true;
}
