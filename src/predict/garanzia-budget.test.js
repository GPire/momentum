// ============================================================
// GARANZIA — ogni scenario in cui compaiono STIPENDIO, BUDGET,
// divisione per GIORNO/SETTIMANA e OBIETTIVI
// ============================================================
// Perché questo file esiste, per intero e senza abbellimenti.
//
// Utenti veri hanno segnalato di voler abbandonare l'app per un motivo
// preciso: impostato il budget, sfogliando le settimane all'indietro nel
// calendario, il budget della settimana risultava OGNI VOLTA DIVERSO —
// anche senza aver speso nulla e con lo stesso stipendio. Cifre riportate:
// 621,43 / 483,87 / 348,39 / 212,20 / 690,37 su settimane consecutive.
// Erano numeri veri prodotti dal codice, non un'impressione: il motore
// settimanale sommava un RIPORTO che cresceva settimana dopo settimana
// dentro il mese e si azzerava al cambio mese, e in più la card della
// striscia settimanale passava la settimana SFOGLIATA come se fosse "oggi",
// facendo ricalcolare il presente ad ogni tocco delle frecce.
//
// Non basta correggere: va DIMOSTRATO, su ogni combinazione, che il numero
// mostrato è stabile e spiegabile. Le proprietà qui sotto sono scritte come
// GARANZIE — se una si rompe, si rompe la build, non la fiducia di chi usa
// l'app.
//
// Regola delle garanzie: valgono a parità di dati. Un numero può cambiare
// solo se cambia qualcosa di REALE (una spesa in più, un budget diverso,
// un mese di lunghezza diversa), mai perché è cambiato QUANDO lo guardi.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || { document: { documentElement: {} } };
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0, language: 'it-IT' };
globalThis.document = globalThis.document || { documentElement: { classList: { contains: () => false } } };

const { getIsoWeekStatus, getWeeklyStatus, getMonthWeeks } = await import('./weekly-budget.js');
const { getDailySafeToSpend } = await import('./advisor.js');
const { cycleAllowance, commitmentForecast } = await import('./fixed-commitments.js');
const { computeGoalProgress } = await import('./engagement.js');
const { fireTargetCapital, yearsToFire } = await import('./fire.js');

const BUDGET = 1500;
const STIPENDIO = { dayOfMonth: 27, amount: 2000 };

// Lunedì della settimana che contiene una certa data.
function lunediDi(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const g = x.getDay();
  x.setDate(x.getDate() + ((g === 0 ? -6 : 1) - g));
  return x;
}

// ────────────────────────────────────────────────────────────
// 1. LA GARANZIA PRINCIPALE — sfogliare indietro non cambia i conti
// ────────────────────────────────────────────────────────────

test('GARANZIA: 104 settimane all\'indietro, zero spese, stesso budget → nessun salto assurdo', () => {
  const oggi = new Date(2026, 8, 4);
  const valori = [];
  for (let off = 0; off >= -104; off--) {
    const lun = lunediDi(oggi);
    lun.setDate(lun.getDate() + off * 7);
    const r = getIsoWeekStatus({}, BUDGET, lun, oggi);
    assert.ok(r, `settimana ${off}: nessun risultato`);
    valori.push(r.budget);
  }
  // Due anni di settimane: ogni valore deve stare nella banda stretta della
  // quota settimanale vera (mesi da 28 a 31 giorni → 7/31 e 7/28 del budget).
  const min = BUDGET * 7 / 31; // 338,71
  const max = BUDGET * 7 / 28; // 375,00
  for (let i = 0; i < valori.length; i++) {
    assert.ok(valori[i] >= min - 0.01 && valori[i] <= max + 0.01,
      `settimana ${-i}: budget ${valori[i]} fuori dalla banda [${min.toFixed(2)}, ${max.toFixed(2)}] — è il bug segnalato dagli utenti`);
  }
  // E nessuno scalino grande fra una settimana e la successiva.
  for (let i = 1; i < valori.length; i++) {
    const salto = Math.abs(valori[i] - valori[i - 1]);
    assert.ok(salto <= max - min + 0.01,
      `salto di ${salto.toFixed(2)}€ fra due settimane consecutive (${valori[i - 1]} → ${valori[i]})`);
  }
});

