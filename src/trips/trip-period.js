// ============================================================
// PERIODO DELLA TRASFERTA — inizio e fine, con l'ora
// ============================================================
// Perché l'ora e non solo il giorno (ricerca reale su come funzionano le
// note spese in Europa, SAP Concur/Rydoo/Mobilexpense 2026): in Germania —
// uno dei mercati più grandi per questi strumenti — la diaria dei pasti
// (Verpflegungsmehraufwand) NON dipende dai giorni ma dalle ORE di assenza:
// sotto le 8 ore non spetta nulla, fra 8 e 24 ore spetta la quota ridotta,
// oltre le 24 ore la quota piena per i giorni interi e quella ridotta per il
// giorno di partenza e quello di ritorno. Registrare solo la data rende
// impossibile calcolare la cosa che l'azienda deve rimborsare.
//
// E c'è il pezzo che si incastra con quello che Momentum già raccoglie: se un
// pasto è OFFERTO, la diaria va ridotta — 20% per la colazione, 40% per il
// pranzo, 40% per la cena. Momentum già sa quali pasti sono stati offerti
// (tripCategory 'vitto' + mealType, la funzione "Offerto"): è esattamente il
// dato che serve, raccolto perché serviva onestà nella nota spese, e che qui
// diventa un calcolo che i concorrenti fanno con un servizio a parte.
//
// ONESTÀ, come sempre: le TARIFFE cambiano per Paese e per anno e le decide
// il fisco, non noi. Qui non ne è scritta nessuna: questo file calcola ORE,
// GIORNI e RIDUZIONI: la tariffa la fornisce chi chiama (l'utente o la sua
// azienda), e se non c'è non si inventa un numero.
//
// Funzioni pure: nessun DOM, nessuna rete.
'use strict';

// Percentuali di riduzione della diaria quando il pasto è offerto da altri.
// Sono le proporzioni usate in Germania e riprese da gran parte dei
// regolamenti europei; restano DICHIARATE qui e sovrascrivibili, mai
// nascoste dentro un calcolo.
export const RIDUZIONE_PASTO = { colazione: 0.20, pranzo: 0.40, cena: 0.40 };

// Soglie in ore, sempre dichiarate.
export const ORE_MINIME_DIARIA = 8;
export const ORE_GIORNO_PIENO = 24;

function aData(iso, ora) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  const [hh, mm] = String(ora || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0);
}

export function isoDelGiorno(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

// Il periodo della trasferta: ritorna null se non è definito per intero —
// mai una durata "presunta", che in una nota spese diventerebbe un rimborso
// calcolato su un dato inventato.
export function periodoTrasferta(trip) {
  const inizio = aData(trip?.startDate, trip?.startTime);
  const fine = aData(trip?.endDate, trip?.endTime);
  if (!inizio || !fine) return null;
  if (fine < inizio) return null; // una trasferta che finisce prima di iniziare non è un periodo
  const ore = (fine - inizio) / 3600000;
  return { inizio, fine, ore: Math.round(ore * 100) / 100 };
}

// Tutti i giorni toccati dalla trasferta, estremi inclusi. Serve al calendario
// per illuminare il periodo, e a chi controlla per vedere i giorni scoperti.
export function giorniDelPeriodo(trip) {
  const p = periodoTrasferta(trip);
  if (!p) return [];
  const giorni = [];
  const cursore = new Date(p.inizio.getFullYear(), p.inizio.getMonth(), p.inizio.getDate());
  const ultimo = new Date(p.fine.getFullYear(), p.fine.getMonth(), p.fine.getDate());
  // Limite di sicurezza: una trasferta di più di due anni è quasi sempre un
  // errore di digitazione sull'anno, e senza tetto qui si genererebbe una
  // lista enorme che blocca la schermata.
  let guardia = 0;
  while (cursore <= ultimo && guardia++ < 800) {
    giorni.push(isoDelGiorno(cursore));
    cursore.setDate(cursore.getDate() + 1);
  }
  return giorni;
}

// Una spesa registrata FUORI dal periodo dichiarato: non è un errore da
// bloccare (capita di pagare l'hotel il giorno prima di partire), ma chi
// approva vuole saperlo — ed è meglio che se ne accorga chi compila.
export function speseFuoriPeriodo(trip, expenses = []) {
  const giorni = new Set(giorniDelPeriodo(trip));
  if (!giorni.size) return [];
  return expenses.filter(e => e?.date && !giorni.has(String(e.date).slice(0, 10)));
}

// Giorni del periodo SENZA nessuna spesa registrata. È l'informazione che
// manca ovunque: una giornata dimenticata la scopre chi approva, e la nota
// spese torna indietro.
export function giorniScoperti(trip, expenses = []) {
  const conSpesa = new Set(expenses.map(e => String(e?.date || '').slice(0, 10)));
  return giorniDelPeriodo(trip).filter(g => !conSpesa.has(g));
}

// La diaria spettante, secondo la struttura a ore usata in Europa. `tariffe`
// le passa chi chiama: { piena, ridotta } nella valuta dell'utente. Senza
// tariffe non si stima nulla — si dichiara che non si può calcolare.
export function diariaSpettante(trip, { piena = null, ridotta = null } = {}) {
  const p = periodoTrasferta(trip);
  if (!p) return { calcolabile: false, motivo: 'periodo non definito' };
  if (piena == null || ridotta == null) return { calcolabile: false, motivo: 'tariffe non impostate', ore: p.ore };
  if (p.ore < ORE_MINIME_DIARIA) {
    return { calcolabile: true, ore: p.ore, giorniPieni: 0, giorniRidotti: 0, lordo: 0, riduzioni: 0, totale: 0, sottoSoglia: true };
  }
  const giorni = giorniDelPeriodo(trip);
  // Sotto le 24 ore: una sola quota ridotta, anche se il viaggio tocca due
  // giorni civili (partenza alle 22, ritorno alle 6 del mattino dopo).
  if (p.ore < ORE_GIORNO_PIENO) {
    const lordo = ridotta;
    const riduzioni = riduzioniPerPastiOfferti(trip, piena);
    return { calcolabile: true, ore: p.ore, giorniPieni: 0, giorniRidotti: 1, lordo, riduzioni, totale: arrotonda(Math.max(0, lordo - riduzioni)), sottoSoglia: false };
  }
  // Oltre le 24 ore: primo e ultimo giorno ridotti, quelli in mezzo pieni.
  const giorniRidotti = Math.min(2, giorni.length);
  const giorniPieni = Math.max(0, giorni.length - giorniRidotti);
  const lordo = arrotonda(giorniPieni * piena + giorniRidotti * ridotta);
  const riduzioni = riduzioniPerPastiOfferti(trip, piena);
  return { calcolabile: true, ore: p.ore, giorniPieni, giorniRidotti, lordo, riduzioni, totale: arrotonda(Math.max(0, lordo - riduzioni)), sottoSoglia: false };
}

// Quanto va tolto perché quei pasti li ha pagati qualcun altro. Le percentuali
// si applicano alla quota PIENA anche nei giorni ridotti: è la regola tedesca,
// ed è quella che rende il calcolo verificabile invece che approssimato.
export function riduzioniPerPastiOfferti(trip, quotaPiena, percentuali = RIDUZIONE_PASTO) {
  if (!(quotaPiena > 0)) return 0;
  let tot = 0;
  for (const voce of (trip?.offeredItems || [])) {
    const pct = percentuali[voce?.mealType];
    if (pct) tot += quotaPiena * pct;
  }
  return arrotonda(tot);
}

function arrotonda(n) { return Math.round((+n + Number.EPSILON) * 100) / 100; }
