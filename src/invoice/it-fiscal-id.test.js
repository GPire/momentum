import test from 'node:test';
import assert from 'node:assert/strict';
const { isValidPartitaIva, isValidCodiceFiscale, checkFiscalId } = await import('./it-fiscal-id.js');

test('isValidPartitaIva: accetta una P.IVA con checksum corretto, rifiuta il typo', () => {
  assert.equal(isValidPartitaIva('01234567897'), true);  // checksum valido
  assert.equal(isValidPartitaIva('01234567890'), false); // ultima cifra errata
  assert.equal(isValidPartitaIva('00000000000'), true);  // caso limite matematicamente valido
  assert.equal(isValidPartitaIva('1234567890'), false);  // 10 cifre
  assert.equal(isValidPartitaIva('abcdefghijk'), false); // non numerico
  assert.equal(isValidPartitaIva(''), false);
});

test('isValidCodiceFiscale: accetta un CF valido noto, rifiuta il carattere di controllo errato', () => {
  // CF di test standard (persona fittizia): carattere di controllo S.
  assert.equal(isValidCodiceFiscale('RSSMRA85T10A562S'), true);
  assert.equal(isValidCodiceFiscale('RSSMRA85T10A562X'), false); // controllo sbagliato
  assert.equal(isValidCodiceFiscale('rssmra85t10a562s'), true);  // case-insensitive
  assert.equal(isValidCodiceFiscale('RSSMRA85T10A562'), false);  // 15 char
  assert.equal(isValidCodiceFiscale('12345678901234567'), false); // troppo lungo
});

test('checkFiscalId: distingue P.IVA / CF / ignoto e segnala i typo', () => {
  assert.deepEqual(checkFiscalId('01234567897'), { ok: true, kind: 'piva' });
  assert.equal(checkFiscalId('01234567890').ok, false);
  assert.equal(checkFiscalId('01234567890').kind, 'piva');
  assert.deepEqual(checkFiscalId('RSSMRA85T10A562S'), { ok: true, kind: 'cf' });
  assert.equal(checkFiscalId('RSSMRA85T10A562X').ok, false);
  // formato estero/ignoto → non boccia (non è compito suo)
  assert.deepEqual(checkFiscalId('DE811234567'), { ok: true, kind: 'unknown' });
});
