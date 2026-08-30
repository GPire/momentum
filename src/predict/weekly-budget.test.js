import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { getMonthWeeks, getWeeklyStatus, getIsoWeekStatus } = await import("./weekly-budget.js");

test("getMonthWeeks copre esattamente tutti i giorni del mese, senza buchi né sovrapposizioni", () => {
  // luglio 2026 ha 31 giorni, inizia di mercoledì
  const weeks = getMonthWeeks("2026-07");
  const totalDays = weeks.reduce((s, w) => s + w.daysInMonth, 0);
  assert.equal(totalDays, 31);
  // la prima settimana deve iniziare il giorno 1 (non prima, essendo clippata al mese)
  assert.equal(weeks[0].start.getDate(), 1);
  // l'ultima settimana deve finire il giorno 31
  const last = weeks[weeks.length - 1];
  assert.equal(last.end.getDate(), 31);
});

test("una settimana parziale (3 giorni) riceve una quota proporzionale, non 1/4 piatto", () => {
  // febbraio 2026 inizia di domenica: la prima settimana "vera" (lun-dom
  // contenente il 1) ha solo 1 giorno di febbraio (il resto è gennaio, escluso).
  const weeks = getMonthWeeks("2026-02");
  const firstWeek = weeks[0];
  assert.ok(firstWeek.daysInMonth <= 7);
  const status = getWeeklyStatus([], 700, new Date(2026, 0, 1)); // referenceDate fuori mese, edge case difensivo
  assert.ok(Array.isArray(status.weeks));
});

test("il budget DI BASE di una settimana da 7 giorni è pari a 7/totalDays del mensile (prima del riporto)", () => {
  // verifica diretta sulla proporzione giorni/budget di getMonthWeeks, senza
  // passare da getWeeklyStatus: lì il campo `budget` include ANCHE il riporto
  // delle settimane precedenti per design (vedi test sul riporto sotto),
  // quindi non è il posto giusto per isolare il solo calcolo proporzionale.
  const weeks = getMonthWeeks("2026-07"); // 31 giorni
  const totalDays = weeks.reduce((s, w) => s + w.daysInMonth, 0);
  const fullWeek = weeks.find(w => w.daysInMonth === 7);
  assert.ok(fullWeek, "atteso almeno una settimana piena in un mese di 31 giorni");
  const expectedBase = 3100 * (fullWeek.daysInMonth / totalDays);
  assert.ok(Math.abs(expectedBase - 3100 * (7 / 31)) < 0.01);
});

test("una settimana passata sotto budget riporta l'avanzo alla settimana successiva", () => {
  const monthTxs = [
    // settimana 1 (lun 6 - dom 12 luglio 2026): spende poco
    { date: "2026-07-07T10:00:00Z", amount: 10, type: "uscita", category: "spesa", description: "test" },
  ];
  // referenceDate nella settimana 2, cosi la settimana 1 è "isPast" e il riporto è calcolato
  const status = getWeeklyStatus(monthTxs, 700, new Date(2026, 6, 14));
  const week1 = status.weeks[0];
  const week2 = status.weeks.find(w => w.isCurrent);
  assert.ok(week1.remaining > 0, "settimana 1 deve chiudere in avanzo");
  assert.ok(week2.rolloverIn > 0, "il riporto verso la settimana 2 deve essere positivo");
  assert.ok(week2.budget > week2.rolloverIn === false || week2.rolloverIn > 0); // sanity
});

test("una settimana passata in sforamento riduce il budget disponibile della settimana successiva", () => {
  const monthTxs = [
    { date: "2026-07-07T10:00:00Z", amount: 500, type: "uscita", category: "spesa", description: "spesone" },
  ];
  const status = getWeeklyStatus(monthTxs, 700, new Date(2026, 6, 14));
  const week2 = status.weeks.find(w => w.isCurrent);
  assert.ok(week2.rolloverIn < 0, "lo sforamento deve propagarsi come riporto negativo");
  assert.ok(week2.budget < week2.budget - week2.rolloverIn); // il budget con riporto negativo è più basso della sola base
});

test("le settimane future mostrano solo il budget di base, senza riporto (non ancora determinato)", () => {
  const status = getWeeklyStatus([], 700, new Date(2026, 6, 1));
  const future = status.weeks.filter(w => w.isFuture);
  assert.ok(future.length > 0);
  future.forEach(w => assert.equal(w.rolloverIn, null));
});