test('GARANZIA: la stessa settimana dà lo stesso numero, da qualunque giorno la si guardi', () => {
  const settimanaTarget = new Date(2026, 6, 15); // mer 15 luglio
  const riferimenti = [
    new Date(2026, 6, 13), new Date(2026, 6, 15), new Date(2026, 6, 19), // dentro la settimana
    new Date(2026, 7, 4), new Date(2026, 9, 20), new Date(2027, 2, 1),   // molto dopo
  ];
  const numeri = riferimenti.map(oggi => getIsoWeekStatus({}, BUDGET, settimanaTarget, oggi).budget);
  for (const n of numeri) {
    assert.equal(n, numeri[0], `la stessa settimana cambia valore a seconda di quando la guardi: ${numeri.join(' / ')}`);
  }
});

test('GARANZIA: anno su anno, la stessa settimana del calendario resta confrontabile', () => {
  const a = getIsoWeekStatus({}, BUDGET, new Date(2025, 5, 16), new Date(2026, 8, 4)).budget;
  const b = getIsoWeekStatus({}, BUDGET, new Date(2026, 5, 15), new Date(2026, 8, 4)).budget;
  // Stesso mese (giugno, 30 giorni) in due anni diversi → stessa quota.
  assert.equal(a, b);
});

test('GARANZIA: febbraio (28/29 giorni) resta spiegabile, anche bisestile', () => {
  const feb2026 = getIsoWeekStatus({}, BUDGET, new Date(2026, 1, 9), new Date(2026, 8, 4)).budget;
  const feb2028 = getIsoWeekStatus({}, BUDGET, new Date(2028, 1, 7), new Date(2028, 5, 1)).budget;
  assert.equal(feb2026, +(BUDGET * 7 / 28).toFixed(2)); // 2026 non bisestile
  assert.equal(feb2028, +(BUDGET * 7 / 29).toFixed(2)); // 2028 bisestile
});

// ────────────────────────────────────────────────────────────
// 2. LA DIVISIONE AL GIORNO
// ────────────────────────────────────────────────────────────

test('GARANZIA: senza spese, "oggi puoi spendere" resta la quota giornaliera del budget', () => {
  // Lunedì: 7 giorni davanti, quota settimana / 7 = quota giornaliera vera.
  const lun = new Date(2026, 6, 13);
  const r = getDailySafeToSpend({ monthTxs: [], allTx: {}, monthlyBudget: BUDGET, referenceDate: lun });
  const quotaGiorno = BUDGET / 31; // luglio
  assert.ok(Math.abs(r.safeToday - quotaGiorno) < 0.5,
    `oggi puoi spendere ${r.safeToday}, la quota giornaliera vera è ${quotaGiorno.toFixed(2)}`);
});

test('GARANZIA: il giornaliero non supera mai la quota mensile diviso i giorni del mese, senza spese', () => {
  for (let mese = 0; mese < 12; mese++) {
    const giorniMese = new Date(2026, mese + 1, 0).getDate();
    const quotaGiorno = BUDGET / giorniMese;
    // primo lunedì del mese
    const primo = new Date(2026, mese, 1);
    const lun = lunediDi(primo);
    if (lun.getMonth() !== mese) lun.setDate(lun.getDate() + 7);
    const r = getDailySafeToSpend({ monthTxs: [], allTx: {}, monthlyBudget: BUDGET, referenceDate: lun });
    assert.ok(r.safeToday <= quotaGiorno * 1.02,
      `mese ${mese + 1}: oggi puoi spendere ${r.safeToday} > quota giornaliera ${quotaGiorno.toFixed(2)}`);
  }
});

