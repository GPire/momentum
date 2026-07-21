// ============================================================
// SIMULAZIONE ANTI-DUPLICAZIONE cross-canale (garanzia richiesta dall'utente)
// ============================================================
// Garanzia: la STESSA operazione inserita da canali diversi — manuale, CSV, PDF,
// screenshot/OCR, bonifico SEPA registrato — NON deve duplicarsi. Qui si
// simulano molte casistiche reali (prefissi bancari, Satispay, OCR imperfetto,
// tolleranza importo, finestra temporale, RI-import idempotente, confine di mese)
// e si verifica il comportamento del deduplicatore che alimenta addTransaction.
import test from 'node:test';
import assert from 'node:assert/strict';
const { findDuplicate, reconcileTransaction, descriptionSimilarity } = await import('./deduplicator.js');

// Simula il flusso di addTransaction su un log piatto: per ogni tx in arrivo,
// se trova un duplicato fonde, altrimenti inserisce. Ritorna il log finale.
function ingest(stream, opts = {}) {
  const log = [];
  for (const tx of stream) {
    const r = reconcileTransaction(tx, log, opts);
    if (r.action === 'insert') log.push({ ...tx });
    else { const i = log.findIndex(t => t.id === r.targetId); log[i] = { ...log[i], ...r.transaction }; }
  }
  return log;
}

test('SIM: stesso acquisto da 3 canali (manuale, CSV, screenshot) → 1 sola tx', () => {
  const stream = [
    { id: 1, date: '2026-07-10T12:00:00Z', amount: 4.5, type: 'uscita', category: 'Bar', description: 'Bar Roma', source: 'manual' },
    { id: 2, date: '2026-07-10T12:05:00Z', amount: 4.5, type: 'uscita', description: 'SATISPAY*BAR ROMA', source: 'csv' },
    { id: 3, date: '2026-07-10T13:00:00Z', amount: 4.5, type: 'uscita', description: 'Bar Roma', source: 'image' },
  ];
  const log = ingest(stream);
  assert.equal(log.length, 1, 'le 3 fonti devono fondersi in una');
  assert.equal(log[0].category, 'Bar'); // categoria del manuale conservata
});

test('SIM: RI-import dello stesso CSV due volte → nessuna crescita (idempotente)', () => {
  const csv = [
    { id: 10, date: '2026-07-01T09:00:00Z', amount: 30, type: 'uscita', description: 'ESSELUNGA MILANO', source: 'csv' },
    { id: 11, date: '2026-07-03T18:30:00Z', amount: 12.9, type: 'uscita', description: 'NETFLIX.COM', source: 'csv' },
  ];
  const log1 = ingest(csv);
  const log2 = ingest([...csv, ...csv.map(t => ({ ...t, id: t.id + 100 }))]); // stesso file due volte
  assert.equal(log1.length, 2);
  assert.equal(log2.length, 2, 're-importare lo stesso file non deve duplicare');
});

test('SIM: due acquisti DISTINTI di importo diverso lo stesso giorno → 2 tx (nessuna falsa fusione)', () => {
  const stream = [
    { id: 20, date: '2026-07-10T08:00:00Z', amount: 1.2, type: 'uscita', description: 'Caffè', source: 'manual' },
    { id: 21, date: '2026-07-10T16:00:00Z', amount: 35, type: 'uscita', description: 'Spesa', source: 'manual' },
  ];
  assert.equal(ingest(stream).length, 2);
});

test('SIM: entrata e uscita di pari importo lo stesso giorno → 2 tx (tipo diverso non fonde)', () => {
  const stream = [
    { id: 30, date: '2026-07-10T09:00:00Z', amount: 100, type: 'entrata', description: 'Rimborso', source: 'manual' },
    { id: 31, date: '2026-07-10T10:00:00Z', amount: 100, type: 'uscita', description: 'Rimborso', source: 'manual' },
  ];
  assert.equal(ingest(stream).length, 2);
});

test('SIM: OCR imperfetto (accenti/maiuscole/prefisso POS) → riconosciuto come stesso', () => {
  assert.ok(descriptionSimilarity('POS FARMACIA S. ANNA', 'Farmacia Sant Anna') >= 0.5);
  const stream = [
    { id: 40, date: '2026-07-10T11:00:00Z', amount: 9.9, type: 'uscita', description: 'Farmacia Sant Anna', source: 'manual' },
    { id: 41, date: '2026-07-10T11:20:00Z', amount: 9.9, type: 'uscita', description: 'FARMACIA SANT ANNA', source: 'image' },
  ];
  assert.equal(ingest(stream).length, 1);
});

test('SIM: oltre la finestra di 48h → NON è duplicato (due addebiti ricorrenti distinti)', () => {
  const stream = [
    { id: 50, date: '2026-06-10T10:00:00Z', amount: 12.9, type: 'uscita', description: 'NETFLIX', source: 'csv' },
    { id: 51, date: '2026-07-10T10:00:00Z', amount: 12.9, type: 'uscita', description: 'NETFLIX', source: 'csv' },
  ];
  assert.equal(ingest(stream).length, 2, 'due mesi diversi = due addebiti reali, non un duplicato');
});

test('SIM: bonifico SEPA registrato + stesso movimento poi nel CSV della banca → 1 sola tx', () => {
  const stream = [
    // il movimento auto-avviato porta il flag selfTransfer (lo mette Momentum)
    { id: 60, date: '2026-07-10T10:00:00Z', amount: 200, type: 'invest', category: 'risparmio', description: 'Risparmio avanzo (da spostare tu)', source: 'sepa', selfTransfer: true },
    { id: 61, date: '2026-07-10T10:30:00Z', amount: 200, type: 'invest', description: 'BONIFICO SEPA RISPARMIO', source: 'csv' },
  ];
  // descrizioni MOLTO diverse, ma il flag selfTransfer riconcilia su importo+tipo+finestra
  const log = ingest(stream);
  assert.equal(log.length, 1, 'il bonifico auto-avviato e il rigo banca sono lo stesso movimento');
});

// --- CONFINE DI MESE: il buco che addTransaction (bucket per-mese) avrebbe ---
test('SIM: stessa tx a cavallo di due mesi (31/1 23:00 vs 1/2 00:30) → deve restare 1', () => {
  const a = { id: 70, date: '2026-01-31T23:00:00Z', amount: 50, type: 'uscita', description: 'Cena', source: 'manual' };
  const b = { id: 71, date: '2026-02-01T00:30:00Z', amount: 50, type: 'uscita', description: 'Cena', source: 'csv' };
  // il deduplicatore su un log PIATTO (tutti i mesi) le riconosce come duplicato:
  assert.ok(findDuplicate(b, [a]) !== null, 'entro 48h sono la stessa: la logica di dedup le vede');
});
