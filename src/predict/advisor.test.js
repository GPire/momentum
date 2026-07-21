import test from 'node:test';
import assert from 'node:assert/strict';

// Shim minimo per moduli scritti per il browser (stesso pattern degli altri
// test del progetto: constants.js tocca window all'import).
globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { getUpcomingCharges, getDailySafeToSpend, getMonthEndProjection, getAdvisorInsights, getMonthlyCommitments } = await import('./advisor.js');

// Date fisse, mai new Date() nei test.
// Mercoledì 15 luglio 2026: metà mese, metà settimana (lun 13 - dom 19).
const REF = new Date(2026, 6, 15);

function tx(date, amount, description, type = 'uscita', category = 'Svago') {
  return { date, amount, description, type, category };
}

// Serie mensile Netflix: 3 addebiti il giorno 17 → prossimo atteso ~17 luglio.
function netflixHistory() {
  return {
    '2026-04': [tx('2026-04-17', 12.99, 'NETFLIX.COM')],
    '2026-05': [tx('2026-05-17', 12.99, 'NETFLIX.COM')],
    '2026-06': [tx('2026-06-17', 12.99, 'NETFLIX.COM')],
  };
}

test('getMonthlyCommitments: riserva impegni ricorrenti fino a fine mese (incl. uscite grandi)', () => {
  // Affitto grande + Netflix piccolo, entrambi mensili, prossimi entro fine mese.
  const allTx = {
    '2026-04': [tx('2026-04-05', 800, 'AFFITTO', 'uscita', 'Casa'), tx('2026-04-17', 12.99, 'NETFLIX.COM')],
    '2026-05': [tx('2026-05-05', 800, 'AFFITTO', 'uscita', 'Casa'), tx('2026-05-17', 12.99, 'NETFLIX.COM')],
    '2026-06': [tx('2026-06-05', 800, 'AFFITTO', 'uscita', 'Casa'), tx('2026-06-17', 12.99, 'NETFLIX.COM')],
  };
  const c = getMonthlyCommitments(allTx, new Date(2026, 6, 1)); // 1 luglio → affitto ~5, netflix ~17 in arrivo
  assert.ok(c.reserved >= 812, `riserva attesa ~812,99, avuto ${c.reserved}`);
  assert.ok(c.count >= 2);
  assert.equal(c.top[0].name, 'AFFITTO'); // l'impegno più grande in cima (per la UI)
});

test('getMonthlyCommitments: nessuna storia ricorrente → riserva 0 (niente invenzioni)', () => {
  const c = getMonthlyCommitments({ '2026-07': [tx('2026-07-03', 20, 'Spesa una tantum', 'uscita', 'Cibo')] }, new Date(2026, 6, 5));
  assert.equal(c.reserved, 0);
  assert.equal(c.count, 0);
});

test('getUpcomingCharges: abbonamento mensile atteso entro la finestra', () => {
  const charges = getUpcomingCharges(netflixHistory(), REF, 7);
  assert.equal(charges.length, 1);
  assert.equal(charges[0].amount, 12.99);
  assert.ok(charges[0].daysUntil >= 0 && charges[0].daysUntil <= 7);
});

test('getUpcomingCharges: fuori finestra se il prossimo addebito è lontano', () => {
  // Ultimo addebito il 10 luglio → prossimo ~10 agosto, ben oltre 7 giorni.
  const allTx = {
    '2026-05': [tx('2026-05-10', 9.99, 'SPOTIFY')],
    '2026-06': [tx('2026-06-10', 9.99, 'SPOTIFY')],
    '2026-07': [tx('2026-07-10', 9.99, 'SPOTIFY')],
  };
  assert.equal(getUpcomingCharges(allTx, REF, 7).length, 0);
});

test('getUpcomingCharges: usa l\'ULTIMO importo, non la media (cattura aumenti)', () => {
  const allTx = {
    '2026-04': [tx('2026-04-17', 9.99, 'NETFLIX.COM')],
    '2026-05': [tx('2026-05-17', 9.99, 'NETFLIX.COM')],
    '2026-06': [tx('2026-06-17', 14.99, 'NETFLIX.COM')],
  };
  const charges = getUpcomingCharges(allTx, REF, 7);
  assert.equal(charges[0].amount, 14.99);
});

