import test from 'node:test';
import assert from 'node:assert/strict';
import { itemSplitShares } from './item-split.js';

const IDS = ['marco', 'anna', 'luca'];

test('itemSplitShares: ogni voce assegnata a una sola persona → paga solo lei', () => {
  const { byId, total } = itemSplitShares([
    { description: 'Pizza', amount: 12, assignedTo: ['marco'] },
    { description: 'Pasta', amount: 10, assignedTo: ['anna'] },
  ], IDS);
  assert.equal(byId.marco, 12);
  assert.equal(byId.anna, 10);
  assert.equal(byId.luca, undefined); // Luca non ha ordinato nulla, non deve nulla
  assert.equal(total, 22);
});

test('itemSplitShares: una voce assegnata a più persone si divide fra loro', () => {
  const { byId } = itemSplitShares([
    { description: 'Antipasto misto', amount: 9, assignedTo: ['marco', 'anna', 'luca'] },
  ], IDS);
  assert.equal(byId.marco, 3);
  assert.equal(byId.anna, 3);
  assert.equal(byId.luca, 3);
});

test('itemSplitShares: assignedTo "all" (o assente) coinvolge tutti i membri del gruppo, non solo chi appare in altre voci', () => {
  const { byId } = itemSplitShares([
    { description: 'Pizza', amount: 12, assignedTo: ['marco'] },
    { description: 'Acqua per tutti', amount: 3, assignedTo: 'all' },
  ], IDS);
  assert.ok(Math.abs(byId.marco - 13) < 1e-9); // 12 + 1 (3/3)
  assert.ok(Math.abs(byId.anna - 1) < 1e-9);
  assert.ok(Math.abs(byId.luca - 1) < 1e-9);
});

test('itemSplitShares: più voci sulla stessa persona si sommano', () => {
  const { byId } = itemSplitShares([
    { description: 'Pizza', amount: 12, assignedTo: ['marco'] },
    { description: 'Birra', amount: 5, assignedTo: ['marco'] },
  ], IDS);
  assert.equal(byId.marco, 17);
});

test('itemSplitShares: nessuna voce → errore, mai una spesa vuota', () => {
  assert.throws(() => itemSplitShares([], IDS), /nessuna voce/i);
});

test('itemSplitShares: voce con importo zero o negativo → errore con il nome della voce', () => {
  assert.throws(() => itemSplitShares([{ description: 'Sconto', amount: -5, assignedTo: ['marco'] }], IDS), /Sconto/);
  assert.throws(() => itemSplitShares([{ description: 'Vuota', amount: 0, assignedTo: ['marco'] }], IDS), /Vuota/);
});

test('itemSplitShares: voce senza nessun partecipante valido → errore, mai un costo assegnato a nessuno', () => {
  assert.throws(() => itemSplitShares([{ description: 'Fantasma', amount: 10, assignedTo: [] }], IDS), /Fantasma/);
  // un id che non esiste nel gruppo viene filtrato via, e se resta vuoto è comunque un errore
  assert.throws(() => itemSplitShares([{ description: 'Ospite sbagliato', amount: 10, assignedTo: ['non-esiste'] }], IDS), /Ospite sbagliato/);
});

test('itemSplitShares: mancia proporzionale — chi ha speso di più paga più mancia', () => {
  const { byId, total } = itemSplitShares([
    { description: 'Pizza', amount: 30, assignedTo: ['marco'] }, // 3/4 del conto
    { description: 'Insalata', amount: 10, assignedTo: ['anna'] }, // 1/4 del conto
  ], IDS, { tip: 8, tipMode: 'proporzionale' });
  assert.ok(Math.abs(byId.marco - (30 + 8 * 0.75)) < 1e-9);
  assert.ok(Math.abs(byId.anna - (10 + 8 * 0.25)) < 1e-9);
  assert.equal(byId.luca, undefined); // Luca non era al tavolo (nessuna voce sua), non paga mancia
  assert.equal(total, 48);
});

test('itemSplitShares: mancia equa — divisa a testa fra chi era coinvolto, non in base al consumo', () => {
  const { byId } = itemSplitShares([
    { description: 'Pizza', amount: 30, assignedTo: ['marco'] },
    { description: 'Insalata', amount: 10, assignedTo: ['anna'] },
  ], IDS, { tip: 10, tipMode: 'equa' });
  assert.equal(byId.marco, 35); // 30 + 5
  assert.equal(byId.anna, 15); // 10 + 5
});

test('itemSplitShares: la somma delle quote (con o senza mancia) torna sempre al totale dichiarato', () => {
  const items = [
    { description: 'Pizza', amount: 12.50, assignedTo: ['marco'] },
    { description: 'Pasta', amount: 9.90, assignedTo: ['anna'] },
    { description: 'Vino', amount: 18, assignedTo: ['marco', 'anna', 'luca'] },
  ];
  const { byId, total } = itemSplitShares(items, IDS, { tip: 4, tipMode: 'proporzionale' });
  const somma = Object.values(byId).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(somma - total) < 0.01);
});
