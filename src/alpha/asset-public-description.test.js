import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPublicDescription, selectTickerDescription, fetchPublicDescription } from './asset-public-description.js';

const stock = (name, symbol) => ({ kind: 'stock', name, symbol });

test('public descriptions reject a homonym before matching the company', () => {
  const rows = [
    { id: 'Q89', label: 'Apple', description: 'fruit of the apple tree' },
    { id: 'Q312', label: 'Apple Inc.', description: 'American consumer electronics and software company' },
  ];
  const found = selectPublicDescription(stock('Apple', 'AAPL'), rows);
  assert.equal(found?.id, 'Q312');
  assert.match(found.summary, /electronics/);
});

test('public descriptions require a close name and the correct instrument type', () => {
  const rows = [
    { id: 'Q1', label: 'ASML Holding', description: 'Dutch manufacturer of semiconductor lithography machines' },
    { id: 'Q2', label: 'ASML Football Club', description: 'Dutch football team' },
  ];
  assert.equal(selectPublicDescription(stock('ASML', 'ASML'), rows)?.id, 'Q1');
  assert.equal(selectPublicDescription(stock('Apple', 'AAPL'), rows), null);
  assert.equal(selectPublicDescription({ kind: 'stock', instrumentType: 'etf', name: 'ASML', symbol: 'ASML' }, rows), null);
  assert.equal(selectPublicDescription({ kind: 'crypto', name: 'ASML', symbol: 'ASML' }, rows), null);
});

test('a crypto search skips an identically named forum about the coin', () => {
  const rows = [
    { id: 'Q110262618', label: 'Ethereum', description: 'Stack Exchange site for users of Ethereum, the decentralized application platform and smart contract enabled blockchain' },
    { id: 'Q16783523', label: 'Ethereum', description: 'public blockchain platform with programmable transaction functionality' },
  ];
  assert.equal(selectPublicDescription({ kind: 'crypto', name: 'Ethereum', symbol: 'ETH' }, rows)?.id, 'Q16783523');
});

test('a shortened company name needs an exact exchange ticker claim', () => {
  const rows = [{ id: 'Q1', label: 'JPMorgan Chase', description: 'American multinational banking company' }];
  const entity = { Q1: { claims: { P249: [{ mainsnak: { datavalue: { value: 'JPM' } } }] } } };
  assert.equal(selectTickerDescription(stock('JPMorgan', 'JPM'), rows, entity)?.id, 'Q1');
  assert.equal(selectTickerDescription(stock('JPMorgan', 'OTHER'), rows, entity), null);
  assert.equal(selectTickerDescription(stock('JPMorgan', 'JPM'), rows, {}), null);
  assert.equal(selectTickerDescription(stock('JP', 'JPM'), rows, entity), null);
  assert.equal(selectTickerDescription({ ...stock('JPMorgan', 'JPM'), instrumentType: 'etf' }, rows, entity), null);
});

test('an exchange qualifier can carry the ticker without a direct P249 claim', () => {
  const rows = [{ id: 'Q2', label: 'JPMorgan Chase', description: 'American banking company' }];
  const entities = { Q2: { claims: { P414: [{ qualifiers: { P249: [{ datavalue: { value: 'JPM' } }] } }] } } };
  assert.equal(selectTickerDescription(stock('JPMorgan', 'JPM'), rows, entities)?.id, 'Q2');
});

test('fetches a short localized fact with no API key and a bounded query', async () => {
  let requested;
  const fetchImpl = async url => {
    requested ||= new URL(url);
    return { ok: true, json: async () => ({ search: [
      { id: 'Q297879', label: 'ASML', description: 'azienda olandese che produce macchine per la litografia dei microchip' },
    ] }) };
  };
  const result = await fetchPublicDescription(stock('ASML', 'ASML'), { lang: 'it', fetchImpl });
  assert.equal(requested.searchParams.get('origin'), '*');
  assert.equal(requested.searchParams.get('language'), 'it');
  assert.equal(result?.sourceUrl, 'https://www.wikidata.org/wiki/Q297879');
  assert.match(result.summary, /litografia/);
});

