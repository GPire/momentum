// Budget settimanale derivato automaticamente dal budget mensile — zero
// nuovi input richiesti all'utente (bassa frizione: se hai già impostato un
// tetto mensile, hai già impostato anche questo).
//
// Due scelte che lo rendono più intelligente di "budget mensile / 4":
// 1. Split PROPORZIONALE ai giorni reali di ogni settimana nel mese: la
//    prima e l'ultima settimana di un mese sono quasi sempre parziali
//    (es. il mese inizia di giovedì), una settimana da 3 giorni non deve
//    avere lo stesso budget di una da 7.
// 2. RIPORTO automatico: se una settimana chiude in avanzo, l'avanzo si
//    somma al budget della settimana successiva; se sfora, la settimana
//    successiva parte con meno margine. Stesso principio degli "envelope
//    budget" (YNAB e simili), qui calcolato in automatico senza che
//    l'utente debba mai spostare soldi a mano tra buste.
import { monthKey } from '../core/constants.js';

function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=domenica..6=sabato
  const diff = (day === 0 ? -6 : 1) - day; // sposta al lunedì della stessa settimana
  d.setDate(d.getDate() + diff);
  return d;
}

// Elenca le settimane (lun-dom) che intersecano il mese `monthKeyStr`
// ("YYYY-MM"), clippate ai confini reali del mese.
export function getMonthWeeks(monthKeyStr) {
  const [y, m] = monthKeyStr.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0); // ultimo giorno del mese
  const weeks = [];
  let cursor = mondayOf(monthStart);

  while (cursor <= monthEnd) {
    const weekEndFull = new Date(cursor);
    weekEndFull.setDate(weekEndFull.getDate() + 6);
    const start = cursor < monthStart ? monthStart : new Date(cursor);
    const end = weekEndFull > monthEnd ? monthEnd : weekEndFull;
    const daysInMonth = Math.round((end - start) / 86_400_000) + 1;
    weeks.push({ start, end, daysInMonth });
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

function sumExpenses(txs, start, end) {
  return txs
    .filter(t => t.type === 'uscita')
    .filter(t => { const d = new Date(t.date); return d >= start && d <= new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999); })
    .reduce((s, t) => s + t.amount, 0);
}

// Calcola lo stato di ogni settimana del mese: budget di base (proporzionale
// ai giorni), speso, riporto in ingresso/uscita, rimanente.
// `monthTxs`: array delle transazioni di QUEL mese (es. VaultDAO.state.transactions[monthKey]).
//
// `referenceDate` sceglie QUALE mese enumerare (`monthKey(referenceDate)`);
// `realNow` (default = referenceDate, quindi retrocompatibile con ogni
// chiamante esistente che passa già "oggi" vero) decide invece cosa è
// PASSATO/CORRENTE/FUTURO — sono due domande diverse, e confonderle è
// esattamente il BUG REALE segnalato da utenti veri (2026-09-04, "il budget
// della settimana cambia in modo assurdo tornando indietro nel calendario",
// alcuni pronti ad abbandonare l'app): la card che mostra la settimana
// sfogliata (Dashboard, striscia settimanale) passava il lunedì della
// settimana SFOGLIATA anche come "oggi" — così ogni settimana passata
// veniva ricalcolata come se FOSSE lei il presente, azzerando il riporto
// delle settimane successive (mai viste, sempre trattate come "future") e
// producendo numeri che saltano su e giù senza alcuna relazione con quanto
// l'utente ha davvero speso. Con `realNow` sempre ancorato al vero adesso,
// sfogliare il passato mostra la fotografia STORICA vera (il riporto reale
// accumulato fino a quella settimana), mai una fotografia reinventata ad
// ogni tocco delle frecce.
export function getWeeklyStatus(monthTxs, monthlyBudget, referenceDate = new Date(), realNow = referenceDate) {
  const mk = monthKey(referenceDate);
  const weeks = getMonthWeeks(mk);
  const totalDays = weeks.reduce((s, w) => s + w.daysInMonth, 0) || 1;
  const txs = monthTxs || [];

  let rollover = 0;
  const result = [];

  for (const week of weeks) {
    const baseBudget = monthlyBudget * (week.daysInMonth / totalDays);
    // week.end è costruito a mezzanotte (solo data, vedi getMonthWeeks): un
    // confronto diretto con `realNow` (che ha l'ora reale) classificava
    // la settimana corrente come "isPast" per tutto il giorno finale della
    // settimana (la domenica) tranne l'istante esatto di mezzanotte — bug
    // reale trovato confrontando il rendering live con l'orario reale: la
    // card mostrava la lista di tutte le settimane invece del riquadro
    // "questa settimana", proprio perché nessuna settimana risultava mai
    // isCurrent dopo la mezzanotte dell'ultimo giorno. Fix: confrontare
    // contro la fine del giorno, non contro la mezzanotte che lo apre.
    const weekEndCutoff = new Date(week.end.getFullYear(), week.end.getMonth(), week.end.getDate(), 23, 59, 59, 999);
    const isPast = realNow > weekEndCutoff;
    const isCurrent = realNow >= week.start && realNow <= weekEndCutoff;
    const isFuture = realNow < week.start;

    if (isFuture) {
      // Le settimane future non hanno ancora un riporto certo: dipende da
      // come chiuderà la settimana corrente, quindi si mostra solo la base.
      result.push({ start: week.start, end: week.end, budget: +baseBudget.toFixed(2), spent: 0, remaining: +baseBudget.toFixed(2), rolloverIn: null, isPast, isCurrent, isFuture });
      continue;
    }

    const spent = sumExpenses(txs, week.start, week.end);
    const budgetWithRollover = baseBudget + rollover;
    const remaining = budgetWithRollover - spent;

    result.push({
      start: week.start, end: week.end,
      budget: +budgetWithRollover.toFixed(2),
      spent: +spent.toFixed(2),
      remaining: +remaining.toFixed(2),
      rolloverIn: +rollover.toFixed(2),
      isPast, isCurrent, isFuture,
    });

    if (isPast) rollover = remaining; // l'avanzo/sforamento passa alla settimana dopo
    // se è la settimana corrente (in corso), il suo riporto verso la prossima
    // non è ancora definitivo: non lo propaghiamo finché non è isPast.
  }

  return {
    weeks: result,
    currentWeek: result.find(w => w.isCurrent) || null,
  };
}

