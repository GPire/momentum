import test from 'node:test';
import assert from 'node:assert/strict';
import {
  periodoTrasferta, giorniDelPeriodo, speseFuoriPeriodo, giorniScoperti,
  diariaSpettante, riduzioniPerPastiOfferti, RIDUZIONE_PASTO,
} from './trip-period.js';

const trip = (extra = {}) => ({ id: 't1', name: 'Milano', offeredItems: [], ...extra });

test('senza date complete il periodo non è definito, mai una durata inventata', () => {
  assert.equal(periodoTrasferta(trip()), null);
  assert.equal(periodoTrasferta(trip({ startDate: '2026-09-10' })), null);
  assert.equal(periodoTrasferta(trip({ startDate: '2026-09-10', endDate: '2026-09-08' })), null); // finisce prima di iniziare
});

test('le ore si contano davvero, non solo i giorni civili', () => {
  const p = periodoTrasferta(trip({ startDate: '2026-09-10', startTime: '09:00', endDate: '2026-09-10', endTime: '18:00' }));
  assert.equal(p.ore, 9);
});

test('un viaggio a cavallo di mezzanotte conta le ore vere, non "un giorno"', () => {
  const p = periodoTrasferta(trip({ startDate: '2026-09-10', startTime: '22:00', endDate: '2026-09-11', endTime: '06:00' }));
  assert.equal(p.ore, 8);
});

test('i giorni del periodo includono gli estremi, mai uno in più o in meno', () => {
  const giorni = giorniDelPeriodo(trip({ startDate: '2026-09-10', endDate: '2026-09-13' }));
  assert.deepEqual(giorni, ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']);
});

test('un periodo di un solo giorno produce un solo giorno, non zero', () => {
  assert.deepEqual(giorniDelPeriodo(trip({ startDate: '2026-09-10', endDate: '2026-09-10' })), ['2026-09-10']);
});

test('le spese fuori dal periodo dichiarato si segnalano, mai un blocco', () => {
  const t = trip({ startDate: '2026-09-10', endDate: '2026-09-12' });
  const spese = [
    { date: '2026-09-11', amount: 20 },
    { date: '2026-09-09', amount: 45 }, // il giorno prima di partire
  ];
  const fuori = speseFuoriPeriodo(t, spese);
  assert.equal(fuori.length, 1);
  assert.equal(fuori[0].amount, 45);
});

test('senza un periodo dichiarato, nessuna spesa risulta "fuori" — non c\'è nulla da confrontare', () => {
  assert.deepEqual(speseFuoriPeriodo(trip(), [{ date: '2026-09-09', amount: 45 }]), []);
});

// IL CASO CHE HA MOTIVATO TUTTO: una trasferta di più giorni con un giorno
// dimenticato. È l'informazione che nessuno vede finché non la cerca chi
// approva — e allora la nota spese torna indietro.
test('un giorno del periodo senza nessuna spesa risulta scoperto', () => {
  const t = trip({ startDate: '2026-09-10', endDate: '2026-09-13' });
  const spese = [{ date: '2026-09-10', amount: 10 }, { date: '2026-09-12', amount: 10 }, { date: '2026-09-13', amount: 10 }];
  assert.deepEqual(giorniScoperti(t, spese), ['2026-09-11']);
});

test('tutti i giorni coperti: nessun buco', () => {
  const t = trip({ startDate: '2026-09-10', endDate: '2026-09-11' });
  const spese = [{ date: '2026-09-10', amount: 1 }, { date: '2026-09-11', amount: 1 }];
  assert.deepEqual(giorniScoperti(t, spese), []);
});

// ── DIARIA A ORE (struttura tedesca, ripresa in gran parte d'Europa) ──

test('diaria: sotto le 8 ore non spetta nulla', () => {
  const t = trip({ startDate: '2026-09-10', startTime: '09:00', endDate: '2026-09-10', endTime: '16:00' }); // 7 ore
  const d = diariaSpettante(t, { piena: 28, ridotta: 14 });
  assert.equal(d.sottoSoglia, true);
  assert.equal(d.totale, 0);
});

test('diaria: fra 8 e 24 ore spetta UNA quota ridotta, anche a cavallo di due giorni civili', () => {
  const t = trip({ startDate: '2026-09-10', startTime: '20:00', endDate: '2026-09-11', endTime: '05:00' }); // 9 ore, due giorni civili
  const d = diariaSpettante(t, { piena: 28, ridotta: 14 });
  assert.equal(d.giorniRidotti, 1);
  assert.equal(d.giorniPieni, 0);
  assert.equal(d.totale, 14);
});

test('diaria: oltre le 24 ore, primo e ultimo giorno ridotti, quelli in mezzo pieni', () => {
  // Quattro giorni civili, oltre le 24 ore.
  const t = trip({ startDate: '2026-09-10', startTime: '08:00', endDate: '2026-09-13', endTime: '18:00' });
  const d = diariaSpettante(t, { piena: 28, ridotta: 14 });
  assert.equal(d.giorniPieni, 2);   // 11 e 12
  assert.equal(d.giorniRidotti, 2); // 10 e 13
  assert.equal(d.lordo, 2 * 28 + 2 * 14);
});

test('diaria: senza tariffe impostate non si calcola nulla, ma si dice perché', () => {
  const t = trip({ startDate: '2026-09-10', startTime: '08:00', endDate: '2026-09-11', endTime: '08:00' });
  const d = diariaSpettante(t);
  assert.equal(d.calcolabile, false);
  assert.match(d.motivo, /tariffe/i);
});

test('diaria: un pasto offerto riduce la quota (regola tedesca: 20/40/40)', () => {
  const t = trip({
    startDate: '2026-09-10', startTime: '08:00', endDate: '2026-09-11', endTime: '20:00',
    offeredItems: [{ tripCategory: 'vitto', mealType: 'cena', amount: 0, description: 'Cena col cliente' }],
  });
  const d = diariaSpettante(t, { piena: 28, ridotta: 14 });
  assert.equal(d.riduzioni, Math.round(28 * RIDUZIONE_PASTO.cena * 100) / 100);
  assert.ok(d.totale < d.lordo);
});

test('diaria: più pasti offerti si sommano, ma mai sotto zero', () => {
  const t = trip({
    startDate: '2026-09-10', startTime: '00:00', endDate: '2026-09-10', endTime: '10:00',
    offeredItems: [
      { tripCategory: 'vitto', mealType: 'colazione' },
      { tripCategory: 'vitto', mealType: 'pranzo' },
    ],
  });
  const d = diariaSpettante(t, { piena: 28, ridotta: 14 });
  // 20% + 40% di 28 = 16.80, sotto la quota ridotta di 14: non deve andare negativo.
  assert.ok(d.totale >= 0);
});

test('riduzioniPerPastiOfferti: un mealType non riconosciuto non riduce nulla', () => {
  const t = trip({ offeredItems: [{ tripCategory: 'vitto', mealType: 'brunch' }] });
  assert.equal(riduzioniPerPastiOfferti(t, 28), 0);
});

test('riduzioniPerPastiOfferti: senza una quota piena valida, zero e nessun crash', () => {
  assert.equal(riduzioniPerPastiOfferti(trip(), 0), 0);
  assert.equal(riduzioniPerPastiOfferti(trip(), null), 0);
});

test('dati sporchi non rompono nulla', () => {
  assert.equal(periodoTrasferta(null), null);
  assert.deepEqual(giorniDelPeriodo(null), []);
  assert.deepEqual(giorniScoperti(null, []), []);
  assert.deepEqual(speseFuoriPeriodo(null, []), []);
});
