import test from 'node:test';
import assert from 'node:assert/strict';

const { remainingInstallments, payoffDate, isActive, residualApprox, nextOccurrence,
  commitmentsDueBetween, commitmentForecast, matchCommitmentInMonth, reconcileCommitments,
  learnCommitmentAmount, enrichCommitmentsWithLearning, cycleAllowance } = await import('./fixed-commitments.js');

const mutuo = { id: 'm1', name: 'Mutuo casa', amount: 650, dayOfMonth: 5, kind: 'mutuo', startDate: '2024-01-05', termMonths: 240 };
const prestito = { id: 'p1', name: 'Prestito auto', amount: 210, dayOfMonth: 10, kind: 'prestito', startDate: '2025-06-10', termMonths: 24 };
const affitto = { id: 'a1', name: 'Affitto', amount: 500, dayOfMonth: 1, kind: 'affitto' }; // aperto

// ── rate residue / estinzione ────────────────────────────────────────────────
test('remainingInstallments: conta le rate residue di un prestito finito', () => {
  // prestito 24 rate da giugno 2025; a luglio 2026 sono passati 13 mesi → 11 residue
  const now = Date.parse('2026-07-15');
  assert.equal(remainingInstallments(prestito, now), 11);
});

test('remainingInstallments: null per un impegno aperto (affitto)', () => {
  assert.equal(remainingInstallments(affitto, Date.now()), null);
});

test('payoffDate: data di estinzione = ultima rata', () => {
  // prestito parte 2025-06-10, 24 rate → ultima rata maggio 2027
  assert.equal(payoffDate(prestito), '2027-05-10');
});

test('isActive: un prestito già estinto non è più attivo', () => {
  const finito = { ...prestito, startDate: '2020-01-10', termMonths: 12 };
  assert.equal(isActive(finito, Date.parse('2026-07-01')), false);
  assert.equal(isActive(prestito, Date.parse('2026-07-01')), true);
});

test('residualApprox: stima lineare rate residue × importo (dichiarata approssimata)', () => {
  const now = Date.parse('2026-07-15');
  assert.equal(residualApprox(prestito, now), 11 * 210);
});

// ── occorrenze nel tempo ─────────────────────────────────────────────────────
test('nextOccurrence: la prossima rata dopo una data', () => {
  const occ = nextOccurrence(mutuo, Date.parse('2026-07-15')); // il 5 è passato → agosto
  assert.equal(occ.date, '2026-08-05');
  assert.equal(occ.amount, 650);
});

test('nextOccurrence: null se l\'impegno è già estinto', () => {
  const finito = { ...prestito, startDate: '2020-01-10', termMonths: 6 };
  assert.equal(nextOccurrence(finito, Date.parse('2026-07-01')), null);
});

test('clamp giorno 31: a febbraio la rata cade il 28 (o 29)', () => {
  const c = { id: 'x', name: 'X', amount: 100, dayOfMonth: 31, kind: 'abbonamento' };
  const occ = nextOccurrence(c, Date.parse('2026-02-10'));
  assert.equal(occ.date, '2026-02-28'); // 2026 non bisestile
});

test('commitmentsDueBetween: elenca le rate nella finestra, ordinate', () => {
  const from = Date.parse('2026-07-01'), to = Date.parse('2026-07-31');
  const due = commitmentsDueBetween([mutuo, prestito, affitto], from, to);
  const dates = due.map(d => `${d.name}@${d.date}`);
  assert.deepEqual(dates, ['Affitto@2026-07-01', 'Mutuo casa@2026-07-05', 'Prestito auto@2026-07-10']);
});

// ── forecast preciso al giorno ───────────────────────────────────────────────
test('commitmentForecast: quanto serve PRIMA dello stipendio', () => {
  const now = Date.parse('2026-07-03'); // stipendio il 27; mutuo il 5, prestito il 10 ancora da pagare
  const salary = { dayOfMonth: 27, amount: 1800 };
  const f = commitmentForecast([mutuo, prestito, affitto], salary, { now });
  assert.equal(f.payday.date, '2026-07-27');
  // prima del 27 cadono: mutuo 5 (650) + prestito 10 (210) = 860 (affitto 1 già passato il 1)
  assert.equal(f.dueBeforePaydayTotal, 860);
  assert.ok(f.dueBeforePayday.some(o => o.name === 'Mutuo casa'));
});

