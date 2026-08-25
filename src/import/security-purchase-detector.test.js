'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sembraAcquistoTitolo, estraiDettagliAcquisto, rilevaAcquistoTitolo, aggiornaPosizioneConAcquisto } from './security-purchase-detector.js';

// ── sembraAcquistoTitolo ──

test('sembraAcquistoTitolo: mai per denaro in entrata, anche con parole di broker', () => {
  assert.equal(sembraAcquistoTitolo({ description: 'Bonifico da Directa SPA', amount: 500 }), false);
});

test('sembraAcquistoTitolo: categoria già di tipo investimento basta da sola', () => {
  assert.equal(sembraAcquistoTitolo({ description: 'qualsiasi testo', amount: -100, category: 'etf' }), true);
  assert.equal(sembraAcquistoTitolo({ description: 'qualsiasi testo', amount: -100, category: 'crypto' }), true);
});

test('sembraAcquistoTitolo: un broker/exchange noto nella descrizione basta, categoria generica', () => {
  assert.equal(sembraAcquistoTitolo({ description: 'Bonifico a Directa SPA', amount: -500, category: 'altro' }), true);
  assert.equal(sembraAcquistoTitolo({ description: 'BINANCE*ORDER 123', amount: -200 }), true);
});

test('sembraAcquistoTitolo: parola d\'acquisto da sola non basta, serve anche un token che sembra un ticker', () => {
  assert.equal(sembraAcquistoTitolo({ description: 'ho comprato il pane', amount: -5 }), false);
  assert.equal(sembraAcquistoTitolo({ description: 'buy AAPL 10 shares', amount: -1500 }), true);
});

test('sembraAcquistoTitolo: una spesa qualsiasi non categorizzata resta false', () => {
  assert.equal(sembraAcquistoTitolo({ description: 'Supermercato Coop', amount: -45 }), false);
});

// ── estraiDettagliAcquisto ──

test('estraiDettagliAcquisto: pattern "10x AAPL" — quantità e ticker insieme, certo:true', () => {
  const r = estraiDettagliAcquisto('Ordine eseguito 10x AAPL @150.25');
  assert.equal(r.ticker, 'AAPL');
  assert.equal(r.quantity, 10);
  assert.equal(r.prezzoUnitario, 150.25);
  assert.equal(r.certo, true);
});

test('estraiDettagliAcquisto: quantità con parola ("5 azioni TSLA") e ticker separato', () => {
  const r = estraiDettagliAcquisto('Acquisto 5 azioni TSLA');
  assert.equal(r.quantity, 5);
  assert.equal(r.ticker, 'TSLA');
  assert.equal(r.certo, true);
});

test('estraiDettagliAcquisto: quantità con la virgola decimale italiana', () => {
  const r = estraiDettagliAcquisto('2,5x BTC');
  assert.equal(r.quantity, 2.5);
  assert.equal(r.ticker, 'BTC');
});

test('estraiDettagliAcquisto: cripto citata per nome, non solo come ticker maiuscolo', () => {
  const r = estraiDettagliAcquisto('Acquisto di bitcoin su Kraken');
  assert.equal(r.ticker, 'BITCOIN');
  // Nessuna quantità esplicita nel testo: certo deve restare false, mai inventata.
  assert.equal(r.quantity, null);
  assert.equal(r.certo, false);
});

test('estraiDettagliAcquisto: solo un ticker senza quantità → certo:false, mai una quantità a caso', () => {
  const r = estraiDettagliAcquisto('BINANCE*ORDER ETH');
  assert.equal(r.ticker, 'ETH');
  assert.equal(r.quantity, null);
  assert.equal(r.certo, false);
});

test('estraiDettagliAcquisto: descrizione senza nessun pattern riconoscibile → tutto null, mai un\'eccezione', () => {
  const r = estraiDettagliAcquisto('Bonifico a Directa SPA');
  assert.equal(r.ticker, null);
  assert.equal(r.quantity, null);
  assert.equal(r.certo, false);
});

test('estraiDettagliAcquisto: input vuoto/assente non lancia mai', () => {
  assert.doesNotThrow(() => estraiDettagliAcquisto(undefined));
  assert.doesNotThrow(() => estraiDettagliAcquisto(null));
  assert.equal(estraiDettagliAcquisto('').certo, false);
});

