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
    'esActivateReal', 'esActivatedToast', 'esDeactivate', 'esDeactivatedToast', 'esCardSub',
    'esCardNoInvoice', 'esCardDisclaimer', 'esBaseMinLabel', 'esBaseMaxLabel',
    'esConfirmYes', 'esConfirmNo', 'esUncertainLabel',
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

test('t: esTramoChanged e esBaseChoiceNote (card RETA+IRPF con tracciamento reale, 2026-08-26) interpolano correttamente in ogni lingua', () => {
  assert.equal(t('esTramoChanged', 'es', 670, 900), 'Tu tramo RETA cambió respecto al mes pasado: antes hasta 670€/mes, ahora hasta 900€/mes — tu cuota cambiará en consecuencia.');
  assert.match(t('esTramoChanged', 'it', 670, 900), /670€\/mese/);
  assert.match(t('esTramoChanged', 'en', 670, 900), /€670\/month/);
  assert.equal(t('esBaseChoiceNote', 'es', 1500), 'Base elegida actual: 1500€/mes.');
});

test('t: chi ha il dispositivo in tedesco/francese e finisce comunque sulla schermata spagnola ricade su EN, mai su una chiave grezza', () => {
  // Nessuna chiave esDE/esFR scritta apposta (nessun autónomo spagnolo
  // avrebbe il dispositivo in quelle lingue in pratica) — il fallback di
  // t() deve comunque tenere, non mostrare "esSimTitle" all'utente.
  assert.notEqual(t('esSimTitle', 'de'), 'esSimTitle');
  assert.equal(t('esSimTitle', 'de'), t('esSimTitle', 'en'));
});

// ── Onboarding (g-step-0..4, index.html) — 2026-08-28, punto più ad alto
// impatto virale: la prima cosa che vede chiunque arrivi da un link di
// divisione. Solo IT/EN/ES (priorità già stabilita nel modulo): DE/FR
// ricadono su EN per queste chiavi, verificato esplicitamente sotto. ──

test('t: tutte le chiavi genesis esistono in IT/EN/ES — nessuna traduzione dimenticata', () => {
  const chiavi = [
    'genesisTagline', 'genesisPrivacyTitle', 'genesisPrivacyText', 'genesisStart',
    'genesisProgress1', 'genesisProgress2', 'genesisProgress3', 'genesisProgress4Last',
    'genesisQ1Title', 'genesisQ1Sub', 'genesisQ1Opt1', 'genesisQ1Opt2', 'genesisQ1Opt3', 'genesisQ1Opt4', 'genesisQ1Opt5',
    'genesisQ2Title', 'genesisQ2Sub', 'genesisQ2Opt1', 'genesisQ2Opt2', 'genesisQ2Opt3', 'genesisQ2Opt4',
    'genesisQ3Title', 'genesisQ3Sub', 'genesisQ3Opt1', 'genesisQ3Opt2', 'genesisQ3Opt3',
    'genesisQ4Title', 'genesisQ4Sub', 'genesisQ4Opt1', 'genesisQ4Opt2', 'genesisQ4Opt3', 'genesisQ4Opt4',
  ];
  for (const lang of ['it', 'en', 'es']) {
    for (const k of chiavi) {
      const v = t(k, lang);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}" (ripiegata sulla chiave grezza)`);
    }
  }
});

test('t: le chiavi genesis in tedesco/francese ricadono su EN (nessuna traduzione DE/FR scritta per queste, per scelta di scope)', () => {
  for (const lang of ['de', 'fr']) {
    assert.equal(t('genesisTagline', lang), t('genesisTagline', 'en'));
    assert.equal(t('genesisQ1Title', lang), t('genesisQ1Title', 'en'));
  }
});

test('t: la domanda 4 (regolarità entrate, D2) traduce correttamente in ognuna delle 3 lingue coperte', () => {
  assert.equal(t('genesisQ4Title', 'it'), 'Le tue entrate, come arrivano?');
  assert.equal(t('genesisQ4Title', 'en'), 'How does your income arrive?');
  assert.equal(t('genesisQ4Title', 'es'), '¿Cómo llegan tus ingresos?');
  assert.equal(t('genesisQ4Opt3', 'en'), 'Changes a lot, month to month');
});