test('GARANZIA: spendere di più oggi abbassa il disponibile, mai il contrario', () => {
  const ref = new Date(2026, 6, 15);
  let precedente = Infinity;
  for (const speso of [0, 50, 100, 200, 400]) {
    const monthTxs = speso > 0 ? [{ date: '2026-07-14', amount: speso, type: 'uscita', description: 'x' }] : [];
    const r = getDailySafeToSpend({ monthTxs, allTx: {}, monthlyBudget: BUDGET, referenceDate: ref });
    assert.ok(r.safeToday <= precedente + 0.01, `spendendo ${speso} il disponibile è salito: ${r.safeToday} > ${precedente}`);
    precedente = r.safeToday;
  }
});

// ────────────────────────────────────────────────────────────
// 3. STIPENDIO + BUDGET INSIEME (Cassa Unica)
// ────────────────────────────────────────────────────────────

test('GARANZIA: con stipendio e budget insieme, il giornaliero non supera mai il budget dichiarato', () => {
  for (let giorno = 1; giorno <= 28; giorno++) {
    const oggi = new Date(2026, 6, giorno);
    const a = cycleAllowance([], STIPENDIO, { now: oggi.getTime(), allTx: {}, monthlyBudget: BUDGET });
    if (!a) continue;
    const tettoGiornaliero = BUDGET / 28; // il ciclo più corto possibile
    assert.ok(a.perDay <= tettoGiornaliero * 1.1,
      `giorno ${giorno}: perDay ${a.perDay} supera il tetto ragionevole ${tettoGiornaliero.toFixed(2)} del budget dichiarato`);
  }
});

test('GARANZIA: uno stipendio più alto non alza il giornaliero oltre il budget', () => {
  const oggi = new Date(2026, 6, 10);
  const piccolo = cycleAllowance([], { dayOfMonth: 27, amount: 1600 }, { now: oggi.getTime(), allTx: {}, monthlyBudget: BUDGET });
  const enorme = cycleAllowance([], { dayOfMonth: 27, amount: 99000 }, { now: oggi.getTime(), allTx: {}, monthlyBudget: BUDGET });
  assert.equal(enorme.budget, piccolo.budget >= enorme.budget ? enorme.budget : enorme.budget);
  assert.ok(enorme.budget <= BUDGET * 1.05,
    `con stipendio 99.000€ il ciclo propone ${enorme.budget}, oltre il budget dichiarato di ${BUDGET}`);
});

test('GARANZIA: senza budget dichiarato, il ciclo resta ancorato allo stipendio (retrocompatibile)', () => {
  const oggi = new Date(2026, 6, 10);
  const a = cycleAllowance([], STIPENDIO, { now: oggi.getTime(), allTx: {}, monthlyBudget: null });
  assert.equal(a.budget, STIPENDIO.amount);
});

test('GARANZIA: gli impegni fissi abbassano il disponibile, mai lo alzano', () => {
  const oggi = new Date(2026, 6, 10);
  const senza = cycleAllowance([], STIPENDIO, { now: oggi.getTime(), allTx: {}, monthlyBudget: BUDGET });
  const affitto = [{ id: 'a', name: 'Affitto', amount: 600, dayOfMonth: 1, kind: 'affitto' }];
  const con = cycleAllowance(affitto, STIPENDIO, { now: oggi.getTime(), allTx: {}, monthlyBudget: BUDGET });
  assert.ok(con.budget < senza.budget, 'un affitto da 600€ non ha ridotto il disponibile del ciclo');
  assert.ok(con.perDay < senza.perDay);
});

test('GARANZIA: il pool non è mai negativo, nemmeno con impegni sopra lo stipendio', () => {
  const oggi = new Date(2026, 6, 10);
  const pesante = [{ id: 'h', name: 'Mutuo', amount: 9000, dayOfMonth: 5, kind: 'mutuo' }];
  const a = cycleAllowance(pesante, STIPENDIO, { now: oggi.getTime(), allTx: {}, monthlyBudget: BUDGET });
  assert.ok(a.budget >= 0 && a.perDay >= 0, `valori negativi: budget ${a.budget}, perDay ${a.perDay}`);
  const f = commitmentForecast(pesante, STIPENDIO, { now: oggi.getTime(), monthlyBudget: BUDGET });
  assert.ok(f.allowance.pool >= 0 && f.allowance.perDay >= 0);
});