test('uses the article linked to the exact entity for a specific company explanation', async () => {
  const fetched = [];
  const fetchImpl = async raw => {
    const url = new URL(raw);
    fetched.push(url);
    if (url.searchParams.get('action') === 'wbsearchentities') return { ok: true, json: async () => ({ search: [
      { id: 'Q128896', label: 'Advanced Micro Devices', description: 'American semiconductor company' },
    ] }) };
    if (url.searchParams.get('action') === 'wbgetentities') return { ok: true, json: async () => ({ entities: { Q128896: { sitelinks: { enwiki: { title: 'Advanced Micro Devices' } } } } }) };
    if (url.searchParams.get('prop') === 'extracts') return { ok: true, json: async () => ({ query: { pages: { 1: { extract: 'Advanced Micro Devices designs central processing units and graphics processors for computers. It also makes chips for servers.' } } } }) };
    throw Error('unexpected request');
  };
  const found = await fetchPublicDescription(stock('Advanced Micro Devices', 'AMD'), { lang: 'en', fetchImpl });
  assert.match(found.summary, /central processing units/);
  assert.equal(found.source, 'Wikipedia');
  assert.equal(found.license, 'CC BY-SA 4.0');
  assert.match(found.sourceUrl, /Advanced_Micro_Devices/);
  assert.equal(fetched.length, 3);
});

test('identity extract excludes a later stale valuation sentence', async () => {
  const fetchImpl = async raw => {
    const url = new URL(raw);
    if (url.searchParams.get('action') === 'wbsearchentities') return { ok: true, json: async () => ({ search: [
      { id: 'Q7', label: 'JPMorgan Chase', description: 'American banking company' },
    ] }) };
    if (url.searchParams.get('props') === 'claims|sitelinks') return { ok: true, json: async () => ({ entities: { Q7: {
      claims: { P249: [{ mainsnak: { datavalue: { value: 'JPM' } } }] },
      sitelinks: { itwiki: { title: 'JPMorgan Chase' } },
    } } }) };
    if (url.searchParams.get('prop') === 'extracts') return { ok: true, json: async () => ({ query: { pages: { 1: {
      extract: 'JPMorgan Chase è una banca statunitense con sede a New York. Ha una capitalizzazione di 420 miliardi di dollari.',
    } } } }) };
    throw Error('unexpected');
  };
  const fact = await fetchPublicDescription(stock('JPMorgan', 'JPM'), { lang: 'it', fetchImpl });
  assert.match(fact.summary, /banca statunitense/);
  assert.doesNotMatch(fact.summary, /420 miliardi/);
});

test('a missing article retains the matched CC0 description without inventing products', async () => {
  const fetchImpl = async raw => {
    const action = new URL(raw).searchParams.get('action');
    if (action === 'wbsearchentities') return { ok: true, json: async () => ({ search: [{ id: 'Q55', label: 'North Example', description: 'European software company' }] }) };
    throw Error('article unavailable');
  };
  const found = await fetchPublicDescription(stock('North Example', 'NEX'), { lang: 'en', fetchImpl });
  assert.equal(found.source, 'Wikidata');
  assert.equal(found.summary, 'European software company');
  assert.equal(found.license, undefined);
});

test('unavailable or ambiguous public data does not become a made-up description', async () => {
  assert.equal(await fetchPublicDescription(stock('A', 'A'), { fetchImpl: async () => { throw Error('offline'); } }), null);
  const bad = async () => ({ ok: true, json: async () => ({ search: [{ id: 'Q1', label: 'Apple', description: 'fruit' }] }) });
  assert.equal(await fetchPublicDescription(stock('Apple', 'AAPL'), { fetchImpl: bad }), null);
});