// ── rilevaAcquistoTitolo (punto d'ingresso) ──

test('rilevaAcquistoTitolo: non rilevato per una transazione che non sembra un acquisto', () => {
  assert.deepEqual(rilevaAcquistoTitolo({ description: 'Supermercato Coop', amount: -45 }), { rilevato: false });
});

test('rilevaAcquistoTitolo: rilevato E certo quando ticker e quantità sono entrambi chiari', () => {
  const r = rilevaAcquistoTitolo({ description: '10x AAPL @150', amount: -1500, category: 'stock' });
  assert.equal(r.rilevato, true);
  assert.equal(r.certo, true);
  assert.equal(r.ticker, 'AAPL');
  assert.equal(r.quantity, 10);
});

test('rilevaAcquistoTitolo: rilevato ma NON certo quando manca la quantità — qui l\'interfaccia deve chiedere', () => {
  const r = rilevaAcquistoTitolo({ description: 'Bonifico a Directa SPA', amount: -500, category: 'etf' });
  assert.equal(r.rilevato, true);
  assert.equal(r.certo, false);
});

// ── aggiornaPosizioneConAcquisto ──

test('aggiornaPosizioneConAcquisto: crea una nuova posizione se il ticker non esiste ancora', () => {
  const out = aggiornaPosizioneConAcquisto([], { ticker: 'AAPL', quantity: 10, prezzoUnitario: 150 });
  assert.deepEqual(out, [{ ticker: 'AAPL', assetClass: 'stock', quantity: 10, avgPrice: 150, currency: 'USD' }]);
});

test('aggiornaPosizioneConAcquisto: su un acquisto aggiuntivo, la quantità si SOMMA (non sovrascrive)', () => {
  const esistenti = [{ ticker: 'AAPL', assetClass: 'stock', quantity: 10, avgPrice: 100, currency: 'USD' }];
  const out = aggiornaPosizioneConAcquisto(esistenti, { ticker: 'AAPL', quantity: 10, prezzoUnitario: 200 });
  const pos = out.find((p) => p.ticker === 'AAPL');
  assert.equal(pos.quantity, 20);
  // Prezzo medio ponderato: (10*100 + 10*200) / 20 = 150
  assert.equal(pos.avgPrice, 150);
});

test('aggiornaPosizioneConAcquisto: senza prezzo unitario, la quantità si somma ma il prezzo medio resta quello di prima (mai inventato)', () => {
  const esistenti = [{ ticker: 'AAPL', assetClass: 'stock', quantity: 10, avgPrice: 100, currency: 'USD' }];
  const out = aggiornaPosizioneConAcquisto(esistenti, { ticker: 'AAPL', quantity: 5 });
  const pos = out.find((p) => p.ticker === 'AAPL');
  assert.equal(pos.quantity, 15);
  assert.equal(pos.avgPrice, 100);
});

test('aggiornaPosizioneConAcquisto: senza ticker o quantità valida, la lista non cambia — mai una posizione a metà', () => {
  const esistenti = [{ ticker: 'AAPL', quantity: 10, avgPrice: 100 }];
  assert.deepEqual(aggiornaPosizioneConAcquisto(esistenti, { ticker: null, quantity: 5 }), esistenti);
  assert.deepEqual(aggiornaPosizioneConAcquisto(esistenti, { ticker: 'MSFT', quantity: 0 }), esistenti);
  assert.deepEqual(aggiornaPosizioneConAcquisto(esistenti, { ticker: 'MSFT', quantity: -3 }), esistenti);
});

test('aggiornaPosizioneConAcquisto: non muta l\'array originale (funzione pura)', () => {
  const esistenti = [{ ticker: 'AAPL', quantity: 10, avgPrice: 100 }];
  const originale = JSON.stringify(esistenti);
  aggiornaPosizioneConAcquisto(esistenti, { ticker: 'AAPL', quantity: 5, prezzoUnitario: 200 });
  assert.equal(JSON.stringify(esistenti), originale);
});

test('aggiornaPosizioneConAcquisto: senza posizioni preesistenti (undefined), non lancia mai', () => {
  assert.doesNotThrow(() => aggiornaPosizioneConAcquisto(undefined, { ticker: 'AAPL', quantity: 1, prezzoUnitario: 100 }));
});
