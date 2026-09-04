import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCryptoOverview, fetchStockOverview, fetchAssetOverview } from './asset-overview.js';

test('fetchCryptoOverview: forma reale CoinGecko → riassunto ripulito da HTML, troncato', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({
    name: 'Bitcoin',
    description: { en: 'Bitcoin is digital money. It has no central bank. <a href="x">link</a>. Third sentence should be cut.' },
    categories: ['Cryptocurrency', 'Layer 1'],
    market_cap_rank: 1,
    links: { homepage: ['https://bitcoin.org'] },
  }) });
  const r = await fetchCryptoOverview('bitcoin', { fetchImpl });
  assert.equal(r.name, 'Bitcoin');
  assert.ok(!r.summary.includes('<a'));
  assert.ok(r.summary.includes('digital money'));
  assert.equal(r.marketCapRank, 1);
});

test('fetchCryptoOverview: senza id → errore onesto', async () => {
  await assert.rejects(() => fetchCryptoOverview(null));
});

test('fetchStockOverview: senza chiave → errore onesto', async () => {
  await assert.rejects(() => fetchStockOverview('AAPL', {}), /chiave/i);
});

test('fetchStockOverview: forma reale Alpha Vantage → normalizza settore/industria/PE', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({
    Name: 'Apple Inc', Description: 'Apple progetta e vende dispositivi elettronici.', Sector: 'TECHNOLOGY', Industry: 'CONSUMER ELECTRONICS', MarketCapitalization: '3000000000000', PERatio: '32.5',
  }) });
  const r = await fetchStockOverview('AAPL', { apiKey: 'k', fetchImpl });
  assert.equal(r.sector, 'TECHNOLOGY');
  assert.equal(r.peRatio, 32.5);
  assert.equal(r.marketCap, 3000000000000);
});

// ── EPS/dividend yield (2026-09-04) — la stessa risposta li porta già ──
test('fetchStockOverview: EPS e dividend yield reali vengono normalizzati', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({
    Name: 'Apple Inc', Description: 'x', Sector: 's', Industry: 'i', EPS: '6.13', DividendYield: '0.0044',
  }) });
  const r = await fetchStockOverview('AAPL', { apiKey: 'k', fetchImpl });
  assert.equal(r.eps, 6.13);
  assert.equal(r.dividendYield, 0.0044);
});

test('fetchStockOverview: chi non paga dividendo è 0 reale, distinto dal dato mancante', async () => {
  const senzaCampo = await fetchStockOverview('AAPL', { apiKey: 'k', fetchImpl: async () => ({ ok: true, json: async () => ({ Name: 'x', Description: 'x' }) }) });
  assert.equal(senzaCampo.dividendYield, null, 'campo assente: null onesto, non zero');
  const zeroReale = await fetchStockOverview('AAPL', { apiKey: 'k', fetchImpl: async () => ({ ok: true, json: async () => ({ Name: 'x', Description: 'x', DividendYield: '0' }) }) });
  assert.equal(zeroReale.dividendYield, 0, 'zero dichiarato dalla fonte: zero vero, non null');
  const none = await fetchStockOverview('AAPL', { apiKey: 'k', fetchImpl: async () => ({ ok: true, json: async () => ({ Name: 'x', Description: 'x', DividendYield: 'None' }) }) });
  assert.equal(none.dividendYield, null, '"None" di Alpha Vantage è un dato mancante, mai zero inventato');
});

test('fetchStockOverview: azienda non coperta/chiave non valida → errore, mai un riassunto vuoto camuffato', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({}) });
  await assert.rejects(() => fetchStockOverview('ZZZZ', { apiKey: 'k', fetchImpl }));
});

test('fetchAssetOverview: instrada per kind', async () => {
  const fetchImpl = async (url) => url.includes('coingecko')
    ? { ok: true, json: async () => ({ name: 'Ethereum', description: { en: 'Ethereum is a platform.' } }) }
    : { ok: true, json: async () => ({ Name: 'Apple Inc', Description: 'x', Sector: 's', Industry: 'i' }) };
  const crypto = await fetchAssetOverview({ kind: 'crypto', id: 'ethereum' }, { fetchImpl });
  assert.equal(crypto.kind, 'crypto');
  const stock = await fetchAssetOverview({ kind: 'stock', symbol: 'AAPL' }, { apiKey: 'k', fetchImpl });
  assert.equal(stock.kind, 'stock');
});
