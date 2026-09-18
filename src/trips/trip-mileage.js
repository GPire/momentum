// ============================================================
// RIMBORSO CHILOMETRICO — formula pura, nessuna tariffa qui dentro
// ============================================================
// Stesso principio di trip-period.js: la tariffa la fornisce chi chiama
// (una delle costanti in trip-mileage-rates.js, o un numero digitato
// dall'utente per un Paese non coperto — vedi il commento su
// TARIFFA_KM_PER_PAESE) — qui SOLO la moltiplicazione, mai un numero
// inventato.
'use strict';

export function rimborsoChilometrico(distanza, tariffaPerUnita) {
  if (!(distanza > 0) || !(tariffaPerUnita > 0)) return null;
  return Math.round(distanza * tariffaPerUnita * 100) / 100;
}
