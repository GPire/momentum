// ============================================================
// GIORNO DI CALENDARIO LOCALE — mai un giorno che scivola per il fuso orario
// ============================================================
// BUG REALE segnalato da più utenti (2026-09-06): "inserisco la spesa per
// ieri (sabato), l'app la mette venerdì". Riprodotto e capito.
//
// Una transazione backdatata nasce come `new Date(anno, mese, giorno)`
// (mezzanotte LOCALE) e viene salvata con `.toISOString()`. Per chiunque sia
// in un fuso AVANTI su UTC (Italia e gran parte d'Europa/Asia — la
// maggioranza degli utenti reali), mezzanotte locale è ancora la SERA PRIMA
// in UTC: sabato mezzanotte a Roma è "venerdì 22:00 UTC". La stringa salvata
// (`t.date`) porta quindi la data di VENERDÌ nei suoi primi 10 caratteri,
// anche se rappresenta l'istante giusto.
//
// Qui non è la scrittura a essere sbagliata (l'istante UTC è corretto), è
// che 13 punti di lettura in main.js facevano `String(t.date).slice(0, 10)`
// — tagliano la stringa e si aspettano il giorno LOCALE, ma leggono quello
// UTC. Altri 6 punti già facevano `new Date(t.date).getDate()` (ricostruendo
// l'istante e leggendolo con i getter locali) ed erano già corretti. Questa
// funzione è quella lettura corretta, fatta una volta sola e testata, perché
// tutti i 13 punti la richiamino invece di ripetere lo stesso taglio di
// stringa sbagliato.
//
// Funzione pura: nessun DOM, nessuna dipendenza dal fuso orario del server.
'use strict';

// Da un Date, o da qualunque cosa new Date() sappia interpretare (una
// stringa ISO con tempo e Z, un timestamp), il giorno di calendario COME LO
// VEDE chi guarda l'orologio sul proprio dispositivo. MAI un taglio di
// stringa: quello si aspetta che i caratteri siano già nel fuso giusto, e
// per una stringa con "Z" (UTC vero) spesso non lo sono.
export function giornoLocale(dataOString) {
  const d = dataOString instanceof Date ? dataOString : new Date(dataOString);
  if (Number.isNaN(d.getTime())) return null;
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

// Stesso principio, per il MESE (usato dove oggi si tagliava a 7 caratteri
// invece che a 10 — stesso bug, stessa causa).
export function meseLocale(dataOString) {
  const d = dataOString instanceof Date ? dataOString : new Date(dataOString);
  if (Number.isNaN(d.getTime())) return null;
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
}