test('commitmentForecast: segnala gli impegni in via di estinzione', () => {
  const now = Date.parse('2027-03-15'); // prestito (fino a mag 2027) → 2 rate residue
  const f = commitmentForecast([mutuo, prestito], { dayOfMonth: 27, amount: 1800 }, { now });
  const ending = f.endingSoon.find(e => e.name === 'Prestito auto');
  assert.ok(ending, 'il prestito quasi finito è segnalato');
  assert.ok(ending.remaining <= 3);
  assert.equal(ending.payoff, '2027-05-10');
});

test('commitmentForecast: totale impegni fissi mensili', () => {
  const f = commitmentForecast([mutuo, prestito, affitto], null, { now: Date.parse('2026-07-01') });
  assert.equal(f.monthlyFixedTotal, 650 + 210 + 500);
  assert.equal(f.payday, null, 'senza stipendio noto, niente giorno accredito (non inventa)');
});

test('commitmentForecast: un impegno estinto non entra nei conti', () => {
  const finito = { ...prestito, startDate: '2020-01-10', termMonths: 6 };
  const f = commitmentForecast([finito, affitto], null, { now: Date.parse('2026-07-01') });
  assert.equal(f.activeCount, 1, 'solo l\'affitto è attivo');
  assert.equal(f.monthlyFixedTotal, 500);
});

// ── RICONCILIAZIONE anti doppio-conteggio ───────────────────────────────────
const monthTxPaidMutuo = [
  { amount: 648, type: 'uscita', description: 'ADDEBITO RATA MUTUO', date: '2026-07-05' },
];
test('matchCommitmentInMonth: una spesa reale vicina per importo e giorno combacia', () => {
  const t = matchCommitmentInMonth(mutuo, monthTxPaidMutuo);
  assert.ok(t, 'il mutuo pagato il 5 per ~650 combacia con la rata reale di 648');
});

test('matchCommitmentInMonth: importo troppo diverso NON combacia', () => {
  const tx = [{ amount: 200, type: 'uscita', date: '2026-07-05' }];
  assert.equal(matchCommitmentInMonth(mutuo, tx), null);
});

test('matchCommitmentInMonth: giorno troppo lontano NON combacia', () => {
  const tx = [{ amount: 650, type: 'uscita', date: '2026-07-25' }]; // il mutuo è il 5
  assert.equal(matchCommitmentInMonth(mutuo, tx), null);
});

test('reconcileCommitments: separa pagati e in sospeso', () => {
  const now = Date.parse('2026-07-20');
  const r = reconcileCommitments([mutuo, prestito, affitto], monthTxPaidMutuo, { now });
  assert.equal(r.paid.length, 1);
  assert.equal(r.paid[0].name, 'Mutuo casa');
  assert.equal(r.paidTotal, 648);
  assert.equal(r.pending.length, 2, 'prestito e affitto ancora da pagare');
  assert.equal(r.pendingTotal, 210 + 500);
});

test('commitmentForecast con monthTx: i fantasmi in sospeso escludono ciò che è già pagato', () => {
  const now = Date.parse('2026-07-20');
  const f = commitmentForecast([mutuo, prestito, affitto], { dayOfMonth: 27, amount: 1800 }, { now, monthTx: monthTxPaidMutuo });
  // mutuo già pagato → non è più un fantasma da accantonare
  assert.equal(f.paidTotal, 648);
  assert.equal(f.pendingGhostTotal, 210 + 500, 'solo prestito+affitto restano fantasmi');
  assert.ok(f.paid.some(c => c.name === 'Mutuo casa'));
});

test('commitmentForecast senza monthTx: retrocompatibile (tutto in sospeso)', () => {
  const f = commitmentForecast([mutuo, prestito, affitto], null, { now: Date.parse('2026-07-01') });
  assert.equal(f.pendingGhostTotal, f.monthlyFixedTotal);
  assert.equal(f.paidTotal, 0);
});

