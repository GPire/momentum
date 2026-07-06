import test from 'node:test';
import assert from 'node:assert/strict';

// Shim minimo per moduli scritti per il browser (stesso pattern degli altri test).
globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { touchStreak, computeWeeklyRecap, computeGoalProgress, suggestSubscriptionRegistrations } = await import('./engagement.js');

function tx(date, amount, description, type = 'uscita', category = 'Svago') {
  return { date, amount, description, type, category };
}

// ---- touchStreak ----

test('touchStreak: primo giorno in assoluto → streak 1', () => {
  const res = touchStreak({ lastActiveDay: null, streak: 0, bestStreak: 0 }, new Date(2026, 6, 15));
  assert.equal(res.streak, 1);
  assert.equal(res.bestStreak, 1);
  assert.equal(res.lastActiveDay, '2026-07-15');
  assert.equal(res.changed, true);
});

test('touchStreak: giorno consecutivo → +1', () => {
  const res = touchStreak({ lastActiveDay: '2026-07-14', streak: 3, bestStreak: 5 }, new Date(2026, 6, 15));
  assert.equal(res.streak, 4);
  assert.equal(res.bestStreak, 5);
});

test('touchStreak: stesso giorno → invariato, changed false', () => {
  const res = touchStreak({ lastActiveDay: '2026-07-15', streak: 3, bestStreak: 5 }, new Date(2026, 6, 15, 22, 30));
  assert.equal(res.streak, 3);
  assert.equal(res.changed, false);
});

test('touchStreak: gap di 2+ giorni → si riparte da 1, il record resta', () => {
  const res = touchStreak({ lastActiveDay: '2026-07-10', streak: 9, bestStreak: 9 }, new Date(2026, 6, 15));
  assert.equal(res.streak, 1);
  assert.equal(res.bestStreak, 9);
});

test('touchStreak: nuovo record aggiorna bestStreak', () => {
  const res = touchStreak({ lastActiveDay: '2026-07-14', streak: 9, bestStreak: 9 }, new Date(2026, 6, 15));
  assert.equal(res.streak, 10);
  assert.equal(res.bestStreak, 10);
});

test('touchStreak: cavallo di fine anno, 31 dic → 1 gen è consecutivo', () => {
  const res = touchStreak({ lastActiveDay: '2026-12-31', streak: 5, bestStreak: 5 }, new Date(2027, 0, 1));
  assert.equal(res.streak, 6);
});

test('touchStreak: orologio spostato indietro non regala progressi', () => {
  const res = touchStreak({ lastActiveDay: '2026-07-15', streak: 5, bestStreak: 5 }, new Date(2026, 6, 10));
  assert.equal(res.streak, 1);
});

// ---- computeWeeklyRecap ----
// REF mercoledì 15 lug 2026 → ultima settimana completa: lun 6 - dom 12;
// quella prima: lun 29 giu - dom 5 lug.

const REF = new Date(2026, 6, 15);

test('computeWeeklyRecap: totali, delta e top categoria corretti', () => {
  const allTx = {
    '2026-06': [tx('2026-06-30', 100, 'Cena', 'uscita', 'Ristorante')],
    '2026-07': [
      tx('2026-07-07', 80, 'Spesa', 'uscita', 'Alimentari'),
      tx('2026-07-09', 40, 'Benzina', 'uscita', 'Trasporti'),
      tx('2026-07-10', 30, 'Spesa2', 'uscita', 'Alimentari'),
      tx('2026-07-08', 500, 'Stipendio parziale', 'entrata', 'Entrata'),
      tx('2026-07-14', 999, 'Fuori dalla settimana del recap'),
    ],
  };
  const recap = computeWeeklyRecap(allTx, REF);
  assert.equal(recap.totalSpent, 150);           // 80+40+30, esclusa la tx del 14
  assert.equal(recap.prevTotalSpent, 100);       // la cena del 30 giu (settimana a cavallo di mese)
  assert.equal(recap.deltaPct, 50);              // (150-100)/100
  assert.deepEqual(recap.topCategory, { id: 'Alimentari', amount: 110 });
  assert.equal(recap.saved, 350);                // 500-150
});

