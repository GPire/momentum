import test from 'node:test';
import assert from 'node:assert/strict';
import { taxHandoffGuide } from './tax-handoff.js';

test('wizardUrl (feedback 2026-09-21): solo per l\'Italia, mai dato come primo link, sempre con nota "solo dopo l\'accesso"', () => {
  for (const lang of ['it','en','de','fr','es','nl','pt']) {
    const it = taxHandoffGuide('it', lang);
    const url = new URL(it.wizardUrl);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'ivaservizi.agenziaentrate.gov.it');
    assert.equal(url.search, '');
    assert.ok(it.wizardOpen.length > 0);
    assert.ok(it.wizardNote.length > 0);
    for (const country of ['ch','es']) assert.equal(taxHandoffGuide(country, lang).wizardUrl, undefined);
  }
});
test('ogni lingua e Paese ha quattro passi e link ufficiali senza dati utente', () => {
  const hosts = new Set(['ivaservizi.agenziaentrate.gov.it','www.fiscooggi.it','estvportal.estv.admin.ch','www.estv.admin.ch','www1.agenciatributaria.gob.es','sede.agenciatributaria.gob.es']);
  for (const lang of ['it','en','de','fr','es','nl','pt']) for (const country of ['it','ch','es']) {
    const guide = taxHandoffGuide(country, lang);
    assert.equal(guide.steps.length, 4);
    for (const step of guide.steps) assert.ok(step.title.length && step.body.length > 30);
    for (const key of ['title','back','next','open','helpLabel','external','note']) assert.ok(guide[key]);
    for (const value of [guide.url, guide.help]) {
      const url = new URL(value);
      assert.equal(url.protocol, 'https:');
      assert.ok(hosts.has(url.hostname));
      assert.equal(url.search, '');
      assert.equal(url.username + url.password, '');
    }
  }
});
test('Paese ignoto non riceve istruzioni fiscali di un altro Paese', () => {
  for (const code of [null, '', 'DEFAULT', 'US', '__proto__', 'constructor']) assert.equal(taxHandoffGuide(code), null);
  assert.equal(taxHandoffGuide(' IT ').country, 'it');
  assert.deepEqual(taxHandoffGuide('es','unknown'), taxHandoffGuide('es','en'));
});
test('ogni apertura riceve passi indipendenti senza stato di invio', () => {
  const guide = taxHandoffGuide('it','it');
  guide.steps[0].body = 'changed';
  assert.notEqual(taxHandoffGuide('it','it').steps[0].body, 'changed');
  assert.equal('sdiTransmitted' in guide, false);
});