// ── IMPORTI VARIABILI: la bolletta cambia ogni mese, deve comunque combaciare ─
test('matchCommitmentInMonth: una BOLLETTA variabile combacia anche con importo diverso', () => {
  const bolletta = { id: 'b1', name: 'Bolletta luce', amount: 70, dayOfMonth: 15, kind: 'bolletta' };
  const inverno = [{ amount: 120, type: 'uscita', description: 'ENEL ENERGIA', date: '2026-01-15' }];
  const t = matchCommitmentInMonth(bolletta, inverno);
  assert.ok(t, 'bolletta stimata 70 combacia con la reale 120 (banda larga per i variabili)');
});

test('matchCommitmentInMonth: un MUTUO fisso NON accetta un importo lontano (banda stretta)', () => {
  const m = { id: 'm', name: 'Mutuo', amount: 650, dayOfMonth: 5, kind: 'mutuo' };
  const tx = [{ amount: 850, type: 'uscita', date: '2026-07-05' }]; // +30%: non è la rata
  assert.equal(matchCommitmentInMonth(m, tx), null, 'il mutuo è fisso: 850 non è la rata da 650');
});

test('reconcileCommitments: la bolletta pagata usa l\'importo REALE, non la stima', () => {
  const bolletta = { id: 'b1', name: 'Bolletta luce', amount: 70, dayOfMonth: 15, kind: 'bolletta' };
  const inverno = [{ amount: 120, type: 'uscita', date: '2026-01-15' }];
  const r = reconcileCommitments([bolletta], inverno, { now: Date.parse('2026-01-20') });
  assert.equal(r.paid.length, 1);
  assert.equal(r.paid[0].matchedAmount, 120, 'conta i 120€ realmente spesi, non i 70 stimati');
});

test('matchCommitmentInMonth: sceglie il candidato più vicino al giorno atteso', () => {
  const m = { id: 'm', name: 'Mutuo', amount: 650, dayOfMonth: 5, kind: 'mutuo' };
  const tx = [
    { amount: 650, type: 'uscita', date: '2026-07-08' }, // +3 giorni
    { amount: 650, type: 'uscita', date: '2026-07-05' }, // esatto
  ];
  assert.equal(matchCommitmentInMonth(m, tx).date, '2026-07-05');
});

// ── AUTO-ADDESTRAMENTO IMPORTI: media dei pagamenti reali passati ────────────
const bollettaHist = {
  '2026-01': [{ amount: 120, type: 'uscita', date: '2026-01-15' }],
  '2026-02': [{ amount: 90, type: 'uscita', date: '2026-02-15' }],
  '2026-03': [{ amount: 60, type: 'uscita', date: '2026-03-14' }],
};
test('learnCommitmentAmount: media (mediana) dei pagamenti reali passati', () => {
  const bolletta = { id: 'b', name: 'Bolletta', amount: 70, dayOfMonth: 15, kind: 'bolletta' };
  const l = learnCommitmentAmount(bolletta, bollettaHist);
  assert.equal(l.samples, 3);
  assert.equal(l.learnedAmount, 90); // mediana di 120,90,60
  assert.equal(l.min, 60);
  assert.equal(l.max, 120);
});

test('learnCommitmentAmount: null se non trova pagamenti passati', () => {
  const c = { id: 'x', name: 'X', amount: 50, dayOfMonth: 3, kind: 'abbonamento' };
  assert.equal(learnCommitmentAmount(c, bollettaHist), null);
});

test('enrichCommitmentsWithLearning: sostituisce l\'importo digitato con la media appresa', () => {
  const bolletta = { id: 'b', name: 'Bolletta', amount: 70, dayOfMonth: 15, kind: 'bolletta' };
  const [e] = enrichCommitmentsWithLearning([bolletta], bollettaHist);
  assert.equal(e.learned, true);
  assert.equal(e.amount, 90, 'usa la media reale');
  assert.equal(e.typedAmount, 70, 'conserva ciò che avevi scritto');
  assert.equal(e.learnedSamples, 3);
});

