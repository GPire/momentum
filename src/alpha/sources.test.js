import test from 'node:test';
import assert from 'node:assert/strict';

const { SOURCE_REGISTRY, crossCheck, plausibility, fetchVerified, trainingEligible, parseFredJson, parseEcbCsv } =
  await import('./sources.js');

// ── helper: mock delle risposte fetch per CoinGecko (json) e Stooq (csv) ──
const msUTC = d => Date.parse(`${d}T00:00:00Z`);
const geckoRes = pairs => ({ ok: true, status: 200, json: async () => ({ prices: pairs.map(([d, c]) => [msUTC(d), c]) }) });
const stooqRes = rows => ({ ok: true, status: 200, text: async () => 'Date,Open,High,Low,Close,Volume\n' + rows.map(([d, c]) => `${d},0,0,0,${c},0`).join('\n') });
const mkCache = (store = {}) => ({ store, async get(k) { return this.store[k]; }, async put(k, v) { this.store[k] = v; } });

// ============ SOURCE_REGISTRY: whitelist onesta ============

test('SOURCE_REGISTRY: bloomberg e yahoo esclusi con motivazione onesta, fred richiede chiave', () => {
  const byId = Object.fromEntries(SOURCE_REGISTRY.map(s => [s.id, s]));
  for (const id of ['bloomberg', 'yahoo-finance']) {
    assert.equal(byId[id].cors, 'no');
    assert.equal(byId[id].excluded, true);
    assert.ok(/esclusa/i.test(byId[id].note));
  }
  assert.equal(byId.fred.cors, 'key');
  assert.equal(byId.ecb.cors, 'yes');
  // fonti prezzi effettivamente utilizzabili: coingecko + stooq
  const usable = SOURCE_REGISTRY.filter(s => s.kind === 'prices' && !s.excluded && s.cors !== 'no');
  assert.deepEqual(usable.map(s => s.id).sort(), ['coingecko', 'stooq']);
});

// ============ crossCheck ============

test('crossCheck: ultima data comune entro soglia → confirmed', () => {
  const a = [{ date: '2026-07-01', close: 100 }, { date: '2026-07-02', close: 102 }];
  const b = [{ date: '2026-07-01', close: 100.5 }, { date: '2026-07-02', close: 102.5 }];
  const r = crossCheck(a, b);
  assert.equal(r.confirmed, true);
  assert.ok(r.divergencePct < 2);
  assert.ok(/2026-07-02/.test(r.reason)); // confronta la data più recente
});

test('crossCheck: divergenza > 2% → NON confirmed, con motivo', () => {
  const a = [{ date: '2026-07-02', close: 100 }];
  const b = [{ date: '2026-07-02', close: 110 }];
  const r = crossCheck(a, b);
  assert.equal(r.confirmed, false);
  assert.ok(r.divergencePct > 2);
  assert.ok(/divergenza/.test(r.reason));
});

test('crossCheck: soglia personalizzabile', () => {
  const a = [{ date: '2026-07-02', close: 100 }];
  const b = [{ date: '2026-07-02', close: 104 }];
  assert.equal(crossCheck(a, b).confirmed, false);
  assert.equal(crossCheck(a, b, { maxDivergencePct: 10 }).confirmed, true);
});

test('crossCheck: serie vuota → mai confermato, divergenza null', () => {
  assert.equal(crossCheck([], [{ date: '2026-07-01', close: 1 }]).confirmed, false);
  assert.equal(crossCheck(null, null).divergencePct, null);
});

test('crossCheck: nessuna data in comune → onesto "non confermabile"', () => {
  const r = crossCheck([{ date: '2026-07-01', close: 100 }], [{ date: '2026-07-02', close: 100 }]);
  assert.equal(r.confirmed, false);
  assert.ok(/comune/i.test(r.reason));
});

test('crossCheck: singolo punto sovrapposto basta', () => {
  const r = crossCheck([{ date: '2026-07-01', close: 100 }], [{ date: '2026-07-01', close: 100 }]);
  assert.equal(r.confirmed, true);
  assert.equal(r.divergencePct, 0);
});

// ============ plausibility ============

test('plausibility: serie sana → plausible senza motivi', () => {
  const r = plausibility([{ date: '2026-07-01', close: 100 }, { date: '2026-07-02', close: 103 }]);
  assert.equal(r.plausible, true);
  assert.equal(r.reasons.length, 0);
});

test('plausibility: serie vuota → non plausibile', () => {
  const r = plausibility([]);
  assert.equal(r.plausible, false);
  assert.ok(/vuota/i.test(r.reasons[0]));
});