test('computeWeeklyRecap: null senza transazioni nella settimana (mai recap inventati)', () => {
  assert.equal(computeWeeklyRecap({}, REF), null);
});

test('computeWeeklyRecap: settimana precedente vuota → deltaPct null, non infinito', () => {
  const allTx = { '2026-07': [tx('2026-07-07', 80, 'Spesa')] };
  const recap = computeWeeklyRecap(allTx, REF);
  assert.equal(recap.deltaPct, null);
});

// ---- computeGoalProgress ----

test('computeGoalProgress: risparmio netto cumulato e percentuale', () => {
  const goal = { id: 'g1', name: 'Vacanza', target: 1000, createdAt: '2026-07-01' };
  const allTx = {
    '2026-06': [tx('2026-06-15', 5000, 'Prima del goal, non conta', 'entrata')],
    '2026-07': [
      tx('2026-07-05', 800, 'Stipendio', 'entrata'),
      tx('2026-07-08', 300, 'Spese'),
    ],
  };
  const res = computeGoalProgress(goal, allTx, REF);
  assert.equal(res.saved, 500);
  assert.equal(res.pct, 50);
  assert.equal(res.remaining, 500);
  assert.equal(res.onTrack, null); // senza deadline nessun giudizio di ritmo
});

test('computeGoalProgress: deadline — in linea vs in ritardo, misurato', () => {
  const goal = { id: 'g1', name: 'Vacanza', target: 1000, createdAt: '2026-07-01', deadline: '2026-07-29' };
  // Al 15 luglio sono passati 14 giorni su 28 → servirebbero 500€.
  const onTrackTx = { '2026-07': [tx('2026-07-05', 600, 'Stipendio', 'entrata')] };
  const behindTx = { '2026-07': [tx('2026-07-05', 300, 'Stipendio', 'entrata')] };
  assert.equal(computeGoalProgress(goal, onTrackTx, REF).onTrack, true);
  assert.equal(computeGoalProgress(goal, behindTx, REF).onTrack, false);
});

test('computeGoalProgress: risparmio negativo → pct 0, mai barre negative', () => {
  const goal = { id: 'g1', name: 'Vacanza', target: 1000, createdAt: '2026-07-01' };
  const allTx = { '2026-07': [tx('2026-07-08', 300, 'Solo spese')] };
  const res = computeGoalProgress(goal, allTx, REF);
  assert.equal(res.pct, 0);
  assert.equal(res.saved, -300);
});

// ---- suggestSubscriptionRegistrations ----

function netflixHistory() {
  return {
    '2026-04': [tx('2026-04-17', 12.99, 'NETFLIX.COM', 'uscita', 'Svago')],
    '2026-05': [tx('2026-05-17', 12.99, 'NETFLIX.COM', 'uscita', 'Svago')],
    '2026-06': [tx('2026-06-17', 12.99, 'NETFLIX.COM', 'uscita', 'Svago')],
  };
}

test('suggestSubscriptionRegistrations: propone il ricorrente non registrato', () => {
  const res = suggestSubscriptionRegistrations(netflixHistory(), []);
  assert.equal(res.length, 1);
  assert.equal(res[0].description, 'NETFLIX.COM');
  assert.equal(res[0].amount, 12.99);
  assert.equal(res[0].occurrences, 3);
});

test('suggestSubscriptionRegistrations: esclude abbonamenti già registrati anche con nome simile ma non identico', () => {
  const res = suggestSubscriptionRegistrations(netflixHistory(), [{ name: 'Netflix', amount: 12.99 }]);
  assert.equal(res.length, 0);
});

test('suggestSubscriptionRegistrations: accetta anche known come stringhe', () => {
  const res = suggestSubscriptionRegistrations(netflixHistory(), ['netflix.com']);
  assert.equal(res.length, 0);
});

test('suggestSubscriptionRegistrations: spese una-tantum non proposte', () => {
  const allTx = { '2026-07': [tx('2026-07-03', 45, 'Ristorante Da Mario')] };
  assert.equal(suggestSubscriptionRegistrations(allTx, []).length, 0);
});
