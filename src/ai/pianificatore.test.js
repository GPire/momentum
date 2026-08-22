'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import { registra, pianifica, elencoCapacita, azzeraRegistro } from './pianificatore.js';
import { creaInterrogazione } from './interrogazione.js';

test.beforeEach(() => azzeraRegistro());

test('registra: convalida la forma, rifiuta capacità malformate', () => {
  assert.throws(() => registra({ operazioni: ['descrivi'], misura: 'x', copertura: () => true, calcola: () => 1 }), /nome/);
  assert.throws(() => registra({ nome: 'a', misura: 'x', copertura: () => true, calcola: () => 1 }), /operazioni/);
  assert.throws(() => registra({ nome: 'a', operazioni: ['descrivi'], copertura: () => true, calcola: () => 1 }), /misura/);
  assert.throws(() => registra({ nome: 'a', operazioni: ['descrivi'], misura: 'x', calcola: () => 1 }), /copertura/);
  assert.throws(() => registra({ nome: 'a', operazioni: ['descrivi'], misura: 'x', copertura: () => true }), /calcola/);
});

test('registra: due capacità con lo stesso nome è un errore (non un rimpiazzo silenzioso)', () => {
  registra({ nome: 'dup', operazioni: ['descrivi'], misura: 'x', copertura: () => true, calcola: () => 1 });
  assert.throws(() => registra({ nome: 'dup', operazioni: ['descrivi'], misura: 'x', copertura: () => true, calcola: () => 2 }), /già registrata/);
});

test('pianifica: nessuna capacità per quella operazione/misura → motivo "operazione-sconosciuta"', () => {
  const q = creaInterrogazione({ operazione: 'simula', misura: 'stress-test-inventato' });
  const r = pianifica(q, {});
  assert.equal(r.risolto, false);
  assert.equal(r.motivo, 'operazione-sconosciuta');
  assert.match(r.mancante, /Nessuna capacità/);
});

test('pianifica: capacità esiste ma rifiuta la copertura → motivo "dati-insufficienti", diverso dal caso sopra', () => {
  registra({
    nome: 'confronto-finto',
    operazioni: ['confronta'],
    misura: 'rendimento',
    copertura: (q) => q.soggetti.every((s) => s.id === 'NOTO'),
    calcola: () => ({ ok: true }),
  });
  const q = creaInterrogazione({ operazione: 'confronta', misura: 'rendimento', soggetti: [{ tipo: 'settore', id: 'IGNOTO' }] });
  const r = pianifica(q, {});
  assert.equal(r.risolto, false);
  assert.equal(r.motivo, 'dati-insufficienti');
  assert.match(r.mancante, /confronto-finto/);
  assert.match(r.mancante, /settore:IGNOTO/);
});

test('pianifica: capacità che copre → risolto, con nome della capacità e risultato', () => {
  registra({
    nome: 'descrizione-finta',
    operazioni: ['descrivi'],
    misura: 'margine',
    copertura: () => true,
    calcola: (q) => ({ soggetto: q.soggetti[0].id, valore: 0.42 }),
  });
  const q = creaInterrogazione({ operazione: 'descrivi', misura: 'margine', soggetti: [{ tipo: 'titolo', id: 'AAPL' }] });
  const r = pianifica(q, {});
  assert.equal(r.risolto, true);
  assert.equal(r.capacita, 'descrizione-finta');
  assert.deepEqual(r.risultato, { soggetto: 'AAPL', valore: 0.42 });
});

test('pianifica: più capacità sulla stessa misura, vince la prima che copre — non tutte devono coprire', () => {
  registra({ nome: 'copre-A', operazioni: ['descrivi'], misura: 'x', copertura: (q) => q.soggetti[0]?.id === 'A', calcola: () => 'risultato-A' });
  registra({ nome: 'copre-B', operazioni: ['descrivi'], misura: 'x', copertura: (q) => q.soggetti[0]?.id === 'B', calcola: () => 'risultato-B' });
  const qA = creaInterrogazione({ operazione: 'descrivi', misura: 'x', soggetti: [{ tipo: 't', id: 'A' }] });
  const qB = creaInterrogazione({ operazione: 'descrivi', misura: 'x', soggetti: [{ tipo: 't', id: 'B' }] });
  assert.equal(pianifica(qA, {}).risultato, 'risultato-A');
  assert.equal(pianifica(qB, {}).risultato, 'risultato-B');
});

test('pianifica: ctx passato sia a copertura sia a calcola', () => {
  registra({
    nome: 'usa-ctx',
    operazioni: ['descrivi'],
    misura: 'x',
    copertura: (q, ctx) => !!ctx.datiDisponibili,
    calcola: (q, ctx) => ctx.datiDisponibili,
  });
  const q = creaInterrogazione({ operazione: 'descrivi', misura: 'x' });
  assert.equal(pianifica(q, {}).risolto, false);
  assert.equal(pianifica(q, { datiDisponibili: 99 }).risultato, 99);
});

// ── IL PRIMO CONTROLLO ASSOLUTO (rifiuto-strutturale.js) ──
test('pianifica: rifiuta una misura vietata ANCHE SE una capacità registrata accetterebbe di rispondere', () => {
  // Capacità deliberatamente "malscritta": copertura sempre vera, calcola
  // darebbe una risposta. Il rifiuto strutturale deve intercettarla PRIMA
  // di arrivare al registro — non deve dipendere da quanto è ben scritta
  // ogni singola capacità.
  registra({ nome: 'capacita-mal-scritta', operazioni: ['descrivi'], misura: 'cosa-comprare', copertura: () => true, calcola: () => 'AVREI RISPOSTO' });
  const q = creaInterrogazione({ operazione: 'descrivi', misura: 'cosa-comprare' });
  const r = pianifica(q, {});
  assert.equal(r.risolto, false);
  assert.equal(r.motivo, 'rifiuto-strutturale');
  assert.match(r.mancante, /nessuno sa/i);
});

test('pianifica: il rifiuto strutturale vince anche senza nessuna capacità registrata (nessun registro, nessun ctx)', () => {
  const q = creaInterrogazione({ operazione: 'spiega', misura: 'previsione-prezzo' });
  const r = pianifica(q, {});
  assert.equal(r.risolto, false);
  assert.equal(r.motivo, 'rifiuto-strutturale');
});

test('elencoCapacita: riflette il registro, azzeraRegistro lo svuota', () => {
  assert.deepEqual(elencoCapacita(), []);
  registra({ nome: 'una', operazioni: ['descrivi'], misura: 'x', copertura: () => true, calcola: () => 1 });
  assert.equal(elencoCapacita().length, 1);
  assert.equal(elencoCapacita()[0].nome, 'una');
  azzeraRegistro();
  assert.deepEqual(elencoCapacita(), []);
});