test('plausibility: un solo punto positivo → plausibile (niente salti da controllare)', () => {
  assert.equal(plausibility([{ date: '2026-07-01', close: 42 }]).plausible, true);
});

test('plausibility: close negativo o zero → non plausibile', () => {
  assert.equal(plausibility([{ date: '2026-07-01', close: -5 }]).plausible, false);
  assert.equal(plausibility([{ date: '2026-07-01', close: 0 }]).plausible, false);
});

test('plausibility: date non monotone → non plausibile', () => {
  const r = plausibility([{ date: '2026-07-02', close: 100 }, { date: '2026-07-01', close: 101 }]);
  assert.equal(r.plausible, false);
  assert.ok(r.reasons.some(x => /monoton/i.test(x)));
});

test('plausibility: salto giornaliero oltre soglia → non plausibile, soglia regolabile', () => {
  const s = [{ date: '2026-07-01', close: 100 }, { date: '2026-07-02', close: 160 }]; // +60%
  assert.equal(plausibility(s).plausible, false);
  assert.equal(plausibility(s, { maxDailyJumpPct: 70 }).plausible, true);
});

test('plausibility: stesso timestamp con close diversi → non plausibile', () => {
  const r = plausibility([{ date: '2026-07-01', close: 100 }, { date: '2026-07-01', close: 120 }]);
  assert.equal(r.plausible, false);
  assert.ok(r.reasons.some(x => /duplicat/i.test(x)));
});

// ============ fetchVerified: la catena onesta ============

test('fetchVerified: due fonti concordi → confirmed, addestrabile, cache aggiornata', async () => {
  const cache = mkCache();
  const fetchImpl = async url => url.includes('coingecko')
    ? geckoRes([['2026-07-01', 100], ['2026-07-02', 102]])
    : stooqRes([['2026-07-01', 100.4], ['2026-07-02', 102.5]]);
  const r = await fetchVerified({ symbol: 'bitcoin', fetchImpl, cache });
  assert.equal(r.verified, 'confirmed');
  assert.equal(r.source, 'coingecko+stooq');
  assert.equal(r.priceSource, 'coingecko');
  assert.equal(r.prices.length, 2);
  assert.equal(trainingEligible(r), true);
  assert.ok(cache.store['vrf:prices:bitcoin']);
});

test('fetchVerified: fonti divergenti (>2%) → unconfirmed, mostrato ma MAI addestrabile', async () => {
  const fetchImpl = async url => url.includes('coingecko')
    ? geckoRes([['2026-07-02', 102]])
    : stooqRes([['2026-07-02', 130]]); // ~24% di divergenza
  const r = await fetchVerified({ symbol: 'bitcoin', fetchImpl, cache: mkCache() });
  assert.equal(r.verified, 'unconfirmed');
  assert.ok(r.prices.length > 0);               // display sì…
  assert.ok(/NON confermato/i.test(r.note));    // …ma etichettato
  assert.equal(trainingEligible(r), false);     // …e mai nel training
});

test('fetchVerified: una sola fonte raggiungibile e plausibile → single-source, addestrabile', async () => {
  const fetchImpl = async url => {
    if (url.includes('coingecko')) return geckoRes([['2026-07-01', 100], ['2026-07-02', 103]]);
    throw new TypeError('Failed to fetch'); // stooq bloccata da CORS
  };
  const r = await fetchVerified({ symbol: 'bitcoin', fetchImpl, cache: mkCache() });
  assert.equal(r.verified, 'single-source');
  assert.equal(r.priceSource, 'coingecko');
  assert.equal(trainingEligible(r), true);
});

test('fetchVerified: fonte unica con salto del 60% → unconfirmed, NON addestrabile', async () => {
  const fetchImpl = async url => {
    if (url.includes('coingecko')) return geckoRes([['2026-07-01', 100], ['2026-07-02', 160]]);
    throw new TypeError('Failed to fetch');
  };
  const r = await fetchVerified({ symbol: 'bitcoin', fetchImpl, cache: mkCache() });
  assert.equal(r.verified, 'unconfirmed');
  assert.ok(/salto/i.test(r.note));
  assert.equal(trainingEligible(r), false);
});

