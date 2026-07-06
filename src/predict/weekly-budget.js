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
export function getWeeklyStatus(monthTxs, monthlyBudget, referenceDate = new Date()) {
  const mk = monthKey(referenceDate);
  const weeks = getMonthWeeks(mk);
  const totalDays = weeks.reduce((s, w) => s + w.daysInMonth, 0) || 1;
  const txs = monthTxs || [];

  let rollover = 0;
  const result = [];

  for (const week of weeks) {
    const baseBudget = monthlyBudget * (week.daysInMonth / totalDays);
    const isPast = referenceDate > week.end;
    const isCurrent = referenceDate >= week.start && referenceDate <= week.end;
    const isFuture = referenceDate < week.start;

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
