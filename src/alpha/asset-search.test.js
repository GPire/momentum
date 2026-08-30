import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCrypto, searchStock, searchAsset, searchStockTwelveData, searchStockFMP } from './asset-search.js';

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

// Immobili: nessuna API gratuita dà il prezzo di un immobile specifico —
// alias locale verso l'ETF di settore reale (XLRE, quotato) come PROXY,
// mai una previsione sul bene dell'utente. Verifica che l'alias risponda
// SENZA chiamare le API live (nessun fetch effettuato).
test('searchAsset: "mercato immobiliare" -> proxy di settore XLRE, senza chiamare le API live', async () => {
  const fetchImpl = async () => { throw new Error('non doveva essere chiamata'); };
  const r = await searchAsset('mercato immobiliare', { apiKey: 'k', fetchImpl });
  assert.equal(r.results.length, 1);
  assert.equal(r.results[0].symbol, 'XLRE');
  assert.equal(r.results[0].kind, 'stock');
  assert.match(r.results[0].name, /proxy di settore/i);
  assert.equal(r.stale, false);
});

test('searchAsset: "come va il settore immobiliare" (in inglese "real estate") -> stesso alias XLRE', async () => {
  const fetchImpl = async () => { throw new Error('non doveva essere chiamata'); };
  const r = await searchAsset('real estate', { fetchImpl });
  assert.equal(r.results[0].symbol, 'XLRE');
});

// BUG REALE (2026-07-27): chiave Alpha Vantage non valida/demo ("TEST_DEMO_KEY")
// faceva fallire in silenzio la ricerca azionaria di "Apple", ripiegando su
// un token cripto assurdo ("dog-with-apple-in-mouth") spacciato per il
// risultato migliore. Verifica che l'errore reale venga ora conservato.
// NOTA: query cambiata da "Apple" a "Widgetco" (2026-08-05) — "apple" è ora
// nella tabella statica dei titoli noti (asset-search.js, NOTI_TICKER,
// nessuna chiave richiesta) e risolve correttamente da sola, rendendo
// obsoleta la premessa di questo test ("nessun match azionario pertinente
// per Apple"). "Widgetco" resta un nome fittizio fuori da quella tabella,
// preservando lo scenario originale: nessuna fonte azionaria disponibile.
test('searchAsset: chiave Alpha Vantage non valida + solo cripto poco pertinente -> stockWarning onesto', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('coingecko')) {
      return { ok: true, json: async () => ({ coins: [{ id: 'dog-with-widgetco-in-mouth', symbol: 'DOGGO', name: 'Dog with widgetco in mouth', market_cap_rank: 5000 }] }) };
    }
    return { ok: true, json: async () => ({ Information: 'We have detected your API key as TEST_DEMO_KEY...' }) };
  };
  const r = await searchAsset('Widgetco', { apiKey: 'TEST_DEMO_KEY', fetchImpl });
  assert.ok(r.stockWarning, 'deve conservare il messaggio di errore reale');
  assert.equal(r.results[0].symbol, 'DOGGO'); // il risultato debole resta disponibile, ma segnalato
});

// BUG REALE riprodotto dal vivo: il token "dog with apple in mouth" ha
// SIMBOLO letterale "APPLE" (non il nome) — relevanceScore lo trattava come
// match esatto al pari di un titolo vero. Il simbolo può essere scelto
// liberamente da chiunque, il nome no: solo il nome conta per l'esenzione.
// Query "Widgetco" per lo stesso motivo del test precedente.
test('searchAsset: simbolo cripto uguale alla query ma nome diverso -> warning comunque presente (simbolo non è garanzia)', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('coingecko')) {
      return { ok: true, json: async () => ({ coins: [{ id: 'dog-with-widgetco-in-mouth', symbol: 'WIDGETCO', name: 'dog with widgetco in mouth', market_cap_rank: 5000 }] }) };
    }
    return { ok: true, json: async () => ({ Information: 'We have detected your API key as TEST_DEMO_KEY...' }) };
  };
  const r = await searchAsset('Widgetco', { apiKey: 'TEST_DEMO_KEY', fetchImpl });
  assert.ok(r.stockWarning, 'il simbolo uguale alla query non deve bastare a sopprimere il warning');
});

test('searchAsset: match cripto ESATTO nonostante errore azionario -> nessun warning (il match è comunque pertinente)', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('coingecko')) {
      return { ok: true, json: async () => ({ coins: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', market_cap_rank: 1 }] }) };
    }
    return { ok: true, json: async () => ({ Information: 'limite' }) };
  };
  const r = await searchAsset('bitcoin', { apiKey: 'k', fetchImpl });
  assert.equal(r.stockWarning, null);
});

