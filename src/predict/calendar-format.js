// ==========================================
// CALENDAR FORMAT — normalizzazione PURA delle righe del calendario
// ==========================================
// Prima la vista calendario leggeva `ev.title` anche per gli eventi creati da
// VOCE (che hanno `description`, non `title`) → titolo vuoto; e mostrava
// "−0,00 €" per gli APPUNTAMENTI (importo 0) come se fossero scadenze
// finanziarie. Qui la logica è pura e testabile: un evento diventa una riga con
// etichetta corretta, nota (descrizione estesa), tipo (appuntamento / scadenza /
// promemoria / previsto) e flag finanziario onesto. Il render (DOM, in main.js)
// consuma solo queste righe già pronte. Nessun tetto di N eventi: si ordinano
// tutti per data crescente — la gestione "oltre i 5" è una scelta di layout.

// Etichetta leggibile di un evento, robusta all'origine (voce vs form manuale).
export function eventLabel(ev = {}) {
  return String(ev.title || ev.description || 'Promemoria').trim() || 'Promemoria';
}

// Un evento è "finanziario" (ha un importo da mostrare/sommare) solo se porta un
// importo positivo. Un appuntamento dal dentista NON lo è: niente "−0,00 €".
export function isFinancialEvent(ev = {}) {
  return typeof ev.amount === 'number' && ev.amount > 0;
}

// Costruisce le righe display ordinate a partire dagli eventi reali e dagli
// addebiti PREVISTI (già mappati dal chiamante a { title, amount, date }).
// `now` è iniettabile per i test. Ordine: data crescente; gli eventi completati
// scendono in fondo (fatti, ma non spariscono).
export function buildCalendarRows(events = [], predicted = [], now = new Date()) {
  const rows = [];
  for (const ev of events) {
    const fin = isFinancialEvent(ev);
    rows.push({
      id: ev.id,
      predicted: false,
      label: eventLabel(ev),
      note: String(ev.note || '').trim(),
      kind: ev.intent === 'appointment' ? 'appointment' : (fin ? 'deadline' : 'reminder'),
      isFinancial: fin,
      amount: fin ? ev.amount : 0,
      date: ev.date,
      hasTime: !!ev.hasTime,
      completed: !!ev.completed,
    });
  }
  for (const c of predicted) {
    rows.push({
      predicted: true,
      label: String(c.title || c.description || 'Addebito previsto').trim(),
      note: '',
      kind: 'predicted',
      isFinancial: true,
      amount: c.amount || 0,
      date: c.date instanceof Date ? c.date.toISOString() : c.date,
      hasTime: false,
      completed: false,
    });
  }
  const ts = (r) => {
    const t = new Date(r.date).getTime();
    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER; // date invalide in coda
  };
  rows.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1; // completati in fondo
    return ts(a) - ts(b);
  });
  return rows;
}

// Riepilogo compatto per l'intestazione ("3 in programma · 1 fatto"): aiuta a
// gestire MOLTI eventi senza contarli a occhio. Pura, niente DOM.
export function calendarSummary(rows = []) {
  const total = rows.length;
  const done = rows.filter(r => r.completed).length;
  const predicted = rows.filter(r => r.predicted).length;
  const active = total - done - predicted;
  return { total, active, done, predicted };
}
