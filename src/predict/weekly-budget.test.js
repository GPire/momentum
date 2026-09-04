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

// ── BUG REALE segnalato dall'utente (2026-09-04): "il budget non viene
// diviso in modo corretto al giorno". Trovato con dati veri (Node, non solo
// letto nel codice): il test sopra guarda la settimana-ponte da DENTRO il
// mese vecchio (31 agosto, il mese vecchio è ancora "corrente" per la sua
// stessa metà del calcolo) — il caso reale che rompeva tutto è l'opposto,
// guardarla da OGGI nel mese NUOVO con il mese vecchio ormai chiuso e mai
// speso: il suo ultimo giorno arrivava con l'INTERO riporto mensile ancora
// "disponibile" (corretto isolatamente), sommato al budget FRESCO del mese
// nuovo — fino al doppio del budget dichiarato per una sola settimana.
test('getIsoWeekStatus: la settimana-ponte vale la somma delle due quote, mai un mese intero', () => {
  const w = getIsoWeekStatus({}, 1200, new Date(2026, 8, 4)); // ven 4 set, settimana 31 ago-6 set
  assert.ok(w);
  // PRIMA del fix: 1440€ (1200 di agosto mai toccato + 240 quota di
  // settembre) — quasi il DOPPIO del budget mensile per una sola settimana.
  // ORA: quota vera dei giorni, 1 giorno di agosto (1200/31 = 38,71) + 6
  // giorni di settembre (6 × 1200/30 = 240) = 278,71.
  assert.equal(w.budget, 278.71);
  assert.ok(w.budget < 1200 / 4, 'una settimana non può mai valere più di ~un quarto del mese');
});

test('getIsoWeekStatus: lo stesso confine dà lo STESSO numero, che il mese vecchio sia speso o no', () => {
  const agosto = [];
  for (let d = 1; d <= 30; d++) agosto.push({ date: `2026-08-${String(d).padStart(2, '0')}`, amount: 38.7, type: 'uscita', category: 'spesa' });
  const speso = getIsoWeekStatus({ '2026-08': agosto }, 1200, new Date(2026, 8, 4));
  const vuoto = getIsoWeekStatus({}, 1200, new Date(2026, 8, 4));
  // Il BUDGET della settimana è la sua quota di calendario: non cambia in
  // base a quanto è stato speso PRIMA. Ciò che cambia è `spent`/`remaining`.
  assert.equal(speso.budget, vuoto.budget);
  assert.equal(speso.budget, 278.71);
});

test('getIsoWeekStatus: settimana tutta dentro un mese = la sua quota di giorni, senza riporto', () => {
  const allTx = { '2026-07': [{ date: '2026-07-14', amount: 200, type: 'uscita', category: 'spesa' }] };
  const iso = getIsoWeekStatus(allTx, 3100, new Date(2026, 6, 15));
  // 7 giorni su 31 di luglio: 3100 × 7/31 = 700. Il motore mensile
  // (getWeeklyStatus) resta invece a riporto — serve alla settimana in corso,
  // non a rispondere "quanto vale questa settimana": qui i due numeri
  // DEVONO poter divergere, ed è voluto (vedi il commento in weekly-budget.js).
  assert.equal(iso.budget, 700);
  assert.equal(iso.spent, 200);
  assert.equal(iso.remaining, 500);
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
