import test from 'node:test';
import assert from 'node:assert/strict';
import { detectNewsIntent } from './news-intent.js';

test('detectNewsIntent: "dammi le notizie di Nvidia di oggi" -> Nvidia', () => {
  const r = detectNewsIntent("dammi le notizie di Nvidia di oggi");
  assert.equal(r?.asset, 'Nvidia');
});

test('detectNewsIntent: "notizie su Tesla" -> Tesla', () => {
  const r = detectNewsIntent('notizie su Tesla');
  assert.equal(r?.asset, 'Tesla');
});

test('detectNewsIntent: inglese "news about Apple today" -> Apple', () => {
  const r = detectNewsIntent('news about Apple today');
  assert.equal(r?.asset, 'Apple');
});

test('detectNewsIntent: punteggiatura finale rimossa', () => {
  const r = detectNewsIntent('che notizie ci sono su bitcoin?');
  assert.equal(r?.asset, 'bitcoin');
});

test('detectNewsIntent: domanda non di news -> null', () => {
  assert.equal(detectNewsIntent('quanto posso spendere oggi?'), null);
});

test('detectNewsIntent: testo vuoto -> null', () => {
  assert.equal(detectNewsIntent(''), null);
  assert.equal(detectNewsIntent(null), null);
});

test('detectNewsIntent: "cosa sta succedendo con Amazon" -> Amazon', () => {
  const r = detectNewsIntent('cosa sta succedendo con Amazon');
  assert.equal(r?.asset, 'Amazon');
});

test('detectNewsIntent: "grafico di Bitcoin" -> Bitcoin (richiesta esplicita di grafico)', () => {
  const r = detectNewsIntent('fammi vedere il grafico di Bitcoin');
  assert.equal(r?.asset, 'Bitcoin');
});

test('detectNewsIntent: "andamento di Tesla" -> Tesla', () => {
  const r = detectNewsIntent('qual è l\'andamento di Tesla');
  assert.equal(r?.asset, 'Tesla');
});

test('detectNewsIntent: "come è andato Bitcoin" -> Bitcoin', () => {
  const r = detectNewsIntent('come è andato con Bitcoin quest\'anno');
  assert.equal(r?.asset, 'Bitcoin quest\'anno');
});

test('detectNewsIntent: "storico di Ethereum" -> Ethereum', () => {
  const r = detectNewsIntent('mostrami lo storico di Ethereum');
  assert.equal(r?.asset, 'Ethereum');
});

test('detectNewsIntent: "come va il mercato immobiliare?" -> mercato immobiliare (senza connettivo)', () => {
  const r = detectNewsIntent('come va il mercato immobiliare?');
  assert.equal(r?.asset, 'mercato immobiliare');
});

test('detectNewsIntent: "come va il settore immobiliare" -> settore immobiliare', () => {
  const r = detectNewsIntent('come va il settore immobiliare');
  assert.equal(r?.asset, 'settore immobiliare');
});

// ============================================================
// BUG REALE segnalato dal vivo dall'utente durante questa sessione: le due
// formulazioni più naturali per chiedere una quotazione ("quanto vale X",
// "prezzo X" senza "di") non trovavano nessun pattern e cadevano in
// silenzio sulla risposta generica del QA, pur avendo il prezzo disponibile.
// ============================================================

test('BUG REALE: "quanto vale bitcoin?" -> bitcoin (prima non trovava nulla)', () => {
  const r = detectNewsIntent('quanto vale bitcoin?');
  assert.equal(r?.asset, 'bitcoin');
});

test('BUG REALE: "quanto costa apple?" -> apple', () => {
  const r = detectNewsIntent('quanto costa apple?');
  assert.equal(r?.asset, 'apple');
});

test('BUG REALE: "a quanto è tesla?" -> tesla', () => {
  const r = detectNewsIntent('a quanto è tesla?');
  assert.equal(r?.asset, 'tesla');
});

test('BUG REALE: "prezzo bitcoin" (senza "di") -> bitcoin', () => {
  const r = detectNewsIntent('prezzo bitcoin');
  assert.equal(r?.asset, 'bitcoin');
});

test('BUG REALE: "quotazione tesla" (senza "di") -> tesla', () => {
  const r = detectNewsIntent('quotazione tesla');
  assert.equal(r?.asset, 'tesla');
});

test('BUG REALE: "quanto vale un bitcoin" -> bitcoin (articolo indeterminativo ripulito)', () => {
  const r = detectNewsIntent('quanto vale un bitcoin');
  assert.equal(r?.asset, 'bitcoin');
});

// ============================================================
// GUARDIA — mai rubare un intento di finanza personale (qa-engine.js): un
// vero utente non chiede mai il "prezzo" di ciò che possiede con un
// possessivo davanti a un asset di mercato.
// ============================================================

test('GUARDIA: "quanto vale il mio patrimonio?" NON è una richiesta di prezzo di mercato -> null', () => {
  assert.equal(detectNewsIntent('quanto vale il mio patrimonio?'), null);
});

test('GUARDIA: "quanto costano i miei abbonamenti?" -> null', () => {
  assert.equal(detectNewsIntent('quanto costano i miei abbonamenti?'), null);
});

test('GUARDIA: "quanto vale il mio conto?" -> null', () => {
  assert.equal(detectNewsIntent('quanto vale il mio conto?'), null);
});
