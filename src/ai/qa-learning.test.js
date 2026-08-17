'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  recordUnknownQuestion, learnCorrection, suggestLearnedIntent, mostFrequentUnknowns,
  qaLearningCoverage, CONFERME_PER_AUTOAPPLICARE,
} from './qa-learning.js';

test('CONFERME_PER_AUTOAPPLICARE è 2: mai un\'azione automatica da una sola conferma', () => {
  assert.equal(CONFERME_PER_AUTOAPPLICARE, 2);
});

test('una domanda mai vista si registra nel log', () => {
  let state = { unknownLog: [], learned: [] };
  state = recordUnknownQuestion(state, 'quanto costa il pane oggi');
  assert.equal(state.unknownLog.length, 1);
  assert.equal(state.unknownLog[0].question, 'quanto costa il pane oggi');
});

test('domanda vuota o senza parole utili → non registrata, nessun crash', () => {
  let state = { unknownLog: [], learned: [] };
  state = recordUnknownQuestion(state, '');
  assert.equal(state.unknownLog?.length ?? 0, 0);
  state = recordUnknownQuestion(state, '???');
  assert.equal(state.unknownLog?.length ?? 0, 0);
});

test('SCENARIO: prima conferma → candidata ma NON ancora applicabile da sola', () => {
  let state = { unknownLog: [], learned: [] };
  state = learnCorrection(state, 'quanto ho messo via questo mese', 'savings');
  const s = suggestLearnedIntent(state, 'quanto ho messo via questo mese');
  assert.equal(s.intent, 'savings');
  assert.equal(s.conferme, 1);
  assert.equal(s.autoApplicabile, false, 'una sola conferma non deve mai bastare');
});

test('SCENARIO: seconda conferma su formulazione simile → diventa applicabile', () => {
  let state = { unknownLog: [], learned: [] };
  state = learnCorrection(state, 'quanto ho messo via questo mese', 'savings');
  state = learnCorrection(state, 'quanto ho messo via questo mese esattamente', 'savings');
  const s = suggestLearnedIntent(state, 'quanto ho messo via il mese scorso');
  assert.equal(s.intent, 'savings');
  assert.equal(s.conferme, 2);
  assert.equal(s.autoApplicabile, true);
});

test('SCENARIO: formulazione troppo diversa → nessun suggerimento (mai un falso positivo)', () => {
  let state = { unknownLog: [], learned: [] };
  state = learnCorrection(state, 'quanto ho messo via questo mese', 'savings');
  state = learnCorrection(state, 'quanto ho messo via il mese scorso', 'savings');
  assert.equal(suggestLearnedIntent(state, 'che tempo fa domani a Milano'), null);
});

test('SCENARIO: due intenti diversi imparati, la domanda va al più simile dei due', () => {
  let state = { unknownLog: [], learned: [] };
  state = learnCorrection(state, 'quanto ho messo via questo mese', 'savings');
  state = learnCorrection(state, 'quanto ho messo via il mese scorso', 'savings');
  state = learnCorrection(state, 'quanto devo ancora a rate', 'bnplOwed');
  state = learnCorrection(state, 'quanto devo ancora sulle rate klarna', 'bnplOwed');
  const s1 = suggestLearnedIntent(state, 'quanto ho messo via il mese');
  const s2 = suggestLearnedIntent(state, 'quanto devo ancora sulle rate');
  assert.equal(s1.intent, 'savings');
  assert.ok(s1.autoApplicabile);
  assert.equal(s2.intent, 'bnplOwed');
  assert.ok(s2.autoApplicabile);
});

test('mostFrequentUnknowns raggruppa le domande abbastanza simili (Jaccard ≥ soglia), non solo identiche', () => {
  let state = { unknownLog: [], learned: [] };
  for (const q of ['dove mangio stasera', 'dove mangio stasera vicino casa', 'che tempo fa domani']) {
    state = recordUnknownQuestion(state, q);
  }
  const top = mostFrequentUnknowns(state, 3);
  assert.ok(top.length >= 1);
  assert.ok(top[0].count >= 2, 'le due domande su "dove mangio stasera" devono raggrupparsi insieme (condividono 2 token su un totale di 3)');
});

test('mostFrequentUnknowns su stato vuoto → lista vuota, nessun crash', () => {
  assert.deepEqual(mostFrequentUnknowns({ unknownLog: [], learned: [] }), []);
  assert.deepEqual(mostFrequentUnknowns(undefined), []);
});

// ============================================================
// FALLBACK — stato assente, corrotto o di forma inattesa: mai un crash.
// ============================================================

