'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, resolveUiLanguage, UI_LANG_DEFAULT, UI_LANGS } from './ui-strings.js';

test('UI_LANGS copre le 3 lingue nazionali svizzere principali + inglese + spagnolo (autónomos) + olandese + portoghese (2026-08-29, Brasile: gap PIX Nubank già nel repo)', () => {
  assert.deepEqual(UI_LANGS.sort(), ['de', 'en', 'es', 'fr', 'it', 'nl', 'pt'].sort());
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
  assert.equal(resolveUiLanguage({ navigatorLike: { language: 'nl-NL' } }), 'nl');
  assert.equal(resolveUiLanguage({ navigatorLike: { language: 'nl-BE' } }), 'nl', 'Fiandre (Belgio)');
});

test('resolveUiLanguage: lingua non coperta (es. giapponese, romancio) -> fallback inglese, mai italiano forzato', () => {
  assert.equal(resolveUiLanguage({ navigatorLike: { language: 'ja-JP' } }), 'en');
  assert.equal(resolveUiLanguage({ navigatorLike: { language: 'rm-CH' } }), 'en');
});

test('resolveUiLanguage: nessun dato disponibile -> fallback inglese', () => {
  assert.equal(resolveUiLanguage({ navigatorLike: null }), 'en');
  assert.equal(resolveUiLanguage({ navigatorLike: {} }), 'en');
});

