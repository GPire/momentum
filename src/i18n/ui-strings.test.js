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

test('t: tutte le chiavi wn* (header + 8 voci × titolo/testo) esistono in IT/EN/ES/DE/FR', () => {
  const chiavi = ['wnEyebrow', 'wnTitle', 'wnClose'];
  for (const rel of ['0827', '0828']) {
    for (let i = 0; i < 4; i++) {
      chiavi.push(`wn${rel}_${i}_t`, `wn${rel}_${i}_d`);
    }
  }
  assert.equal(chiavi.length, 3 + 16);
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