// BUG REALE trovato dal vivo (2026-07-27): Twelve Data/FMP erano collegati
// SOLO allo storico prezzi, mai alla RICERCA — se Alpha Vantage esauriva il
// limite di 25 richieste/giorno (facilissimo), la ricerca falliva sempre
// anche con le altre due chiavi configurate. Simulazioni della cascata.
test('searchStockTwelveData: forma reale, normalizza i risultati', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ data: [{ symbol: 'AAPL', instrument_name: 'Apple Inc.', country: 'United States' }] }) });
  const r = await searchStockTwelveData('apple', { apiKey: 'k', fetchImpl });
  assert.deepEqual(r, [{ kind: 'stock', id: 'AAPL', symbol: 'AAPL', name: 'Apple Inc.', region: 'United States' }]);
});

test('searchStockTwelveData: chiave non valida -> errore onesto, mai un risultato finto', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ status: 'error', code: 401, message: 'Invalid API key' }) });
  await assert.rejects(() => searchStockTwelveData('apple', { apiKey: 'sbagliata', fetchImpl }), /Invalid API key/);
});

test('searchStockFMP: forma reale (endpoint stable/search-name), normalizza i risultati', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ([{ symbol: 'AAPL', name: 'Apple Inc.', currency: 'USD', exchangeFullName: 'NASDAQ Global Select' }]) });
  const r = await searchStockFMP('apple', { apiKey: 'k', fetchImpl });
  assert.deepEqual(r, [{ kind: 'stock', id: 'AAPL', symbol: 'AAPL', name: 'Apple Inc.', region: 'United States' }]);
});

test('searchStockFMP: valuta non-USD -> region resta il nome della borsa (nessuna preferenza USA)', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ([{ symbol: 'AAPL.DE', name: 'Apple Inc.', currency: 'EUR', exchangeFullName: 'Deutsche Börse' }]) });
  const r = await searchStockFMP('apple', { apiKey: 'k', fetchImpl });
  assert.equal(r[0].region, 'Deutsche Börse');
});

test('searchStockFMP: endpoint legacy dismesso -> errore col messaggio reale, mai un risultato finto', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ 'Error Message': 'Legacy Endpoint : ...' }) });
  await assert.rejects(() => searchStockFMP('apple', { apiKey: 'k', fetchImpl }), /Legacy Endpoint/);
});

test('searchAsset: Alpha Vantage esaurito (limite giornaliero) -> ripiega su Twelve Data, trova comunque il titolo reale', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('alphavantage')) return { ok: true, json: async () => ({ Information: 'limite di 25 richieste/giorno raggiunto' }) };
    if (url.includes('twelvedata')) return { ok: true, json: async () => ({ data: [{ symbol: 'AAPL', instrument_name: 'Apple Inc.', country: 'United States' }] }) };
    if (url.includes('coingecko')) return { ok: true, json: async () => ({ coins: [] }) };
    throw new Error('non doveva essere chiamata');
  };
  const r = await searchAsset('Apple', { apiKey: 'esaurita', twelvedataKey: 'k', fetchImpl });
  assert.equal(r.results[0].symbol, 'AAPL');
  assert.equal(r.results[0].kind, 'stock');
  assert.equal(r.stockWarning, null); // ha trovato un titolo vero, nessun avviso necessario
});

test('searchAsset: Alpha Vantage E Twelve Data falliscono -> ripiega su FMP', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('alphavantage')) return { ok: true, json: async () => ({ Information: 'limite raggiunto' }) };
    if (url.includes('twelvedata')) return { ok: true, json: async () => ({ status: 'error', message: 'chiave non valida' }) };
    if (url.includes('financialmodelingprep')) return { ok: true, json: async () => ([{ symbol: 'AAPL', name: 'Apple Inc.', exchangeFullName: 'NASDAQ' }]) };
    if (url.includes('coingecko')) return { ok: true, json: async () => ({ coins: [] }) };
    throw new Error('non doveva essere chiamata');
  };
  const r = await searchAsset('Apple', { apiKey: 'esaurita', twelvedataKey: 'sbagliata', fmpKey: 'k', fetchImpl });
  assert.equal(r.results[0].symbol, 'AAPL');
});

test('searchAsset: TUTTE le fonti azionarie falliscono -> stockWarning onesto SOLO se il risultato cripto rimasto non è pertinente', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('alphavantage') || url.includes('twelvedata') || url.includes('financialmodelingprep')) {
      throw new Error('tutte le fonti azionarie giù');
    }
    return { ok: true, json: async () => ({ coins: [{ id: 'dog-with-widgetco-in-mouth', symbol: 'DOGGO', name: 'Dog with widgetco in mouth', market_cap_rank: 5000 }] }) };
  };
  const r = await searchAsset('Widgetco', { apiKey: 'k', twelvedataKey: 'k', fmpKey: 'k', fetchImpl });
  assert.ok(r.stockWarning);
});