test('fetchVerified: due fonti concordi ma serie implausibile → comunque unconfirmed', async () => {
  // entrambe riportano lo stesso salto assurdo: concordi, ma niente training
  const fetchImpl = async url => url.includes('coingecko')
    ? geckoRes([['2026-07-01', 100], ['2026-07-02', 300]])
    : stooqRes([['2026-07-01', 100], ['2026-07-02', 301]]);
  const r = await fetchVerified({ symbol: 'bitcoin', fetchImpl, cache: mkCache() });
  assert.equal(r.verified, 'unconfirmed');
  assert.equal(trainingEligible(r), false);
});

test('fetchVerified: tutte le fonti giù + cache presente → fallback etichettato, NON addestrabile', async () => {
  const cache = mkCache({ 'vrf:prices:bitcoin': { prices: [{ date: '2026-07-01', close: 99 }], source: 'coingecko+stooq', priceSource: 'coingecko', asOf: '2026-07-01T00:00:00Z', verified: 'confirmed' } });
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  const r = await fetchVerified({ symbol: 'bitcoin', fetchImpl, cache });
  assert.equal(r.verified, 'fallback');            // la vecchia etichetta 'confirmed' NON sopravvive
  assert.equal(r.prices[0].close, 99);
  assert.ok(/cache/i.test(r.note));
  assert.equal(trainingEligible(r), false);
});

test('fetchVerified: tutte giù e niente cache → prezzi vuoti, nota onesta, nessun throw', async () => {
  const fetchImpl = async () => ({ ok: false, status: 429 });
  const r = await fetchVerified({ symbol: 'bitcoin', fetchImpl, cache: mkCache() });
  assert.equal(r.prices.length, 0);
  assert.equal(r.source, null);
  assert.ok(r.note.length > 0);
  assert.ok(/429/.test(r.note)); // gli errori reali sono citati, non nascosti
  assert.equal(trainingEligible(r), false);
});

test('fetchVerified: kind macro senza apiKey → FRED saltata e dichiarata, ECB single-source', async () => {
  const urls = [];
  const fetchImpl = async url => {
    urls.push(url);
    return { ok: true, status: 200, text: async () => 'KEY,TIME_PERIOD,OBS_VALUE\nICP.M,2026-05,2.1\nICP.M,2026-06,2.2' };
  };
  const r = await fetchVerified({ symbol: 'ICP.M.U2', kind: 'macro', fetchImpl, cache: mkCache() });
  assert.ok(urls.every(u => !u.includes('stlouisfed'))); // mai chiamata senza chiave
  assert.equal(r.verified, 'single-source');
  assert.equal(r.priceSource, 'ecb');
  assert.ok(/chiave/i.test(r.note)); // il salto di FRED è dichiarato nella nota
  assert.equal(trainingEligible(r), true);
});

// ============ trainingEligible: il gate anti-dato-falso ============

test('trainingEligible: solo confirmed e single-source, mai gli altri stati', () => {
  const p = [{ date: '2026-07-01', close: 1 }];
  assert.equal(trainingEligible({ verified: 'confirmed', prices: p }), true);
  assert.equal(trainingEligible({ verified: 'single-source', prices: p }), true);
  assert.equal(trainingEligible({ verified: 'unconfirmed', prices: p }), false);
  assert.equal(trainingEligible({ verified: 'fallback', prices: p }), false);
  assert.equal(trainingEligible({ verified: 'confirmed', prices: [] }), false); // vuoto → niente
  assert.equal(trainingEligible(null), false);
});

// ============ parser FRED / ECB ============

test('parseFredJson: estrae le osservazioni, scarta i valori mancanti "."', () => {
  const p = parseFredJson({ observations: [{ date: '2026-06-01', value: '3.25' }, { date: '2026-06-02', value: '.' }, { date: '2026-06-03', value: '3.30' }] });
  assert.equal(p.length, 2);
  assert.deepEqual(p[0], { date: '2026-06-01', close: 3.25 });
});

test('parseEcbCsv: trova TIME_PERIOD/OBS_VALUE e normalizza i mesi YYYY-MM', () => {
  const p = parseEcbCsv('KEY,FREQ,TIME_PERIOD,OBS_VALUE\nICP,M,2026-05,2.1\nICP,M,2026-06,2.2');
  assert.equal(p.length, 2);
  assert.deepEqual(p[0], { date: '2026-05-01', close: 2.1 });
});

test('parseFredJson/parseEcbCsv: input vuoto o malformato → [] senza throw', () => {
  assert.deepEqual(parseFredJson(null), []);
  assert.deepEqual(parseFredJson({}), []);
  assert.deepEqual(parseEcbCsv(''), []);
  assert.deepEqual(parseEcbCsv('colonne,sbagliate\n1,2'), []);
});
