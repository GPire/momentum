import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTrustGraph, trustRank, trustedWitnesses, effectiveAnonymity,
  sybilDiagnosis, trustText, SOGLIA_VOTO,
} from './sybil-resistance.js';

const GIORNO = 86400000;
// Un gruppo con spese vere fra dispositivi veri.
const gruppo = (id, dispositivi, spese) => ({
  id, name: id,
  members: dispositivi.map((d, i) => ({ id: `m${i}`, name: d, claimedBy: d })),
  expenses: spese.map(([chiPaga, chiDeve, giorno]) => ({
    payer: `m${dispositivi.indexOf(chiPaga)}`,
    amount: 40,
    date: giorno * GIORNO,
    owed: Object.fromEntries(chiDeve.map((d) => [`m${dispositivi.indexOf(d)}`, 20])),
  })),
});

// Una storia vera: quattro persone che dividono spese per mesi.
const storiaVera = () => {
  const persone = ['me', 'anna', 'bruno', 'carla'];
  const spese = [];
  for (let g = 0; g < 120; g += 10) {
    spese.push(['me', ['anna', 'bruno'], g]);
    spese.push(['anna', ['me', 'carla'], g + 3]);
    spese.push(['bruno', ['me', 'carla'], g + 6]);
  }
  return gruppo('reale', persone, spese);
};

// ── Il grafo si costruisce solo su fatti attestati ──

test('un nome scritto a mano non è una persona che vota', () => {
  const g = {
    id: 'x', name: 'x',
    members: [{ id: 'm0', name: 'me', claimedBy: 'me' }, { id: 'm1', name: 'Luca' }],
    expenses: [{ payer: 'm0', amount: 10, date: 0, owed: { m1: 5 } }],
  };
  const grafo = buildTrustGraph([g], { me: 'me' });
  assert.equal(grafo.legami.length, 0, 'un membro senza dispositivo non crea un legame');
  assert.deepEqual(grafo.nodi, ['me']);
});

test('un gruppo con un solo dispositivo non attesta niente', () => {
  const g = gruppo('solo', ['me'], []);
  assert.equal(buildTrustGraph([g], { me: 'me' }).legami.length, 0);
});

test('una relazione lunga pesa più di una esplosa in un pomeriggio', () => {
  const lunga = gruppo('l', ['me', 'anna'], Array.from({ length: 10 }, (_, i) => ['me', ['anna'], i * 12]));
  const lampo = gruppo('f', ['me', 'zeta'], Array.from({ length: 10 }, () => ['me', ['zeta'], 0]));
  const a = buildTrustGraph([lunga], { me: 'me' }).legami[0];
  const b = buildTrustGraph([lampo], { me: 'me' }).legami[0];
  assert.equal(a.episodi, b.episodi, 'stesso numero di episodi');
  assert.ok(a.peso > b.peso * 1.5, `il tempo deve contare: ${a.peso} vs ${b.peso}`);
});

// ── L'ATTACCO, e cosa succede ──

test('MILLE IDENTITÀ FINTE DIETRO UN SOLO LEGAME VERO si spartiscono la fiducia di UN legame', () => {
  // L'attaccante ha davvero diviso una spesa con me (un legame vero), e ha
  // fabbricato 40 dispositivi che si "confermano" fra loro.
  const veri = storiaVera();
  const finti = Array.from({ length: 40 }, (_, i) => `s${i}`);
  const speseFinte = [];
  for (let i = 0; i < finti.length; i++) {
    for (let j = i + 1; j < Math.min(i + 5, finti.length); j++) speseFinte.push([finti[i], [finti[j]], i]);
  }
  const rete = gruppo('finta', finti, speseFinte);
  const ponte = gruppo('ponte', ['me', 's0'], [['me', ['s0'], 5]]);

  const grafo = buildTrustGraph([veri, rete, ponte], { me: 'me' });
  const cl = trustRank(grafo);

  const onesti = ['anna', 'bruno', 'carla'].map((p) => cl.rango.get(p) || 0);
  const fintiValori = finti.map((p) => cl.rango.get(p) || 0);
  const sommaFinti = fintiValori.reduce((a, b) => a + b, 0);

  assert.ok(Math.min(...onesti) > Math.max(...fintiValori),
    `il peggiore degli onesti (${Math.min(...onesti)}) deve battere il migliore dei finti (${Math.max(...fintiValori)})`);
  assert.ok(sommaFinti < onesti.reduce((a, b) => a + b, 0),
    'quaranta identità finte non devono valere più di tre persone vere');

  const t = trustedWitnesses([...finti, 'anna', 'bruno', 'carla'], cl);
  assert.ok(t.fidati.includes('anna') && t.fidati.includes('bruno'), 'le persone vere restano testimoni');
  assert.ok(t.fidati.filter((f) => f.startsWith('s')).length < 5,
    `troppi finti ammessi a testimoniare: ${t.fidati.filter((f) => f.startsWith('s')).length}`);
});

