import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCrypto, searchStock, searchAsset } from './asset-search.js';

test('searchCrypto: query vuota → nessuna chiamata, lista vuota', async () => {
  assert.deepEqual(await searchCrypto(''), []);
});

test('searchCrypto: forma reale CoinGecko → normalizza kind/symbol/name', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ coins: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }] }) });
  const r = await searchCrypto('bitcoin', { fetchImpl });
  assert.deepEqual(r, [{ kind: 'crypto', id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }]);
});

test('searchStock: senza chiave → errore onesto', async () => {
  await assert.rejects(() => searchStock('apple', {}), /chiave/i);
});

test('searchStock: forma reale Alpha Vantage → normalizza', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ bestMatches: [{ '1. symbol': 'AAPL', '2. name': 'Apple Inc', '4. region': 'United States' }] }) });
  const r = await searchStock('apple', { apiKey: 'k', fetchImpl });
  assert.deepEqual(r, [{ kind: 'stock', id: 'AAPL', symbol: 'AAPL', name: 'Apple Inc', region: 'United States' }]);
});

test('searchStock: limite raggiunto → errore, mai risultati finti', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ Note: 'limite' }) });
  await assert.rejects(() => searchStock('apple', { apiKey: 'k', fetchImpl }));
});

test('searchAsset: combina cripto+azioni; una fonte giù non azzera l\'altra', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('coingecko')) throw new TypeError('Failed to fetch');
    return { ok: true, json: async () => ({ bestMatches: [{ '1. symbol': 'AAPL', '2. name': 'Apple Inc', '4. region': 'US' }] }) };
  };
  const r = await searchAsset('apple', { apiKey: 'k', fetchImpl });
  assert.equal(r.results.length, 1);
  assert.equal(r.results[0].symbol, 'AAPL');
  assert.equal(r.stale, false);
});

test('searchAsset: senza chiave → solo cripto, nessun errore', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ coins: [{ id: 'ethereum', symbol: 'eth', name: 'Ethereum' }] }) });
  const r = await searchAsset('eth', { fetchImpl });
  assert.equal(r.results.length, 1);
  assert.equal(r.results[0].kind, 'crypto');
});

test('searchAsset: tutte le fonti giù CON cache → ripiega sull\'ultima ricerca, dichiarata stale', async () => {
  const cached = [{ kind: 'crypto', id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }];
  const cache = { get: async () => cached, put: async () => {} };
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  const r = await searchAsset('bitcoin', { fetchImpl, cache });
  assert.equal(r.stale, true);
  assert.deepEqual(r.results, cached);
});

test('searchAsset: tutte le fonti giù SENZA cache → lista vuota, mai inventata', async () => {
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  const r = await searchAsset('bitcoin', { fetchImpl });
  assert.deepEqual(r, { results: [], stale: false });
});

// BUG REALE riprodotto con la query "tesla" (2026-07-27, dati reali da
// CoinGecko): 8 token cripto derivati chiamati "Tesla" (rank centinaia/
// migliaia) seppellivano il vero titolo azionario TSLA. Verifica che ora
// il titolo azionario esca PRIMA di quei token.
test('searchCrypto: token cripto oscuri ordinati per notorietà reale (market_cap_rank), non per ordine grezzo dell\'API', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ coins: [
    { id: 'tesla-ondo', symbol: 'TSLAON', name: 'Tesla (Ondo Tokenized Stock)', market_cap_rank: 944 },
    { id: 'backed-tesla', symbol: 'BTSLA', name: 'Backed Tesla', market_cap_rank: null },
    { id: 'tesla-xstock', symbol: 'TSLAX', name: 'Tesla xStock', market_cap_rank: 403 },
  ] }) });
  const r = await searchCrypto('tesla', { fetchImpl });
  assert.deepEqual(r.map(c => c.symbol), ['TSLAX', 'TSLAON', 'BTSLA']); // 403 < 944 < null(Infinity)
});

test('searchAsset: query "tesla" → il titolo azionario reale precede i token cripto oscuri', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('coingecko')) {
      return { ok: true, json: async () => ({ coins: [
        { id: 'tesla-ondo', symbol: 'TSLAON', name: 'Tesla (Ondo Tokenized Stock)', market_cap_rank: 944 },
        { id: 'backed-tesla', symbol: 'BTSLA', name: 'Backed Tesla', market_cap_rank: null },
      ] }) };
    }
    return { ok: true, json: async () => ({ bestMatches: [{ '1. symbol': 'TSLA', '2. name': 'Tesla Inc', '4. region': 'United States', '9. matchScore': '1.0000' }] }) };
  };
  const r = await searchAsset('tesla', { apiKey: 'k', fetchImpl });
  assert.equal(r.results[0].symbol, 'TSLA');
  assert.equal(r.results[0].kind, 'stock');
});
