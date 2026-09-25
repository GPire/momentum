import test from 'node:test';
import assert from 'node:assert/strict';
import { assetIdentityBrief } from './asset-identity-brief.js';
import { searchAssetLocal } from './asset-search.js';
import { secCompanySnapshot } from './sec-catalog.js';

test('company research matrix keeps identity, SEC activity and quotes separate', async () => {
  for (const [query, symbol, activity] of [['Apple', 'AAPL', 'hardware'], ['Microsoft', 'MSFT', 'software'], ['Nvidia', 'NVDA', 'semiconductors'], ['JPMorgan', 'JPM', 'banking'], ['Costco', 'COST', 'retail']]) {
    const asset = (await searchAssetLocal(query))[0];
    assert.equal(asset?.symbol, symbol, query);
    const snapshot = await secCompanySnapshot(symbol);
    const brief = assetIdentityBrief(asset, { snapshot });
    assert.equal(brief.kind, 'stock');
    assert.ok(brief.sector, `${symbol}: SEC activity missing`);
    assert.equal(brief.activity, activity, `${symbol}: plain activity must follow SEC classification`);
    assert.equal(brief.sectorYear, snapshot.year);
    assert.equal('price' in brief, false, `${symbol}: an identity is not a quote`);
  }
});

test('a non-US company does not inherit a different SEC classification', async () => {
  const asset = (await searchAssetLocal('ASML'))[0];
  assert.equal(asset.symbol, 'ASML');
  const brief = assetIdentityBrief(asset, { snapshot: { ticker: 'AAPL', sector: 'COMPUTERS', year: 2025 }, lang: 'it' });
  assert.equal(brief.sector, null);
  assert.match(brief.summary, /litografia/);
  assert.match(brief.sourceUrl, /asml\.com/);
});

test('funds use issuer facts only where checked, and bitcoin exposure is not direct ownership', async () => {
  for (const [symbol, focus] of [['SPY', 'S&P 500'], ['QQQ', 'Nasdaq-100'], ['VOO', 'S&P 500'], ['IBIT', 'Bitcoin']]) {
    const asset = (await searchAssetLocal(symbol))[0];
    const brief = assetIdentityBrief(asset);
    assert.equal(brief.focus, focus);
    assert.match(brief.sourceUrl, /^https:\/\//);
  }
  assert.equal(assetIdentityBrief((await searchAssetLocal('IBIT'))[0]).kind, 'bitcoin-etp');
  assert.equal(assetIdentityBrief((await searchAssetLocal('GLD'))[0]).kind, 'gold-etp');
  assert.equal(assetIdentityBrief({ kind: 'stock', instrumentType: 'etf', symbol: 'OTHER', name: 'Unknown ETF' }).focus, null);
});

test('crypto and tokenized shares stay distinct; external descriptions are shortened before rendering', () => {
  const bitcoin = assetIdentityBrief({ kind: 'crypto', symbol: 'BTC', name: 'Bitcoin' }, { overview: { summary: 'A peer-to-peer network. ' + 'long '.repeat(80) } });
  assert.equal(bitcoin.kind, 'crypto');
  assert.ok(bitcoin.summary.length <= 321);
  assert.equal(assetIdentityBrief({ kind: 'crypto', symbol: 'AAPLX', name: 'Apple xStock' }).kind, 'tokenized-stock');
  assert.equal(assetIdentityBrief({ kind: 'crypto', symbol: 'BTC', name: 'Bitcoin' }).summary, null);
});

test('a sourced public explanation is shown without converting it into a price or a company filing', () => {
  const brief = assetIdentityBrief({ kind: 'stock', symbol: 'NEX', name: 'North Example' }, {
    publicFact: { summary: 'North Example builds accounting software.', source: 'Wikipedia', sourceUrl: 'https://en.wikipedia.org/wiki/North_Example', license: 'CC BY-SA 4.0' },
  });
  assert.match(brief.summary, /accounting software/);
  assert.equal(brief.source, 'Wikipedia');
  assert.equal(brief.license, 'CC BY-SA 4.0');
  assert.equal('price' in brief, false);
});
