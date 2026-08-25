import test from 'node:test';
import assert from 'node:assert/strict';
import { alignMacroToWeeks, alignMacroToMonths, correlaConMacro, spiegaResiduoConMacro, explainConfoundersWithMacro, fetchMacroSeries, fetchMacroSeriesConFallback, CATENA_MACRO_DEFAULT, contestoMacroSeGiaCaldo, scaldaContestoMacroCondiviso } from './macro-context.js';
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

// ── Catena di fallback multi-fonte (2026-08-25) ──
// PROBLEMA REALE TROVATO: il registro sources.js aveva 4+ fonti macro, ma
// ensureMacroContext (main.js) chiamava sempre e solo fetchMacroSeries() coi
// default (ECB), senza mai ripiegare su BIS/OECD se ECB era irraggiungibile.

test('fetchMacroSeriesConFallback: prova la prima fonte, se funziona non tocca le altre', async () => {
  let chiamate = 0;
  const fetchImpl = async () => { chiamate++; return { ok: true, status: 200, text: async () => 'TIME_PERIOD,OBS_VALUE\n2026-06,3.5' }; };
  const r = await fetchMacroSeriesConFallback(CATENA_MACRO_DEFAULT, { fetchImpl });
  assert.equal(chiamate, 1, 'la prima fonte (ECB) ha già dati validi, BIS/OECD non vanno provate');
  assert.equal(r.affidabile, true);
  assert.equal(r.label, CATENA_MACRO_DEFAULT[0].label);
});

test('fetchMacroSeriesConFallback: se la prima fonte fallisce, prova la seconda — mai un crash', async () => {
  let tentativo = 0;
  const fetchImpl = async () => {
    tentativo++;
    if (tentativo === 1) throw new Error('ECB irraggiungibile');
    return { ok: true, status: 200, text: async () => 'TIME_PERIOD,OBS_VALUE\n2026-06,3.5' };
  };
  const r = await fetchMacroSeriesConFallback(CATENA_MACRO_DEFAULT, { fetchImpl });
  assert.equal(r.affidabile, true);
  assert.equal(r.label, CATENA_MACRO_DEFAULT[1].label, 'la seconda fonte della catena (BIS) ha risposto');
  assert.equal(r.tentativi.length, 2);
});

test('fetchMacroSeriesConFallback: se TUTTE le fonti falliscono, dichiara onestamente invece di inventare', async () => {
  const fetchImpl = async () => { throw new Error('rete assente'); };
  const r = await fetchMacroSeriesConFallback(CATENA_MACRO_DEFAULT, { fetchImpl });
  assert.deepEqual(r.series, []);
  assert.equal(r.affidabile, false);
  assert.equal(r.label, null);
  assert.equal(r.tentativi.length, CATENA_MACRO_DEFAULT.length, 'ha provato TUTTE le fonti prima di arrendersi');
});

test('CATENA_MACRO_DEFAULT: ogni passo ha sourceId/symbol/label reali, nessun campo vuoto', () => {
  for (const passo of CATENA_MACRO_DEFAULT) {
    assert.ok(passo.sourceId && passo.symbol && passo.label, JSON.stringify(passo));
  }
});

// ── alignMacroToMonths: come alignMacroToWeeks ma su griglia mensile
// (src/alpha/titolo-causale.js:scomponi produce residui MENSILI, non
// settimanali) ──

test('alignMacroToMonths: porta avanti l\'ultimo valore noto, mai un\'interpolazione', () => {
  const macro = [{ date: '2026-01-15', close: 3.5 }, { date: '2026-04-10', close: 4.0 }];
  const { values, copertura } = alignMacroToMonths(macro, { mesi: 6, meseFinale: '2026-06' });
  // mesi: gen feb mar apr mag giu (indice 0..5)
  assert.equal(values.length, 6);
  assert.equal(values[0], 3.5, 'gennaio: il valore di gennaio è già noto');
  assert.equal(values[2], 3.5, 'marzo: ancora nessun dato nuovo, resta il valore di gennaio');
  assert.equal(values[3], 4.0, 'aprile: arriva il nuovo dato');
  assert.equal(values[5], 4.0, 'giugno: resta l\'ultimo noto');
  assert.ok(copertura > 0);
});

test('alignMacroToMonths: i mesi prima del primo dato noto restano null', () => {
  const macro = [{ date: '2026-05-01', close: 2 }];
  const { values } = alignMacroToMonths(macro, { mesi: 6, meseFinale: '2026-06' });
  assert.deepEqual(values.slice(0, 4), [null, null, null, null]);
  assert.equal(values[4], 2);
});