test('enrichCommitmentsWithLearning: sotto minSamples resta il valore digitato (niente media inventata)', () => {
  const bolletta = { id: 'b', name: 'Bolletta', amount: 70, dayOfMonth: 15, kind: 'bolletta' };
  const oneMonth = { '2026-01': [{ amount: 120, type: 'uscita', date: '2026-01-15' }] };
  const [e] = enrichCommitmentsWithLearning([bolletta], oneMonth, { minSamples: 2 });
  assert.equal(e.learned, false);
  assert.equal(e.amount, 70, 'un solo pagamento non basta: resta il valore inserito');
});

test('enrichCommitmentsWithLearning + forecast: i fantasmi usano la media reale', () => {
  const bolletta = { id: 'b', name: 'Bolletta', amount: 70, dayOfMonth: 15, kind: 'bolletta' };
  const enriched = enrichCommitmentsWithLearning([bolletta], bollettaHist);
  const f = commitmentForecast(enriched, { dayOfMonth: 27, amount: 1500 }, { now: Date.parse('2026-07-01') });
  assert.equal(f.monthlyFixedTotal, 90, 'il fantasma bolletta pesa la media reale 90, non i 70 digitati');
});

// ── DISPONIBILE AL GIORNO / A SETTIMANA ─────────────────────────────────────
test('commitmentForecast: quanto puoi gestire al giorno e a settimana', () => {
  // stipendio 1500 il 27; impegni fissi 500 (affitto); now = 27 giorni prima? 
  const now = Date.parse('2026-07-07'); // prossimo stipendio 27 lug → 20 giorni
  const f = commitmentForecast([affitto], { dayOfMonth: 27, amount: 1500 }, { now });
  assert.ok(f.allowance, 'con stipendio noto calcola la disponibilità');
  assert.equal(f.allowance.daysToNext, 20);
  assert.equal(f.allowance.pool, 1000); // 1500 − 500 fantasmi
  assert.equal(f.allowance.perDay, 50);  // 1000 / 20
  assert.equal(f.allowance.perWeek, 350); // 50 × 7 (20 giorni ≥ 7 → nessun cap)
});

test('commitmentForecast: il settimanale è capato al pool se lo stipendio è imminente', () => {
  const now = Date.parse('2026-07-24'); // stipendio il 27 → 3 giorni
  const f = commitmentForecast([affitto], { dayOfMonth: 27, amount: 1500 }, { now });
  assert.equal(f.allowance.daysToNext, 3);
  assert.equal(f.allowance.perDay, Math.round((1000 / 3) * 100) / 100);
  assert.equal(f.allowance.perWeek, 1000, 'con 3 giorni al pagamento il settimanale non supera il pool');
});

test('commitmentForecast: nessuna disponibilità senza stipendio (non inventa)', () => {
  const f = commitmentForecast([affitto], null, { now: Date.parse('2026-07-07') });
  assert.equal(f.allowance, null);
});

test('commitmentForecast: se gli impegni superano lo stipendio, pool = 0 (mai negativo)', () => {
  const heavy = { id: 'h', name: 'Mutuo pesante', amount: 2000, dayOfMonth: 5, kind: 'mutuo' };
  const f = commitmentForecast([heavy], { dayOfMonth: 27, amount: 1500 }, { now: Date.parse('2026-07-10') });
  assert.equal(f.allowance.pool, 0, 'non mostra un disponibile negativo');
  assert.equal(f.allowance.perDay, 0);
});

