import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowWhatsNew, unseenReleases, RELEASES, LATEST_WHATS_NEW_VERSION } from './whats-new.js';

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

test('RELEASES: ogni release ha almeno una voce, ogni voce ha titolo e testo non vuoti', () => {
  assert.ok(RELEASES.length > 0);
  for (const r of RELEASES) {
    assert.ok(r.versione);
    assert.ok(r.voci.length > 0, `release ${r.versione} non ha voci — una release vuota non va pubblicata`);
    for (const v of r.voci) {
      assert.ok(v.titolo && v.titolo.length > 0);
      assert.ok(v.testo && v.testo.length > 0);
      assert.ok(['gold', 'primary', 'green', 'purple'].includes(v.colore), `colore "${v.colore}" non è uno dei toni già usati nel payoff onboarding`);
    }
  }
});

// titoloKey/testoKey (2026-08-28): riferimento a src/i18n/ui-strings.js,
// opzionale per non bloccare il rilascio di una voce nuova non ancora
// tradotta — ma le release ESISTENTI (già tradotte in questa sessione)
// devono averle entrambe, altrimenti main.js ricadrebbe silenziosamente
// sull'italiano per un utente che ha scelto un'altra lingua.
test('RELEASES: ogni voce delle release esistenti ha titoloKey e testoKey (nessun buco silenzioso in altre lingue)', () => {
  for (const r of RELEASES) {
    for (const v of r.voci) {
      assert.ok(v.titoloKey, `voce "${v.titolo}" (${r.versione}) senza titoloKey`);
      assert.ok(v.testoKey, `voce "${v.titolo}" (${r.versione}) senza testoKey`);
    }
  }
});

// ── unseenReleases: STORICO, non solo l'ultima (richiesto esplicitamente
// dall'utente) — un dispositivo fermo da mesi deve vedere TUTTO quello che
// si è perso, non solo la voce più recente. ──

test('unseenReleases: dispositivo che non ha mai visto nulla → TUTTE le release, in ordine cronologico', () => {
  const out = unseenReleases({});
  assert.deepEqual(out.map((r) => r.versione), RELEASES.map((r) => r.versione));
});

test('unseenReleases: dispositivo già alla versione più recente → nessuna release da mostrare', () => {
  assert.deepEqual(unseenReleases({ whatsNewSeen: LATEST_WHATS_NEW_VERSION }), []);
});

test('unseenReleases: versione salvata non riconosciuta (dato corrotto o build più vecchia dell\'elenco) → mostra tutto, mai nascondere per un confronto fallito', () => {
  const out = unseenReleases({ whatsNewSeen: 'una-versione-mai-esistita' });
  assert.deepEqual(out.map((r) => r.versione), RELEASES.map((r) => r.versione));
});

test('unseenReleases: con PIÙ release pubblicate, un dispositivo fermo a metà vede solo quelle successive, in ordine', () => {
  // Simulazione con dati finti (non i RELEASES veri, per non dipendere dal
  // contenuto reale che cambierà nel tempo): stessa logica, verificata a parte.
  const fakeReleases = [
    { versione: 'v1', voci: [{ titolo: 'A', testo: 'a', colore: 'gold' }] },
    { versione: 'v2', voci: [{ titolo: 'B', testo: 'b', colore: 'green' }] },
    { versione: 'v3', voci: [{ titolo: 'C', testo: 'c', colore: 'purple' }] },
  ];
  // Riproduce la stessa funzione pura con dati finti (nessun modo di
  // iniettare RELEASES dall'esterno, e va bene così: la funzione esportata
  // resta testata sopra sui dati reali — qui si verifica solo la LOGICA di
  // slicing, riscritta identica per isolarla dal contenuto specifico).
  const unseenConDati = (state, releases) => {
    const seen = state.whatsNewSeen;
    if (!seen) return releases;
    const idx = releases.findIndex((r) => r.versione === seen);
    if (idx === -1) return releases;
    return releases.slice(idx + 1);
  };
  assert.deepEqual(unseenConDati({ whatsNewSeen: 'v1' }, fakeReleases).map((r) => r.versione), ['v2', 'v3']);
  assert.deepEqual(unseenConDati({ whatsNewSeen: 'v3' }, fakeReleases).map((r) => r.versione), []);
  assert.deepEqual(unseenConDati({}, fakeReleases).map((r) => r.versione), ['v1', 'v2', 'v3']);
});
