import test from 'node:test';
import assert from 'node:assert/strict';
import {
  residualize, partialCorrelationTest, benjaminiYekutieli,
  buildLaggedFrame, selectParents, discoverCausalGraph, comparePairwise,
} from './causal-discovery.js';

// Generatore deterministico: i test devono fallire per un bug, mai per fortuna.
function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; };
}
function gauss(rnd) {
  const u1 = Math.max(1e-9, rnd()), u2 = rnd();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ── Fondamenta ──

test('residualize toglie davvero la componente spiegata', () => {
  const z = Array.from({ length: 50 }, (_, i) => i);
  const y = z.map((v) => 3 * v + 7);
  const res = residualize(y, [z]);
  assert.ok(res.every((r) => Math.abs(r) < 1e-6), 'una relazione perfettamente lineare deve lasciare residui nulli');
});

test('residualize rifiuta i sistemi degeneri invece di inventare residui', () => {
  const z = Array.from({ length: 10 }, () => 1); // colonna costante = collineare con l'intercetta
  assert.equal(residualize([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [z]), null);
  assert.equal(residualize([1, 2], [[1, 2], [3, 4]]), null, 'più parametri che osservazioni');
});

test('il test di indipendenza produce un p-value vero, non una soglia', () => {
  const rnd = rng(7);
  const x = Array.from({ length: 200 }, () => gauss(rnd));
  const yIndip = Array.from({ length: 200 }, () => gauss(rnd));
  const yLegato = x.map((v) => 0.8 * v + 0.3 * gauss(rnd));

  const a = partialCorrelationTest(x, yIndip);
  const b = partialCorrelationTest(x, yLegato);
  assert.ok(a.p > 0.05, `serie indipendenti: atteso p alto, ottenuto ${a.p}`);
  assert.ok(b.p < 0.001, `serie legate: atteso p bassissimo, ottenuto ${b.p}`);
  assert.ok(Math.abs(b.r) > 0.8);
});

test('con troppe variabili di controllo per il campione si dichiara, non si tira a indovinare', () => {
  const t = partialCorrelationTest([1, 2, 3, 4], [4, 3, 2, 1], [[1, 1, 2, 2], [2, 1, 2, 1]]);
  assert.equal(t.p, null);
  assert.match(t.motivo, /campione troppo piccolo/);
});

// ── Correzione per test multipli ──

test('Benjamini-Yekutieli è più severo di una soglia nuda: il fattore armonico c\'è', () => {
  const ps = [0.001, 0.01, 0.03, 0.2, 0.5];
  const by = benjaminiYekutieli(ps, 0.05);
  assert.ok(by.c > 2, `con 5 test il fattore armonico deve essere >2, ottenuto ${by.c}`);
  assert.ok(by.rejected.has(0), 'il p-value più piccolo deve comunque passare');
  assert.ok(!by.rejected.has(3) && !by.rejected.has(4), 'i p-value alti non devono passare');
});

test('con 90 test tutti nulli, quasi nessuno viene dichiarato significativo', () => {
  const rnd = rng(3);
  const ps = Array.from({ length: 90 }, () => rnd()); // p-value uniformi = ipotesi nulla vera ovunque
  const by = benjaminiYekutieli(ps, 0.05);
  assert.ok(by.rejected.size <= 1, `attesi ~0 falsi positivi, ottenuti ${by.rejected.size}`);
});

// ── Struttura del frame ──

test('le variabili ritardate sono allineate correttamente al presente', () => {
  const frame = buildLaggedFrame({ A: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }, { maxLag: 2 });
  assert.deepEqual(frame.target.A, [3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(frame['lagged']['A@1'], [2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(frame['lagged']['A@2'], [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('una serie troppo corta non produce un frame utilizzabile', () => {
  const frame = buildLaggedFrame({ A: [1, 2, 3] }, { maxLag: 3 });
  assert.equal(frame.T, 0);
});

// ── IL TEST DECISIVO: il confondente comune ──
// Lo stipendio (Z) fa salire INSIEME ristoranti (X) e supermercato (Y).
// Non esiste alcun legame X → Y. Il metodo a coppie lo trova lo stesso: è
// l'errore che porta al consiglio sbagliato "taglia i ristoranti e risparmi
// al supermercato". Il metodo corretto deve NON trovarlo.
function datiConConfondente(n = 160, seed = 11) {
  const rnd = rng(seed);
  const Z = [], X = [], Y = [];
  let z = 0;
  for (let t = 0; t < n; t++) {
    z = 0.7 * z + gauss(rnd);           // driver autocorrelato: lo stipendio/ciclo del mese
    Z.push(z);
    X.push(0.9 * z + 0.5 * gauss(rnd)); // ristoranti seguono il driver
    Y.push(0.9 * z + 0.5 * gauss(rnd)); // supermercato segue lo stesso driver
  }
  // Sfasa X e Y di un periodo rispetto a Z per creare la struttura temporale.
  return { Stipendio: Z, Ristoranti: X, Supermercato: Y };
}

test('CONFONDENTE COMUNE: il metodo a coppie trova un legame FALSO', () => {
  const dati = datiConConfondente();
  const c = comparePairwise(dati, { maxLag: 2, alpha: 0.05 });
  const falso = c.pairwise.filter((l) =>
    (l.from === 'Ristoranti' && l.to === 'Supermercato') || (l.from === 'Supermercato' && l.to === 'Ristoranti'));
  assert.ok(falso.length > 0,
    'il test a coppie DEVE cascarci: è esattamente il difetto che stiamo correggendo');
});

test('CONFONDENTE COMUNE: il metodo corretto NON lo trova', () => {
  const dati = datiConConfondente();
  const g = discoverCausalGraph(dati, { maxLag: 2, alpha: 0.05 });
  const falso = g.links.filter((l) =>
    (l.from === 'Ristoranti' && l.to === 'Supermercato') || (l.from === 'Supermercato' && l.to === 'Ristoranti'));
  assert.equal(falso.length, 0,
    `nessun legame diretto tra le due categorie guidate dallo stesso driver, trovati: ${JSON.stringify(falso)}`);
});

test('il confronto quantifica quanti legami falsi vengono scartati', () => {
  const dati = datiConConfondente();
  const c = comparePairwise(dati, { maxLag: 2 });
  assert.ok(c.scartatiDalControllo > 0,
    'il numero di legami che il controllo elimina è l\'informazione più utile da mostrare');
});

// ── Nessuna causa: non se ne devono inventare ──

test('SERIE INDIPENDENTI: zero legami trovati (il test che le app di settore non passerebbero)', () => {
  const rnd = rng(23);
  const dati = {};
  for (const nome of ['Alimentari', 'Trasporti', 'Casa', 'Salute', 'Svago']) {
    // Ognuna autocorrelata (come le spese vere) ma senza alcun legame reciproco.
    let v = 0;
    dati[nome] = Array.from({ length: 150 }, () => { v = 0.6 * v + gauss(rnd); return v; });
  }
  const g = discoverCausalGraph(dati, { maxLag: 2, alpha: 0.05 });
  assert.equal(g.links.length, 0, `attesi zero legami, trovati: ${JSON.stringify(g.links)}`);
  assert.ok(g.testEseguiti > 20, 'devono essere stati eseguiti molti test');
});

// ── Una causa VERA va trovata ──

test('CAUSA REALE: un legame forte e ritardato viene trovato, con il ritardo giusto', () => {
  const rnd = rng(31);
  const n = 200;
  const A = [];
  let a = 0;
  for (let t = 0; t < n; t++) { a = 0.3 * a + gauss(rnd); A.push(a); }
  // B dipende da A con ritardo 1, forte.
  const B = A.map((_, t) => (t >= 1 ? 1.2 * A[t - 1] + 0.4 * gauss(rnd) : gauss(rnd)));

  const g = discoverCausalGraph({ Uscite: A, Rimborsi: B }, { maxLag: 3, alpha: 0.05 });
  const trovato = g.links.find((l) => l.from === 'Uscite' && l.to === 'Rimborsi');
  assert.ok(trovato, `il legame vero doveva essere trovato: ${JSON.stringify(g.links)}`);
  assert.equal(trovato.lag, 1, `atteso ritardo 1, trovato ${trovato.lag}`);
  assert.ok(trovato.p < 0.01);
});

test('la direzione conta: non deve comparire il legame all\'indietro', () => {
  const rnd = rng(41);
  const n = 200;
  const A = []; let a = 0;
  for (let t = 0; t < n; t++) { a = 0.3 * a + gauss(rnd); A.push(a); }
  const B = A.map((_, t) => (t >= 1 ? 1.2 * A[t - 1] + 0.4 * gauss(rnd) : gauss(rnd)));
  const g = discoverCausalGraph({ Uscite: A, Rimborsi: B }, { maxLag: 3, alpha: 0.05 });
  const indietro = g.links.find((l) => l.from === 'Rimborsi' && l.to === 'Uscite');
  assert.ok(!indietro, `non doveva trovare il legame inverso: ${JSON.stringify(indietro)}`);
});

// ── Onestà sui dati insufficienti ──

test('con pochi periodi non si emette un grafo: si dice quanti ne servono', () => {
  const g = discoverCausalGraph({ A: [1, 2, 3, 4, 5, 6], B: [2, 3, 4, 5, 6, 7] }, { maxLag: 2, minSamples: 12 });
  assert.equal(g.affidabile, false);
  assert.deepEqual(g.links, []);
  assert.match(g.motivo, /Servono almeno 12 periodi/);
});

test('il risultato dichiara sempre quanti test sono stati fatti e con quale correzione', () => {
  const dati = datiConConfondente(120, 5);
  const g = discoverCausalGraph(dati, { maxLag: 2 });
  assert.ok(g.testEseguiti > 0);
  assert.equal(g.correzione.metodo, 'Benjamini-Yekutieli');
  assert.ok(g.correzione.fattore > 1, 'il fattore di correzione deve essere dichiarato');
});