// ── DISPONIBILITÀ ADATTIVA (burn-rate auto-correttivo) ──────────────────────
test('cycleAllowance: il giornaliero scende se hai già speso molto nel ciclo', () => {
  const salary = { dayOfMonth: 1, amount: 1500 };
  // ciclo 1→31 luglio; oggi 11 (10 giorni passati, 20 rimasti). Budget = 1500−500 = 1000.
  const now = Date.parse('2026-07-11');
  const allTx = { '2026-07': [
    { amount: 500, type: 'uscita', description: 'ADDEBITO AFFITTO', date: '2026-07-01' }, // rata: esclusa
    { amount: 400, type: 'uscita', description: 'spese varie', date: '2026-07-05' },       // discrezionale
    { amount: 100, type: 'entrata', date: '2026-07-06' },                                  // entrata: ignorata
  ] };
  const a = cycleAllowance([affitto], salary, { now, allTx });
  assert.equal(a.budget, 1000);
  assert.equal(a.spent, 400, 'solo la spesa discrezionale, non la rata affitto');
  assert.equal(a.remaining, 600);
  assert.equal(a.daysLeft, 21); // da 11 lug a 1 ago (luglio ha 31 giorni)
  assert.equal(a.perDay, Math.round((600 / 21) * 100) / 100); // sceso perché hai già speso 400
});

test('cycleAllowance: segnala quando sei OLTRE il ritmo', () => {
  const salary = { dayOfMonth: 1, amount: 1000 };
  const now = Date.parse('2026-07-06'); // 5 giorni su 30 → ideale ~166, budget 1000
  const allTx = { '2026-07': [{ amount: 600, type: 'uscita', description: 'shopping', date: '2026-07-03' }] };
  const a = cycleAllowance([], salary, { now, allTx });
  assert.equal(a.pace, 'oltre il ritmo');
  assert.ok(a.overBy > 0);
  assert.equal(a.onTrack, false);
});

test('cycleAllowance: in linea quando la spesa segue il passo', () => {
  const salary = { dayOfMonth: 1, amount: 3000 };
  const now = Date.parse('2026-07-11'); // 10/30 giorni → ideale 1000
  const allTx = { '2026-07': [{ amount: 900, type: 'uscita', description: 'varie', date: '2026-07-05' }] };
  const a = cycleAllowance([], salary, { now, allTx });
  assert.equal(a.pace, 'in linea');
  assert.equal(a.onTrack, true);
});

test('cycleAllowance: null senza stipendio (non inventa)', () => {
  assert.equal(cycleAllowance([affitto], null, { now: Date.now() }), null);
});

// ── BUG REALE segnalato dall'utente (2026-09-04): stipendio E budget insieme
// dovevano dividersi correttamente al giorno — il ciclo ignorava il budget ──
test('cycleAllowance: il budget mensile dichiarato vince quando è più prudente dello stipendio', () => {
  const salary = { dayOfMonth: 1, amount: 1800 };
  // ciclo pieno 1 ago → 1 set (31 giorni), oggi il giorno dopo il pagamento.
  const now = Date.parse('2026-08-02');
  const a = cycleAllowance([], salary, { now, allTx: {}, monthlyBudget: 1200 });
  // Senza il fix: budget = 1800 (l'intero stipendio). Con un budget mensile
  // di 1200€ dichiarato, un ciclo di 31 giorni (leggermente più lungo della
  // media 30,44 → quota proporzionalmente un po' più alta, ~1222€) non deve
  // MAI avvicinarsi all'intero stipendio: il tetto resta ancorato al budget.
  assert.ok(a.budget <= 1200 * 1.05, `budget non deve avvicinarsi allo stipendio (era ${a.budget})`);
  assert.ok(a.budget < 1800, 'lo stipendio da solo avrebbe permesso di più: il budget deve vincere');
});

test('cycleAllowance: senza un budget mensile impostato, il comportamento resta quello di sempre (solo stipendio)', () => {
  const salary = { dayOfMonth: 1, amount: 1800 };
  const now = Date.parse('2026-08-02');
  const a = cycleAllowance([], salary, { now, allTx: {}, monthlyBudget: null });
  assert.equal(a.budget, 1800, 'retrocompatibile: senza budget dichiarato, resta lo stipendio');
});

test('cycleAllowance: lo stipendio vince quando il budget dichiarato è PIÙ generoso (mai spendere soldi che non arrivano)', () => {
  const salary = { dayOfMonth: 1, amount: 900 };
  const now = Date.parse('2026-08-02');
  const a = cycleAllowance([], salary, { now, allTx: {}, monthlyBudget: 2000 });
  assert.equal(a.budget, 900, 'un budget più alto dello stipendio non deve mai far proporre più di quanto entra davvero');
});