test('getUpcomingCharges: addebito leggermente in ritardo incluso con daysUntil 0', () => {
  // Atteso il 13 luglio (2 giorni fa rispetto a REF): non ancora visto → può
  // arrivare da un momento all'altro, va riservato.
  const allTx = {
    '2026-04': [tx('2026-04-13', 7.99, 'DISNEY PLUS')],
    '2026-05': [tx('2026-05-13', 7.99, 'DISNEY PLUS')],
    '2026-06': [tx('2026-06-13', 7.99, 'DISNEY PLUS')],
  };
  const charges = getUpcomingCharges(allTx, REF, 7);
  assert.equal(charges.length, 1);
  assert.equal(charges[0].daysUntil, 0);
});

test('getDailySafeToSpend: senza ricorrenti = rimanente/giorni rimasti', () => {
  // Budget 3100 su luglio (31 giorni) → 100€/giorno di base.
  // Settimana corrente 13-19 lug (7 giorni, tutti nel mese) → base 700€.
  // Le settimane precedenti (1-5, 6-12) sono passate senza spese → riporto
  // completo in avanti: 500 + 700 = 1200 di riporto entrante.
  const monthTxs = [tx('2026-07-14', 200, 'Spesa grossa')];
  const res = getDailySafeToSpend({ monthTxs, allTx: {}, monthlyBudget: 3100, referenceDate: REF });
  assert.ok(res);
  // budget settimana = 700 (base) + 1200 (riporto) = 1900; speso 200 → restano 1700.
  assert.equal(res.weekRemaining, 1700);
  assert.equal(res.daysLeftInWeek, 5); // mer 15 → dom 19, oggi incluso
  assert.equal(res.safeToday, 340); // 1700/5
  assert.equal(res.reservedForCharges, 0);
  assert.equal(res.isOverBudget, false);
});

test('getDailySafeToSpend: l\'abbonamento in arrivo riduce il numero di oggi', () => {
  const allTx = netflixHistory(); // atteso ~17 lug, entro fine settimana (19)
  const monthTxs = [tx('2026-07-14', 200, 'Spesa grossa')];
  const con = getDailySafeToSpend({ monthTxs, allTx, monthlyBudget: 3100, referenceDate: REF });
  const senza = getDailySafeToSpend({ monthTxs, allTx: {}, monthlyBudget: 3100, referenceDate: REF });
  assert.equal(con.reservedForCharges, 12.99);
  assert.ok(con.safeToday < senza.safeToday);
});

test('getDailySafeToSpend: settimana sforata → 0 e flag', () => {
  // Spese enormi: la settimana è oltre il budget.
  const monthTxs = [tx('2026-07-14', 99999, 'Follia')];
  const res = getDailySafeToSpend({ monthTxs, allTx: {}, monthlyBudget: 1000, referenceDate: REF });
  assert.equal(res.safeToday, 0);
  assert.equal(res.isOverBudget, true);
  assert.ok(res.weekRemaining < 0);
});

test('getDailySafeToSpend: null senza budget impostato (mai un numero inventato)', () => {
  assert.equal(getDailySafeToSpend({ monthTxs: [], allTx: {}, monthlyBudget: 0, referenceDate: REF }), null);
});

test('getDailySafeToSpend: mai NaN, anche l\'ultimo giorno della settimana', () => {
  const sunday = new Date(2026, 6, 19);
  const res = getDailySafeToSpend({ monthTxs: [], allTx: {}, monthlyBudget: 1000, referenceDate: sunday });
  assert.ok(Number.isFinite(res.safeToday));
  assert.equal(res.daysLeftInWeek, 1);
});

test('getMonthEndProjection: run-rate quando manca il forecast', () => {
  // 15 giorni trascorsi, 150€ spesi → 10€/giorno → 16 giorni restanti = +160.
  const monthTxs = [tx('2026-07-10', 150, 'Spese varie')];
  const proj = getMonthEndProjection({ monthTxs, monthlyBudget: 400, referenceDate: REF });
  assert.equal(proj.method, 'run-rate');
  assert.equal(proj.spentSoFar, 150);
  assert.equal(proj.projectedTotal, 310); // 150 + 10*16
  assert.equal(proj.projectedDelta, 90);
  assert.equal(proj.willOverspend, false);
});