test('FALLBACK: stato undefined ovunque → tutte le funzioni restituiscono un default sicuro', () => {
  assert.doesNotThrow(() => recordUnknownQuestion(undefined, 'ciao'));
  assert.doesNotThrow(() => learnCorrection(undefined, 'ciao', 'savings'));
  assert.equal(suggestLearnedIntent(undefined, 'ciao'), null);
});

test('FALLBACK: learned con voci malformate (tokens assente) → non esplode, semplicemente non trova nulla', () => {
  const state = { unknownLog: [], learned: [{ intent: 'savings' }] };
  assert.doesNotThrow(() => suggestLearnedIntent(state, 'quanto ho risparmiato'));
});

test('FALLBACK: learnCorrection senza intento → non crea una voce inutile', () => {
  let state = { unknownLog: [], learned: [] };
  state = learnCorrection(state, 'quanto ho risparmiato', null);
  assert.equal(state.learned.length, 0);
});

test('FALLBACK: il log delle domande non riconosciute resta limitato (mai crescita illimitata)', () => {
  let state = { unknownLog: [], learned: [] };
  for (let i = 0; i < 250; i++) state = recordUnknownQuestion(state, `domanda numero unica ${i}`);
  assert.ok(state.unknownLog.length <= 200);
});

test('SCENARIO: copertura misurata distingue famiglie affidabili (≥2 conferme) da candidate (1 sola)', () => {
  let state = { unknownLog: [], learned: [] };
  state = learnCorrection(state, 'quanto ho messo via questo mese', 'savings');
  state = learnCorrection(state, 'quanto ho messo via il mese scorso', 'savings'); // 2a conferma → affidabile
  state = learnCorrection(state, 'a chi devo ancora dei soldi a rate', 'bnplOwed'); // 1 sola → candidata
  state = recordUnknownQuestion(state, 'che tempo fa domani');
  const cop = qaLearningCoverage(state);
  assert.equal(cop.famiglieRiconosciute, 1);
  assert.equal(cop.famiglieInAttesaDiConferma, 1);
  assert.equal(cop.domandeMaiChiarite, 1);
});

test('FALLBACK: qaLearningCoverage su stato assente → tutti zero, nessun crash', () => {
  assert.deepEqual(qaLearningCoverage(undefined), { famiglieRiconosciute: 0, famiglieInAttesaDiConferma: 0, domandeMaiChiarite: 0 });
});

// --- similarità SEMANTICA opzionale (src/ai/semantic-embed.js) ---
// Nessun modello reale nei test: una funzione finta ma deterministica
// prova che il punto di innesto funziona, resta retrocompatibile (default
// Jaccard invariato) e usa la soglia semantica diversa da quella Jaccard.

test('similarity esplicita → sostituisce Jaccard, non lo somma né lo ignora', () => {
  let state = { unknownLog: [], learned: [] };
  state = learnCorrection(state, 'quanto spendo di solito al ristorante', 'topCategory');
  state = learnCorrection(state, 'quanto spendo di solito al ristorante', 'topCategory'); // 2 conferme
  // Zero parole in comune: Jaccard darebbe 0, la similarity finta simula un
  // vero match semantico (stesso significato, parole diverse).
  const similarity = (a, b) => (a === 'qual è la mia spesa abituale per mangiare fuori' ? 0.8 : 0);
  const senzaSemantica = suggestLearnedIntent(state, 'qual è la mia spesa abituale per mangiare fuori');
  assert.equal(senzaSemantica, null); // Jaccard non trova nulla: zero parole condivise
  const conSemantica = suggestLearnedIntent(state, 'qual è la mia spesa abituale per mangiare fuori', { similarity });
  assert.ok(conSemantica, 'con la similarità semantica il match deve esserci');
  assert.equal(conSemantica.intent, 'topCategory');
  assert.equal(conSemantica.autoApplicabile, true);
});

test('similarity semantica sotto soglia (0,62) → nessun match, mai un falso positivo per un punteggio debole', () => {
  let state = { unknownLog: [], learned: [] };
  state = learnCorrection(state, 'quanto ho risparmiato questo mese', 'savings');
  state = learnCorrection(state, 'quanto ho risparmiato questo mese', 'savings');
  const similarity = () => 0.4; // sotto la soglia semantica, sopra zero
  assert.equal(suggestLearnedIntent(state, 'domanda vagamente imparentata', { similarity }), null);
});

test('senza similarity esplicita, il comportamento resta Jaccard puro (retrocompatibilità)', () => {
  let state = { unknownLog: [], learned: [] };
  state = learnCorrection(state, 'quanto ho messo via questo mese', 'savings');
  state = learnCorrection(state, 'quanto ho messo via il mese scorso', 'savings');
  const conJaccard = suggestLearnedIntent(state, 'quanto ho messo via questo mese qui');
  assert.ok(conJaccard);
  assert.equal(conJaccard.intent, 'savings');
});
