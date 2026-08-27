import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowWhatsNew, WHATS_NEW_ITEMS, LATEST_WHATS_NEW_VERSION } from './whats-new.js';

test('shouldShowWhatsNew: utente che non ha mai visto nessuna versione → true', () => {
  assert.equal(shouldShowWhatsNew({}), true);
  assert.equal(shouldShowWhatsNew({ whatsNewSeen: undefined }), true);
});

test('shouldShowWhatsNew: utente che ha già visto la versione corrente → false', () => {
  assert.equal(shouldShowWhatsNew({ whatsNewSeen: LATEST_WHATS_NEW_VERSION }), false);
});

test('shouldShowWhatsNew: utente che ha visto una versione VECCHIA → true (c\'è del nuovo)', () => {
  assert.equal(shouldShowWhatsNew({ whatsNewSeen: '2020-01-01' }), true);
});

test('WHATS_NEW_ITEMS: ogni voce ha titolo e testo non vuoti, mai una card vuota', () => {
  assert.ok(WHATS_NEW_ITEMS.length > 0);
  for (const v of WHATS_NEW_ITEMS) {
    assert.ok(v.titolo && v.titolo.length > 0);
    assert.ok(v.testo && v.testo.length > 0);
    assert.ok(['gold', 'primary', 'green', 'purple'].includes(v.colore), `colore "${v.colore}" non è uno dei toni già usati nel payoff onboarding`);
  }
});