test('resolveUiLanguage: chiamata SENZA argomenti (come fa main.js: resolveUiLanguage()) legge il navigator VERO del browser — bug reale trovato dal vivo (2026-08-29): il default navigatorLike=null passava null a detectDeviceLanguage, che con null esplicito (mai undefined) non ripiegava mai sul navigator reale, quindi l\'app mostrava sempre inglese a prescindere dal dispositivo', () => {
  const realNavigator = globalThis.navigator;
  try {
    globalThis.navigator = { language: 'it-IT', languages: ['it-IT'] };
    assert.equal(resolveUiLanguage(), 'it', 'con navigator reale in italiano, resolveUiLanguage() senza argomenti deve restituire "it", non ripiegare su "en"');
    globalThis.navigator = { language: 'de-CH', languages: ['de-CH'] };
    assert.equal(resolveUiLanguage(), 'de');
  } finally {
    globalThis.navigator = realNavigator;
  }
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
// divisione. IT/EN/ES/DE/FR: tedesco e francese aggiunti dopo una ricerca
// esplicita sui mercati reali della divisione spese (Tricount, stessa
// categoria di prodotto, è forte in Francia/Belgio/Germania/Paesi Bassi,
// non solo popolazione generica) — non ripiegano più su EN per queste
// chiavi. ──

test('t: tutte le chiavi genesis esistono in IT/EN/ES/DE/FR — nessuna traduzione dimenticata', () => {
  const chiavi = [
    'genesisTagline', 'genesisPrivacyTitle', 'genesisPrivacyText', 'genesisStart',
    'genesisProgress1', 'genesisProgress2', 'genesisProgress3', 'genesisProgress4Last',
    'genesisQ1Title', 'genesisQ1Sub', 'genesisQ1Opt1', 'genesisQ1Opt2', 'genesisQ1Opt3', 'genesisQ1Opt4', 'genesisQ1Opt5',
    'genesisQ2Title', 'genesisQ2Sub', 'genesisQ2Opt1', 'genesisQ2Opt2', 'genesisQ2Opt3', 'genesisQ2Opt4',
    'genesisQ3Title', 'genesisQ3Sub', 'genesisQ3Opt1', 'genesisQ3Opt2', 'genesisQ3Opt3',
    'genesisQ4Title', 'genesisQ4Sub', 'genesisQ4Opt1', 'genesisQ4Opt2', 'genesisQ4Opt3', 'genesisQ4Opt4',
  ];
  for (const lang of ['it', 'en', 'es', 'de', 'fr', 'nl']) {
    for (const k of chiavi) {
      const v = t(k, lang);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}" (ripiegata sulla chiave grezza)`);
    }
  }
});

test('t: le chiavi genesis in tedesco e francese sono traduzioni reali, non un ripiego su EN', () => {
  assert.notEqual(t('genesisTagline', 'de'), t('genesisTagline', 'en'));
  assert.notEqual(t('genesisQ1Title', 'fr'), t('genesisQ1Title', 'en'));
  assert.equal(t('genesisTagline', 'de'), 'Dein Geld, endlich klar.');
  assert.equal(t('genesisTagline', 'fr'), 'Ton argent, enfin clair.');
});

test('t: la domanda 4 (regolarità entrate, D2) traduce correttamente in ognuna delle 6 lingue coperte', () => {
  assert.equal(t('genesisQ4Title', 'it'), 'Le tue entrate, come arrivano?');
  assert.equal(t('genesisQ4Title', 'en'), 'How does your income arrive?');
  assert.equal(t('genesisQ4Title', 'es'), '¿Cómo llegan tus ingresos?');
  assert.equal(t('genesisQ4Title', 'de'), 'Wie kommt dein Einkommen an?');
  assert.equal(t('genesisQ4Title', 'fr'), 'Comment arrivent tes revenus ?');
  assert.equal(t('genesisQ4Title', 'nl'), 'Hoe komt jouw inkomen binnen?');
  assert.equal(t('genesisQ4Opt3', 'en'), 'Changes a lot, month to month');
});

// ── Dashboard — solo l'orb principale (2026-08-28), la parte più vista di
// tutta l'app: il numero e l'etichetta che compaiono ad ogni apertura. ──

test('t: tutte le chiavi dash* dell\'orb principale esistono in IT/EN/ES/DE/FR', () => {
  const chiavi = ['dashOggiPuoiSpendere', 'dashComeStaiMesso', 'dashToccaSegnaSpesa', 'dashSpesoFinora', 'dashEntrateMenoUscite'];
  for (const lang of ['it', 'en', 'es', 'de', 'fr', 'nl']) {
    for (const k of chiavi) {
      assert.notEqual(t(k, lang), k, `chiave "${k}" mancante in lingua "${lang}"`);
    }
  }
});

test('t: dashOggiPuoiSpendere traduce correttamente in tutte le 6 lingue', () => {
  assert.equal(t('dashOggiPuoiSpendere', 'it'), 'Oggi puoi spendere');
  assert.equal(t('dashOggiPuoiSpendere', 'en'), 'You can spend today');
  assert.equal(t('dashOggiPuoiSpendere', 'es'), 'Hoy puedes gastar');
  assert.equal(t('dashOggiPuoiSpendere', 'de'), 'Heute kannst du ausgeben');
  assert.equal(t('dashOggiPuoiSpendere', 'fr'), 'Tu peux dépenser aujourd\'hui');
  assert.equal(t('dashOggiPuoiSpendere', 'nl'), 'Vandaag kun je uitgeven');
});

test('t: dashAriaOggiPuoiSpendere (aria-label, chiave-funzione) interpola correttamente in ogni lingua', () => {
  assert.equal(t('dashAriaOggiPuoiSpendere', 'it', '50€'), 'Oggi puoi spendere 50€. Tocca per segnare una spesa.');
  assert.equal(t('dashAriaOggiPuoiSpendere', 'en', '€50'), 'You can spend €50 today. Tap to log an expense.');
  assert.equal(t('dashAriaOggiPuoiSpendere', 'es', '50€'), 'Hoy puedes gastar 50€. Toca para registrar un gasto.');
  assert.equal(t('dashAriaOggiPuoiSpendere', 'de', '50€'), 'Heute kannst du 50€ ausgeben. Tippen, um eine Ausgabe zu erfassen.');
  assert.equal(t('dashAriaOggiPuoiSpendere', 'fr', '50€'), 'Tu peux dépenser 50€ aujourd\'hui. Touche pour enregistrer une dépense.');
  assert.equal(t('dashAriaOggiPuoiSpendere', 'nl', '50€'), 'Vandaag kun je 50€ uitgeven. Tik om een uitgave te registreren.');
});

// ── Import CTA (#import-cta, index.html) — 2026-08-28: il momento di
// attivazione più importante, convincere chi è appena entrato a importare
// dati veri invece di restare sull'esempio. ──

test('t: tutte le chiavi dashImport* esistono in IT/EN/ES/DE/FR', () => {
  const chiavi = ['dashImportTitle', 'dashImportSub', 'dashImportBtn', 'dashImportBackup'];
  for (const lang of ['it', 'en', 'es', 'de', 'fr', 'nl']) {
    for (const k of chiavi) {
      assert.notEqual(t(k, lang), k, `chiave "${k}" mancante in lingua "${lang}"`);
    }
  }
});

// ── "Cosa c'è di nuovo" (src/core/whats-new.js) — 2026-08-28: segnalato
// dall'utente che era rimasta solo in italiano dopo la prima passata di
// traduzioni. ──

test('t: tutte le chiavi wn* (header + 12 voci × titolo/testo) esistono in IT/EN/ES/DE/FR', () => {
  const chiavi = ['wnEyebrow', 'wnTitle', 'wnClose'];
  for (const rel of ['0827', '0828', '0830']) {
    for (let i = 0; i < 4; i++) {
      chiavi.push(`wn${rel}_${i}_t`, `wn${rel}_${i}_d`);
    }
  }
  assert.equal(chiavi.length, 3 + 24);
  for (const lang of ['it', 'en', 'es', 'de', 'fr', 'nl']) {
    for (const k of chiavi) {
      assert.notEqual(t(k, lang), k, `chiave "${k}" mancante in lingua "${lang}"`);
    }
  }
});

test('t: wnTitle e wnClose traducono correttamente in tutte le 6 lingue', () => {
  assert.equal(t('wnTitle', 'it'), 'Cosa c\'è di nuovo');
  assert.equal(t('wnTitle', 'en'), 'What\'s new');
  assert.equal(t('wnTitle', 'es'), 'Novedades');
  assert.equal(t('wnTitle', 'de'), 'Was ist neu');
  assert.equal(t('wnTitle', 'fr'), 'Quoi de neuf');
  assert.equal(t('wnTitle', 'nl'), 'Wat is er nieuw');
  assert.equal(t('wnClose', 'en'), 'Got it');
});

// ── Nomi categoria (src/core/constants.js DEFAULT_CATEGORIES) + Command
// Center: picker categoria e riga transazione (2026-08-29). Solo IT/EN/ES/
// DE/FR qui: l'id resta invariato (storage/lexicon/modelli), solo il nome
// mostrato cambia — verificato che main.js:catName() non tocchi mai `cat.name`. ──

test('t: tutte le 15 chiavi cat_* esistono in IT/EN/ES/DE/FR', () => {
  const ids = ['spesa', 'ristoranti', 'shopping', 'abbonamenti', 'trasporti', 'casa', 'bollette', 'salute', 'istruzione', 'viaggi', 'svago', 'stipendio', 'etf', 'crypto', 'risparmio'];
  for (const lang of ['it', 'en', 'es', 'de', 'fr', 'nl']) {
    for (const id of ids) {
      const k = 'cat_' + id;
      assert.notEqual(t(k, lang), k, `chiave "${k}" mancante in lingua "${lang}"`);
    }
  }
});

test('t: cat_spesa traduce correttamente in tutte le 6 lingue (nome, non l\'id "spesa" — mai toccato)', () => {
  assert.equal(t('cat_spesa', 'it'), 'Alimentari');
  assert.equal(t('cat_spesa', 'en'), 'Groceries');
  assert.equal(t('cat_spesa', 'es'), 'Alimentación');
  assert.equal(t('cat_spesa', 'de'), 'Lebensmittel');
  assert.equal(t('cat_spesa', 'fr'), 'Alimentation');
  assert.equal(t('cat_spesa', 'nl'), 'Boodschappen');
});

test('t: le etichette del picker categoria/Command Center esistono in tutte le 5 lingue', () => {
  const chiavi = ['catNuova', 'catNuovaCategoria', 'catAnnulla', 'catNomeCategoria', 'catComeChiami', 'catCreaCategoria', 'catCambiaCategoria', 'txEliminaAria', 'txElimina', 'txRimuoviConferma'];
  for (const lang of ['it', 'en', 'es', 'de', 'fr', 'nl']) {
    for (const k of chiavi) {
      assert.notEqual(t(k, lang), k, `chiave "${k}" mancante in lingua "${lang}"`);
    }
  }
});

test('t: catCambiaCategoriaAria (chiave-funzione) interpola il nome categoria in ogni lingua', () => {
  assert.equal(t('catCambiaCategoriaAria', 'it', 'Alimentari'), 'Cambia categoria: Alimentari');
  assert.equal(t('catCambiaCategoriaAria', 'en', 'Groceries'), 'Change category: Groceries');
});

test('t: dashImportTitle traduce correttamente in tutte le 6 lingue', () => {
  assert.equal(t('dashImportTitle', 'it'), 'Vedi i tuoi soldi veri.');
  assert.equal(t('dashImportTitle', 'en'), 'See your real money.');
  assert.equal(t('dashImportTitle', 'es'), 'Mira tu dinero real.');
  assert.equal(t('dashImportTitle', 'de'), 'Sieh dein echtes Geld.');
  assert.equal(t('dashImportTitle', 'fr'), 'Vois ton argent réel.');
  assert.equal(t('dashImportTitle', 'nl'), 'Bekijk je echte geld.');
});

// ── Divisione spese — invito/ingresso (2026-08-29): il loop virale vero
// (README: "Momentum's own viral loop"). Copre openShareCode/inviteToMomentum/
// receiveSplitGroup/openJoinConfirm/openMomentumReveal/openActivationQuestions/
// renderSplitForesight in main.js — le schermate che vede chi NON è ancora
// un utente Momentum. Prima volta a 7 lingue (portoghese incluso: gap
// concreto, non ipotetico — vedi commento su UI_LANGS/pt sopra). ──

test('t: tutte le chiavi share*/invite*/receive*/join*/reveal*/act*/fore* esistono nelle 7 lingue coperte, mai un fallback sulla chiave grezza', () => {
  const chiavi = [
    'shareDefaultTitle', 'shareDefaultGroupName', 'shareFallbackSub', 'shareInviteTitle',
    'shareInviteSub', 'shareInviteSubChat', 'shareQrHint', 'shareCopyLink', 'shareOther',
    'shareCodeFallback', 'shareP2pSummary', 'shareP2pText', 'shareP2pPlaceholder',
    'shareP2pConnect', 'shareP2pConnected', 'shareToastCopied', 'shareToastInvalidAnswer',
    'shareToastNeedPaste', 'shareToastP2pActive', 'shareWaMsg', 'shareEmailSubject',
    'inviteTitle', 'inviteSub', 'inviteMsg', 'inviteEmailSubject', 'inviteFromGroupCta',
    'receiveTitle', 'receiveSub', 'receivePlaceholder', 'receiveBtn', 'receiveToastInvalid',
    'joinEyebrow', 'joinTitleNew', 'joinTitleUpdate', 'joinWithNames', 'joinAndOthers',
    'joinExpensesCount', 'joinNoExpenses', 'joinWhoAreYou', 'joinNotThere', 'joinNamePlaceholder',
    'joinBtnUpdate', 'joinBtnNew', 'joinFooterBase', 'joinFooterExtra', 'joinToastChooseWho',
    'joinToastMerged', 'joinToastJoined',
    'revealTitle', 'revealSub', 'revealCard1Title', 'revealCard1Desc', 'revealCard2Title',
    'revealCard2DescHook', 'revealCard2DescNoHook', 'revealCard3Title', 'revealCard3Desc',
    'revealActivate', 'revealLater', 'revealToastActivated',
    'actQ1Title', 'actQ1Opt1', 'actQ1Opt2', 'actQ1Opt3', 'actQ2Title', 'actQ2Opt1', 'actQ2Opt2', 'actQ2Opt3',
    'foreNowLabel', 'foreInDays', 'foreUsuallyPays', 'foreEyebrow', 'foreDisclaimer',
  ];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      // le chiavi-funzione (shareWaMsg, joinExpensesCount, ecc.) restituiscono
      // una stringa interpolata: passiamo argomenti fittizi solo per farle
      // eseguire, il controllo di copertura riguarda la funzione stessa (mai
      // `undefined` o la chiave grezza), non il contenuto interpolato qui.
      const v = t(k, lang, 'X', 'Y');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}" (ripiegata sulla chiave grezza)`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

test('t: joinTitleNew/joinTitleUpdate (grammatica per lingua, non concatenazione a schema fisso) interpolano correttamente', () => {
  assert.equal(t('joinTitleNew', 'it', 'Weekend a Roma'), 'Unisciti a «Weekend a Roma»');
  assert.equal(t('joinTitleNew', 'en', 'Rome weekend'), 'Join "Rome weekend"');
  assert.equal(t('joinTitleNew', 'de', 'Rom-Wochenende'), 'Tritt „Rom-Wochenende" bei');
  assert.equal(t('joinTitleUpdate', 'fr', 'Week-end à Rome'), 'Mettre à jour « Week-end à Rome »');
  assert.equal(t('joinTitleNew', 'pt', 'Fim de semana em Roma'), 'Entrar em «Fim de semana em Roma»');
});

test('t: shareWaMsg (messaggio WhatsApp d\'invito) porta sempre il link da solo sull\'ultima riga, in ogni lingua — regola esplicita del commento in main.js', () => {
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    const msg = t('shareWaMsg', lang, 'Weekend', 'https://esempio.test/x');
    const righe = msg.split('\n');
    assert.equal(righe[righe.length - 1], 'https://esempio.test/x', `lingua "${lang}": il link non è sull'ultima riga da solo`);
  }
});

// ── Log di verifica del settlement (2026-08-30): idea #1 da
// ANALISI_COMPETITOR.md §7 (Splitwise), collega window.openSettlementVerification
// in main.js a settlementVerificationLog in split-engine.js. ──

test('t: tutte le chiavi settleVerify* esistono nelle 7 lingue coperte, mai un fallback sulla chiave grezza', () => {
  const chiavi = [
    'settleVerifyCta', 'settleVerifyTitle', 'settleVerifyMethodExact', 'settleVerifyMethodGreedy',
    'settleVerifyStepArrow', 'settleVerifyBeforeAfter', 'settleVerifiedYes', 'settleVerifiedNo',
    'settleVerifyClose',
  ];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 'Marco', 'Giulia', '12,50 €');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}" (ripiegata sulla chiave grezza)`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

test('t: settleVerifyStepArrow/settleVerifyBeforeAfter interpolano correttamente nomi e importo in ogni lingua', () => {
  assert.equal(t('settleVerifyStepArrow', 'it', 'Marco', 'Giulia', '12,50 €'), 'Marco → Giulia: 12,50 €');
  assert.equal(t('settleVerifyStepArrow', 'en', 'Marco', 'Giulia', '€12.50'), 'Marco → Giulia: €12.50');
  assert.equal(t('settleVerifyBeforeAfter', 'it', 'Marco', '-12,50 €', '0,00 €'), 'Marco: da -12,50 € a 0,00 €');
  assert.equal(t('settleVerifyBeforeAfter', 'en', 'Marco', '-€12.50', '€0.00'), 'Marco: from -€12.50 to €0.00');
});

test('t: il portoghese (Brasile) copre lo stesso catalogo genesis*/dash*/wn*/cat* già coperto da it/en/de/fr/es/nl', () => {
  const chiavi = [
    'genesisTagline', 'genesisStart', 'dashOggiPuoiSpendere', 'dashImportTitle',
    'wnTitle', 'wnClose', 'cat_spesa', 'cat_stipendio', 'catNuovaCategoria',
  ];
  for (const k of chiavi) {
    assert.notEqual(t(k, 'pt'), k, `chiave "${k}" mancante in portoghese`);
  }
  assert.equal(t('dashOggiPuoiSpendere', 'pt'), 'Hoje você pode gastar');
});

// ── Dashboard — resto della schermata oltre l'orb (2026-08-29): traiettoria
// di fine mese, card "oggi meglio non spendere", promemoria divisione spese,
// impegni già prenotati, lista movimenti. La parte più vista di tutta
// l'app — copre main.js:renderDashboard oltre alle chiavi dash* già
// esistenti per l'orb principale. ──

test('t: tutte le chiavi Dashboard (traiettoria/overspend/nudge/insight/split-reminder/fisco/streak/impegni/lista) esistono nelle 7 lingue, mai un fallback sulla chiave grezza', () => {
  const chiavi = [
    'dashMonthTooltipPast', 'dashMonthTooltipFuture', 'dashWeekTitle',
    'dashTrajOver', 'dashTrajTight', 'dashTrajOk', 'dashTrajMethodConfident', 'dashTrajMethodRhythm',
    'dashTrajLabel', 'dashTrajBudgetLine',
    'dashOverspendTitle', 'dashOverAmount', 'dashOverTip', 'dashChargesReserved', 'dashWeekRemaining',
    'dashNudgeAria', 'dashNudgeDefaultReason', 'dashNudgeTapSuffix',
    'dashInsightOf', 'dashInsightMissingOne', 'dashInsightMissingMany', 'dashInsightAwarenessTail', 'dashInsightNextGoal',
    'dashSplitDisputeCount', 'dashSplitDisputeText', 'dashSplitDisputeAria', 'dashSplitSeeArrow',
    'dashSplitMsgAria', 'dashSplitMsgCount', 'dashSplitReadArrow',
    'dashSplitOwedVerb', 'dashSplitOweVerb', 'dashSplitBalanceAria', 'dashSplitOtherGroups', 'dashSplitSettleArrow',
    'dashTaxDiscoverQuestion', 'dashTaxDiscoverCta', 'dashStreakDays',
    'dashCommittedTitle', 'dashTaxSetAsideTitle', 'dashRealAvailable', 'dashKeepMoneyNote', 'dashSafetyLabel',
    'dashNoTx', 'dashNoDate', 'dashToday', 'dashYesterday',
  ];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 'X', 'Y', 'Z');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}" (ripiegata sulla chiave grezza)`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

test('t: dashOverspendTitle e dashTrajLabel traducono correttamente nelle 7 lingue', () => {
  assert.equal(t('dashOverspendTitle', 'it'), 'Oggi meglio non spendere');
  assert.equal(t('dashOverspendTitle', 'en'), 'Better not to spend today');
  assert.equal(t('dashOverspendTitle', 'de'), 'Heute besser nichts ausgeben');
  assert.equal(t('dashOverspendTitle', 'fr'), 'Mieux vaut ne rien dépenser aujourd\'hui');
  assert.equal(t('dashOverspendTitle', 'es'), 'Mejor no gastar hoy');
  assert.equal(t('dashOverspendTitle', 'nl'), 'Vandaag beter niets uitgeven');
  assert.equal(t('dashOverspendTitle', 'pt'), 'Melhor não gastar hoje');
});

// ── Momentum Vault (impostazioni) — prima passata (2026-08-29): solo il
// testo statico di index.html mai riscritto da JS (verificato per ogni id
// prima di tradurlo — install-guide-title/steps, neurosym-explain-*, i
// traguardi, mesh-status, tax-settings-body/tax-es-* restano italiani,
// generati da altri moduli, cantiere separato). Consumato via
// data-i18n-key/-html/-title/-placeholder in index.html + applyUiTranslations()
// in main.js, stesso meccanismo dell'onboarding esteso con tre varianti. ──

test('t: tutte le chiavi vault* (prima passata Momentum Vault) esistono nelle 7 lingue, mai un fallback sulla chiave grezza', () => {
  const chiavi = [
    'vaultInstallSubtitle', 'vaultInstallBtn', 'vaultInstallDone',
    'vaultQuickaddTitle', 'vaultQuickaddSubtitle', 'vaultQuickaddUrlLabel', 'vaultCopy',
    'vaultHowItWorksTitle', 'vaultHowItWorksSubtitle', 'vaultShareGoal',
    'vaultImportTitle', 'vaultImportSubtitle', 'vaultImportAllBtn', 'vaultImportAllHint',
    'vaultImportPdfBtn', 'vaultImportScreenshotBtn',
    'vaultPayrollTitle', 'vaultPayrollSubtitle', 'vaultMySalary', 'vaultHowToBePaid',
    'vaultTaxTitle', 'vaultTaxItalyTitle', 'vaultTaxSwissTitle', 'vaultTaxSpainTitle',
    'vaultTaxSubtitle', 'vaultTaxItLabel', 'vaultTaxItDisclaimer',
    'vaultSyncTitle', 'vaultSyncSubtitle', 'vaultLinkDevice', 'vaultGenerateQrSync',
    'vaultSecureBackup', 'vaultRestoreBackup', 'vaultPreferOwnPassword', 'vaultPasswordWarning',
    'vaultExportEncrypted', 'vaultRestoreLabel', 'vaultPlainCopyOption', 'vaultPlainCopyWarning',
    'vaultSavePlainCopy', 'vaultExportTrainingData', 'vaultWebrtcLabel', 'vaultPeerIdPlaceholder',
    'vaultWebrtcFooter',
  ];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}" (ripiegata sulla chiave grezza)`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

test('t: vaultPlainCopyWarning porta il markup <strong> in ogni lingua (consumata via data-i18n-html, mai textContent — l\'enfasi non deve sparire in nessuna lingua)', () => {
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    const v = t('vaultPlainCopyWarning', lang);
    assert.match(v, /<strong>.*<\/strong>/, `lingua "${lang}": manca <strong> in vaultPlainCopyWarning`);
  }
});

test('t: vaultInstallBtn e vaultSyncTitle traducono correttamente nelle 7 lingue', () => {
  assert.equal(t('vaultInstallBtn', 'it'), 'Installa ora');
  assert.equal(t('vaultInstallBtn', 'en'), 'Install now');
  assert.equal(t('vaultInstallBtn', 'de'), 'Jetzt installieren');
  assert.equal(t('vaultInstallBtn', 'fr'), 'Installer maintenant');
  assert.equal(t('vaultInstallBtn', 'es'), 'Instalar ahora');
  assert.equal(t('vaultInstallBtn', 'nl'), 'Nu installeren');
  assert.equal(t('vaultInstallBtn', 'pt'), 'Instalar agora');
});

// ── Momentum Vault — seconda passata (2026-08-29): prezzi live (5 chiavi
// API), telemetria, feedback, chat generica, freno spese, radar
// abbonamenti, suoni, notifiche granulari, comprensione semantica/
// sentiment locali (solo cornice statica: le label di stato download
// restano JS-managed, fuori da questo batch), scadenze/promemoria. ──

test('t: tutte le chiavi vault* della seconda passata esistono nelle 7 lingue, mai un fallback sulla chiave grezza', () => {
  const chiavi = [
    'vaultLivePricesTitle', 'vaultLivePricesSubtitle', 'vaultKeyPlaceholderAV', 'vaultSave', 'vaultKeyGuideLink',
    'vaultPlanBStocks', 'vaultKeyPlaceholderTD', 'vaultPlanBUsStocks', 'vaultKeyPlaceholderFMP',
    'vaultPlanBNews', 'vaultKeyPlaceholderFinnhub', 'vaultPlanBGeneralNews', 'vaultKeyPlaceholderNewsApi',
    'vaultTelemetryTitle', 'vaultTelemetrySubtitle', 'vaultTelemetryToggle',
    'vaultFeedbackTitle', 'vaultFeedbackSubtitle', 'vaultWriteFeedback',
    'vaultGenericChatTitle', 'vaultGenericChatSubtitle', 'vaultGeminiRecommend',
    'vaultChatContextToggle', 'vaultForceAnimToggle', 'vaultQaLanguageLabel', 'vaultQaLanguageAuto',
    'vaultOtherProvidersSummary', 'vaultProviderGroq', 'vaultProviderDeepseek', 'vaultProviderOpenai',
    'vaultProviderAnthropic', 'vaultProvidersFooter', 'vaultUnrecognizedQSummary',
    'vaultBrakeTitle', 'vaultBrakeSubtitle', 'vaultModeZen', 'vaultModeAdvisor', 'vaultModePredator',
    'vaultGhostRadarTitle', 'vaultGhostRadarSubtitle', 'vaultSoundsTitle', 'vaultSoundsSubtitle',
    'vaultNotificationsTitle', 'vaultNotificationsSubtitle', 'vaultNotifyTaxDeadlines',
    'vaultNotifyTaxLaw', 'vaultNotifyPriceAlerts',
    'vaultSemanticQaTitle', 'vaultSemanticQaSubtitle', 'vaultSemanticQaFooter',
    'vaultSentimentTitle', 'vaultSentimentSubtitle', 'vaultSentimentFooter',
    'vaultRemindersTitle', 'vaultRemindersSubtitle', 'vaultSyncIcs',
  ];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}" (ripiegata sulla chiave grezza)`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

test('t: vaultGeminiRecommend porta il markup <b> in ogni lingua (consumata via data-i18n-html)', () => {
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    const v = t('vaultGeminiRecommend', lang);
    assert.match(v, /<b>Gemini<\/b>/, `lingua "${lang}": manca <b>Gemini</b> in vaultGeminiRecommend`);
  }
});

test('t: vaultModeZen/Advisor/Predator traducono correttamente nelle 7 lingue', () => {
  assert.equal(t('vaultModeZen', 'it'), 'Delicato');
  assert.equal(t('vaultModeZen', 'en'), 'Gentle');
  assert.equal(t('vaultModePredator', 'de'), 'Bestimmt');
  assert.equal(t('vaultModeAdvisor', 'fr'), 'Conseiller');
  assert.equal(t('vaultModePredator', 'es'), 'Firme');
  assert.equal(t('vaultModeZen', 'nl'), 'Zacht');
  assert.equal(t('vaultModePredator', 'pt'), 'Firme');
});

// ── Momentum Vault — coda (2026-08-29): form "Aggiungi scadenza", pulsante
// aggiornamenti, cancellazione dati, link legali. Con questi la cornice
// STATICA di index.html sotto #settings-view è coperta per intero nelle 7
// lingue (verificato con una scansione riga-per-riga del blocco: ogni testo
// rivolto all'utente porta un data-i18n-*, tranne le 3 eccezioni deliberate
// — nomi di lingua nel select, "Core:"/"Synapse Nodes:" come branding
// tecnico, "Connect" come termine tecnico WebRTC). Il contenuto generato da
// altri moduli JS resta un cantiere separato, per ciascun modulo. ──

test('t: tutte le chiavi vault* della coda esistono nelle 7 lingue, mai un fallback sulla chiave grezza', () => {
  const chiavi = [
    'vaultEventTitlePlaceholder', 'vaultEventNotePlaceholder', 'vaultEventAmountPlaceholder',
    'vaultAddEventAria', 'vaultCheckUpdates', 'vaultDeleteAllData',
    'vaultPrivacyPolicy', 'vaultTermsOfService',
  ];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}" (ripiegata sulla chiave grezza)`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

test('t: vaultDeleteAllData traduce correttamente nelle 7 lingue (azione distruttiva, mai ambigua)', () => {
  assert.equal(t('vaultDeleteAllData', 'it'), 'Cancella tutti i dati');
  assert.equal(t('vaultDeleteAllData', 'en'), 'Delete all data');
  assert.equal(t('vaultDeleteAllData', 'de'), 'Alle Daten löschen');
  assert.equal(t('vaultDeleteAllData', 'fr'), 'Supprimer toutes les données');
  assert.equal(t('vaultDeleteAllData', 'es'), 'Eliminar todos los datos');
  assert.equal(t('vaultDeleteAllData', 'nl'), 'Alle gegevens verwijderen');
  assert.equal(t('vaultDeleteAllData', 'pt'), 'Apagar todos os dados');
});

// ── Command Center (form di inserimento, 2026-08-29): la UI più usata di
// tutta l'app. Cassa Unica / "Il tuo mese, senza sorprese" + gestore
// impegni fissi. Banner demo. Le 4 tessere Entrate/Uscite/Quanto avanza/
// Investito + striscia sotto l'orb (src/ui/mese-strip.js, modulo puro
// separato — trovato non tradotto da un test dal vivo dell'utente). ──

test('t: tutte le chiavi tx*/catIconAria/catColorAria (form inserimento) esistono nelle 7 lingue', () => {
  const chiavi = ['txCategorySuggested','txSecurityLabel','txAiThinking','txUseSuggestion','txTypeExpense','txTypeIncome','txTypeInvest','txAmountAria','txVoiceAria','txNumpadAria','txDelAria','txKbdHint','txSuggestNewCat','txDescPlaceholder','txDateToday','txSplit','txSplitWith','txConfirm','catIconAria','catColorAria','txFomoBadge','txFomoMessage'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 'X');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

test('t: tutte le chiavi demo*/ghost*/fc* (banner demo + Cassa Unica + impegni fissi) esistono nelle 7 lingue', () => {
  const chiavi = ['demoTitle','demoSubtitle','demoStartFresh','demoDismissedToast','ghostSectionTitle','ghostManageBtn','ghostPayTomorrow','ghostPayInDays','ghostSpentLegend','ghostTimeLegend','ghostOnTrack','ghostOnTrackDetail','ghostRunningFast','ghostRunningFastDetail','ghostNoAdaptive','ghostPerWeek','ghostRemainingThisMonth','ghostSalaryMinusCommitments','ghostColdStartLine','ghostColdStartSub','ghostSetupSalaryBtn','ghostRateSuffix','ghostAlreadyPaid','ghostLearnedNote','ghostEndingSoonLabel','ghostEndingItem','ghostWhatGoesAlone','ghostPerMonth','ghostNoCommitmentsYet','ghostDueBeforePayday','ghostEstimateDisclaimer','fcKindRent','fcKindMortgage','fcKindLoan','fcKindBill','fcKindSubscription','fcRowInstallments','fcRowRecurring','fcEditLabel','fcEyebrow','fcTitle','fcSubtitle','fcYourSalary','fcSalaryLine','fcSalaryNotSet','fcNoCommitments','fcAddOne','fcNamePlaceholder','fcAmountPlaceholder','fcDayPlaceholder','fcTotalInstallmentsPlaceholder','fcAddBtn','fcSaveChangesBtn','fcToastMissingFields','fcToastUpdated','fcToastAdded'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 'X', 'Y', 'Z');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

test('t: le 4 tessere Dashboard (Entrate/Uscite/Quanto avanza/Investito) e la striscia sotto l\'orb esistono nelle 7 lingue', () => {
  const chiavi = ['dashPrevMonthAria','dashNextMonthAria','dashWeeklySpendCaption','dashIncome','dashExpense','dashRemaining','dashInvested','dashIncomeVsExpense','msLateFixed','msLateRhythm','msPayToday','msPayTomorrow','msPayInDays','msRhythmToday','msRhythmInDays','msDayOfTotal','msSalaryArrived','msSpentSoFar','msSpent'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 1, 2);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

// ── VoiceCore (2026-08-29, src/voice/voice.js) + nome sezione "Analisi
// Tensor" nella sidebar/titolo — segnalati dall'utente come rimasti
// italiani anche a UI/voce in un'altra lingua. VoiceCore usa this._lingua
// (linguaVoceAttiva), non __uiLang: la voce può parlare una lingua diversa
// dall'interfaccia per scelta esplicita. ──

test('t: tutte le chiavi voice* (toast e riepilogo dettatura) esistono nelle 7 lingue, mai un fallback sulla chiave grezza', () => {
  const chiavi = ['voiceListening','voiceErrNotAllowed','voiceErrNoSpeech','voiceErrNoMic','voiceErrNetwork','voiceRegistered','voiceNoSolito','voiceEstimatedSuffixInline','voiceSummarySplit','voiceSummaryAppointment','voiceSummaryReminder','voiceDone','voiceEstimatedNote','voiceMissingAmounts','voiceParseError','voiceMicNotSupported'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 'X', 'Y');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

test('t: voiceSummarySplit gestisce sia il caso con importo sia senza, in ogni lingua', () => {
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    const withAmount = t('voiceSummarySplit', lang, 50, 'Marco, Luca');
    const withoutAmount = t('voiceSummarySplit', lang, null, 'Marco, Luca');
    assert.ok(withAmount.includes('50') && withAmount.includes('Marco, Luca'), `lingua "${lang}": manca importo o persone`);
    assert.ok(withoutAmount.includes('Marco, Luca') && !withoutAmount.includes('null'), `lingua "${lang}": caso senza importo rotto`);
  }
});

test('t: navAnalysis (nome sezione "Analisi Tensor") esiste nelle 7 lingue — "Tensor" resta fisso come "Momentum", solo "Analisi" si traduce', () => {
  assert.equal(t('navAnalysis', 'it'), 'Analisi Tensor');
  assert.equal(t('navAnalysis', 'en'), 'Tensor Analysis');
  assert.equal(t('navAnalysis', 'de'), 'Tensor-Analyse');
  assert.equal(t('navAnalysis', 'fr'), 'Analyse Tensor');
  assert.equal(t('navAnalysis', 'es'), 'Análisis Tensor');
  assert.equal(t('navAnalysis', 'nl'), 'Tensor-analyse');
  assert.equal(t('navAnalysis', 'pt'), 'Análise Tensor');
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    assert.match(t('navAnalysis', lang), /Tensor/, `lingua "${lang}": "Tensor" deve restare fisso`);
  }
});

// ── "Chiedi a Momentum" (QA) + Salvadanaio + intestazione lista movimenti
// (2026-08-29) — verificato dal vivo in Chrome dopo segnalazione utente. ──

test('t: tutte le chiavi qa*/jar*/dashYourTransactions esistono nelle 7 lingue', () => {
  const chiavi = ['qaTitle', 'qaPlaceholder', 'qaSendAria', 'jarTitle', 'jarSubtitle', 'jarSetAsideSoFar', 'jarMonthsCovered', 'jarSweepTitle', 'jarSweepSubtitle', 'jarEstimatedOverflow', 'jarMarkBtn', 'dashYourTransactions'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

test('t: jarSweepSubtitle porta il markup <b> in ogni lingua (consumata via data-i18n-html)', () => {
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    assert.match(t('jarSweepSubtitle', lang), /<b>.*<\/b>/, `lingua "${lang}": manca <b> in jarSweepSubtitle`);
  }
});

// ── Traguardi/livelli (src/ai/progress-milestones.js) + achievements
// (src/predict/achievements.js) + wrapper "Livello N — Nome" in main.js
// (2026-08-29) — moduli puri separati, mai passati dal catalogo prima.
// Bug reale trovato dal vivo in Chrome durante la verifica: "Livello 2 —
// The pattern" restava mezzo tradotto perché il wrapper in main.js non
// passava dalle chiavi lvl* — corretto e coperto qui. ──

test('t: tutte le chiavi mst*/lvl1-4 (progress-milestones.js) esistono nelle 7 lingue', () => {
  const chiavi = ['mstPrimaCatTesto', 'mstPrimaCatSotto', 'mstPatternTesto', 'mstPatternSotto', 'mstCausaleTesto', 'mstCausaleSotto', 'mstSentimentTesto', 'mstSentimentSotto', 'mstMeshTesto', 'mstMeshSotto', 'mstPercentileTesto', 'mstPercentileSotto', 'mstGruppoTesto', 'mstGruppoSotto', 'mstChatTesto', 'mstChatSotto', 'lvl1Nome', 'lvl1Sotto', 'lvl2Nome', 'lvl2Sotto', 'lvl3Nome', 'lvl3Sotto', 'lvl4Nome', 'lvl4Sotto'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 1, 2);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

test('t: tutte le chiavi ach* (achievements.js) esistono nelle 7 lingue', () => {
  const chiavi = ['achUnlockedToast', 'achFirstStepName', 'achFirstStepDesc', 'achGettingSeriousName', 'achGettingSeriousDesc', 'achVeteranName', 'achVeteranDesc', 'achStreak3Name', 'achStreak3Desc', 'achStreak7Name', 'achStreak7Desc', 'achStreak30Name', 'achStreak30Desc', 'achStreak100Name', 'achStreak100Desc', 'achFirstSavedName', 'achFirstSavedDesc', 'achUnderBudgetName', 'achUnderBudgetDesc', 'achFirstGoalName', 'achFirstGoalDesc', 'achConsistencyName', 'achConsistencyDesc'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 'X');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

test('t: tutte le chiavi lvl* del wrapper "Livello N — Nome" (main.js:renderTraguardiCard) esistono nelle 7 lingue — mai più mezzo tradotto', () => {
  const chiavi = ['lvlLabel', 'lvlAllCompleteTitle', 'lvlAllCompleteSubtitle', 'lvlSummary', 'lvlCompletedToast', 'lvlShareMsg', 'lvlCopiedToast'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 2, 'X', 'Y');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
  assert.equal(t('lvlLabel', 'en', 2, 'The pattern'), 'Level 2 — The pattern');
});

test('t: dashSalaryPending/dashMarginPositive/dashMarginNegative esistono nelle 7 lingue — bug reale trovato dal vivo (chiave grezza "dashMarginPositive" mostrata a schermo)', () => {
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    assert.notEqual(t('dashSalaryPending', lang), 'dashSalaryPending');
    assert.notEqual(t('dashMarginPositive', lang, '50€'), 'dashMarginPositive');
    assert.notEqual(t('dashMarginNegative', lang, '50€'), 'dashMarginNegative');
  }
});

test('t: tutte le chiavi brake* (Momentum Vault, freno spese Delicato/Consigliere/Deciso) esistono nelle 7 lingue', () => {
  const chiavi = ['brakeDescZen', 'brakeDescAdvisor', 'brakeDescPredator', 'brakeLiquidityNote', 'brakeToast'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 'X');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
  assert.equal(t('brakeToast', 'en', 'Firm'), 'Spending brake: Firm.');
});

test('t: tutte le chiavi neuro* (neurosym.js, pannello "Come funziona Momentum") esistono nelle 7 lingue', () => {
  const chiavi = ['neuroCatName', 'neuroCatComponents', 'neuroCatMode', 'neuroEpiName', 'neuroEpiComponents', 'neuroEpiMode', 'neuroCausalName', 'neuroCausalComponents', 'neuroCausalMode', 'neuroInvestName', 'neuroInvestComponents', 'neuroInvestMode', 'neuroQaName', 'neuroQaComponents', 'neuroQaMode', 'neuroHwName', 'neuroHwComponents', 'neuroHwModeActive', 'neuroHwModeInactive', 'neuroHonesty'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

test('t: providerChangeBtn/providerActivateBtn/toastAnon* (lista provider AI + disclosure telemetria/chat) esistono nelle 7 lingue', () => {
  const chiavi = ['providerChangeBtn', 'providerActivateBtn', 'toastAnonBoth', 'toastAnonTelemetry', 'toastAnonChatCtx'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

test('t: chiavi key* (stato chiavi API prezzi live, Momentum Vault) esistono nelle 7 lingue', () => {
  const chiavi = ['keyStatusSaved', 'keyStatusNotConfigured', 'keyPasteFirst', 'keySavedOnDevice', 'keySavedToast'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 'abcd…wxyz');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

test('t: chiavi semantic-embed/sentiment on-device (Momentum Vault) esistono nelle 7 lingue', () => {
  const chiavi = ['semanticQaActivateLabel', 'sentimentActivateLabel', 'progressPct', 'progressUnknownSize', 'semanticQaReadyLabel', 'semanticQaDownloadingLabel', 'semanticQaDownloadToast', 'semanticQaSuccessToast', 'semanticQaFailToast', 'sentimentReadyLabel', 'sentimentDownloadingLabel', 'sentimentDownloadToast', 'sentimentSuccessToast', 'sentimentFailToast', 'errUnknownReason', 'remindersEmptyTitle', 'remindersEmptyBody'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 42, 'network error');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
    assert.match(t('remindersEmptyBody', lang), /<b>.*<\/b>/, `remindersEmptyBody deve contenere <b> in lingua "${lang}"`);
  }
});

test('t: tutte le chiavi inst* (install-guide.js, guida installazione PWA) esistono nelle 7 lingue', () => {
  const chiavi = ['instAlreadyInstalledTitle', 'instInAppTitle', 'instInAppWarning', 'instInAppOpenSafari', 'instInAppOpenChrome', 'instInAppThenWorks', 'instIosSafariTitle', 'instIosBackupWarning', 'instIosShareIcon', 'instIosAddToHome', 'instIosConfirmAdd', 'instIosEmptyAfterInstall', 'instIosOtherTitle', 'instIosOnlySafari', 'instIosShareThenHome', 'instAndroidTitle', 'instAndroidTapInstall', 'instAndroidConfirm', 'instAndroidMenuDots', 'instAndroidAddHome', 'instDesktopTitle', 'instDesktopTapInstall', 'instDesktopOpensWindow', 'instFirefoxNotSupported', 'instFirefoxAlternative', 'instFallbackTitle', 'instFallbackStep'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 'Instagram');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
  assert.match(t('instInAppTitle', 'en', 'Instagram'), /Instagram/);
});

test('t: tutte le chiavi tax*/es* nuove (renderTax/renderTaxEs/renderTaxSettings, Momentum Vault) esistono nelle 7 lingue', () => {
  const chiaviPlain = ['taxLvl0Note', 'taxSimulateBtn', 'taxNotSelfEmployedBtn', 'taxAskRegimeNote', 'taxNoInvoiceThisMonth', 'taxNoInvoiceYet', 'taxIncomeFallback', 'taxConfirmInvoiceBtn', 'taxConfirmNoBtn', 'taxCreateBtn', 'taxMarkTransmittedBtn', 'taxOpenSdiPortalBtn', 'taxSdiGuideBtn', 'taxCreateInvoiceBtn', 'taxShowSpainInstead', 'esIncomeFallback', 'esShowItalyInstead', 'taxYearPaceLabel', 'taxToSetAsideLabel', 'taxChangeRegimeBtn', 'taxSeenInvoicesNote', 'taxJustCuriousBtn', 'taxEmployedNote', 'taxChangedMindBtn', 'taxIntroNote', 'taxPartitaIvaBtn', 'taxClientFallback'];
  const chiaviFn = ['taxUncertainCount', 'taxRecurringDue', 'taxSdiPendingCount', 'taxActiveRegimeLine'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiaviPlain) {
      const v = t(k, lang);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
    for (const k of chiaviFn) {
      const v = t(k, lang, 2, 'Mensile', 'Mario Rossi', 50, 3, 'Forfettario');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
  assert.equal(t('taxUncertainCount', 'it', 1), '1 entrata da confermare');
  assert.equal(t('taxUncertainCount', 'it', 2), '2 entrate da confermare');
  assert.equal(t('taxUncertainCount', 'en', 1), '1 income to confirm');
  assert.equal(t('taxUncertainCount', 'en', 3), '3 incomes to confirm');
  assert.match(t('taxRecurringDue', 'en', 'Monthly', 'Mario Rossi', 50), /Mario Rossi/);
  assert.match(t('taxRecurringDue', 'en', 'Monthly', 'Mario Rossi', null), /not issued yet/);
});

test('t: tutte le chiavi mesh* nuove (renderMeshStatus/renderMeshEconomics/updateSplitMeshDot) esistono nelle 7 lingue', () => {
  const chiaviFn = ['meshNoPeers', 'meshConnectedStatus', 'meshEconomicsStatus', 'splitMeshConnected'];
  const chiaviPlain = ['splitMeshDisconnected'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiaviFn) {
      const v = t(k, lang, 3, 120, 5, 2, '4.2×', 20);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
    for (const k of chiaviPlain) {
      const v = t(k, lang);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
  assert.equal(t('meshConnectedStatus', 'it', 1, 50, 3, 0), '1 dispositivo fidato collegato · modello su <b>50</b> esempi · 3 fusioni accettate.');
  assert.equal(t('splitMeshConnected', 'it', 1), '1 dispositivo collegato in diretta');
  assert.equal(t('splitMeshConnected', 'it', 3), '3 dispositivi collegati in diretta');
});
test('t: tutte le chiavi statiche alpha* (Analisi Tensor, cornice cards) esistono nelle 7 lingue', () => {
  const chiavi = ['alphaSubtitle', 'alphaBudgetTitle', 'alphaBudgetTapHint', 'alphaGoalsTitle', 'alphaGoalsNewBtn', 'alphaDebtTitle', 'alphaDebtSub', 'alphaDebtBtn', 'alphaWhereGoesTitle', 'alphaWhereGoesSub', 'alphaTogetherTitle', 'alphaTogetherSub', 'alphaTogetherGroupsBtn', 'alphaQuickSplitBtn', 'alphaWealthGrowthTitle', 'alphaProjection1y', 'alphaProjection5y', 'alphaFireTitle', 'alphaFireSub', 'alphaFireYearsLabel', 'alphaCalculating', 'alphaTargetCapitalLabel', 'alphaWhatIfTitle', 'alphaWhatIfSub', 'alphaIncreaseSavingsLabel', 'alphaMonteCarloRange', 'alphaWhatIfCategoryLabel', 'alphaInvestTitle', 'alphaInvestSub', 'alphaInvestDisclaimer', 'alphaNetWorthTitle', 'alphaNetWorthSub', 'alphaNetWorthDisclaimer', 'alphaRatesWorldTitle', 'alphaRatesWorldSub', 'alphaCauseEffectTitle', 'alphaCauseEffectSub', 'alphaMarketOverviewTitle', 'alphaMarketOverviewSub', 'alphaTraderDeskTitle', 'alphaTraderDeskSub', 'alphaTailRiskTitle', 'alphaTailRiskSub', 'alphaTrackRecordTitle', 'alphaTrackRecordSub', 'alphaDiagnosisTitle', 'alphaDiagnosisSub', 'alphaTimingTitle', 'alphaTimingSub', 'alphaPeriodCompareTitle', 'alphaPeriodCompareSub', 'alphaPeriodMonthBtn', 'alphaPeriodYearBtn', 'alphaLinkedCatsTitle', 'alphaLinkedCatsSub', 'alphaAssetSearchTitle', 'alphaAssetSearchSub', 'alphaAssetSearchPlaceholder', 'alphaSearchBtn', 'alphaGoldChip', 'alphaAlertsDisclaimer', 'alphaHeatmapTitle', 'alphaHeatmapSub', 'alphaSubsTitle', 'alphaSubsSub'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
});

test('t: tutte le chiavi dinamiche alpha* (renderAnalysis: budget settimanale, forecast, FIRE, heatmap, what-if) esistono nelle 7 lingue', () => {
  const chiavi = ['alphaOfBudget', 'alphaWeekTitle', 'alphaOverBudget', 'alphaRemaining', 'alphaRolloverIn', 'alphaWeeklyBudgetTitle', 'alphaCagrEstimate', 'alphaScenarios5y', 'alphaNextMonthExpenses', 'alphaDiscipline', 'alphaFireYearsResult', 'alphaFireNoSavings', 'alphaFireCoastNote', 'alphaFireCoastBonus', 'alphaHeatmapNoExpense', 'alphaWhatIfNoHistory', 'alphaWhatIfVerbSave', 'alphaWhatIfVerbSpendMore', 'alphaWhatIfResultLine', 'alphaWhatIfDirectionDown', 'alphaWhatIfDirectionUp', 'alphaWhatIfLagWeek', 'alphaWhatIfChainLine', 'alphaWhatIfTotalEstimate', 'alphaScenarioExtraVal', 'alphaScenario5yResult', 'alphaScenario5yZero', 'alphaBestStrategiesIntro'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, '10€', '20€', '5', 'lun', 'ven', 'Cibo', 'sale', ', la settimana dopo');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
  assert.equal(t('alphaOfBudget', 'it', '100€'), 'su 100€');
  assert.equal(t('alphaOfBudget', 'en', '100€'), 'of 100€');
  assert.equal(t('alphaWeekTitle', 'en', '1 Jan', '7 Jan'), 'This week (1 Jan - 7 Jan)');
});

test('t: chiavi dataRecovery* (recupero da tx_log dopo il bug di perdita dati) esistono nelle 7 lingue', () => {
  const chiavi = ['dataRecoveryTitle', 'dataRecoveryBody', 'dataRecoveryConfirmBtn', 'dataRecoveryDismissBtn', 'dataRecoverySuccessToast'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 3);
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
  assert.match(t('dataRecoveryBody', 'en', 3), /3/);
  assert.match(t('dataRecoverySuccessToast', 'it', 1), /1/);
});

test('t: tutte le chiavi nw* (renderNetWorth: proiezione, settori, macro, tail risk, track record, divario comportamento, diagnosi, trader desk, tassi Paesi) esistono nelle 7 lingue', () => {
  const chiavi = ['nwCashLine', 'nwInvestedLine', 'nwLiabilitiesLine', 'nwStaleBothLabel', 'nwStaleNowcastLabel', 'nwStaleCostLabel', 'nwProjectionLegend', 'nwSolidBadge', 'nwSolidBadgeTitle', 'nwLuckBadge', 'nwLuckBadgeTitle', 'nwBarTooltip', 'nwTrialsNote', 'nwStaleParamsLabel', 'nwSectorRankingHeader', 'nwRegimeNowTitle', 'nwRegimeCalm', 'nwRegimeVolatile', 'nwRegimeUnclear', 'nwHeadlineRatesSync', 'nwHeadlineNoPosition', 'nwRealNumbersSummary', 'nwGlobalRateCycle', 'nwCorrelationNote', 'nwTailRiskEmpty', 'nwNotMeasurable', 'nwTailRiskWorstMonths', 'nwTailRiskMoreFragile', 'nwTailRiskLessFragile', 'nwTailRiskLossShare', 'nwTailRiskEquivSectors', 'nwTailRiskUncovered', 'nwTailRiskMethodNote', 'nwTrackRecordEmpty', 'nwTrackRecordMethodNote', 'nwBehaviorGapEmpty', 'nwBehaviorGapVsFlat', 'nwHowCalculated', 'nwBehaviorGapDeposited', 'nwBehaviorGapResult', 'nwBehaviorGapExcluded', 'nwDiagnosisEmpty', 'nwDiagnosisHistoricalSummary', 'nwDiagnosisSold', 'nwDiagnosisHeld', 'nwDiagnosisRealMonthsNote', 'nwFearIndex', 'nwTraderDeskDisclaimer', 'nwGlobalRateCycleSync', 'nwRatesSyncedGlobal', 'nwRatesDecoupled', 'nwLongTermRatesLabel'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 'X', 'Y', 'Z', 'W');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
  assert.equal(t('nwCashLine', 'en', '100€'), 'cash 100€');
  assert.equal(t('nwTailRiskLossShare', 'it', 42), '42% della perdita');
});

test('t: tutte le chiavi alphaGoals*/alphaSubs* (obiettivi risparmio, abbonamenti — Analisi Tensor) esistono nelle 7 lingue', () => {
  const chiavi = ['alphaGoalsCreateFirst', 'alphaGoalsCreateFirstSub', 'alphaGoalsRemove', 'alphaGoalsOnTrack', 'alphaGoalsBehindTrack', 'alphaGoalsProgressLine', 'alphaSubsEmpty', 'alphaSubsPerMonth', 'alphaSubsIncludesNote', 'alphaSubsNextDate', 'alphaSubsHikeNote'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 'X', 'Y', 'Z');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
  assert.equal(t('alphaGoalsProgressLine', 'en', '100€', '500€', 20), '100€ of 500€ (20%)');
  assert.equal(t('alphaSubsPerMonth', 'it', '15€'), '15€/mese');
});

test('t: tutte le chiavi alphaSubsDormant* (abbonamenti dimenticati, 2026-08-30) esistono nelle 7 lingue', () => {
  const chiavi = ['alphaSubsDormantTitle', 'alphaSubsDormantSub', 'alphaSubsDormantBody', 'alphaSubsDormantReview'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 'Netflix', 200, '19,98 €');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
  assert.match(t('alphaSubsDormantBody', 'it', 'Netflix', 200, '19,98 €'), /Netflix/);
});

test('t: tutte le chiavi alphaSubsNew* (nuovo addebito ricorrente, 2026-08-30) esistono nelle 7 lingue', () => {
  const chiavi = ['alphaSubsNewTitle', 'alphaSubsNewBody'];
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const k of chiavi) {
      const v = t(k, lang, 'Disney Plus', '8,99 €');
      assert.notEqual(v, k, `chiave "${k}" mancante in lingua "${lang}"`);
      assert.notEqual(v, undefined, `chiave "${k}" in lingua "${lang}" ha restituito undefined`);
    }
  }
  assert.match(t('alphaSubsNewBody', 'it', 'Disney Plus', '8,99 €'), /Disney Plus/);
});
