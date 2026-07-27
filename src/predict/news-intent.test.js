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
