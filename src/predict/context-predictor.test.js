import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { slotOf, getTemporalAffinity, rankSuggestionsByContext } = await import('./context-predictor.js');

// Storia: caffè ogni mattina feriale alle 8; spesa grossa ogni sabato alle 11.
function history() {
  const allTx = {};
  const add = (iso, h, amount, description, category) => {
    const mk = iso.slice(0, 7);
    (allTx[mk] = allTx[mk] || []).push({ date: `${iso}T${String(h).padStart(2, '0')}:15:00`, amount, description, category, type: 'uscita' });
  };
  // giugno 2026: lun 1 giu. Caffè lun-ven alle 8 per 3 settimane
  for (let w = 0; w < 3; w++) {
    for (let d = 0; d < 5; d++) {
      add(`2026-06-${String(1 + w * 7 + d).padStart(2, '0')}`, 8, 1.20, 'Caffè bar', 'Ristorante');
    }
    add(`2026-06-${String(6 + w * 7).padStart(2, '0')}`, 11, 85, 'Esselunga spesa', 'Alimentari'); // sabati 6/13/20
  }
  return allTx;
}

test('slotOf: fasce orarie corrette', () => {
  assert.equal(slotOf(new Date(2026, 5, 1, 8)), 0);   // mattina
  assert.equal(slotOf(new Date(2026, 5, 1, 12)), 1);  // pranzo
  assert.equal(slotOf(new Date(2026, 5, 1, 17)), 2);  // pomeriggio
  assert.equal(slotOf(new Date(2026, 5, 1, 22)), 3);  // sera
  assert.equal(slotOf(new Date(2026, 5, 1, 3)), 3);   // notte = sera
});

test('getTemporalAffinity: pattern mattutino netto → lift alto e motivo spiegato', () => {
  const dates = Array.from({ length: 15 }, (_, i) => new Date(2026, 5, 1 + i, 8));
  const aff = getTemporalAffinity(dates, new Date(2026, 5, 22, 8, 30)); // lunedì mattina
  assert.ok(aff.slotLift > 2, `slotLift atteso alto, trovato ${aff.slotLift}`);
  assert.equal(aff.reason, 'di solito la mattina');
});

test('getTemporalAffinity: fuori fascia → lift sotto 1 (penalizzato, mai azzerato)', () => {
  const dates = Array.from({ length: 15 }, (_, i) => new Date(2026, 5, 1 + i, 8));
  const aff = getTemporalAffinity(dates, new Date(2026, 5, 22, 21)); // sera
  assert.ok(aff.slotLift < 0.5 && aff.slotLift > 0, `atteso basso ma >0, trovato ${aff.slotLift}`);
});

test('getTemporalAffinity: senza occorrenze → neutro, nessun motivo inventato', () => {
  const aff = getTemporalAffinity([], new Date(2026, 5, 22, 8));
  assert.equal(aff.lift, 1);
  assert.equal(aff.reason, null);
});

test('rank: lunedì alle 8 il caffè batte la spesa; sabato a mezzogiorno vince la spesa', () => {
  const allTx = history();
  const suggestions = [
    { description: 'Caffè bar', category: 'Ristorante', amount: 1.20, type: 'uscita', occurrences: 15 },
    { description: 'Esselunga spesa', category: 'Alimentari', amount: 85, type: 'uscita', occurrences: 3 },
  ];
  const lunedi8 = rankSuggestionsByContext(suggestions, allTx, new Date(2026, 5, 22, 8, 30));
  assert.equal(lunedi8[0].description, 'Caffè bar');
  assert.ok(lunedi8[0].reason, 'il primo posto deve essere spiegato');

  const sabato12 = rankSuggestionsByContext(suggestions, allTx, new Date(2026, 5, 27, 12, 0));
  assert.equal(sabato12[0].description, 'Esselunga spesa', 'il sabato a pranzo la spesa deve superare il caffè nonostante meno occorrenze');
});

test('rank: senza pattern temporale l\'ordine per frequenza resta invariato', () => {
  // occorrenze spalmate uniformemente su fasce e giorni
  const allTx = { '2026-06': [] };
  let day = 1;
  for (const h of [8, 12, 17, 21]) {
    for (let i = 0; i < 2; i++) {
      allTx['2026-06'].push({ date: `2026-06-${String(day++).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00`, amount: 5, description: 'Generico', category: 'Svago', type: 'uscita' });
    }
  }
  const suggestions = [
    { description: 'Generico', category: 'Svago', amount: 5, type: 'uscita', occurrences: 8 },
    { description: 'Raro', category: 'Svago', amount: 3, type: 'uscita', occurrences: 3 },
  ];
  const ranked = rankSuggestionsByContext(suggestions, allTx, new Date(2026, 5, 22, 8));
  assert.equal(ranked[0].description, 'Generico'); // la frequenza decide ancora
});
