import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreForSync, rankForSync, rankMissingByMonth, flattenRankedForSync } from './sync-priority.js';

const NOW = new Date('2026-08-04T12:00:00Z').getTime();
const giorni = (n) => new Date(NOW + n * 86_400_000).toISOString();

test('una lapide vale sempre di più di qualunque transazione', () => {
  const lapide = { isTombstone: true, id: 'x' };
  const grande = { amount: 100000, date: giorni(0) };
  assert.ok(scoreForSync(lapide, { now: NOW }) > scoreForSync(grande, { now: NOW }));
});

test('una piccola spesa di domani batte una grande spesa di tre mesi fa', () => {
  const domani = { amount: 12, date: giorni(1) };
  const treMesiFa = { amount: 900, date: giorni(-90) };
  const s1 = scoreForSync(domani, { now: NOW });
  const s2 = scoreForSync(treMesiFa, { now: NOW });
  assert.ok(s1 > s2, `atteso domani(${s1}) > tre mesi fa(${s2})`);
});

test('un impegno vicino nel FUTURO pesa quanto uno vicino nel PASSATO, a parità di importo', () => {
  const futuro = { amount: 50, date: giorni(3) };
  const passato = { amount: 50, date: giorni(-3) };
  assert.equal(scoreForSync(futuro, { now: NOW }), scoreForSync(passato, { now: NOW }));
});

test('oltre l\'orizzonte la vicinanza non conta più: due date lontane pesano uguale (solo importo)', () => {
  const lontana1 = { amount: 40, date: giorni(-40) };
  const lontana2 = { amount: 40, date: giorni(-400) };
  assert.equal(scoreForSync(lontana1, { now: NOW, horizonDays: 14 }), scoreForSync(lontana2, { now: NOW, horizonDays: 14 }));
});

test('un importo enorme non stacca all\'infinito: il punteggio dell\'importo satura', () => {
  const enorme = { amount: 999999, date: giorni(-90) };
  const cap = { amount: 500, date: giorni(-90) };
  assert.equal(scoreForSync(enorme, { now: NOW }), scoreForSync(cap, { now: NOW }));
});

test('senza una data leggibile, conta solo l\'importo (mai un crash, mai NaN)', () => {
  const senzaData = { amount: 80 };
  const s = scoreForSync(senzaData, { now: NOW });
  assert.ok(Number.isFinite(s) && s > 0);
  assert.ok(Number.isFinite(scoreForSync({}, { now: NOW })));
  assert.equal(scoreForSync(null, { now: NOW }), 0);
});

test('rankForSync ordina dalla più alla meno urgente, stabile a parità di punteggio', () => {
  const items = [
    { id: 'a', amount: 10, date: giorni(-90) },
    { id: 'b', isTombstone: true },
    { id: 'c', amount: 10, date: giorni(0) },
    { id: 'd', amount: 10, date: giorni(0) }, // stesso punteggio di c: deve restare dopo (stabilità)
  ];
  const ranked = rankForSync(items, { now: NOW }).map((t) => t.id);
  assert.deepEqual(ranked, ['b', 'c', 'd', 'a']);
});

test('rankForSync non muta l\'elenco originale', () => {
  const items = [{ id: 'a', amount: 1, date: giorni(0) }, { id: 'b', isTombstone: true }];
  const originale = [...items];
  rankForSync(items, { now: NOW });
  assert.deepEqual(items, originale);
});

test('rankMissingByMonth ordina dentro ogni mese, senza mescolare i mesi', () => {
  const missing = {
    '2026-05': [{ id: 'vecchia', amount: 5, date: giorni(-90) }, { id: 'vecchia-lapide', isTombstone: true }],
    '2026-08': [{ id: 'oggi', amount: 5, date: giorni(0) }],
  };
  const out = rankMissingByMonth(missing, { now: NOW });
  assert.deepEqual(Object.keys(out), ['2026-05', '2026-08']);
  assert.equal(out['2026-05'][0].id, 'vecchia-lapide');
  assert.equal(out['2026-08'][0].id, 'oggi');
});

test('flattenRankedForSync appiattisce TUTTI i mesi in un unico ordine per urgenza', () => {
  const missing = {
    __deleted: { 'id-cancellato': Date.now() }, // le lapidi vive in sync.js NON sono array: vanno escluse dall'appiattimento
    '2026-01': [{ id: 'gennaio-grande', amount: 400, date: giorni(-200) }],
    '2026-08': [{ id: 'oggi-piccola', amount: 5, date: giorni(0) }],
  };
  const flat = flattenRankedForSync(missing, { now: NOW }).map((t) => t.id);
  assert.deepEqual(flat, ['oggi-piccola', 'gennaio-grande']);
});

test('flattenRankedForSync su un pacchetto vuoto non crolla', () => {
  assert.deepEqual(flattenRankedForSync({}, { now: NOW }), []);
  assert.deepEqual(flattenRankedForSync(undefined, { now: NOW }), []);
});

// Verifica di integrazione con il formato REALE prodotto da sync.js, non un
// formato inventato per il test.
test('integrazione: il formato di transactionsMissingFromPeer si ordina senza modifiche', async () => {
  const { transactionsMissingFromPeer } = await import('./sync.js');
  const mine = {
    '2026-01': [{ id: 'a', hash: 'ha', amount: 300, date: giorni(-200) }],
    '2026-08': [{ id: 'b', hash: 'hb', amount: 20, date: giorni(0) }],
  };
  const missing = transactionsMissingFromPeer(mine, {}); // il peer non ha nulla: manca tutto
  const flat = flattenRankedForSync(missing, { now: NOW }).map((t) => t.id);
  assert.deepEqual(flat, ['b', 'a']);
});
