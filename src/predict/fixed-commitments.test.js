import test from 'node:test';
import assert from 'node:assert/strict';

const { remainingInstallments, payoffDate, isActive, residualApprox, nextOccurrence,
  commitmentsDueBetween, commitmentForecast, matchCommitmentInMonth, reconcileCommitments } = await import('./fixed-commitments.js');

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
