import test from 'node:test';
import assert from 'node:assert/strict';
import { detectDeviceLanguage, resolveQaLanguage } from './detect.js';

test('detectDeviceLanguage: legge navigator.language e riduce a 2 lettere supportate', () => {
  assert.equal(detectDeviceLanguage({ language: 'en-US' }), 'en');
  assert.equal(detectDeviceLanguage({ language: 'it-IT' }), 'it');
  assert.equal(detectDeviceLanguage({ language: 'de' }), 'de');
});

test('detectDeviceLanguage: lingua non supportata → null', () => {
  assert.equal(detectDeviceLanguage({ language: 'ja-JP' }), null);
});

test('detectDeviceLanguage: usa languages[0] se language manca', () => {
  assert.equal(detectDeviceLanguage({ languages: ['fr-FR', 'en-US'] }), 'fr');
});

test('resolveQaLanguage: override manuale vince sempre', () => {
  const r = resolveQaLanguage('quanto posso spendere oggi?', { deviceLang: 'en', override: 'es' });
  assert.equal(r.lang, 'es');
  assert.equal(r.source, 'override');
});

test('resolveQaLanguage: override non supportato viene ignorato', () => {
  const r = resolveQaLanguage('how much can I spend today?', { deviceLang: 'it', override: 'xx' });
  assert.equal(r.lang, 'en');
  assert.equal(r.source, 'text');
});

test('resolveQaLanguage: testo con segnale chiaro vince sul device', () => {
  const r = resolveQaLanguage('how much can I spend today?', { deviceLang: 'it' });
  assert.equal(r.lang, 'en');
  assert.equal(r.source, 'text');
});

test('resolveQaLanguage: testo ambiguo cade sulla lingua del dispositivo (non più sempre it)', () => {
  const r = resolveQaLanguage('50', { deviceLang: 'en' });
  assert.equal(r.lang, 'en');
  assert.equal(r.source, 'device');
});

test('resolveQaLanguage: nessun segnale e nessun device → it di default', () => {
  const r = resolveQaLanguage('50', {});
  assert.equal(r.lang, 'it');
  assert.equal(r.source, 'default');
});
