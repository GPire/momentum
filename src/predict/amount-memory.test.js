import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { predictAmount, getQuickAddSuggestions } = await import('./amount-memory.js');

const REF = new Date(2026, 6, 6);

function tx(date, amount, description, category = 'Svago', type = 'uscita') {
  return { date, amount, description, type, category };
}

const SIGARETTE = {
  '2026-06': [
    tx('2026-06-02', 5.40, 'Sigarette'),
    tx('2026-06-10', 5.40, 'sigarette tabacchi'),
    tx('2026-06-20', 5.40, 'Sigarette'),
    tx('2026-06-25', 42.00, 'Cena fuori', 'Ristorante'),
  ],
  '2026-07': [tx('2026-07-01', 5.40, 'Sigarette')],
};

test('predictAmount: prodotto abituale → importo esatto, confidenza alta', () => {
  const r = predictAmount('Svago', 'Sigarette', SIGARETTE);
  assert.equal(r.amount, 5.40);
  assert.equal(r.confidence, 'alta');
  assert.ok(r.occurrences >= 3);
});

test('predictAmount: match fuzzy sulla descrizione ("sigarette tabacchi" conta)', () => {
  const r = predictAmount(null, 'sigarette', SIGARETTE);
  assert.equal(r.amount, 5.40);
});

test('predictAmount: solo categoria quando manca la descrizione', () => {
  const r = predictAmount('Svago', '', SIGARETTE);
  assert.equal(r.amount, 5.40); // in Svago il 5.40 domina (4 su 4)
});

test('predictAmount: importi sempre diversi → null, mai indovinare', () => {
  const varie = { '2026-06': [
    tx('2026-06-02', 12.30, 'Spesa', 'Alimentari'),
    tx('2026-06-10', 47.80, 'Spesa', 'Alimentari'),
    tx('2026-06-20', 23.15, 'Spesa', 'Alimentari'),
  ]};
  assert.equal(predictAmount('Alimentari', 'Spesa', varie), null);
});

test('predictAmount: storia insufficiente → null', () => {
  assert.equal(predictAmount('Svago', 'Sigarette', { '2026-07': [tx('2026-07-01', 5.40, 'Sigarette')] }), null);
});

test('getQuickAddSuggestions: l\'abituale frequente è il primo tasto rapido', () => {
  const s = getQuickAddSuggestions(SIGARETTE, REF);
  assert.equal(s.length, 1); // la cena una-tantum non diventa un tasto
  assert.equal(s[0].description, 'Sigarette');
  assert.equal(s[0].amount, 5.40);
  assert.equal(s[0].occurrences, 4);
});

test('getQuickAddSuggestions: spese vecchie oltre la finestra escluse', () => {
  const old = { '2026-01': [
    tx('2026-01-02', 5.40, 'Sigarette'), tx('2026-01-10', 5.40, 'Sigarette'), tx('2026-01-20', 5.40, 'Sigarette'),
  ]};
  assert.equal(getQuickAddSuggestions(old, REF).length, 0);
});

test('getQuickAddSuggestions: ordina per frequenza', () => {
  const mixed = { '2026-06': [
    tx('2026-06-01', 1.20, 'Caffè'), tx('2026-06-02', 1.20, 'Caffè'), tx('2026-06-03', 1.20, 'Caffè'),
    tx('2026-06-04', 1.20, 'Caffè'), tx('2026-06-05', 1.20, 'Caffè'),
    tx('2026-06-02', 5.40, 'Sigarette'), tx('2026-06-10', 5.40, 'Sigarette'), tx('2026-06-20', 5.40, 'Sigarette'),
  ]};
  const s = getQuickAddSuggestions(mixed, REF);
  assert.equal(s[0].description, 'Caffè');
  assert.equal(s[1].description, 'Sigarette');
});
