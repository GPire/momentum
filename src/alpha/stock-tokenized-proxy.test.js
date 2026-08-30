import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTokenizedStockProxy } from './stock-tokenized-proxy.js';

// Forma reale osservata dal vivo (2026-08-30) per "apple" su
// api.coingecko.com/api/v3/search — solo i campi che il modulo legge.
const rispostaApple = {
  coins: [
    { id: 'apple-xstock', name: 'Apple xStock', symbol: 'aaplx', market_cap_rank: 1027 },
    { id: 'apple-ondo-tokenized-stock', name: 'Apple (Ondo Tokenized Stock)', symbol: 'aaplon', market_cap_rank: 2450 },
    { id: 'apple-bstocks-tokenized-stock', name: 'Apple (bStocks Tokenized Stock)', symbol: 'aaplb', market_cap_rank: 3100 },
    { id: 'apple-coin', name: 'AppleCoin', symbol: 'apc', market_cap_rank: 5000 }, // cripto reale, non un proxy: nome non matcha il pattern
  ],
};

test('resolveTokenizedStockProxy: trova il proxy con market_cap_rank migliore (più liquido), non il primo dell\'elenco', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => rispostaApple });
  const r = await resolveTokenizedStockProxy('apple', { fetchImpl });
  assert.equal(r.id, 'apple-xstock');
  assert.equal(r.symbol, 'AAPLX');
});

test('resolveTokenizedStockProxy: scarta le cripto che condividono il nome ma non sono un token-proxy dichiarato', async () => {
  const soloCriptoNonProxy = { coins: [rispostaApple.coins[3]] };
  const fetchImpl = async () => ({ ok: true, json: async () => soloCriptoNonProxy });
  const r = await resolveTokenizedStockProxy('apple', { fetchImpl });
  assert.equal(r, null);
});

test('resolveTokenizedStockProxy: query senza corrispondenza -> null, mai un match a caso', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ coins: [] }) });
  const r = await resolveTokenizedStockProxy('un\'azienda a caso mai sentita', { fetchImpl });
  assert.equal(r, null);
});

test('resolveTokenizedStockProxy: BUG REALE già visto altrove — un token con match solo sul simbolo/prefisso non basta, serve il nome vero nel titolo', async () => {
  // "Applied Materials xStock" non deve vincere per "apple" (prefisso, non
  // parola intera) — stessa guardia di titoloParlaDi già in news.js.
  const rumoroso = { coins: [{ id: 'applied-materials-xstock', name: 'Applied Materials xStock', symbol: 'amatx', market_cap_rank: 900 }] };
  const fetchImpl = async () => ({ ok: true, json: async () => rumoroso });
  const r = await resolveTokenizedStockProxy('apple', { fetchImpl });
  assert.equal(r, null);
});

test('resolveTokenizedStockProxy: stringa vuota -> null, mai un fetch a vuoto', async () => {
  const r = await resolveTokenizedStockProxy('', { fetchImpl: async () => { throw new Error('non deve essere chiamata'); } });
  assert.equal(r, null);
});

test('resolveTokenizedStockProxy: errore di rete -> null onesto, mai un\'eccezione che rompe il chiamante', async () => {
  const r = await resolveTokenizedStockProxy('apple', { fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(r, null);
});

test('resolveTokenizedStockProxy: HTTP non-ok -> null onesto', async () => {
  const r = await resolveTokenizedStockProxy('apple', { fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.equal(r, null);
});

// ============================================================
// Stesso buco già trovato e corretto in src/ai/local-sentiment.js e in
// tutte le altre fonti di questa sessione (src/core/con-timeout.js): un
// fetch che non risponde mai non deve bloccare per sempre. Timer finti:
// mai un test reale da 15 secondi.
// ============================================================
test('resolveTokenizedStockProxy: un fetch che non risponde mai scade con null, non blocca per sempre', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const cheNonFiniscePiu = () => new Promise(() => {});
  const p = resolveTokenizedStockProxy('apple', { fetchImpl: cheNonFiniscePiu }).then((r) => assert.equal(r, null));
  t.mock.timers.tick(15_000);
  await p;
});
