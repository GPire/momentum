import test from 'node:test';
import assert from 'node:assert/strict';
const { invoicePdfBytes, invoiceFilename } = await import('./invoice-pdf.js');
const { computeInvoice } = await import('./invoice-engine.js');

function pdfText(bytes) { return Array.from(bytes).map(b => String.fromCharCode(b)).join(''); }

test('invoicePdfBytes: produce un PDF VALIDO (header, trailer, xref)', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario' });
  const bytes = invoicePdfBytes(inv, { number: 3, year: 2026, client: 'Studio Rossi', emitter: 'Mario Bianchi', description: 'Consulenza' });
  const s = pdfText(bytes);
  assert.ok(s.startsWith('%PDF-1.4'), 'deve iniziare con l\'header PDF');
  assert.ok(s.includes('/Type/Catalog'));
  assert.ok(s.includes('/BaseFont/Times-Roman'));
  assert.ok(/startxref\n\d+\n%%EOF$/.test(s), 'deve avere xref e trailer validi');
});

test('invoicePdfBytes: la lunghezza dichiarata dello stream combacia coi byte reali', () => {
  const inv = computeInvoice({ imponibile: 500, regime: 'forfettario' });
  const s = pdfText(invoicePdfBytes(inv, { number: 1, year: 2026, client: 'Beta', emitter: 'X' }));
  const declared = +s.match(/\/Length (\d+)>>\nstream\n/)[1];
  const stream = s.match(/>>\nstream\n([\s\S]*?)\nendstream/)[1];
  assert.equal(stream.length, declared, 'Length deve combaciare col contenuto reale (PDF valido)');
});

test('invoicePdfBytes: contiene i numeri e il testo della fattura', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'ordinario' });
  const s = pdfText(invoicePdfBytes(inv, { number: 5, year: 2026, client: 'Acme', emitter: 'Studio', description: 'Sviluppo' }));
  assert.ok(s.includes('Fattura n. 5/2026'));
  assert.ok(s.includes('1.068,80') || s.includes('1068,80')); // netto a ricevere ordinario
  assert.ok(s.includes('Netto a ricevere'));
});

test('invoicePdfBytes: € e accenti non rompono il PDF (WinAnsi)', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario' });
  const bytes = invoicePdfBytes(inv, { number: 1, year: 2026, client: 'Società Àèìòù', emitter: 'Perù' });
  const s = pdfText(bytes);
  assert.ok(s.startsWith('%PDF-1.4'));
  // € codificato come byte 0x80 (WinAnsi), non spezza la stringa
  assert.ok(bytes.includes(0x80));
});

test('invoicePdfBytes: parentesi nel testo vengono ESCAPATE (PDF non corrotto)', () => {
  const inv = computeInvoice({ imponibile: 100, regime: 'forfettario' });
  const s = pdfText(invoicePdfBytes(inv, { number: 1, year: 2026, client: 'Rossi (SRL)', emitter: 'X' }));
  assert.ok(s.includes('Rossi \\(SRL\\)'), 'le parentesi devono essere escapate con backslash');
});

test('invoiceFilename: nome intelligente con numero, cliente slug e data', () => {
  const f = invoiceFilename({ number: 7, year: 2026, client: 'Studio Rossi & C.', isoDate: '2026-07-20' });
  assert.equal(f, 'Fattura_7-2026_Studio-Rossi-C_2026-07-20.pdf');
});

test('invoiceFilename: cliente vuoto → fallback, mai un nome rotto', () => {
  const f = invoiceFilename({ number: 1, year: 2026, isoDate: '2026-01-01' });
  assert.ok(/^Fattura_1-2026_cliente_2026-01-01\.pdf$/.test(f));
});