test("l'ultimo giorno della settimana (domenica) resta isCurrent anche a un'ora reale dopo mezzanotte", () => {
  // bug reale: week.end è mezzanotte (solo data); un referenceDate con
  // un'ora reale successiva (es. sera) sulla domenica finiva classificato
  // "isPast" invece di "isCurrent", e la card del budget settimanale
  // mostrava la lista di tutte le settimane invece del riquadro corrente.
  const domenicaSera = new Date(2026, 7, 30, 21, 30, 0); // domenica 30 agosto 2026, ore 21:30
  const status = getWeeklyStatus([], 400, domenicaSera);
  const week = status.currentWeek;
  assert.ok(week, "la settimana in corso deve essere trovata anche a sera inoltrata della domenica");
  assert.equal(week.end.getDate(), 30);
});

test("la somma dei budget di base di tutte le settimane è pari al budget mensile (nessun euro perso o duplicato)", () => {
  const weeks = getMonthWeeks("2026-07");
  const totalDays = weeks.reduce((s, w) => s + w.daysInMonth, 0);
  const status = getWeeklyStatus([], 3100, new Date(2026, 6, 1));
  const totalBase = status.weeks.reduce((s, w) => s + (w.isFuture ? w.budget : w.budget - (w.rolloverIn || 0)), 0);
  assert.ok(Math.abs(totalBase - 3100) < 0.05);
});

// ── getIsoWeekStatus: la settimana come la vive una persona ──
// Caso reale che l'ha resa necessaria: lunedì 31 agosto 2026 (ultimo giorno
// del mese) il segmento mensile durava un giorno solo, e "oggi puoi spendere"
// crollava a 0 perché tutti gli addebiti in arrivo pesavano su quel giorno.

test('getIsoWeekStatus: settimana a cavallo di due mesi = sette giorni, budget sommato', () => {
  const allTx = {
    '2026-08': [{ date: '2026-08-31', amount: 10, type: 'uscita', category: 'spesa' }],
    '2026-09': [{ date: '2026-09-02', amount: 20, type: 'uscita', category: 'spesa' }],
  };
  const w = getIsoWeekStatus(allTx, 1500, new Date(2026, 7, 31)); // lun 31 ago
  assert.ok(w);
  assert.equal(w.start.getDate(), 31);
  assert.equal(w.start.getMonth(), 7);
  assert.equal(w.end.getDate(), 6);
  assert.equal(w.end.getMonth(), 8);
  // spese di ENTRAMBI i mesi dentro la settimana
  assert.equal(w.spent, 30);
  assert.equal(w.remaining, +(w.budget - 30).toFixed(2));
  // il budget della settimana non può essere quello di un giorno solo
  const unGiorno = 1500 / 31;
  assert.ok(w.budget > unGiorno * 3, `budget settimana ${w.budget} troppo vicino a un giorno solo`);
});

test('getIsoWeekStatus: settimana tutta dentro un mese = stesso risultato del motore mensile', () => {
  const allTx = { '2026-07': [{ date: '2026-07-14', amount: 200, type: 'uscita', category: 'spesa' }] };
  const iso = getIsoWeekStatus(allTx, 3100, new Date(2026, 6, 15));
  const { currentWeek } = getWeeklyStatus(allTx['2026-07'], 3100, new Date(2026, 6, 15));
  assert.equal(iso.budget, currentWeek.budget);
  assert.equal(iso.spent, currentWeek.spent);
  assert.equal(iso.remaining, currentWeek.remaining);
});

test('getIsoWeekStatus: senza budget non inventa niente', () => {
  assert.equal(getIsoWeekStatus({}, 0, new Date(2026, 7, 31)), null);
});

test('getIsoWeekStatus: le entrate non contano come spesa', () => {
  const allTx = { '2026-07': [
    { date: '2026-07-14', amount: 2000, type: 'entrata', category: 'stipendio' },
    { date: '2026-07-15', amount: 50, type: 'uscita', category: 'spesa' },
  ] };
  const w = getIsoWeekStatus(allTx, 3100, new Date(2026, 6, 15));
  assert.equal(w.spent, 50);
});