test('commitmentForecast: il budget mensile dichiarato limita il pool disponibile, non solo lo stipendio', () => {
  const salary = { dayOfMonth: 1, amount: 1800 };
  const now = Date.parse('2026-08-02');
  const f = commitmentForecast([], salary, { now, monthlyBudget: 1200 });
  assert.ok(f.allowance.pool <= 1200 + 1, `pool non deve superare ~1200 (era ${f.allowance.pool})`);
});

// ── riconoscimento per NOME (bolletta sottostimata) ──────────────────────────
test('matchCommitmentInMonth: riconosce dal NOME una bolletta molto fuori banda', () => {
  const b = { id: 'b1', name: 'Luce', merchant: 'Enel', amount: 50, dayOfMonth: 12, kind: 'bolletta' };
  const tx = [{ type: 'uscita', amount: 180, date: '2026-07-14', description: 'Enel Energia' }];
  const m = matchCommitmentInMonth(b, tx);
  assert.ok(m, 'atteso match per nome: 180€ non entra nella banda di 50€');
  assert.equal(m.amount, 180);
});

test('matchCommitmentInMonth: il nome NON basta se il giorno è lontano', () => {
  const b = { id: 'b1', name: 'Luce', merchant: 'Enel', amount: 50, dayOfMonth: 12, kind: 'bolletta' };
  const tx = [{ type: 'uscita', amount: 180, date: '2026-07-28', description: 'Enel Energia' }];
  assert.equal(matchCommitmentInMonth(b, tx), null);
});

test('matchCommitmentInMonth: il NOME batte una coincidenza d\'importo', () => {
  // Verificato dal vivo: con una bolletta variabile la banda d'importo è
  // larghissima e agganciava la prima spesa qualunque vicina al giorno (imparava
  // 12€ invece di ~90€). Una descrizione che coincide identifica; un importo in
  // banda larga no.
  const b = { id: 'b1', name: 'Luce', merchant: 'Enel', amount: 50, dayOfMonth: 12, kind: 'bolletta', variable: true };
  const tx = [
    { type: 'uscita', amount: 180, date: '2026-07-11', description: 'Enel Energia' }, // il vero addebito
    { type: 'uscita', amount: 52, date: '2026-07-13', description: 'Supermercato' },  // coincidenza
  ];
  assert.equal(matchCommitmentInMonth(b, tx).amount, 180);
});

test('matchCommitmentInMonth: senza alcun nome riconosciuto ripiega sulla banda d\'importo', () => {
  const b = { id: 'b1', name: 'Luce', merchant: 'Enel', amount: 50, dayOfMonth: 12, kind: 'bolletta' };
  const tx = [{ type: 'uscita', amount: 52, date: '2026-07-13', description: 'addebito utenza' }];
  assert.equal(matchCommitmentInMonth(b, tx).amount, 52);
});

test('matchCommitmentInMonth: un movimento senza relazione non viene mai agganciato', () => {
  const b = { id: 'b1', name: 'Luce', merchant: 'Enel', amount: 50, dayOfMonth: 12, kind: 'bolletta' };
  const tx = [{ type: 'uscita', amount: 180, date: '2026-07-12', description: 'Volo Ryanair' }];
  assert.equal(matchCommitmentInMonth(b, tx), null);
});

test('learnCommitmentAmount: impara la cifra vera di una bolletta sottostimata (via nome)', () => {
  const b = { id: 'b1', name: 'Luce', merchant: 'Enel', amount: 50, dayOfMonth: 12, kind: 'bolletta' };
  const allTx = {
    '2026-05': [{ type: 'uscita', amount: 170, date: '2026-05-12', description: 'Enel' }],
    '2026-06': [{ type: 'uscita', amount: 190, date: '2026-06-13', description: 'Enel' }],
  };
  const l = learnCommitmentAmount(b, allTx);
  assert.equal(l.samples, 2);
  assert.equal(l.learnedAmount, 180);
});
