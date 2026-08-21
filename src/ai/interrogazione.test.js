'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import { creaInterrogazione, descriviInterrogazione, OPERAZIONI } from './interrogazione.js';

test('OPERAZIONI: le 7 del piano, "consiglia" non è fra queste', () => {
  assert.equal(OPERAZIONI.length, 7);
  assert.deepEqual(OPERAZIONI, ['descrivi', 'confronta', 'classifica', 'condiziona', 'spiega', 'simula', 'attribuisci']);
  assert.ok(!OPERAZIONI.includes('consiglia'));
});

test('creaInterrogazione: costruzione valida minima', () => {
  const q = creaInterrogazione({ operazione: 'descrivi', misura: 'margine', soggetti: [{ tipo: 'titolo', id: 'AAPL' }] });
  assert.equal(q.operazione, 'descrivi');
  assert.equal(q.misura, 'margine');
  assert.deepEqual(q.soggetti, [{ tipo: 'titolo', id: 'AAPL' }]);
  assert.equal(q.finestra, null);
  assert.deepEqual(q.vincoli, {});
});

test('creaInterrogazione: soggetti vuoti sono validi (domanda su un archivio intero)', () => {
  const q = creaInterrogazione({ operazione: 'spiega', misura: 'deterioramento' });
  assert.deepEqual(q.soggetti, []);
});

test('creaInterrogazione: operazione sconosciuta lancia, con le operazioni valide nel messaggio', () => {
  assert.throws(() => creaInterrogazione({ operazione: 'consiglia', misura: 'x' }), /operazione sconosciuta.*consiglia/);
});

test('creaInterrogazione: misura mancante o vuota lancia', () => {
  assert.throws(() => creaInterrogazione({ operazione: 'descrivi' }), /misura/);
  assert.throws(() => creaInterrogazione({ operazione: 'descrivi', misura: '   ' }), /misura/);
});

test('creaInterrogazione: soggetti non-array lancia', () => {
  assert.throws(() => creaInterrogazione({ operazione: 'descrivi', misura: 'x', soggetti: 'AAPL' }), /array/);
});

test('creaInterrogazione: soggetto malformato (manca tipo o id) lancia', () => {
  assert.throws(() => creaInterrogazione({ operazione: 'descrivi', misura: 'x', soggetti: [{ id: 'AAPL' }] }), /soggetto #0/);
  assert.throws(() => creaInterrogazione({ operazione: 'descrivi', misura: 'x', soggetti: [{ tipo: 'titolo' }] }), /soggetto #0/);
});

test('creaInterrogazione: finestra deve essere oggetto o null', () => {
  assert.throws(() => creaInterrogazione({ operazione: 'descrivi', misura: 'x', finestra: 'ultimi 12 mesi' }));
  assert.throws(() => creaInterrogazione({ operazione: 'descrivi', misura: 'x', finestra: [1, 2] }));
  assert.doesNotThrow(() => creaInterrogazione({ operazione: 'descrivi', misura: 'x', finestra: { ultimi: 12 } }));
});

test('creaInterrogazione: il risultato è congelato (immutabile)', () => {
  const q = creaInterrogazione({ operazione: 'descrivi', misura: 'x', soggetti: [{ tipo: 'titolo', id: 'AAPL' }] });
  assert.throws(() => { q.misura = 'altro'; }, TypeError);
  assert.throws(() => { q.soggetti.push({ tipo: 'titolo', id: 'MSFT' }); }, TypeError);
  assert.throws(() => { q.soggetti[0].id = 'MSFT'; }, TypeError);
});

test('descriviInterrogazione: formato leggibile, con e senza soggetti', () => {
  const q1 = creaInterrogazione({ operazione: 'confronta', misura: 'rendimento', soggetti: [{ tipo: 'settore', id: 'XLK' }, { tipo: 'settore', id: 'XLE' }] });
  assert.equal(descriviInterrogazione(q1), 'confronta/rendimento su [settore:XLK, settore:XLE]');
  const q2 = creaInterrogazione({ operazione: 'spiega', misura: 'deterioramento' });
  assert.equal(descriviInterrogazione(q2), 'spiega/deterioramento su [nessun soggetto specifico]');
});
