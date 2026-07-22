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

test('getQuickAddSuggestions: BUG FIX — importo che oscilla un po\' (media confidenza) entra nel pool', () => {
  // Il caffè varia un po': 2 volte 1.20€ e 2 volte 1.30€ su 4 → modal.share =
  // 0.5 (sotto la vecchia soglia 'alta' 0.6, dentro la nuova 'media' 0.5). Il
  // vecchio filtro (solo 'alta') lo escludeva SEMPRE — un'abitudine reale ma
  // con importo non perfettamente fisso non entrava mai nel pool.
  const variabile = { '2026-06': [
    tx('2026-06-01', 1.20, 'Bar Espresso', 'Svago'),
    tx('2026-06-08', 1.20, 'Bar Espresso', 'Svago'),
    tx('2026-06-15', 1.30, 'Bar Espresso', 'Svago'),
    tx('2026-06-22', 1.30, 'Bar Espresso', 'Svago'),
  ]};
  const s = getQuickAddSuggestions(variabile, REF);
  assert.equal(s.length, 1, 'con share 50% (media confidenza) deve comparire, non piu\' escluso');
  assert.equal(s[0].description, 'Bar Espresso');
});

test('getQuickAddSuggestions: pool piu\' ampio (limit=8 default) non frequenza-4-e-basta', () => {
  const molte = { '2026-06': [] };
  const names = ['Caffè', 'Sigarette', 'Bar', 'Pane', 'Giornale', 'Parcheggio'];
  for (const n of names) {
    for (let i = 0; i < 3; i++) molte['2026-06'].push(tx(`2026-06-0${i + 1}`, 2.5, n, 'Svago'));
  }
  const s = getQuickAddSuggestions(molte, REF);
  assert.equal(s.length, 6, 'con 6 abituali qualificati il pool eleggibile li contiene tutti (non tagliato a 4)');
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

// ---- matchSolito (comando vocale "il solito") ----

const { matchSolito } = await import('./amount-memory.js');

test('matchSolito: "caffè" trova l\'abituale caffè', () => {
  const hit = matchSolito('caffè', SIGARETTE_E_CAFFE(), REF);
  assert.ok(hit);
  assert.equal(hit.description, 'Caffè bar');
});

test('matchSolito: frase vuota → il più frequente', () => {
  const hit = matchSolito('', SIGARETTE_E_CAFFE(), REF);
  assert.ok(hit);
  assert.equal(hit.description, 'Caffè bar'); // più frequente
});

test('matchSolito: parola senza abituale corrispondente → null', () => {
  assert.equal(matchSolito('elicottero', SIGARETTE_E_CAFFE(), REF), null);
});

test('matchSolito: senza storia → null', () => {
  assert.equal(matchSolito('caffè', {}, REF), null);
});

function SIGARETTE_E_CAFFE() {
  const allTx = {};
  const add = (iso, amount, description, category) => {
    const mk = iso.slice(0, 7);
    (allTx[mk] = allTx[mk] || []).push({ date: `${iso}T08:15:00`, amount, description, category, type: 'uscita' });
  };
  // caffè 5 volte, sigarette 3 volte (giugno 2026)
  for (let d = 1; d <= 5; d++) add(`2026-06-0${d}`, 1.20, 'Caffè bar', 'Ristorante');
  for (const d of [10, 17, 24]) add(`2026-06-${d}`, 5.40, 'Sigarette', 'Shopping');
  return allTx;
}