test('la firma dell\'attacco è misurabile: densi dentro, quasi scollegati da te', () => {
  const veri = storiaVera();
  const finti = Array.from({ length: 12 }, (_, i) => `s${i}`);
  const speseFinte = [];
  for (let i = 0; i < finti.length; i++) for (let j = i + 1; j < finti.length; j++) speseFinte.push([finti[i], [finti[j]], i]);
  const grafo = buildTrustGraph([veri, gruppo('f', finti, speseFinte), gruppo('p', ['me', 's0'], [['me', ['s0'], 1]])], { me: 'me' });
  const cl = trustRank(grafo);
  const d = sybilDiagnosis(grafo, cl);
  assert.equal(d.sospetto, true);
  assert.ok(d.conduttanza < 0.2, `conduttanza ${d.conduttanza}: pochissimi legami verso il resto del mondo`);
  assert.match(d.motivo, /stessa persona/);
});

test('una rete fatta solo di persone vere NON viene accusata di niente', () => {
  const grafo = buildTrustGraph([storiaVera()], { me: 'me' });
  const d = sybilDiagnosis(grafo, trustRank(grafo));
  assert.equal(d.sospetto, false);
  assert.match(d.motivo, /persone con cui hai una storia/);
});

// ── Il k-anonimato smette di contare identificatori ──

test('IL PUNTO CONCRETO: tre identità finte non fanno uscire un dato, tre persone sì', () => {
  const veri = storiaVera();
  const finti = ['s0', 's1', 's2'];
  const grafo = buildTrustGraph([
    veri,
    gruppo('f', finti, [['s0', ['s1'], 1], ['s1', ['s2'], 1], ['s2', ['s0'], 1]]),
    gruppo('p', ['me', 's0'], [['me', ['s0'], 1]]),
  ], { me: 'me' });
  const cl = trustRank(grafo);

  const conFinti = effectiveAnonymity(finti, cl, { k: 3 });
  assert.equal(conFinti.kDichiarato, 3);
  assert.equal(conFinti.sufficiente, false, 'tre id non sono tre persone');
  assert.ok(conFinti.gonfiato > 0);
  assert.match(conFinti.motivo, /persone con una storia vera/);

  const conVeri = effectiveAnonymity(['anna', 'bruno', 'carla'], cl, { k: 3 });
  assert.equal(conVeri.sufficiente, true, 'tre persone vere devono passare');
  assert.equal(conVeri.gonfiato, 0);
});

test('le origini ripetute non gonfiano il conteggio', () => {
  const grafo = buildTrustGraph([storiaVera()], { me: 'me' });
  const cl = trustRank(grafo);
  const r = effectiveAnonymity(['anna', 'anna', 'anna', 'bruno'], cl, { k: 3 });
  assert.equal(r.kDichiarato, 2, 'lo stesso dispositivo mille volte resta uno');
  assert.equal(r.sufficiente, false);
});

// ── Chi non ha ancora una storia non viene punito ──

test('un utente nuovo non viene escluso da niente di suo, e la cosa è dichiarata', () => {
  const grafo = buildTrustGraph([], { me: 'nuovo' });
  const cl = trustRank(grafo);
  assert.equal(cl.rango.size, 0);
  assert.match(cl.motivo, /non è in nessun gruppo condiviso/);
  // Non porta voti, ma non c'è nessun errore e nessun blocco.
  const t = trustedWitnesses(['a', 'b'], cl);
  assert.deepEqual(t.fidati, []);
  assert.match(t.motivo, /usano Momentum normalmente/);
});

test('chi è escluso dal voto è escluso SOLO dal voto: il testo lo dice', () => {
  const grafo = buildTrustGraph([storiaVera()], { me: 'me' });
  const t = trustedWitnesses(['sconosciuto'], trustRank(grafo));
  assert.match(t.motivo, /non contano come conferma/);
  assert.ok(!/blocc|espuls|banda|vietat/i.test(t.motivo), `linguaggio punitivo: ${t.motivo}`);
});

