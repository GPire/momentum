import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReceiptOcrReport } from './receipt-ocr-transparency.js';

test('tutto trovato da immagine: confidenza propagata, nessun avviso', () => {
  const r = buildReceiptOcrReport(
    { amount: 45.8, description: 'Ristorante Da Mario', date: new Date(2026, 6, 12), currency: 'EUR', confidence: 'alta', rawText: 'RISTORANTE DA MARIO\nTOTALE 45,80' },
    { tripCurrency: 'EUR', source: 'image', currentDate: '2026-07-12' }
  );
  assert.equal(r.ok, true);
  assert.equal(r.missing.length, 0);
  assert.equal(r.warnings.length, 0);
  assert.equal(r.found.find(f => f.field === 'amount').confidence, 'alta');
  assert.ok(r.rawText.includes('TOTALE'));
});

test('PDF: campi trovati sono sempre confidenza alta (testo vero, non OCR)', () => {
  const r = buildReceiptOcrReport(
    { amount: 120, description: 'Hotel Berlin GmbH', date: new Date(2026, 8, 1), currency: 'EUR' },
    { tripCurrency: 'EUR', source: 'pdf' }
  );
  assert.equal(r.found.every(f => f.confidence === 'alta'), true);
  assert.equal(r.rawText, null); // mai il testo grezzo per un PDF: è già il documento
});

test('nessun importo riconosciuto: report onesto, mai bloccato in silenzio', () => {
  const r = buildReceiptOcrReport(null, { tripCurrency: 'EUR', source: 'image' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing.sort(), ['amount', 'currency', 'date', 'merchant']);
  assert.equal(r.found.length, 0);
});

test('valuta scontrino diversa dalla trasferta: avviso, mai conversione automatica', () => {
  const r = buildReceiptOcrReport(
    { amount: 20, description: 'Diner', currency: 'USD' },
    { tripCurrency: 'EUR', source: 'image' }
  );
  const w = r.warnings.find(x => x.type === 'currency-mismatch');
  assert.ok(w);
  assert.equal(w.receiptCurrency, 'USD');
  assert.equal(w.tripCurrency, 'EUR');
});

test('valuta scontrino uguale alla trasferta: nessun avviso', () => {
  const r = buildReceiptOcrReport({ amount: 20, currency: 'EUR' }, { tripCurrency: 'EUR', source: 'image' });
  assert.equal(r.warnings.some(x => x.type === 'currency-mismatch'), false);
});

test('data letta diversa da quella già impostata: avviso con la data letta, mai sovrascritta da sola', () => {
  const r = buildReceiptOcrReport(
    { amount: 10, date: new Date(2026, 6, 10) },
    { tripCurrency: 'EUR', source: 'image', currentDate: '2026-07-12' }
  );
  const w = r.warnings.find(x => x.type === 'date-differs');
  assert.ok(w);
  assert.equal(w.ocrDate, '2026-07-10');
  assert.equal(w.currentDate, '2026-07-12');
});

test('data letta uguale a quella già impostata: nessun avviso ridondante', () => {
  const r = buildReceiptOcrReport(
    { amount: 10, date: new Date(2026, 6, 12) },
    { tripCurrency: 'EUR', source: 'image', currentDate: '2026-07-12' }
  );
  assert.equal(r.warnings.some(x => x.type === 'date-differs'), false);
});

test('data non valida trattata come mancante, non come crash', () => {
  const r = buildReceiptOcrReport({ amount: 10, date: new Date(NaN) }, { source: 'image' });
  assert.ok(r.missing.includes('date'));
});

test('importo zero o negativo non è un importo trovato', () => {
  assert.ok(buildReceiptOcrReport({ amount: 0 }, {}).missing.includes('amount'));
  assert.ok(buildReceiptOcrReport({ amount: -5 }, {}).missing.includes('amount'));
});

// Data ambigua gg/mm vs mm/gg (2026-09-19): mai una confidenza piena su una
// data che è genuinamente un colpo di moneta fra due interpretazioni valide.
test('dateAmbiguous: confidenza abbassata a "bassa" e avviso con entrambe le date possibili', () => {
  const r = buildReceiptOcrReport(
    { amount: 10, date: new Date(2026, 3, 3), dateAmbiguous: true }, // 3 aprile scelto, ma potrebbe essere 4 marzo
    { source: 'image' }
  );
  const campoData = r.found.find(f => f.field === 'date');
  assert.equal(campoData.confidence, 'bassa');
  const w = r.warnings.find(x => x.type === 'date-ambiguous');
  assert.ok(w);
  assert.equal(w.chosenDate, '2026-04-03');
  assert.equal(w.alternateDate, '2026-03-04');
});

test('dateAmbiguous assente (data inequivocabile): nessun avviso, confidenza normale', () => {
  const r = buildReceiptOcrReport({ amount: 10, date: new Date(2026, 3, 25) }, { source: 'image' });
  assert.equal(r.warnings.some(x => x.type === 'date-ambiguous'), false);
  assert.equal(r.found.find(f => f.field === 'date').confidence, 'media');
});

test('dateAmbiguous da un PDF: confidenza comunque abbassata a "bassa" (l\'ambiguità non dipende dalla fonte)', () => {
  const r = buildReceiptOcrReport({ amount: 10, date: new Date(2026, 3, 3), dateAmbiguous: true }, { source: 'pdf' });
  assert.equal(r.found.find(f => f.field === 'date').confidence, 'bassa');
});
