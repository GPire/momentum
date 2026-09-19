import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ocrLanguagesFor, NON_LATIN_OCR_LANGUAGES, isNonLatinOcrLanguage } from './ocr-languages.js';

test('Paese trasferta noto vince sulla lingua interfaccia', () => {
  assert.equal(ocrLanguagesFor({ tripCountry: 'DE', uiLang: 'it' }), 'deu+eng');
});

test('Paese USA/UK -> solo inglese (nessun eng+eng ridondante)', () => {
  assert.equal(ocrLanguagesFor({ tripCountry: 'US', uiLang: 'it' }), 'eng');
  assert.equal(ocrLanguagesFor({ tripCountry: 'UK', uiLang: 'de' }), 'eng');
});

test('senza Paese noto, ricade sulla lingua interfaccia', () => {
  assert.equal(ocrLanguagesFor({ tripCountry: 'ALTRO', uiLang: 'fr' }), 'fra+eng');
  assert.equal(ocrLanguagesFor({ tripCountry: null, uiLang: 'es' }), 'spa+eng');
  assert.equal(ocrLanguagesFor({ uiLang: 'nl' }), 'nld+eng');
  assert.equal(ocrLanguagesFor({ uiLang: 'pt' }), 'por+eng');
});

test('interfaccia in inglese -> solo inglese', () => {
  assert.equal(ocrLanguagesFor({ uiLang: 'en' }), 'eng');
});

test('nessun dato disponibile -> italiano+inglese (default storico del progetto)', () => {
  assert.equal(ocrLanguagesFor({}), 'ita+eng');
  assert.equal(ocrLanguagesFor(), 'ita+eng');
});

test('lingua interfaccia sconosciuta -> fallback italiano+inglese', () => {
  assert.equal(ocrLanguagesFor({ uiLang: 'xx' }), 'ita+eng');
});

test('override esplicito vince SEMPRE su Paese trasferta e lingua interfaccia', () => {
  assert.equal(ocrLanguagesFor({ tripCountry: 'DE', uiLang: 'it', override: 'jpn' }), 'jpn+eng');
  assert.equal(ocrLanguagesFor({ override: 'rus' }), 'rus+eng');
});

test('override "eng" non produce eng+eng ridondante', () => {
  assert.equal(ocrLanguagesFor({ override: 'eng' }), 'eng');
});

test('elenco lingue non latine: codici unici, tutti riconosciuti da isNonLatinOcrLanguage', () => {
  const codes = NON_LATIN_OCR_LANGUAGES.map(l => l.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const c of codes) assert.equal(isNonLatinOcrLanguage(c), true);
  assert.equal(isNonLatinOcrLanguage('ita'), false);
  assert.equal(isNonLatinOcrLanguage(undefined), false);
});