// LA SETTIMANA COME LA VIVE UNA PERSONA: lunedì → domenica, anche quando
// cade a cavallo di due mesi.
//
// `getWeeklyStatus` taglia le settimane ai confini del mese, e deve farlo:
// il budget è mensile. Ma per chi guarda l'app quella non è "una settimana".
// Il caso reale che ha reso necessaria questa funzione: lunedì 31 agosto,
// ultimo giorno del mese, il segmento del mese durava UN giorno — l'affitto
// di 650 € in arrivo veniva scaricato tutto su quell'unico giorno e
// "oggi puoi spendere" diventava 0, mentre la settimana vera (31 ago → 6 set)
// aveva sette giorni su cui distribuirlo.
//
// Qui i segmenti mensili che la settimana attraversa si SOMMANO: il budget
// resta quello del motore (riporto incluso), la settimana torna di sette
// giorni. `allTx` è la mappa {monthKey: [tx]} già usata ovunque.
//
// `referenceDate` sceglie QUALE settimana mostrare (qualsiasi giorno dentro
// quella settimana); `realNow` (default = referenceDate) resta ancorato a
// oggi VERO per decidere passato/corrente/futuro e per il riporto — vedi il
// commento esteso su `getWeeklyStatus`, è lo stesso bug segnalato dagli
// utenti che sfogliano le settimane all'indietro.
export function getIsoWeekStatus(allTx, monthlyBudget, referenceDate = new Date(), realNow = referenceDate) {
  if (!monthlyBudget || monthlyBudget <= 0) return null;
  const start = mondayOf(referenceDate);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);

  const giorni = [];
  for (let i = 0; i < 7; i++) giorni.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const mesi = [...new Set(giorni.map(d => monthKey(d)))];

  // ── IL BUDGET DELLA SETTIMANA È LA SUA QUOTA, NON UN SALDO CHE SI ACCUMULA ──
  // BUG REALE segnalato da utenti veri, molti pronti ad abbandonare l'app
  // (2026-09-04): "definisco il budget, sfoglio le settimane all'indietro e
  // anche senza aver speso NIENTE il budget è ogni volta completamente
  // diverso, anche con lo stesso stipendio" — cifre reali riportate:
  // 621,43 / 483,87 / 348,39 / 212,20 / 690,37 su settimane consecutive.
  // RIPRODOTTO e capito: prima questa funzione sommava, per ogni mese
  // toccato, il segmento settimanale calcolato da `getWeeklyStatus` — che
  // include il RIPORTO accumulato dalle settimane precedenti dello stesso
  // mese. Con zero spese quel riporto cresce settimana dopo settimana (per
  // costruzione: "non hai speso, quei soldi sono ancora tuoi"), quindi la
  // 4ª settimana di un mese mostrava fino a 4 volte la 1ª — e al cambio
  // mese ripartiva da zero, creando esattamente il saliscendi segnalato.
  // Matematicamente coerente, ma come risposta alla domanda "quanto budget
  // ho questa settimana?" è illeggibile e distrugge la fiducia.
  //
  // Ora la settimana vale la sua QUOTA REALE: per ogni mese che attraversa,
  // (giorni della settimana in quel mese / giorni del mese) × budget mensile.
  // Conseguenze volute: stesso budget e stesso stipendio → stesso numero
  // ogni settimana, sempre, sfogliando avanti o indietro, quest'anno o
  // l'anno scorso; una settimana non può mai valere più di ~un settimo del
  // mese; il numero non dipende più da QUANDO lo guardi. Il riporto resta
  // dove è davvero utile e non può gonfiare nulla: dentro la settimana
  // corrente, perché `remaining = budget − speso` continua a dare più
  // margine ai giorni rimasti se nei primi giorni non hai speso.
  let budget = 0;
  let trovato = false;
  for (const mk of mesi) {
    const giorniInQuestoMese = giorni.filter(d => monthKey(d) === mk).length;
    const [y, m] = mk.split('-').map(Number);
    const giorniDelMese = new Date(y, m, 0).getDate();
    budget += monthlyBudget * (giorniInQuestoMese / giorniDelMese);
    trovato = true;
  }
  if (!trovato) return null;

  // Lo speso si conta sui sette giorni veri, non sui segmenti: deve sempre
  // combaciare con quello che l'utente vede giorno per giorno.
  const spent = mesi.reduce((s, mk) => s + sumExpenses(allTx?.[mk] || [], start, end), 0);
  return {
    start, end,
    budget: +budget.toFixed(2),
    spent: +spent.toFixed(2),
    remaining: +(budget - spent).toFixed(2),
  };
}
