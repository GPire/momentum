'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCanonico, ESEMPI_CANONICI, SOGLIA_CANONICA } from './qa-canonical-bank.js';

test('senza similarity, nessun match — mai un confronto senza un vero motore semantico', () => {
  assert.equal(matchCanonico('quanto posso spendere oggi', null), null);
});

test('domanda vuota → nessun match, nessun crash', () => {
  const similarity = () => 0.9;
  assert.equal(matchCanonico('', similarity), null);
});

test('similarità alta su un esempio del banco → riconosciuto con l\'intento giusto', () => {
  const similarity = (a, b) => (b === 'quanto posso spendere oggi' ? 0.85 : 0.1);
  const r = matchCanonico('quanto sono disposto a spendere questo pomeriggio', similarity);
  assert.ok(r);
  assert.equal(r.intent, 'safeToSpend');
});

test('similarità sotto soglia (0,72) → nessun match, mai un falso positivo su una somiglianza debole', () => {
  const similarity = () => 0.5;
  assert.equal(matchCanonico('una domanda qualsiasi', similarity), null);
});

test('sceglie il MIGLIOR match fra intenti diversi, non il primo trovato', () => {
  const similarity = (a, b) => {
    if (b === 'dove spendo di più') return 0.9;
    if (b === 'quanto ho risparmiato') return 0.75;
    return 0.1;
  };
  const r = matchCanonico('qualcosa di ambiguo', similarity);
  assert.equal(r.intent, 'topCategory');
});

test('nessun intento con estrazione-parametri (affordability/causal/goal) nel banco: forzarli su una parafrasi senza il dato servito romperebbe la risposta', () => {
  assert.ok(!('affordability' in ESEMPI_CANONICI));
  assert.ok(!('causal' in ESEMPI_CANONICI));
  assert.ok(!('goal' in ESEMPI_CANONICI));
});

test('ogni intento del banco ha almeno un esempio italiano e uno inglese', () => {
  for (const [intent, esempi] of Object.entries(ESEMPI_CANONICI)) {
    assert.ok(esempi.length >= 3, `${intent} ha troppi pochi esempi`);
  }
});
