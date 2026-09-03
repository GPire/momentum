import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPENSE_PLATFORMS, trovaPiattaforma, indirizzoValido, nomeFileGiustificativo, scontriniDaInviare, scontriniGiaInviati } from './expense-bridge.js';

test('Concur ed Expensify hanno un indirizzo fisso verificato, Zoho e Altro no', () => {
  assert.equal(trovaPiattaforma('concur').indirizzoFisso, 'receipts@concur.com');
  assert.equal(trovaPiattaforma('expensify').indirizzoFisso, 'receipts@expensify.com');
  assert.equal(trovaPiattaforma('zoho').indirizzoFisso, null);
  assert.equal(trovaPiattaforma('altro').indirizzoFisso, null);
});

test('un id sconosciuto non restituisce una piattaforma inventata', () => {
  assert.equal(trovaPiattaforma('nonexiste'), null);
  assert.equal(trovaPiattaforma(undefined), null);
});

test('ogni piattaforma elencata ha un nome e una nota, mai un campo vuoto', () => {
  for (const p of EXPENSE_PLATFORMS) {
    assert.ok(p.nome && p.nome.length > 0);
    assert.ok(p.nota && p.nota.length > 0);
  }
});

test('indirizzoValido accetta email plausibili e rifiuta il resto', () => {
  assert.equal(indirizzoValido('receipts@concur.com'), true);
  assert.equal(indirizzoValido('mario.rossi+trasferte@azienda.it'), true);
  assert.equal(indirizzoValido('non-un-email'), false);
  assert.equal(indirizzoValido(''), false);
  assert.equal(indirizzoValido(null), false);
  assert.equal(indirizzoValido(undefined), false);
});

test('nomeFileGiustificativo usa la data della spesa, mai un nome generico che si sovrascrive', () => {
  assert.equal(nomeFileGiustificativo({ id: 'abc123', date: '2026-09-03' }, false), 'scontrino-2026-09-03-c123.jpg');
  assert.equal(nomeFileGiustificativo({ id: 'abc123', date: '2026-09-03T10:00:00.000Z' }, true), 'scontrino-2026-09-03-c123.pdf');
});

test('nomeFileGiustificativo con dati sporchi non crasha', () => {
  assert.equal(nomeFileGiustificativo({}, false), 'scontrino-senza-data.jpg');
  assert.equal(nomeFileGiustificativo(null, false), 'scontrino-senza-data.jpg');
});

test('due scontrini nello stesso giorno producono nomi file diversi (il caso reale che ha motivato il suffisso)', () => {
  const nome1 = nomeFileGiustificativo({ id: 'taxi-001', date: '2026-09-01' }, false);
  const nome2 = nomeFileGiustificativo({ id: 'pranzo-002', date: '2026-09-01' }, false);
  assert.notEqual(nome1, nome2);
});

test('scontriniDaInviare: solo spese con scontrino E non ancora inviate', () => {
  const expenses = [
    { id: '1', receiptImage: 'data:x', bridgeSentAt: null },
    { id: '2', receiptImage: 'data:x', bridgeSentAt: '2026-09-01T10:00:00.000Z' },
    { id: '3', receiptImage: null },
    { id: '4' },
  ];
  const risultato = scontriniDaInviare(expenses);
  assert.deepEqual(risultato.map(e => e.id), ['1']);
});

test('scontriniGiaInviati: il complemento esatto di scontriniDaInviare fra le spese con scontrino', () => {
  const expenses = [
    { id: '1', receiptImage: 'data:x', bridgeSentAt: null },
    { id: '2', receiptImage: 'data:x', bridgeSentAt: '2026-09-01T10:00:00.000Z' },
  ];
  assert.deepEqual(scontriniGiaInviati(expenses).map(e => e.id), ['2']);
});

test('scontriniDaInviare/scontriniGiaInviati con lista vuota o assente non crashano', () => {
  assert.deepEqual(scontriniDaInviare([]), []);
  assert.deepEqual(scontriniDaInviare(undefined), []);
  assert.deepEqual(scontriniGiaInviati(undefined), []);
});