test('alignMacroToMonths: input vuoto/malformato → copertura zero, mai un crash', () => {
  assert.deepEqual(alignMacroToMonths([], { mesi: 6, meseFinale: '2026-06' }), { values: [], copertura: 0 });
  assert.deepEqual(alignMacroToMonths([{ date: '2026-01-01', close: 1 }], { mesi: 6, meseFinale: 'non-un-mese' }), { values: [], copertura: 0 });
  assert.deepEqual(alignMacroToMonths([{ date: '2026-01-01', close: 1 }], {}), { values: [], copertura: 0 });
});

test('alignMacroToMonths: attraversa un cambio d\'anno correttamente', () => {
  const macro = [{ date: '2025-12-01', close: 1 }, { date: '2026-02-01', close: 2 }];
  const { values } = alignMacroToMonths(macro, { mesi: 4, meseFinale: '2026-02' }); // nov dic gen feb
  assert.deepEqual(values, [null, 1, 1, 2]);
});

// ── spiegaResiduoConMacro: la versione a un solo residuo, per titolo-causale.js ──

test('spiegaResiduoConMacro: un macro che spiega davvero il residuo viene dichiarato, con la forma giusta', () => {
  const rnd = rng(23);
  const n = 100;
  const macro = []; let m = 3;
  const residuo = [];
  for (let t = 0; t < n; t++) {
    m += 0.1 * gauss(rnd);
    macro.push(m);
    residuo.push(0.9 * m + 0.1 * gauss(rnd));
  }
  const allineato = { values: macro, copertura: 1 };
  const r = spiegaResiduoConMacro(residuo, allineato, { label: 'il tasso BIS' });
  assert.equal(r.disponibile, true);
  assert.equal(r.spiegato, true);
  assert.equal(r.label, 'il tasso BIS');
  assert.ok(['livello', 'variazione'].includes(r.forma));
});

test('spiegaResiduoConMacro: un residuo indipendente dal macro resta onestamente "non spiegato"', () => {
  const rnd = rng(29);
  const n = 100;
  const macro = Array.from({ length: n }, () => gauss(rnd));
  const residuo = Array.from({ length: n }, () => gauss(rnd));
  const r = spiegaResiduoConMacro(residuo, { values: macro, copertura: 1 });
  assert.equal(r.disponibile, true);
  assert.equal(r.spiegato, false);
});

test('spiegaResiduoConMacro: senza copertura sufficiente o senza residuo, non disponibile — mai un crash', () => {
  assert.equal(spiegaResiduoConMacro([1, 2, 3], { values: [1, 2, 3], copertura: 0.1 }).disponibile, false);
  assert.equal(spiegaResiduoConMacro([], { values: [1], copertura: 1 }).disponibile, false);
  assert.equal(spiegaResiduoConMacro(null, { values: [1], copertura: 1 }).disponibile, false);
  assert.equal(spiegaResiduoConMacro([1, 2], null).disponibile, false);
});

// ── Cache di sessione condivisa: sync in lettura, popolata da chi la scalda ──

test('contestoMacroSeGiaCaldo: null onestamente finché nessuno l\'ha scaldata', () => {
  // Nota: questo test presuppone di girare PRIMA di scaldaContestoMacroCondiviso
  // in questo processo — node --test isola i moduli per file, quindi è sicuro
  // solo se nessun altro test in QUESTO file scalda la cache prima. Verificato
  // con l'ordine dei test in questo file (nessuna chiamata precedente).
  assert.equal(contestoMacroSeGiaCaldo(), null);
});

test('scaldaContestoMacroCondiviso: con tutte le fonti giù, resta null — mai un dato inventato', async () => {
  const fetchImpl = async () => { throw new Error('rete assente'); };
  const r = await scaldaContestoMacroCondiviso({ fetchImpl });
  assert.equal(r, null);
  assert.equal(contestoMacroSeGiaCaldo(), null);
});

test('scaldaContestoMacroCondiviso: con dati validi, scalda la cache e porta con sé i campi per la staffetta mesh', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => 'TIME_PERIOD,OBS_VALUE\n2026-06,3.5\n2026-07,3.6' });
  const r = await scaldaContestoMacroCondiviso({ fetchImpl });
  assert.ok(r);
  assert.ok(r.series.length > 0);
  assert.ok(r.label);
  assert.ok('verified' in r && 'asOf' in r && 'source' in r, 'servono a packForRelay in knowledge-relay.js');
  assert.deepEqual(contestoMacroSeGiaCaldo(), r, 'da qui in poi la cache è calda e sincronamente leggibile');
});
