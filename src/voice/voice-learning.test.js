'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordVoiceCorrection, suggestVoiceCorrection, voiceLearningCoverage, CONFERME_PER_AUTOAPPLICARE } from './voice-learning.js';

test('CONFERME_PER_AUTOAPPLICARE è 2: mai un\'azione automatica da una sola conferma', () => {
  assert.equal(CONFERME_PER_AUTOAPPLICARE, 2);
});

test('nessuna modifica reale (originale === corretta) → non registra nulla', () => {
  const state = recordVoiceCorrection({ corrette: [] }, 'Magliette', 'Magliette');
  assert.equal(state.corrette.length, 0);
});

test('correzione vuota → non registra nulla, nessun crash', () => {
  const state = recordVoiceCorrection({ corrette: [] }, '', 'qualcosa');
  assert.equal(state.corrette.length, 0);
});

test('SCENARIO: prima correzione → candidata ma NON ancora applicabile da sola', () => {
  let state = recordVoiceCorrection({ corrette: [] }, 'Magleitte', 'Magliette');
  assert.equal(suggestVoiceCorrection(state, 'Magleitte'), null);
  const cop = voiceLearningCoverage(state);
  assert.equal(cop.correzioniAffidabili, 0);
  assert.equal(cop.correzioniInAttesa, 1);
});

test('SCENARIO: seconda conferma della STESSA coppia → applicabile da sola', () => {
  let state = recordVoiceCorrection({ corrette: [] }, 'Magleitte', 'Magliette');
  state = recordVoiceCorrection(state, 'Magleitte', 'Magliette');
  assert.equal(suggestVoiceCorrection(state, 'Magleitte'), 'Magliette');
  const cop = voiceLearningCoverage(state);
  assert.equal(cop.correzioniAffidabili, 1);
});

test('la corrispondenza è ESATTA, non fuzzy: "Magleitte" corretta non aiuta "Magleit" (nome diverso, non una parafrasi)', () => {
  let state = recordVoiceCorrection({ corrette: [] }, 'Magleitte', 'Magliette');
  state = recordVoiceCorrection(state, 'Magleitte', 'Magliette');
  assert.equal(suggestVoiceCorrection(state, 'Magleit'), null);
});

test('correzioni diverse per lo STESSO "sentito" restano candidate separate finché non ne conferma una', () => {
  let state = recordVoiceCorrection({ corrette: [] }, 'Nike', 'Nike Air');
  state = recordVoiceCorrection(state, 'Nike', 'Nyke');
  assert.equal(state.corrette.length, 2, 'due correzioni diverse per lo stesso testo sentito restano distinte');
  assert.equal(suggestVoiceCorrection(state, 'Nike'), null, 'nessuna delle due ha ancora 2 conferme');
});

test('ignora maiuscole/minuscole e spazi nel confronto ma preserva la capitalizzazione della correzione', () => {
  let state = recordVoiceCorrection({ corrette: [] }, '  Magleitte  ', 'Magliette');
  state = recordVoiceCorrection(state, 'MAGLEITTE', 'Magliette');
  assert.equal(suggestVoiceCorrection(state, 'magleitte'), 'Magliette');
});

test('FALLBACK: stato assente → nessun crash, nessuna correzione suggerita', () => {
  assert.equal(suggestVoiceCorrection(undefined, 'qualsiasi cosa'), null);
  assert.deepEqual(voiceLearningCoverage(undefined), { correzioniAffidabili: 0, correzioniInAttesa: 0 });
});

test('il log delle correzioni resta limitato (mai crescita illimitata)', () => {
  let state = { corrette: [] };
  for (let i = 0; i < 150; i++) state = recordVoiceCorrection(state, `sentito${i}`, `corretto${i}`);
  assert.ok(state.corrette.length <= 100);
});
