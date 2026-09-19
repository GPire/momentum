import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ocrLanguagesFor } from './ocr-languages.js';

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