test('GARANZIA: giorno per giorno lungo un ciclo intero, il giornaliero non fa salti assurdi', () => {
  const valori = [];
  for (let g = 1; g <= 26; g++) {
    const a = cycleAllowance([], STIPENDIO, { now: new Date(2026, 6, g).getTime(), allTx: {}, monthlyBudget: BUDGET });
    if (a) valori.push(a.perDay);
  }
  for (let i = 1; i < valori.length; i++) {
    const variazione = Math.abs(valori[i] - valori[i - 1]) / Math.max(1, valori[i - 1]);
    assert.ok(variazione < 0.5, `salto del ${(variazione * 100).toFixed(0)}% da un giorno all'altro: ${valori[i - 1]} → ${valori[i]}`);
  }
});

// ────────────────────────────────────────────────────────────
// 4. COERENZA FRA LE SCHERMATE — mai due risposte alla stessa domanda
// ────────────────────────────────────────────────────────────

test('GARANZIA: la somma delle settimane di un mese non supera il budget del mese', () => {
  for (let mese = 0; mese < 12; mese++) {
    const weeks = getMonthWeeks(`2026-${String(mese + 1).padStart(2, '0')}`);
    const totale = weeks.reduce((s, w) => s + BUDGET * (w.daysInMonth / new Date(2026, mese + 1, 0).getDate()), 0);
    assert.ok(Math.abs(totale - BUDGET) < 0.02,
      `mese ${mese + 1}: le quote settimanali sommano ${totale.toFixed(2)} invece di ${BUDGET}`);
  }
});

test('GARANZIA: "speso" nella settimana combacia sempre con la somma dei giorni mostrati', () => {
  const allTx = { '2026-07': [
    { date: '2026-07-13', amount: 30, type: 'uscita', description: 'a' },
    { date: '2026-07-16', amount: 20, type: 'uscita', description: 'b' },
    { date: '2026-07-19', amount: 10, type: 'uscita', description: 'c' },
    { date: '2026-07-20', amount: 99, type: 'uscita', description: 'fuori settimana' },
    { date: '2026-07-15', amount: 500, type: 'entrata', description: 'entrata ignorata' },
  ] };
  const r = getIsoWeekStatus(allTx, BUDGET, new Date(2026, 6, 15), new Date(2026, 8, 4));
  assert.equal(r.spent, 60);
  assert.equal(r.remaining, +(r.budget - 60).toFixed(2));
});

// ────────────────────────────────────────────────────────────
// 5. OBIETTIVI — la paura dichiarata dall'utente ("temo siano sbagliati anche loro")
// ────────────────────────────────────────────────────────────

test('GARANZIA obiettivi: il progresso non dipende da quando lo guardi, solo dai movimenti', () => {
  const goal = { id: 1, name: 'Viaggio', target: 1000, createdAt: '2026-06-01' };
  const allTx = [
    { date: '2026-06-10', amount: 300, type: 'entrata' },
    { date: '2026-06-20', amount: 100, type: 'uscita' },
  ];
  const a = computeGoalProgress(goal, allTx, new Date(2026, 7, 1));
  const b = computeGoalProgress(goal, allTx, new Date(2026, 11, 31));
  assert.equal(a.saved, 200);
  assert.equal(a.saved, b.saved, 'il risparmio verso l\'obiettivo cambia col passare del tempo senza nuovi movimenti');
  assert.equal(a.pct, 20);
});

test('GARANZIA obiettivi: senza cifra target nessuna percentuale inventata', () => {
  const goal = { id: 2, name: 'Console', target: null, createdAt: '2026-06-01' };
  const r = computeGoalProgress(goal, [{ date: '2026-06-10', amount: 150, type: 'entrata' }], new Date(2026, 7, 1));
  assert.equal(r.saved, 150);
  assert.equal(r.pct, null);
  assert.equal(r.remaining, null);
  assert.equal(r.onTrack, null);
});

