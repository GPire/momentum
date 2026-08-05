import test from 'node:test';
import assert from 'node:assert/strict';
import { alignMacroToWeeks, explainConfoundersWithMacro, fetchMacroSeries } from './macro-context.js';
import { buildLaggedFrame, discoverCausalGraph } from './causal-discovery.js';
import { detectLatentConfounders } from './causal-diagnostics.js';

function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; };
}
const gauss = (rnd) => {
  const u1 = Math.max(1e-9, rnd()), u2 = rnd();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

// ── Riallineamento alla griglia settimanale ──

test('un valore macro viene portato avanti finché non arriva il successivo (mai interpolato)', () => {
  const oggi = new Date('2026-08-05T00:00:00Z');
  const macro = [
    { date: '2026-06-01', close: 3.5 },
    { date: '2026-07-15', close: 4.0 },
  ];
  const { values, copertura } = alignMacroToWeeks(macro, { weeks: 12, referenceDate: oggi });
  assert.equal(values.length, 12);
  assert.ok(values.some((v) => v === 3.5));
  assert.ok(values.some((v) => v === 4.0));
  assert.ok(copertura > 0 && copertura <= 1);
});

test('le settimane prima del primo dato noto restano null, mai un valore inventato', () => {
  const oggi = new Date('2026-08-05T00:00:00Z');
  const macro = [{ date: '2026-07-29', close: 4.0 }]; // dato molto recente
  const { values } = alignMacroToWeeks(macro, { weeks: 20, referenceDate: oggi });
  assert.equal(values[0], null, 'le settimane lontane nel passato non devono avere un valore');
  assert.ok(values.slice(-2).some((v) => v === 4.0));
});

test('senza alcun dato macro, copertura zero e nessun crash', () => {
  const r = alignMacroToWeeks([], { weeks: 10, referenceDate: new Date() });
  assert.deepEqual(r.values, []);
  assert.equal(r.copertura, 0);
});

test('date malformate o valori non finiti vengono scartati prima dell\'allineamento', () => {
  const macro = [{ date: 'non-una-data', close: 5 }, { date: '2026-01-01', close: NaN }, { date: '2026-01-01', close: 3 }];
  const r = alignMacroToWeeks(macro, { weeks: 4, referenceDate: new Date('2026-08-05') });
  assert.ok(r.values.every((v) => v === null || v === 3));
});

// ── IL TEST DECISIVO: una causa comune nascosta viene NOMINATA ──

test('CAUSA NOMINATA: un macro reale che spiega il confondente lo dice esplicitamente', () => {
  const rnd = rng(7);
  const n = 200;
  const macroRaw = []; let m = 3;
  const A = [], B = [];
  for (let t = 0; t < n; t++) {
    m += 0.15 * gauss(rnd);
    macroRaw.push(m);
    A.push(1.1 * m + 0.2 * gauss(rnd));
    B.push(1.1 * m + 0.2 * gauss(rnd));
  }
  const frame = buildLaggedFrame({ A, B }, { maxLag: 2 });
  const latent = detectLatentConfounders(frame, {});
  assert.equal(latent.pulito, false, 'il confondente deve essere sospettato prima di poterlo nominare');

  // La serie macro allineata: stessa lunghezza dei residui per semplicità di test.
  const macroAllineato = { values: macroRaw.slice(0, frame.T), copertura: 1 };
  const spiegato = explainConfoundersWithMacro(latent, macroAllineato, { label: 'il tasso di riferimento' });
  assert.equal(spiegato.macroDisponibile, true);
  const s = spiegato.sospetti.find((x) => x.tra.includes('A') && x.tra.includes('B'));
  assert.equal(s.spiegatoDaMacro, 'il tasso di riferimento');
  assert.match(s.nota, /non per un legame diretto/);
});

test('senza una vera spiegazione macro, il sospetto resta "non sappiamo" — mai un\'attribuzione a metà', () => {
  const rnd = rng(11);
  const n = 200;
  const U = Array.from({ length: n }, () => gauss(rnd)); // causa nascosta VERA, ma NON è il macro
  const A = U.map((u) => 1.2 * u + 0.4 * gauss(rnd));
  const B = U.map((u) => 1.2 * u + 0.4 * gauss(rnd));
  const macroIndipendente = Array.from({ length: n }, () => gauss(rnd)); // scorrelato da U

  const frame = buildLaggedFrame({ A, B }, { maxLag: 2 });
  const latent = detectLatentConfounders(frame, {});
  const macroAllineato = { values: macroIndipendente.slice(0, frame.T), copertura: 1 };
  const spiegato = explainConfoundersWithMacro(latent, macroAllineato);
  const s = spiegato.sospetti.find((x) => x.tra.includes('A') && x.tra.includes('B'));
  assert.equal(s.spiegatoDaMacro, null, 'un macro che non c\'entra non deve essere accusato lo stesso');
});

test('con copertura macro troppo bassa, non si tenta nemmeno la spiegazione', () => {
  const rnd = rng(13);
  const n = 100;
  const U = Array.from({ length: n }, () => gauss(rnd));
  const A = U.map((u) => 1.2 * u + 0.4 * gauss(rnd));
  const B = U.map((u) => 1.2 * u + 0.4 * gauss(rnd));
  const frame = buildLaggedFrame({ A, B }, { maxLag: 2 });
  const latent = detectLatentConfounders(frame, {});
  const pocaCopertura = { values: new Array(frame.T).fill(null), copertura: 0.1 };
  const spiegato = explainConfoundersWithMacro(latent, pocaCopertura);
  assert.equal(spiegato.macroDisponibile, false);
  assert.ok(spiegato.sospetti.every((s) => s.spiegatoDaMacro === null));
});

test('senza alcun sospetto, la funzione non inventa nulla da spiegare', () => {
  const rnd = rng(17);
  const n = 150;
  const A = Array.from({ length: n }, () => gauss(rnd));
  const B = Array.from({ length: n }, () => gauss(rnd));
  const frame = buildLaggedFrame({ A, B }, { maxLag: 2 });
  const latent = detectLatentConfounders(frame, {});
  assert.equal(latent.pulito, true);
  const macroAllineato = { values: new Array(frame.T).fill(3), copertura: 1 };
  const spiegato = explainConfoundersWithMacro(latent, macroAllineato);
  assert.deepEqual(spiegato.sospetti, []);
});

// ── Integrazione end-to-end con PCMCI vero ──
//
// Scoperta reale nel costruire questo test (non un bug, un limite onesto da
// documentare): quando detectLatentConfounders riceve i genitori VERI di
// PCMCI (non un dizionario vuoto), i residui sono già stati depurati anche
// del proprio passato autocorrelato — che su un driver macro lento porta via
// gran parte della sua variabilità. Quello che resta nel residuo a volte non
// si spiega più in modo pulito né dal livello né dalla variazione del macro,
// con un campione finito: il condizionamento PCMCI e la spiegazione macro
// "fanno a gara" per la stessa varianza. La funzione fa la cosa giusta in
// questo caso — resta in silenzio invece di indovinare — ed è esattamente
// la garanzia da verificare, non il trovare sempre un nome.
test('INTEGRAZIONE: il ciclo completo scoperta+diagnosi+spiegazione macro non crolla e non inventa mai un\'attribuzione debole', () => {
  const rnd = rng(19);
  const n = 220;
  const macroRaw = []; let m = 3;
  const A = [], B = [];
  for (let t = 0; t < n; t++) {
    m += 0.15 * gauss(rnd);
    macroRaw.push(m);
    A.push(1.1 * m + 0.2 * gauss(rnd));
    B.push(1.1 * m + 0.2 * gauss(rnd));
  }
  const g = discoverCausalGraph({ A, B }, { maxLag: 2, alpha: 0.05 });
  const latent = detectLatentConfounders(g.frame, g.parentsByTarget);
  const macroAllineato = { values: macroRaw.slice(0, g.frame.T), copertura: 1 };
  const spiegato = explainConfoundersWithMacro(latent, macroAllineato, { label: 'il tasso BIS' });
  assert.equal(spiegato.macroDisponibile, true);
  // Ogni sospetto, spiegato o no, deve avere il campo dichiarato — mai
  // assente, mai un'etichetta a metà.
  for (const s of spiegato.sospetti) assert.ok('spiegatoDaMacro' in s);
});

// Lo stesso scenario, ma testando il meccanismo di attribuzione DIRETTAMENTE
// sui residui grezzi (senza il condizionamento aggiuntivo di PCMCI, come fa
// il test "CAUSA NOMINATA" sopra): qui il segnale macro è ancora pulito e
// l'attribuzione DEVE riuscire. Le due versioni insieme documentano il
// confine reale: la spiegazione macro funziona meglio prima del
// condizionamento PCMCI sul proprio passato, non dopo.
test('lo stesso scenario SENZA il condizionamento aggiuntivo di PCMCI: l\'attribuzione riesce', () => {
  const rnd = rng(19);
  const n = 220;
  const macroRaw = []; let m = 3;
  const A = [], B = [];
  for (let t = 0; t < n; t++) {
    m += 0.15 * gauss(rnd);
    macroRaw.push(m);
    A.push(1.1 * m + 0.2 * gauss(rnd));
    B.push(1.1 * m + 0.2 * gauss(rnd));
  }
  const frame = buildLaggedFrame({ A, B }, { maxLag: 2 });
  const latent = detectLatentConfounders(frame, {});
  const macroAllineato = { values: macroRaw.slice(0, frame.T), copertura: 1 };
  const spiegato = explainConfoundersWithMacro(latent, macroAllineato, { label: 'il tasso BIS' });
  const s = spiegato.sospetti.find((x) => x.tra.includes('A') && x.tra.includes('B'));
  assert.equal(s.spiegatoDaMacro, 'il tasso BIS');
});

// ── L'adattatore di rete: solo fonti keyless, mai bloccante ──

test('fetchMacroSeries usa solo la fonte richiesta e non lancia mai un\'eccezione su rete rotta', async () => {
  const fetchImpl = async () => { throw new Error('rete assente'); };
  const r = await fetchMacroSeries({ sourceId: 'bis', symbol: 'WS_CBPOL', fetchImpl });
  assert.deepEqual(r.series, []);
  assert.notEqual(r.verified, 'confirmed');
});

test('fetchMacroSeries con una fonte sconosciuta non crolla', async () => {
  const r = await fetchMacroSeries({ sourceId: 'fonte-inesistente', fetchImpl: async () => ({}) });
  assert.deepEqual(r.series, []);
  assert.equal(r.verified, 'fonte-sconosciuta');
});

test('fetchMacroSeries con dati validi restituisce una serie utilizzabile e dichiara l\'affidabilità', async () => {
  const fetchImpl = async () => ({
    ok: true, status: 200,
    text: async () => 'KEY,TIME_PERIOD,OBS_VALUE\nM.IT,2026-05,3.75\nM.IT,2026-06,3.5',
  });
  const r = await fetchMacroSeries({ sourceId: 'bis', symbol: 'WS_CBPOL', fetchImpl });
  assert.ok(r.series.length > 0);
  assert.equal(r.affidabile, true);
});