// BUG REALE riprodotto dal vivo con dati reali (2026-07-27): query "Apple"
// con Twelve Data funzionante restituiva comunque il token cripto-esca
// come risultato migliore (asset = results[0]), perché il match esatto sul
// solo SIMBOLO lo metteva in cima alla classifica, davanti ad Apple Inc.
// reale. Verifica che ora il titolo azionario vero vinca sempre.
test('searchAsset: simbolo cripto uguale alla query NON deve battere un titolo azionario reale nella classifica', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('coingecko')) {
      return { ok: true, json: async () => ({ coins: [{ id: 'dog-with-apple-in-mouth', symbol: 'APPLE', name: 'dog with apple in mouth', market_cap_rank: 5000 }] }) };
    }
    return { ok: true, json: async () => ({ bestMatches: [{ '1. symbol': 'AAPL', '2. name': 'Apple Inc.', '4. region': 'United States', '9. matchScore': '1.0000' }] }) };
  };
  const r = await searchAsset('Apple', { apiKey: 'k', fetchImpl });
  assert.equal(r.results[0].symbol, 'AAPL');
  assert.equal(r.results[0].kind, 'stock');
});

// BUG REALE riprodotto dal vivo: tra più listini dello stesso titolo, uno
// estero (nome per caso troncato esattamente alla query) vinceva sul
// listino USA primario — e il listino estero spesso richiede un piano a
// pagamento sulle stesse API gratuite (verificato: 4AAPL su Twelve Data
// → 404 "serve un piano Pro"). Verifica che il listino USA sia preferito.
test('searchAsset: tra più listini dello stesso titolo, il listino USA vince anche se un listino estero ha il nome esattamente troncato alla query', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('coingecko')) return { ok: true, json: async () => ({ coins: [] }) };
    return {
      ok: true,
      json: async () => ({
        bestMatches: [
          { '1. symbol': '4AAPL', '2. name': 'APPLE', '4. region': 'Italy', '9. matchScore': '0.6000' },
          { '1. symbol': 'AAPL', '2. name': 'Apple Inc.', '4. region': 'United States', '9. matchScore': '0.8000' },
        ],
      }),
    };
  };
  const r = await searchAsset('apple', { apiKey: 'k', fetchImpl });
  assert.equal(r.results[0].symbol, 'AAPL');
  assert.equal(r.results[0].region, 'United States');
});

// ============================================================
// TABELLA STATICA DEI TITOLI NOTI (2026-08-05) — BUG REALE segnalato dal
// vivo dall'utente: "quanto vale apple?" SENZA nessuna chiave configurata
// restituiva un token cripto marginale ("AAPLX") spacciato per il titolo
// vero, perché senza chiave la ricerca azionaria non partiva nemmeno.
// ============================================================

test('BUG REALE: "apple" SENZA alcuna chiave configurata -> risolve comunque al titolo vero (tabella statica)', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('coingecko')) {
      // Riproduce esattamente lo scenario dal vivo: una cripto marginale
      // con nome esatto "Apple" che altrimenti vincerebbe la classifica.
      return { ok: true, json: async () => ({ coins: [{ id: 'aaplx-token', symbol: 'AAPLX', name: 'Apple', market_cap_rank: 8000 }] }) };
    }
    throw new Error('non deve essere chiamata: nessuna chiave configurata');
  };
  const r = await searchAsset('apple', { fetchImpl }); // nessuna apiKey/twelvedataKey/fmpKey
  assert.equal(r.results[0].kind, 'stock');
  assert.equal(r.results[0].symbol, 'AAPL');
  assert.equal(r.stockWarning, null); // match statico pertinente: nessun avviso necessario
});

test('tabella statica: nomi comuni (microsoft/tesla/nvidia) risolvono senza alcuna chiave', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ coins: [] }) });
  for (const [query, symbol] of [['microsoft', 'MSFT'], ['tesla', 'TSLA'], ['nvidia', 'NVDA']]) {
    const r = await searchAsset(query, { fetchImpl });
    assert.equal(r.results[0]?.symbol, symbol, query);
  }
});

test('tabella statica: con una chiave che trova davvero il titolo, il risultato reale sostituisce il segnaposto statico (nessun doppione)', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('coingecko')) return { ok: true, json: async () => ({ coins: [] }) };
    return { ok: true, json: async () => ({ bestMatches: [{ '1. symbol': 'AAPL', '2. name': 'Apple Inc.', '4. region': 'United States', '9. matchScore': '1.0000' }] }) };
  };
  const r = await searchAsset('apple', { apiKey: 'k', fetchImpl });
  assert.equal(r.results.filter((x) => x.symbol === 'AAPL').length, 1, 'mai due volte lo stesso titolo');
  assert.equal(r.results[0].name, 'Apple Inc.'); // il dato REALE (nome completo), non il segnaposto statico
});

