import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPlatform, installSteps } from './install-guide.js';

const UA = {
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0 Mobile/15E148 Safari/604.1',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile) Gecko/128.0 Firefox/128.0',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  windowsEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 Edg/128.0',
  macFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0',
  iosInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0.0',
  androidFacebook: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.0]',
};

test('detectPlatform: iPhone Safari → ios/safari, nessun prompt nativo (Apple non lo supporta)', () => {
  const p = detectPlatform(UA.iosSafari);
  assert.equal(p.os, 'ios');
  assert.equal(p.browser, 'safari');
  assert.equal(p.supportsNativePrompt, false);
});

test('detectPlatform: iPhone Chrome → ios (stesso motore Safari sotto), mai un finto prompt nativo', () => {
  const p = detectPlatform(UA.iosChrome);
  assert.equal(p.os, 'ios');
  assert.equal(p.supportsNativePrompt, false);
});

test('detectPlatform: Android Chrome → prompt nativo disponibile davvero', () => {
  const p = detectPlatform(UA.androidChrome);
  assert.equal(p.os, 'android');
  assert.equal(p.browser, 'chrome');
  assert.equal(p.supportsNativePrompt, true);
});

test('detectPlatform: Android Firefox → nessun prompt nativo (solo Chromium lo supporta)', () => {
  const p = detectPlatform(UA.androidFirefox);
  assert.equal(p.supportsNativePrompt, false);
});

test('detectPlatform: già installata (standalone) → dichiarato, mai riproposto', () => {
  const p = detectPlatform(UA.androidChrome, { standalone: true });
  assert.equal(p.standalone, true);
});

test('detectPlatform: browser in-app (Instagram) → rilevato, mai un prompt nativo finto', () => {
  const p = detectPlatform(UA.iosInstagram);
  assert.equal(p.inAppBrowser, 'Instagram');
  assert.equal(p.supportsNativePrompt, false);
});

test('detectPlatform: browser in-app (Facebook su Android) → rilevato anche se Chrome sotto', () => {
  const p = detectPlatform(UA.androidFacebook);
  assert.equal(p.inAppBrowser, 'Facebook');
  assert.equal(p.supportsNativePrompt, false); // mai un pulsante Installa che qui non funzionerebbe
});

test('installSteps: browser in-app → dice PRIMA di tutto di aprire in un browser vero, causa reale più comune di "non ci riesco"', () => {
  const p = detectPlatform(UA.iosInstagram);
  const r = installSteps(p);
  assert.ok(/Instagram/.test(r.title));
  assert.ok(r.steps.some(s => /Safari/.test(s.text)));
});

test('installSteps: già installata → nessun passo, mai una guida inutile', () => {
  const p = detectPlatform(UA.androidChrome, { standalone: true });
  const r = installSteps(p);
  assert.equal(r.steps.length, 0);
});

test('installSteps: iPhone Safari → passi manuali reali (Condividi → Aggiungi a Home)', () => {
  const p = detectPlatform(UA.iosSafari);
  const r = installSteps(p);
  assert.ok(r.steps.some(s => /Condividi/.test(s.text)));
  assert.ok(r.steps.some(s => /Aggiungi a Home/.test(s.text)));
});

test('installSteps: iPhone Chrome → dice onestamente di aprire Safari, mai finge di installare da Chrome', () => {
  const p = detectPlatform(UA.iosChrome);
  const r = installSteps(p);
  assert.ok(r.steps.some(s => /Safari/.test(s.text)));
});

// ── hasData: avviso pre-installazione su iOS (2026-08-28, bug reale
// segnalato da utenti — reinserire ogni transazione a mano dopo "Aggiungi a
// Home"). WebKit isola lo storage tra Safari e l'app installata anche per
// la stessa origine: nessun bypass tecnico esiste, l'unico avviso onesto è
// dirlo PRIMA, con un'azione concreta (salvare un backup). ──
test('installSteps: iPhone Safari CON dati già presenti → avvisa di salvare un backup PRIMA di installare', () => {
  const p = detectPlatform(UA.iosSafari);
  const r = installSteps(p, { hasData: true });
  assert.ok(r.steps.some(s => s.action === 'exportPlainBackup'), 'deve esserci un passo con azione di backup');
  assert.ok(r.steps.some(s => /vuota.*backup da importare|backup da importare/.test(s.text)), 'deve anche dire cosa fare dopo, se la app appare vuota');
});

test('installSteps: iPhone Safari SENZA dati → nessun avviso di backup (rumore per chi non ha nulla da perdere)', () => {
  const p = detectPlatform(UA.iosSafari);
  const r = installSteps(p, { hasData: false });
  assert.ok(!r.steps.some(s => s.action === 'exportPlainBackup'));
});

test('installSteps: iPhone Chrome con dati → stesso avviso di backup (stesso WebKit sotto, stesso limite)', () => {
  const p = detectPlatform(UA.iosChrome);
  const r = installSteps(p, { hasData: true });
  assert.ok(r.steps.some(s => s.action === 'exportPlainBackup'));
});

test('installSteps: Android Chrome con dati → NESSUN avviso di backup (lo storage È condiviso lì, verificato — avvisare sarebbe un falso allarme)', () => {
  const p = detectPlatform(UA.androidChrome);
  const r = installSteps(p, { hasData: true });
  assert.ok(!r.steps.some(s => s.action === 'exportPlainBackup'));
});

test('installSteps: Android Chrome → pulsante Installa reale', () => {
  const p = detectPlatform(UA.androidChrome);
  const r = installSteps(p);
  assert.ok(r.steps.some(s => /Installa/.test(s.text)));
});

test('installSteps: Firefox desktop → dichiara onestamente il limite, mai un passo che non funziona', () => {
  const p = detectPlatform(UA.macFirefox);
  const r = installSteps(p);
  assert.ok(r.steps.some(s => /non supporta/.test(s.text)));
});

test('installSteps: Mac Chrome/Edge desktop → pulsante Installa reale', () => {
  const p = detectPlatform(UA.macChrome);
  const r = installSteps(p);
  assert.ok(r.steps.some(s => /Installa/.test(s.text)));
});
