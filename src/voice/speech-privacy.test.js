import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSpeech } from './speech-privacy.js';

const browser = (stato, installOk = true) => ({
  chiamate: [],
  async available(o) { this.chiamate.push(['available', o]); return stato; },
  async install(o) { this.chiamate.push(['install', o]); return installOk; },
});

test('trascrizione sul dispositivo disponibile: si usa quella, nessuna domanda', async () => {
  let chiesto = false;
  const b = browser('available');
  const r = await prepareSpeech(b, 'it-IT', { askCloud: async () => { chiesto = true; return true; } });
  assert.deepEqual(r, { proceed: true, local: true });
  assert.equal(chiesto, false);
  assert.deepEqual(b.chiamate[0][1], { langs: ['it-IT'], processLocally: true });
});

test('pacchetto lingua scaricabile: si installa e si resta sul dispositivo', async () => {
  let avviso = false;
  const b = browser('downloadable');
  const r = await prepareSpeech(b, 'de-DE', { onInstalling: () => { avviso = true; } });
  assert.deepEqual(r, { proceed: true, local: true });
  assert.equal(avviso, true);
  assert.equal(b.chiamate[1][0], 'install');
});

test('niente sul dispositivo: prima volta si chiede, la risposta si ricorda solo se è sì', async () => {
  assert.deepEqual(await prepareSpeech(browser('unavailable'), 'it-IT', { askCloud: async () => true }), { proceed: true, local: false, remember: true });
  assert.deepEqual(await prepareSpeech(browser('unavailable'), 'it-IT', { askCloud: async () => false }), { proceed: false, local: false, remember: false });
  assert.deepEqual(await prepareSpeech(browser('unavailable'), 'it-IT', { cloudAllowed: true }), { proceed: true, local: false });
});

test('browser senza API (es. Safari): nessuna promessa di trascrizione locale', async () => {
  const r = await prepareSpeech(function SenzaApi() {}, 'it-IT', { askCloud: async () => true });
  assert.equal(r.local, false);
  const fallito = browser('downloadable', false);
  assert.equal((await prepareSpeech(fallito, 'it-IT', { cloudAllowed: true })).local, false);
});