// BUG REALE trovato dal vivo (2026-08-05, dati reali CoinGecko): esiste un
// token cripto reale con SIMBOLO letterale "AAPL" ("Apple • Robinhood
// Token"). Il primo tentativo di deduplica ("sostituisci il segnaposto
// statico con qualunque risultato non-statico") lasciava questa cripto
// vincere e cancellava il match statico corretto — riproducendo esattamente
// il bug che la tabella doveva risolvere. Solo un risultato REALMENTE
// azionario può sostituire il segnaposto.
test('BUG REALE: una cripto con lo STESSO simbolo del segnaposto statico non lo sostituisce mai', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('coingecko')) {
      return { ok: true, json: async () => ({ coins: [{ id: 'apple-robinhood-tokenized-stock', symbol: 'AAPL', name: 'Apple • Robinhood Token', market_cap_rank: 3000 }] }) };
    }
    throw new Error('non deve essere chiamata: nessuna chiave configurata');
  };
  const r = await searchAsset('apple', { fetchImpl });
  assert.equal(r.results[0].kind, 'stock', 'la cripto con simbolo AAPL non deve mai sostituire il titolo vero');
  assert.equal(r.results[0].name, 'Apple');
  assert.equal(r.results.filter((x) => x.symbol === 'AAPL').length, 1, 'la cripto duplicata sullo stesso simbolo va scartata, non aggiunta a parte');
});

test('tabella statica: query senza corrispondenza -> nessun match statico, comportamento invariato', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ coins: [{ id: 'ethereum', symbol: 'eth', name: 'Ethereum' }] }) });
  const r = await searchAsset('un\'azienda a caso mai sentita', { fetchImpl });
  assert.equal(r.results.length, 1);
  assert.equal(r.results[0].kind, 'crypto');
});

// ============================================================
// BUG REALE segnalato dal vivo dall'utente (2026-08-30, account reale con
// chiavi configurate): "Cerca un asset" restava bloccato indefinitamente
// per certi asset. Riprodotto in isolamento: un provider che resta
// "pending" senza mai rispondere né fallire lasciava `await fetchImpl(url)`
// bloccato per sempre — stesso buco già trovato e corretto in
// src/ai/local-sentiment.js. Timer finti: mai un test reale da 15 secondi.
// ============================================================
test('searchCrypto: un fetch che non risponde mai scade con un errore chiaro, non blocca per sempre', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const cheNonFiniscePiu = () => new Promise(() => {});
  const p = assert.rejects(() => searchCrypto('apple', { fetchImpl: cheNonFiniscePiu }), /non risponde da troppo tempo/);
  t.mock.timers.tick(15_000);
  await p;
});

test('searchStock: un fetch che non risponde mai scade con un errore chiaro', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const cheNonFiniscePiu = () => new Promise(() => {});
  const p = assert.rejects(() => searchStock('apple', { apiKey: 'k', fetchImpl: cheNonFiniscePiu }), /non risponde da troppo tempo/);
  t.mock.timers.tick(15_000);
  await p;
});

test('searchStockTwelveData: un fetch che non risponde mai scade con un errore chiaro', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const cheNonFiniscePiu = () => new Promise(() => {});
  const p = assert.rejects(() => searchStockTwelveData('apple', { apiKey: 'k', fetchImpl: cheNonFiniscePiu }), /non risponde da troppo tempo/);
  t.mock.timers.tick(15_000);
  await p;
});

test('searchStockFMP: un fetch che non risponde mai scade con un errore chiaro', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const cheNonFiniscePiu = () => new Promise(() => {});
  const p = assert.rejects(() => searchStockFMP('apple', { apiKey: 'k', fetchImpl: cheNonFiniscePiu }), /non risponde da troppo tempo/);
  t.mock.timers.tick(15_000);
  await p;
});

test('searchAsset: un provider azionario bloccato per sempre non impedisce comunque il risultato cripto/statico', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fetchImpl = async (url) => {
    if (String(url).includes('coingecko')) return { ok: true, json: async () => ({ coins: [] }) };
    return new Promise(() => {}); // il provider azionario resta bloccato per sempre
  };
  const p = searchAsset('apple', { apiKey: 'k', fetchImpl }).then((r) => {
    assert.equal(r.results[0].symbol, 'AAPL', 'la tabella statica risponde comunque, il provider bloccato non impedisce il resto');
  });
  t.mock.timers.tick(15_000);
  await p;
});
