import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { buildCategorySeries, buildCausalGraph, propagateImpact, explainChain, pruneNonCausal } = await import('./causal-graph.js');

const REF = new Date(2026, 6, 6); // lunedì 6 luglio 2026

// Storia sintetica con nesso VERO incorporato: nelle settimane "sociali"
// salgono INSIEME Ristorante e Trasporti (esci a cena → taxi), e la
// settimana DOPO sale Farmacia. Alimentari resta costante (nessun legame).
function syntheticHistory() {
  const allTx = {};
  const add = (date, amount, category) => {
    const mk = date.slice(0, 7);
    (allTx[mk] = allTx[mk] || []).push({ date, amount, category, type: 'uscita', description: category });
  };
  const monday0 = new Date(2026, 0, 5); // lunedì 5 gen 2026, ~26 settimane prima di REF
  for (let w = 0; w < 25; w++) {
    const d = new Date(monday0.getTime() + w * 7 * 86_400_000 + 2 * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    const social = w % 2 === 0; // settimane alterne: alta/bassa vita sociale
    add(iso, social ? 120 : 30, 'Ristorante');
    add(iso, social ? 60 : 15, 'Trasporti');
    add(iso, 80, 'Alimentari'); // piatto: nessuna informazione
    // Farmacia segue la settimana DOPO quella sociale
    const prevSocial = w > 0 && (w - 1) % 2 === 0;
    add(iso, prevSocial ? 40 : 10, 'Farmacia');
  }
  return allTx;
}

test('buildCategorySeries: serie settimanali complete e allineate', () => {
  const s = buildCategorySeries(syntheticHistory(), REF, 26);
  assert.ok(s['Ristorante']);
  assert.equal(s['Ristorante'].length, 26);
  assert.ok(s['Ristorante'].some(v => v === 120) && s['Ristorante'].some(v => v === 30));
});

test('buildCausalGraph: trova il legame stessa-settimana Ristorante↔Trasporti', () => {
  const links = buildCausalGraph(syntheticHistory(), REF);
  const same = links.find(l => l.lagWeeks === 0 && ((l.from === 'Ristorante' && l.to === 'Trasporti') || (l.from === 'Trasporti' && l.to === 'Ristorante')));
  assert.ok(same, 'legame lag-0 mancante');
  assert.ok(same.r > 0.8, `r atteso alto, trovato ${same?.r}`);
});

test('buildCausalGraph: trova il legame ritardato Ristorante → Farmacia (settimana dopo)', () => {
  const links = buildCausalGraph(syntheticHistory(), REF);
  const lagged = links.find(l => l.lagWeeks === 1 && l.from === 'Ristorante' && l.to === 'Farmacia');
  assert.ok(lagged, 'legame lag-1 mancante');
  assert.ok(lagged.r > 0.8);
  assert.equal(lagged.direction, 'settimana dopo');
});

test('buildCausalGraph: la categoria piatta (Alimentari) NON entra nel grafo', () => {
  const links = buildCausalGraph(syntheticHistory(), REF);
  assert.equal(links.filter(l => l.from === 'Alimentari' || l.to === 'Alimentari').length, 0);
});

test('propagateImpact: toccare Ristorante muove i vicini, con percorso spiegato', () => {
  const links = buildCausalGraph(syntheticHistory(), REF);
  const effects = propagateImpact(links, 'Ristorante', 50); // +50% su Ristorante
  const trasporti = effects.find(e => e.category === 'Trasporti');
  const farmacia = effects.find(e => e.category === 'Farmacia');
  assert.ok(trasporti && trasporti.expectedPct > 20, 'effetto su Trasporti mancante');
  assert.ok(farmacia && farmacia.lagWeeks >= 1, 'effetto ritardato su Farmacia mancante');
  assert.deepEqual(trasporti.path[0], 'Ristorante'); // il percorso spiega il perché
});

test('propagateImpact: effetti sotto soglia scartati, niente rumore', () => {
  const links = [{ from: 'A', to: 'B', lagWeeks: 0, r: 0.06, samples: 20, direction: 'insieme' }];
  assert.equal(propagateImpact(links, 'A', 50).length, 0); // 50×0.06 = 3% < soglia 5%
});

test('propagateImpact: nessun ciclo infinito su grafi circolari', () => {
  const links = [
    { from: 'A', to: 'B', lagWeeks: 0, r: 0.9, samples: 20, direction: 'insieme' },
    { from: 'B', to: 'A', lagWeeks: 0, r: 0.9, samples: 20, direction: 'insieme' },
  ];
  const effects = propagateImpact(links, 'A', 50);
  assert.equal(effects.length, 1); // solo B: il ritorno su A è bloccato
});

test('buildCausalGraph maxLag>1: cattura effetto ritardato a 2 settimane', () => {
  // Farmacia segue Ristorante con 2 settimane di ritardo (lag variabile)
  const REF2 = new Date('2026-07-06');
  const allTx = {};
  const push = (dateStr, cat, amt) => { const mk = dateStr.slice(0,7); (allTx[mk] = allTx[mk] || []).push({ date: dateStr, type: 'uscita', category: cat, amount: amt }); };
  // 16 settimane: Ristorante oscilla, Farmacia copia con 2 settimane di ritardo
  const rist = [50,120,60,140,55,130,65,150,50,120,60,140,55,130,65,150];
  for (let w = 0; w < rist.length; w++) {
    const d = new Date('2026-03-16'); d.setDate(d.getDate() + w*7);
    const ds = d.toISOString().slice(0,10);
    push(ds, 'Ristorante', rist[w]);
    if (w >= 2) push(ds, 'Farmacia', rist[w-2]); // stessa forma, +2 settimane
  }
  const links = buildCausalGraph(allTx, REF2, { maxLag: 3, minWeeks: 6, minR: 0.5 });
  const lagged = links.find(l => l.from === 'Ristorante' && l.to === 'Farmacia' && l.lagWeeks >= 1);
  assert.ok(lagged, 'legame ritardato Ristorante→Farmacia non trovato');
});

test('explainChain: narrazione "se A allora B, e forse C" col caveat', () => {
  const links = [
    { from: 'A', to: 'B', lagWeeks: 0, r: 0.9, samples: 20, direction: 'insieme' },
    { from: 'B', to: 'C', lagWeeks: 1, r: 0.7, samples: 20, direction: 'settimana dopo' },
  ];
  const { text, steps } = explainChain(links, 'A', 50);
  assert.ok(steps.length >= 1);
  assert.ok(/correlazione/i.test(text)); // caveat presente
  assert.ok(/Se A sale/i.test(text));
});

// ---- pruneNonCausal (Wave 14 v10): euristica di precedenza ----

test('pruneNonCausal: archi simmetrici (lagWeeks=0) passano invariati', () => {
  const links = [{ from: 'A', to: 'B', lagWeeks: 0, r: 0.8, samples: 20, direction: 'insieme' }];
  const out = pruneNonCausal(links);
  assert.deepEqual(out, links);
});

test('pruneNonCausal: quando entrambe le direzioni (stesso lag) superano la soglia, tiene solo la più forte', () => {
  const links = [
    { from: 'A', to: 'B', lagWeeks: 1, r: 0.55, samples: 20, direction: 'settimana dopo' },
    { from: 'B', to: 'A', lagWeeks: 1, r: 0.82, samples: 20, direction: 'settimana dopo' },
  ];
  const out = pruneNonCausal(links);
  assert.equal(out.length, 1, 'una sola direzione deve sopravvivere');
  assert.equal(out[0].from, 'B');
  assert.equal(out[0].to, 'A');
});

test('pruneNonCausal: una sola direzione osservata resta intatta (nessuna ambiguità da risolvere)', () => {
  const links = [{ from: 'A', to: 'B', lagWeeks: 1, r: 0.6, samples: 20, direction: 'settimana dopo' }];
  const out = pruneNonCausal(links);
  assert.deepEqual(out, links);
});

test('pruneNonCausal: coppie/lag diversi restano indipendenti (nessuna contaminazione tra lag)', () => {
  const links = [
    { from: 'A', to: 'B', lagWeeks: 1, r: 0.6, samples: 20, direction: 'settimana dopo' },
    { from: 'B', to: 'A', lagWeeks: 2, r: 0.7, samples: 18, direction: 'dopo 2 settimane' },
  ];
  const out = pruneNonCausal(links);
  assert.equal(out.length, 2, 'lag diversi non sono la stessa ambiguità, entrambi restano');
});

test('pruneNonCausal: input vuoto non esplode', () => {
  assert.deepEqual(pruneNonCausal([]), []);
  assert.deepEqual(pruneNonCausal(undefined), []);
});

test('pruneNonCausal: propagateImpact su un grafo pulito non produce piu\' rumore del grafo grezzo', () => {
  const raw = [
    { from: 'Ristorante', to: 'Trasporti', lagWeeks: 1, r: 0.55, samples: 20, direction: 'settimana dopo' },
    { from: 'Trasporti', to: 'Ristorante', lagWeeks: 1, r: 0.85, samples: 20, direction: 'settimana dopo' },
  ];
  const cleaned = pruneNonCausal(raw);
  const rawEffects = propagateImpact(raw, 'Trasporti', 20);
  const cleanEffects = propagateImpact(cleaned, 'Trasporti', 20);
  // sul grafo grezzo il link debole Ristorante→Trasporti non tocca 'Trasporti' come from,
  // quindi qui la differenza pratica si vede quando si parte da 'Ristorante':
  const rawFromRist = propagateImpact(raw, 'Ristorante', 20);
  const cleanFromRist = propagateImpact(cleaned, 'Ristorante', 20);
  assert.ok(cleanFromRist.length <= rawFromRist.length, 'il grafo pulito non deve produrre più effetti del grezzo');
});
