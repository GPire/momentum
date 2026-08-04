// ============================================================
// SYNC PRIORITY — prima ciò che cambia una decisione, non ciò che è più vecchio
// ============================================================
// Il problema che risolve: oggi il sync manda le transazioni mancanti
// nell'ordine in cui le trova (per mese). Su una connessione che dura due
// secondi — un codice incollato al volo, una rete che sta per cadere — quei
// due secondi vengono spesi a caso, magari su una spesa di tre mesi fa che
// non cambia nulla di ciò che l'utente sta guardando ORA.
//
// Qui le transazioni mancanti vengono RIORDINATE prima di essere inviate:
// prima quelle che più probabilmente cambiano un numero che la persona sta
// guardando adesso — il saldo disponibile oggi, un impegno che sta per
// scadere — poi il resto. Così anche un sync interrotto a metà ha già dato
// il massimo valore possibile nel tempo che ha avuto.
//
// Onestà: questa è un'EURISTICA di priorità, non una chiamata al motore
// completo di previsione (cash-forecast.js) per ogni singola transazione —
// sarebbe corretto ma troppo costoso da ricalcolare a ogni sync su migliaia
// di righe. La euristica approssima lo stesso principio con tre segnali
// misurabili in O(1) per transazione: vicinanza nel tempo, importo, e le
// cancellazioni (che valgono sempre di più, perché correggono un dato falso
// già mostrato). Funzioni pure, nessun DOM, nessuna rete.
'use strict';

// Oltre questa distanza dalla data odierna (passato o futuro), una
// transazione non ha più un vantaggio di "vicinanza": ha lo stesso peso
// temporale minimo di qualunque altra cosa vecchia.
const DEFAULT_HORIZON_DAYS = 14;

// Oltre questo importo assoluto, l'impatto sul saldo è già "grande" e non
// cresce più nel punteggio: evita che un unico movimento enorme monopolizzi
// sempre il primo posto a scapito di tutto il resto.
const DEFAULT_AMOUNT_CAP = 500;

// Punteggio di UNA transazione. Più alto = più urgente da mandare.
//  - una lapide (cancellazione) vale sempre il massimo: costa pochissimo da
//    mandare (è solo un id) e previene di mostrare un dato già falso;
//  - la vicinanza a OGGI (passata o futura entro l'orizzonte) pesa il doppio
//    dell'importo: un piccolo movimento di domani conta più di uno grande di
//    tre mesi fa, perché è quello che sposta il numero guardato adesso;
//  - l'importo assoluto normalizzato (0..1) aggiunge un secondo criterio a
//    parità di vicinanza.
export function scoreForSync(tx, { now = Date.now(), horizonDays = DEFAULT_HORIZON_DAYS, amountCap = DEFAULT_AMOUNT_CAP } = {}) {
  if (!tx) return 0;
  if (tx.isTombstone) return Infinity;

  const ts = new Date(tx.date ?? tx.createdAt ?? NaN).getTime();
  const amountWeight = Math.min(1, Math.abs(Number(tx.amount) || 0) / amountCap);
  if (!Number.isFinite(ts)) return amountWeight; // nessuna data leggibile: solo l'importo conta

  const daysFromNow = (ts - now) / 86_400_000;
  const distanza = Math.abs(daysFromNow);
  const vicinanza = distanza <= horizonDays ? (horizonDays - distanza) / horizonDays : 0;

  return vicinanza * 2 + amountWeight;
}

// Ordina un elenco di transazioni (o lapidi) dalla più a meno urgente da
// sincronizzare. Stabile a parità di punteggio (l'ordine originale non viene
// rimescolato senza motivo — importante per i test e per non far dipendere
// il risultato dall'implementazione di sort del motore JS).
export function rankForSync(items, opts = {}) {
  return (Array.isArray(items) ? items : [])
    .map((tx, i) => ({ tx, i, score: scoreForSync(tx, opts) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.tx);
}

// Applica l'ordinamento a un pacchetto di sync organizzato per mese (come lo
// produce transactionsMissingFromPeer in sync.js): ogni mese viene ordinato
// al suo interno. Chi manda i dati può scegliere di appiattire e troncare
// dopo aver chiamato questa funzione, se vuole limitare quanto mandare in una
// finestra di tempo breve.
export function rankMissingByMonth(missingByMonth, opts = {}) {
  const out = {};
  for (const [key, list] of Object.entries(missingByMonth || {})) {
    out[key] = Array.isArray(list) ? rankForSync(list, opts) : list;
  }
  return out;
}

// Appiattisce il pacchetto ordinato per mese in UNA lista unica ordinata per
// urgenza (utile quando la connessione può interrompersi in qualunque
// momento e non si vuole comunque "finire un mese" prima di iniziare quello
// più urgente del mese successivo). Le lapidi (chiave speciale, non un mese)
// vengono mantenute a parte e restituite sempre per prime: sono l'unica cosa
// che DEVE arrivare prima di ogni transazione, qualunque sia la sua data.
export function flattenRankedForSync(missingByMonth, { tombstoneKey = '__deleted', ...opts } = {}) {
  const tx = [];
  for (const [key, list] of Object.entries(missingByMonth || {})) {
    if (key === tombstoneKey || !Array.isArray(list)) continue;
    tx.push(...list);
  }
  return rankForSync(tx, opts);
}
