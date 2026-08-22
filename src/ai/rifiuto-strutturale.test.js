'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import { richiedeConsiglio, MISURE_VIETATE, MESSAGGIO_RIFIUTO } from './rifiuto-strutturale.js';
import { creaInterrogazione } from './interrogazione.js';

test('richiedeConsiglio: ogni misura vietata scatta, con qualunque operazione la porti', () => {
  for (const misura of MISURE_VIETATE) {
    // Prova con più operazioni: il rifiuto non deve dipendere da quale
    // operazione "trasporta" la misura vietata.
    for (const operazione of ['descrivi', 'spiega', 'classifica']) {
      const q = creaInterrogazione({ operazione, misura });
      assert.equal(richiedeConsiglio(q), true, `${operazione}/${misura} doveva essere rifiutata`);
    }
  }
});

test('richiedeConsiglio: una misura legittima non scatta mai', () => {
  const q = creaInterrogazione({ operazione: 'confronta', misura: 'rendimento', soggetti: [{ tipo: 'settore', id: 'XLK' }] });
  assert.equal(richiedeConsiglio(q), false);
});

test('richiedeConsiglio: prezzo/direzione su finestra futura è un consiglio travestito', () => {
  const q = creaInterrogazione({ operazione: 'descrivi', misura: 'prezzo', finestra: { futuro: true } });
  assert.equal(richiedeConsiglio(q), true);
});

test('richiedeConsiglio: la stessa misura "prezzo" su finestra PASSATA non è vietata (descrivere un prezzo storico è legittimo)', () => {
  const q = creaInterrogazione({ operazione: 'descrivi', misura: 'prezzo', finestra: { da: '2020-01', a: '2020-12' } });
  assert.equal(richiedeConsiglio(q), false);
});

test('richiedeConsiglio: vincoli.tipoRisposta="raccomandazione" scatta indipendentemente dalla misura', () => {
  const q = creaInterrogazione({ operazione: 'classifica', misura: 'qualcosa-di-innocuo', vincoli: { tipoRisposta: 'raccomandazione' } });
  assert.equal(richiedeConsiglio(q), true);
});

test('richiedeConsiglio: input nullo non crasha', () => {
  assert.equal(richiedeConsiglio(null), false);
  assert.equal(richiedeConsiglio(undefined), false);
});

test('MESSAGGIO_RIFIUTO: spiega il perché, non solo dice di no (stesso principio di mercato-qa.js)', () => {
  assert.match(MESSAGGIO_RIFIUTO, /nessuno sa/i);
});
