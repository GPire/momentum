import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prezziARendimenti, fetchStoricoRendimentiCripto, azzeraCacheStoricoCripto, trovaCriptoInTesto,
  trovaTutteLeCriptoInTesto,
} from './crypto-storico.js';

test('prezziARendimenti: calcolato a mano su prezzi consecutivi', () => {
  const r = prezziARendimenti([100, 110, 99]);
  assert.equal(r.length, 2);
  assert.ok(Math.abs(r[0] - 0.1) < 1e-9);
  assert.ok(Math.abs(r[1] - (-0.1)) < 1e-9);
});

test('prezziARendimenti: un prezzo mancante/zero interrompe SOLO quella coppia, mai un rendimento assurdo', () => {
  const r = prezziARendimenti([100, null, 110, 0, 90]);
  assert.equal(r.length, 1); // 110/90-1 salta le coppie che toccano null/0
  assert.ok(Number.isFinite(r[0]));
});

test('prezziARendimenti: meno di 2 prezzi → array vuoto, mai un crash', () => {
  assert.deepEqual(prezziARendimenti([]), []);
  assert.deepEqual(prezziARendimenti([100]), []);
});

test('fetchStoricoRendimentiCripto: con un fetchImpl finto, converte i prezzi CoinGecko REALI (forma osservata dal vivo) in rendimenti', async () => {
  azzeraCacheStoricoCripto();
  const finto = async () => ({
    ok: true,
    json: async () => ({ prices: [[1000, 100], [86400000 + 1000, 110], [172800000 + 1000, 99]] }),
  });
  const r = await fetchStoricoRendimentiCripto('bitcoin', { fetchImpl: finto });
  assert.equal(r.giorni, 2);
  assert.match(r.fonte, /CoinGecko/);
  assert.ok(Math.abs(r.rendimenti[0] - 0.1) < 1e-9);
});

test('fetchStoricoRendimentiCripto: la stessa chiamata la seconda volta NON richiama la rete (cache di sessione)', async () => {
  azzeraCacheStoricoCripto();
  let chiamate = 0;
  const finto = async () => { chiamate++; return { ok: true, json: async () => ({ prices: [[0, 100], [1, 105]] }) }; };
  await fetchStoricoRendimentiCripto('ethereum', { fetchImpl: finto });
  await fetchStoricoRendimentiCripto('ethereum', { fetchImpl: finto });
  assert.equal(chiamate, 1);
});

test('fetchStoricoRendimentiCripto: HTTP non-ok o storico vuoto → errore onesto, mai un risultato inventato', async () => {
  azzeraCacheStoricoCripto();
  await assert.rejects(() => fetchStoricoRendimentiCripto('x', { fetchImpl: async () => ({ ok: false, status: 429 }) }), /HTTP 429/);
  await assert.rejects(() => fetchStoricoRendimentiCripto('y', { fetchImpl: async () => ({ ok: true, json: async () => ({ prices: [] }) }) }), /Nessuno storico/);
});

// ── trovaCriptoInTesto ──

test('trovaCriptoInTesto: riconosce nomi e ticker comuni, a confine di parola', () => {
  assert.equal(trovaCriptoInTesto('quanto ha reso bitcoin quest\'anno?').id, 'bitcoin');
  assert.equal(trovaCriptoInTesto('è stata bravura mia o solo il mercato per ETH?').id, 'ethereum');
  assert.equal(trovaCriptoInTesto('parliamo di Solana').id, 'solana');
});

test('trovaCriptoInTesto: nessuna sottostringa a caso — stesso bug già corretto per i ticker azionari', () => {
  // "dot" e' un ticker cripto (Polkadot) ma anche una parola inglese comune:
  // qui non compare come parola isolata, quindi non deve scattare.
  assert.equal(trovaCriptoInTesto('connect the dots please'), null);
  assert.equal(trovaCriptoInTesto('che tempo fa oggi?'), null);
});

// ── trovaTutteLeCriptoInTesto (2026-09-05) — serve al confronto diretto
// cripto-vs-cripto: la PRIMA cripto trovata deve essere quella nominata per
// prima nel testo, non la prima del dizionario. ──
test('trovaTutteLeCriptoInTesto: due cripto distinte, nell\'ordine in cui compaiono nel testo', () => {
  const r = trovaTutteLeCriptoInTesto('confronta solana ed ethereum');
  assert.equal(r.length, 2);
  assert.equal(r[0].id, 'solana');
  assert.equal(r[1].id, 'ethereum');
});

test('trovaTutteLeCriptoInTesto: ordine invertito nel testo → ordine invertito nel risultato', () => {
  const r = trovaTutteLeCriptoInTesto('confronta ethereum e solana');
  assert.equal(r[0].id, 'ethereum');
  assert.equal(r[1].id, 'solana');
});

test('trovaTutteLeCriptoInTesto: stesso id nominato due volte (bitcoin/btc) non produce un duplicato', () => {
  const r = trovaTutteLeCriptoInTesto('bitcoin è salito, il btc ha reso bene');
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'bitcoin');
});

test('trovaTutteLeCriptoInTesto: una sola cripto → array con un solo elemento', () => {
  const r = trovaTutteLeCriptoInTesto('quanto ha reso ethereum?');
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'ethereum');
});

test('trovaTutteLeCriptoInTesto: nessuna cripto → array vuoto, mai null', () => {
  assert.deepEqual(trovaTutteLeCriptoInTesto('che tempo fa oggi?'), []);
});

test('trovaCriptoInTesto resta coerente con trovaTutteLeCriptoInTesto (stessa prima cripto)', () => {
  assert.deepEqual(trovaCriptoInTesto('confronta solana ed ethereum'), trovaTutteLeCriptoInTesto('confronta solana ed ethereum')[0]);
});