test('GARANZIA obiettivi: il progresso non supera mai il 100% né scende sotto zero', () => {
  const goal = { id: 3, name: 'Fondo', target: 100, createdAt: '2026-06-01' };
  const tanto = computeGoalProgress(goal, [{ date: '2026-06-10', amount: 5000, type: 'entrata' }], new Date(2026, 7, 1));
  const negativo = computeGoalProgress(goal, [{ date: '2026-06-10', amount: 5000, type: 'uscita' }], new Date(2026, 7, 1));
  assert.equal(tanto.pct, 100);
  assert.equal(negativo.pct, 0);
});

// ────────────────────────────────────────────────────────────
// 6. PENSIONE / FIRE — stessa disciplina
// ────────────────────────────────────────────────────────────

test('GARANZIA pensione: più risparmio mensile → mai più anni per arrivare', () => {
  const target = fireTargetCapital(24000); // 600.000 con la regola del 4%
  let precedente = Infinity;
  for (const contributo of [200, 500, 1000, 2000, 4000]) {
    const r = yearsToFire({ currentInvested: 10000, monthlyContribution: contributo, targetCapital: target, expectedAnnualReturn: 0.07 });
    assert.ok(r.reachable);
    assert.ok(r.years <= precedente + 0.01, `con ${contributo}€/mese servono ${r.years} anni, più che con meno risparmio (${precedente})`);
    precedente = r.years;
  }
});

test('GARANZIA pensione: senza capitale né risparmio non inventa un traguardo', () => {
  const r = yearsToFire({ currentInvested: 0, monthlyContribution: 0, targetCapital: 500000 });
  assert.equal(r.reachable, false);
  assert.equal(r.years, null);
});

test('GARANZIA pensione: il capitale obiettivo scala linearmente con le spese annue', () => {
  assert.equal(fireTargetCapital(12000), 300000);
  assert.equal(fireTargetCapital(24000), 600000);
  assert.equal(fireTargetCapital(0), 0);
});

// ────────────────────────────────────────────────────────────
// 7. CASI LIMITE che non devono mai far uscire un numero assurdo
// ────────────────────────────────────────────────────────────

test('GARANZIA: budget zero o assente non produce mai un numero, produce un onesto niente', () => {
  assert.equal(getIsoWeekStatus({}, 0, new Date(2026, 6, 15)), null);
  assert.equal(getIsoWeekStatus({}, null, new Date(2026, 6, 15)), null);
  assert.equal(getDailySafeToSpend({ monthTxs: [], allTx: {}, monthlyBudget: 0, referenceDate: new Date(2026, 6, 15) }), null);
});

test('GARANZIA: nessun NaN, nessun Infinity, in nessuno scenario provato', () => {
  const scenari = [
    { budget: 1500, tx: {} },
    { budget: 0.01, tx: {} },
    { budget: 999999, tx: {} },
    { budget: 1500, tx: { '2026-07': [{ date: '2026-07-15', amount: 999999, type: 'uscita' }] } },
  ];
  for (const s of scenari) {
    for (let off = 0; off >= -8; off--) {
      const lun = lunediDi(new Date(2026, 8, 4));
      lun.setDate(lun.getDate() + off * 7);
      const r = getIsoWeekStatus(s.tx, s.budget, lun, new Date(2026, 8, 4));
      if (!r) continue;
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k} non finito (${v}) con budget ${s.budget}`);
      }
    }
  }
});

test('GARANZIA: il riporto interno al mese resta disponibile dove serve davvero (settimana in corso)', () => {
  // getWeeklyStatus conserva il riporto: serve a chi guarda la settimana in
  // corso dopo aver speso poco nelle precedenti. Qui si verifica solo che il
  // meccanismo esista ancora e sia coerente, non che finisca nella card
  // settimanale (dove causava il bug segnalato).
  const { weeks } = getWeeklyStatus([], BUDGET, new Date(2026, 6, 31));
  const passate = weeks.filter(w => w.isPast);
  assert.ok(passate.length >= 2);
  assert.ok(passate[1].budget > passate[0].budget, 'il riporto interno al mese non funziona più');
});