// ── Proprietà della misura ──

test('la fiducia è SOGGETTIVA: due persone diverse vedono classifiche diverse', () => {
  const g = buildTrustGraph([storiaVera()], { me: 'me' });
  const daMe = trustRank(g, { me: 'me' });
  const daCarla = trustRank(g, { me: 'carla' });
  assert.notEqual(daMe.rango.get('carla'), daCarla.rango.get('carla'));
  assert.ok((daCarla.rango.get('carla') || 0) > 0, 'ognuno parte da sé stesso');
});

test('chi ha più legami veri sta più in alto di chi ne ha uno solo', () => {
  const g = buildTrustGraph([
    storiaVera(),
    gruppo('occasionale', ['me', 'dario'], [['me', ['dario'], 3]]),
  ], { me: 'me' });
  const cl = trustRank(g);
  assert.ok((cl.rango.get('anna') || 0) > (cl.rango.get('dario') || 0));
});

test('la classifica non esplode su un grafo con un nodo isolato', () => {
  const g = buildTrustGraph([storiaVera()], { me: 'me' });
  g.nodi.push('isolato');
  const cl = trustRank(g);
  assert.equal(cl.rango.get('isolato'), 0);
  assert.ok(Number.isFinite(cl.media));
});

test('il testo esiste solo quando serve davvero, e non spaventa a vuoto', () => {
  const grafo = buildTrustGraph([storiaVera()], { me: 'me' });
  const cl = trustRank(grafo);
  assert.equal(trustText(sybilDiagnosis(grafo, cl), effectiveAnonymity(['anna', 'bruno', 'carla'], cl, { k: 3 })), null,
    'quando è tutto a posto non si dice niente');
  const t = trustText(null, { sufficiente: false, gonfiato: 4, kDichiarato: 5, kEffettivo: 1 });
  assert.match(t, /Ho tenuto dentro un dato/);
  assert.ok(!/Sybil|conduttanza|grafo|nodo/i.test(t), `gergo nel testo: ${t}`);
});

test('la soglia non è punitiva per default: la maggior parte delle persone vere passa', () => {
  const grafo = buildTrustGraph([storiaVera()], { me: 'me' });
  const cl = trustRank(grafo);
  const t = trustedWitnesses(['anna', 'bruno', 'carla'], cl, { soglia: SOGLIA_VOTO });
  assert.equal(t.fidati.length, 3);
});

// ── L'innesto nel cancello che protegge davvero ──

test('INNESTO: il k-anonimato smette di contare identificatori e comincia a contare persone', async () => {
  const { initLexiconPool, observeLexicon, eligibleLexicon, heldBackLexicon } = await import('./federated-distillation.js');
  const grafo = buildTrustGraph([storiaVera()], { me: 'me' });
  const cl = trustRank(grafo);
  const fidato = (id) => trustedWitnesses([id], cl).fidati.length === 1;

  // Tre identità fabbricate vedono lo stesso negozio.
  let pool = initLexiconPool();
  for (const finto of ['s0', 's1', 's2']) {
    pool = observeLexicon(pool, { token: 'bar da gino', category: 'Cibo', deviceId: finto, fidato: fidato(finto) });
  }
  assert.equal(eligibleLexicon(pool, { k: 3 }).length, 1, 'col vecchio conteggio uscirebbe');
  assert.equal(eligibleLexicon(pool, { k: 3, soloFidati: true }).length, 0, 'contando le persone, no');
  assert.equal(heldBackLexicon(pool, { k: 3, soloFidati: true })[0].mancano, 3);

  // Tre persone vere vedono lo stesso negozio: esce, come deve.
  let vero = initLexiconPool();
  for (const p of ['anna', 'bruno', 'carla']) {
    vero = observeLexicon(vero, { token: 'bar da gino', category: 'Cibo', deviceId: p, fidato: fidato(p) });
  }
  assert.equal(eligibleLexicon(vero, { k: 3, soloFidati: true }).length, 1);
});

test('INNESTO: senza grafo di fiducia il comportamento resta identico a prima', async () => {
  const { initLexiconPool, observeLexicon, eligibleLexicon } = await import('./federated-distillation.js');
  let pool = initLexiconPool();
  for (const d of ['d1', 'd2', 'd3']) pool = observeLexicon(pool, { token: 'x', category: 'Cibo', deviceId: d });
  assert.equal(eligibleLexicon(pool, { k: 3 }).length, 1, 'chi non usa la fiducia non deve accorgersi di niente');
});
