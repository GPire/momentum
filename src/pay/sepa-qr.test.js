import test from 'node:test';
import assert from 'node:assert/strict';
const { isValidIBAN, buildEpcPayload, sepaFallbackText, normalizeIBAN } = await import('./sepa-qr.js');

test('isValidIBAN: accetta IBAN reali validi (mod-97), rifiuta i typo', () => {
  assert.equal(isValidIBAN('DE89 3704 0044 0532 0130 00'), true);       // classico valido
  assert.equal(isValidIBAN('IT60X0542811101000000123456'), true);       // esempio IT valido
  assert.equal(isValidIBAN('GB82 WEST 1234 5698 7654 32'), true);
  assert.equal(isValidIBAN('DE89370400440532013001'), false);           // ultima cifra errata
  assert.equal(isValidIBAN('IT00X0542811101000000123456'), false);      // checksum 00
  assert.equal(isValidIBAN('NOTANIBAN'), false);
  assert.equal(isValidIBAN(''), false);
});

test('buildEpcPayload: struttura EPC069-12 corretta per un bonifico valido', () => {
  const r = buildEpcPayload({ name: 'Mario Rossi', iban: 'IT60X0542811101000000123456', amount: 100, remittance: 'Risparmio luglio' });
  assert.equal(r.ok, true);
  const lines = r.payload.split('\n');
  assert.equal(lines[0], 'BCD');
  assert.equal(lines[1], '002');
  assert.equal(lines[2], '1');
  assert.equal(lines[3], 'SCT');
  assert.equal(lines[4], '');                       // BIC vuoto ammesso in v002
  assert.equal(lines[5], 'Mario Rossi');
  assert.equal(lines[6], 'IT60X0542811101000000123456');
  assert.equal(lines[7], 'EUR100.00');
  assert.equal(lines[10], 'Risparmio luglio');
  assert.ok(r.bytes <= 331);
});

test('buildEpcPayload: importo formattato EUR con 2 decimali e punto', () => {
  assert.equal(buildEpcPayload({ name: 'X', iban: 'DE89370400440532013000', amount: 12.5 }).amountFormatted, 'EUR12.50');
  assert.equal(buildEpcPayload({ name: 'X', iban: 'DE89370400440532013000', amount: 0.999 }).amountFormatted, 'EUR1.00');
});

test('buildEpcPayload: IBAN non valido → ok:false con errore chiaro', () => {
  const r = buildEpcPayload({ name: 'X', iban: 'IT00X0542811101000000123456', amount: 10 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => /IBAN/.test(e)));
});

test('buildEpcPayload: importo fuori limiti SEPA → errore', () => {
  assert.ok(buildEpcPayload({ name: 'X', iban: 'DE89370400440532013000', amount: 0 }).errors.some(e => /importo/.test(e)));
  assert.ok(buildEpcPayload({ name: 'X', iban: 'DE89370400440532013000', amount: 1e12 }).errors.some(e => /importo/.test(e)));
});

test('buildEpcPayload: nome/causale troncati ai limiti, mai payload oltre 331 byte', () => {
  const r = buildEpcPayload({ name: 'N'.repeat(200), iban: 'DE89370400440532013000', amount: 5, remittance: 'C'.repeat(300) });
  const lines = r.payload.split('\n');
  assert.ok(lines[5].length <= 70);
  assert.ok(lines[10].length <= 140);
  assert.ok(r.bytes <= 331);
});

test('sepaFallbackText: testo copiabile chiaro dove il QR non è supportato', () => {
  const t = sepaFallbackText({ name: 'Studio Rossi', iban: 'IT60X0542811101000000123456', amount: 250, remittance: 'Fattura 3' });
  assert.ok(/Beneficiario: Studio Rossi/.test(t));
  assert.ok(/IBAN: IT60X0542811101000000123456/.test(t));
  assert.ok(/Importo: 250,00 €/.test(t));
  assert.ok(/Causale: Fattura 3/.test(t));
});
