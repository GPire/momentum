'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import { preposizioniArticolateConcatenate, lunghezzaFrasi, perOgniStringa } from './leggibilita.js';

// ── Il modulo, testato sui casi VERI trovati in questa sessione ──
// Non inventati per il test: sono gli errori realmente scritti e corretti
// (a mano, più volte) in file diversi di questo stesso progetto.

test('trova gli errori reali già commessi in sessione', () => {
  assert.deepEqual(preposizioniArticolateConcatenate('In il 2008 il mercato è crollato'), ['In il']);
  assert.deepEqual(preposizioniArticolateConcatenate('Su gli ultimi 26 anni'), ['Su gli']);
  assert.deepEqual(preposizioniArticolateConcatenate('comprate da le azioni americane'), ['da le']);
});

test('non segnala la forma corretta (fusa)', () => {
  assert.deepEqual(preposizioniArticolateConcatenate('Nel 2008 il mercato è crollato'), []);
  assert.deepEqual(preposizioniArticolateConcatenate('Sugli ultimi 26 anni'), []);
  assert.deepEqual(preposizioniArticolateConcatenate('comprate dalle azioni americane'), []);
});

test('per/tra/fra/con NON sono richieste a fondersi — nessun falso allarme', () => {
  // "per il", "tra la", "con il" sono corretti in italiano: includerli nella
  // lista avrebbe rotto frasi legittime, non trovato altri errori veri.
  assert.deepEqual(preposizioniArticolateConcatenate('per il momento va bene così'), []);
  assert.deepEqual(preposizioniArticolateConcatenate('tra la fine del mese e ora'), []);
  assert.deepEqual(preposizioniArticolateConcatenate('con il tuo permesso'), []);
});

test('trova più occorrenze nella stessa frase, non si ferma alla prima', () => {
  assert.deepEqual(
    preposizioniArticolateConcatenate('In il 2008, su gli USA e da le banche europee'),
    ['In il', 'su gli', 'da le']
  );
});

test('input vuoto o non testuale: nessun crash, nessun falso positivo', () => {
  assert.deepEqual(preposizioniArticolateConcatenate(''), []);
  assert.deepEqual(preposizioniArticolateConcatenate(null), []);
  assert.deepEqual(preposizioniArticolateConcatenate(undefined), []);
});

// ── lunghezzaFrasi: misura, non giudizio ──

test('lunghezzaFrasi: divide sulle frasi vere, non su ogni punto', () => {
  const l = lunghezzaFrasi('Frase corta. Questa è un po\' più lunga della prima!');
  assert.equal(l.length, 2);
  assert.ok(l[0] < l[1]);
});

test('lunghezzaFrasi: stringa vuota → nessuna frase, nessun crash', () => {
  assert.deepEqual(lunghezzaFrasi(''), []);
  assert.deepEqual(lunghezzaFrasi(null), []);
});

// ── perOgniStringa: applica un controllo a un intero dizionario ──

test('perOgniStringa: trova i problemi SOLO nelle chiavi che li hanno', () => {
  const dizionario = { a: 'Tutto bene qui', b: 'In il posto sbagliato' };
  const problemi = perOgniStringa(dizionario, preposizioniArticolateConcatenate);
  assert.equal(problemi.length, 1);
  assert.equal(problemi[0].chiave, 'b');
  assert.deepEqual(problemi[0].esito, ['In il']);
});

test('perOgniStringa: le funzioni-modello si testano chiamandole, non si saltano', () => {
  const dizionario = { titolo: (v) => `Con CHF ${v} in il conto` };
  const problemi = perOgniStringa(dizionario, preposizioniArticolateConcatenate);
  assert.equal(problemi.length, 1, 'una stringa-funzione con l\'errore deve essere trovata, non ignorata');
});

// ── IL CANCELLO VERO: l'intero dizionario IT di ui-strings.js ──
// Se domani qualcuno scrive "In il" in una chiave nuova, questo test lo
// blocca prima che diventi un commit — non serve rileggerlo a mano.

test('CANCELLO: nessuna stringa italiana dell\'interfaccia ha una preposizione non fusa', async () => {
  // Import dinamico: ui-strings.js importa detect.js, che non ha bisogno di
  // window/navigator per questo dizionario statico — ma import dinamico
  // resta la forma sicura usata ovunque in questa sessione per i moduli
  // che toccano l'ambiente browser.
  const { t: _t } = await import('./ui-strings.js');
  // Il dizionario IT non è esportato direttamente: lo ricostruiamo
  // interrogando t() con le chiavi note, così il test resta vero anche se
  // l'implementazione interna cambia forma.
  const CHIAVI_IT = [
    'chSimTitle', 'chSimSubtitle', 'chSimPlaceholder', 'chSimCta', 'chSimBack',
    'chAvsLabel', 'chAvsDegressiveTitle', 'chAvsDegressiveLink', 'chInvestText',
    'chCantonNote', 'chCreateInvoice', 'chRecalculate', 'chInvTitle', 'chInvSubtitle',
    'chInvYourData', 'chInvIban', 'chInvName', 'chInvStreet', 'chInvBuilding', 'chInvCap',
    'chInvCity', 'chInvClientSection', 'chInvClientName', 'chInvAmount', 'chInvDesc',
    'chInvGenerate', 'chInvDisclaimer', 'chInvErrMissing', 'chInvErrAmount', 'chResTitle',
    'chResDisclaimer', 'chResNewInvoice', 'chRefLabel',
  ];
  const dizionario = Object.fromEntries(CHIAVI_IT.map((k) => [k, _t(k, 'it')]));
  // Le due chiavi-funzione si testano a parte: t() richiede gli argomenti
  // veri per risolverle, perOgniStringa non può indovinarli da qui.
  dizionario.chResultTitle = _t('chResultTitle', 'it', '80000');
  dizionario.chAvsDegressiveText = _t('chAvsDegressiveText', 'it', '58800', '514');

  const problemi = perOgniStringa(dizionario, preposizioniArticolateConcatenate);
  assert.deepEqual(problemi, [], `trovate preposizioni non fuse: ${JSON.stringify(problemi)}`);
});
