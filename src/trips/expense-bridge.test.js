import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPENSE_PLATFORMS, trovaPiattaforma, indirizzoValido, nomeFileGiustificativo } from './expense-bridge.js';

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
  assert.equal(nomeFileGiustificativo({ date: '2026-09-03' }, false), 'scontrino-2026-09-03.jpg');
  assert.equal(nomeFileGiustificativo({ date: '2026-09-03T10:00:00.000Z' }, true), 'scontrino-2026-09-03.pdf');
});

test('nomeFileGiustificativo con dati sporchi non crasha', () => {
  assert.equal(nomeFileGiustificativo({}, false), 'scontrino-senza-data.jpg');
  assert.equal(nomeFileGiustificativo(null, false), 'scontrino-senza-data.jpg');
});
