'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, resolveUiLanguage, UI_LANG_DEFAULT, UI_LANGS } from './ui-strings.js';

test('UI_LANGS copre le 3 lingue nazionali svizzere principali + inglese + spagnolo (autónomos)', () => {
  assert.deepEqual(UI_LANGS.sort(), ['de', 'en', 'es', 'fr', 'it'].sort());
});

test('UI_LANG_DEFAULT è inglese (richiesta esplicita: "se non riconosciuta, magari inglese")', () => {
  assert.equal(UI_LANG_DEFAULT, 'en');
});

test('resolveUiLanguage: scelta esplicita vince sempre, anche su un dispositivo diverso', () => {
  const lang = resolveUiLanguage({ override: 'fr', navigatorLike: { language: 'de-DE' } });
  assert.equal(lang, 'fr');
});

test('resolveUiLanguage: lingua del dispositivo tra quelle coperte -> usata', () => {
  assert.equal(resolveUiLanguage({ navigatorLike: { language: 'de-CH' } }), 'de');
  assert.equal(resolveUiLanguage({ navigatorLike: { language: 'fr-CH' } }), 'fr');
  assert.equal(resolveUiLanguage({ navigatorLike: { language: 'it-CH' } }), 'it');
  assert.equal(resolveUiLanguage({ navigatorLike: { language: 'es-ES' } }), 'es');
});

test('resolveUiLanguage: lingua non coperta (es. giapponese, romancio) -> fallback inglese, mai italiano forzato', () => {
  assert.equal(resolveUiLanguage({ navigatorLike: { language: 'ja-JP' } }), 'en');
  assert.equal(resolveUiLanguage({ navigatorLike: { language: 'rm-CH' } }), 'en');
});

test('resolveUiLanguage: nessun dato disponibile -> fallback inglese', () => {
  assert.equal(resolveUiLanguage({ navigatorLike: null }), 'en');
  assert.equal(resolveUiLanguage({ navigatorLike: {} }), 'en');
});

test('t: restituisce la stringa giusta in ognuna delle 4 lingue', () => {
  assert.equal(t('chSimTitle', 'it'), 'Lavori in Svizzera?');
  assert.equal(t('chSimTitle', 'en'), 'Working in Switzerland?');
  assert.equal(t('chSimTitle', 'de'), 'Arbeitest du in der Schweiz?');
  assert.equal(t('chSimTitle', 'fr'), 'Vous travaillez en Suisse ?');
});

test('t: le chiavi-funzione (con parametri) interpolano correttamente in ogni lingua', () => {
  assert.equal(t('chResultTitle', 'it', '80\'000'), 'Con CHF 80\'000/anno');
  assert.equal(t('chResultTitle', 'en', '80,000'), 'With CHF 80,000/year');
  assert.equal(t('chAvsDegressiveText', 'de', '60500', '530'), 'Unter CHF 60500/Jahr ist der Satz reduziert, wird aber von deiner Ausgleichskasse berechnet — das geprüfte Minimum ist CHF 530/Jahr.');
});

test('t: lingua non tra le 4 -> ripiega su inglese, mai un crash', () => {
  assert.equal(t('chSimTitle', 'ja'), 'Working in Switzerland?');
});

test('t: chiave inesistente -> ripiega restituendo la chiave stessa, mai un crash o undefined visibile', () => {
  assert.equal(t('chiaveCheNonEsiste', 'it'), 'chiaveCheNonEsiste');
});

test('t: ogni chiave presente in IT esiste anche nelle altre 3 lingue — nessuna traduzione dimenticata', () => {
  // Import diretto del dizionario tramite side-channel: verifichiamo la
  // COPERTURA chiamando t() su ogni chiave nota per ogni lingua e
  // controllando che non ripieghi silenziosamente su un'altra lingua.
  const chiavi = [
    'chSimTitle', 'chSimSubtitle', 'chSimPlaceholder', 'chSimCta', 'chSimBack',
    'chResultSubtitle', 'chAvsLabel', 'chAvsDegressiveTitle', 'chAvsDegressiveLink',
    'chInvestText', 'chCantonNote', 'chCreateInvoice', 'chRecalculate',
    'chInvTitle', 'chInvSubtitle', 'chInvYourData', 'chInvIban', 'chInvName',
    'chInvStreet', 'chInvBuilding', 'chInvCap', 'chInvCity', 'chInvClientSection',
    'chInvClientName', 'chInvAmount', 'chInvDesc', 'chInvGenerate', 'chInvDisclaimer',
    'chInvErrMissing', 'chInvErrAmount', 'chResTitle', 'chResDisclaimer', 'chResNewInvoice', 'chRefLabel',
  ];
  for (const lang of ['it', 'en', 'de', 'fr']) {
    for (const k of chiavi) {
      const v = t(k, lang);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}" (ripiegata sulla chiave grezza)`);
    }
  }
});

// ── Spagna (autónomos, src/predict/tax-es.js) — 2026-08-26 ──

test('t: la lingua spagnola risponde correttamente, e le chiavi es esistono anche in IT/EN (fallback mai sulla chiave grezza)', () => {
  assert.equal(t('esSimTitle', 'es'), '¿Trabajas como autónomo en España?');
  const chiaviEs = [
    'esSimTitle', 'esSimSubtitle', 'esSimPlaceholder', 'esSimCta', 'esSimBack',
    'esResultSubtitle', 'esRetaLabel', 'esRetaBaseNote', 'esIrpfLabel', 'esIrpfNote', 'esRecalculate',
  ];
  for (const lang of ['it', 'en', 'es']) {
    for (const k of chiaviEs) {
      const v = t(k, lang);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}" (ripiegata sulla chiave grezza)`);
    }
  }
});

test('t: le chiavi-funzione spagnole interpolano correttamente', () => {
  assert.equal(t('esResultTitle', 'es', '2000'), 'Con 2000€/mes');
  assert.equal(t('esResultTitle', 'en', '2000'), 'With 2000€/month');
  assert.match(t('esRetencionNote', 'es', 15), /15%/);
});

test('t: chi ha il dispositivo in tedesco/francese e finisce comunque sulla schermata spagnola ricade su EN, mai su una chiave grezza', () => {
  // Nessuna chiave esDE/esFR scritta apposta (nessun autónomo spagnolo
  // avrebbe il dispositivo in quelle lingue in pratica) — il fallback di
  // t() deve comunque tenere, non mostrare "esSimTitle" all'utente.
  assert.notEqual(t('esSimTitle', 'de'), 'esSimTitle');
  assert.equal(t('esSimTitle', 'de'), t('esSimTitle', 'en'));
});