test('getMonthEndProjection: usa Holt-Winters quando disponibile e lo dichiara', () => {
  const monthTxs = [tx('2026-07-10', 150, 'Spese varie')];
  const proj = getMonthEndProjection({ monthTxs, monthlyBudget: 400, referenceDate: REF, hwDailyLevel: 20 });
  assert.equal(proj.method, 'holt-winters');
  assert.equal(proj.projectedTotal, 470); // 150 + 20*16
  assert.equal(proj.willOverspend, true);
});

test('getMonthEndProjection: primo giorno del mese, nessuna divisione per zero', () => {
  const first = new Date(2026, 6, 1);
  const proj = getMonthEndProjection({ monthTxs: [tx('2026-07-01', 30, 'Caffè')], monthlyBudget: 400, referenceDate: first });
  assert.ok(Number.isFinite(proj.projectedTotal));
  assert.equal(proj.spentSoFar, 30);
  assert.equal(proj.projectedTotal, 930); // 30 + 30*30
});

test('getMonthEndProjection: ultimo giorno del mese → proiezione = speso', () => {
  const last = new Date(2026, 6, 31);
  const proj = getMonthEndProjection({ monthTxs: [tx('2026-07-15', 500, 'Spese')], monthlyBudget: 400, referenceDate: last });
  assert.equal(proj.daysRemaining, 0);
  assert.equal(proj.projectedTotal, 500);
});

test('getAdvisorInsights: ordina per gravità e produce il safe-to-spend', () => {
  const monthTxs = [tx('2026-07-14', 99999, 'Follia')];
  const insights = getAdvisorInsights({ allTx: { '2026-07': monthTxs }, monthTxs, monthlyBudget: 1000, referenceDate: REF });
  assert.ok(insights.length >= 2); // safe-to-spend (danger) + month-end (warn)
  assert.equal(insights[0].severity, 'danger');
  assert.equal(insights[0].kind, 'safe-to-spend');
  for (let i = 1; i < insights.length; i++) {
    const rank = { danger: 0, warn: 1, info: 2 };
    assert.ok(rank[insights[i].severity] >= rank[insights[i - 1].severity]);
  }
});

test('getAdvisorInsights: senza budget nessuna card inventata', () => {
  const insights = getAdvisorInsights({ allTx: {}, monthTxs: [], monthlyBudget: 0, referenceDate: REF });
  assert.equal(insights.length, 0);
});

// ---- getSweepSuggestion (sweep salvadanaio → obiettivi) ----

const { getSweepSuggestion } = await import('./advisor.js');

test('sweep: avanzo della settimana scorsa → proposta con importo esatto', () => {
  // REF mercoledì 15 lug: settimana scorsa = 6-12 lug. Budget 3100 (100/gg):
  // w1 (1-5 lug, 5gg) base 500, spese 100 → riporto 400; w2 (6-12) base 700
  // +400 = 1100, spese 300 → avanzo 800.
  const allTx = { '2026-07': [
    tx('2026-07-03', 100, 'Spese w1'),
    tx('2026-07-08', 300, 'Spese w2'),
  ]};
  const s = getSweepSuggestion({ allTx, monthlyBudget: 3100, savingsGoals: [{ id: 9, name: 'Vacanza' }], referenceDate: REF });
  assert.ok(s);
  assert.equal(s.amount, 800);
  assert.equal(s.goalName, 'Vacanza');
  assert.equal(s.weekKey, '2026-07-13'); // lunedì della settimana corrente
});

test('sweep: settimana scorsa sforata → nessuna proposta', () => {
  const allTx = { '2026-07': [tx('2026-07-08', 99999, 'Follia')] };
  assert.equal(getSweepSuggestion({ allTx, monthlyBudget: 1000, referenceDate: REF }), null);
});

test('sweep: già fatto questa settimana → non riproporre', () => {
  const allTx = { '2026-07': [tx('2026-07-08', 10, 'Poco')] };
  const s = getSweepSuggestion({ allTx, monthlyBudget: 3100, lastSweepWeek: '2026-07-13', referenceDate: REF });
  assert.equal(s, null);
});

test('sweep: senza budget → null (mai proposte inventate)', () => {
  assert.equal(getSweepSuggestion({ allTx: {}, monthlyBudget: 0, referenceDate: REF }), null);
});
