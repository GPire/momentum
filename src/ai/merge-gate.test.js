'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMerge, TOLLERANZA_PASSO, TETTO_DERIVA, MIN_VERIFICA, evaluateMergePerCategoria, SOGLIA_NAT_PER_CAT, MIN_ESEMPI_PER_CAT } from './merge-gate.js';

const V = 20; // esempi di verifica sufficienti

test('un merge che MIGLIORA viene accettato e abbassa l\'ancora', () => {
  const r = evaluateMerge({ lossBefore: 1.0, lossAfter: 0.8, bestLoss: 1.0, validationSize: V });
  assert.equal(r.accept, true);
  assert.equal(r.nuovoBest, 0.8);
  assert.match(r.reason, /migliora/);
});

test('un merge chiaramente peggiorativo viene rifiutato', () => {
  const r = evaluateMerge({ lossBefore: 1.0, lossAfter: 1.5, bestLoss: 1.0, validationSize: V });
  assert.equal(r.accept, false);
  assert.match(r.reason, /peggiora le tue previsioni/);
});

test('il rumore di misura non blocca tutto: un peggioramento minimo passa', () => {
  const r = evaluateMerge({ lossBefore: 1.0, lossAfter: 1.01, bestLoss: 1.0, validationSize: V });
  assert.equal(r.accept, true, 'un cancello troppo rigido impedirebbe di imparare qualunque cosa');
});

// ── IL DIFETTO PRINCIPALE: l'avvelenamento LENTO ──
test('AVVELENAMENTO LENTO: 20 merge ognuno appena sotto la vecchia soglia vengono FERMATI', () => {
  // Ogni singolo passo peggiora del 9%: con la vecchia regola (rifiuta solo
  // oltre +10%) passavano tutti, e il modello finiva 6,6 volte peggiore.
  let loss = 1.0;
  let best = 1.0;
  let accettati = 0;
  for (let i = 0; i < 20; i++) {
    const dopo = loss * 1.09;
    const r = evaluateMerge({ lossBefore: loss, lossAfter: dopo, bestLoss: best, validationSize: V });
    if (!r.accept) break;
    accettati++;
    loss = dopo;
    best = r.nuovoBest;
  }
  assert.ok(accettati <= 2, `l'avvelenamento lento deve fermarsi quasi subito, accettati ${accettati}`);
  assert.ok(loss < 1.16, `il degrado complessivo resta sotto il tetto, arrivato a ${loss.toFixed(2)}x`);
});

test('AVVELENAMENTO LENTO estremo: 1000 tentativi non spostano il modello oltre il tetto', () => {
  let loss = 1.0, best = 1.0, accettati = 0;
  for (let i = 0; i < 1000; i++) {
    const dopo = loss * 1.019; // sotto la tolleranza del passo singolo
    const r = evaluateMerge({ lossBefore: loss, lossAfter: dopo, bestLoss: best, validationSize: V });
    if (!r.accept) continue;
    accettati++; loss = dopo; best = r.nuovoBest;
  }
  assert.ok(loss <= TETTO_DERIVA + 0.02, `mille passi piccoli non devono sommare: arrivato a ${loss.toFixed(3)}x`);
});

test('l\'ancora NON scivola: migliorare e poi peggiorare non sposta il riferimento verso il peggio', () => {
  // Si migliora fino a 0.5, poi si tenta di risalire a piccoli passi.
  let best = 0.5, loss = 0.5;
  for (let i = 0; i < 50; i++) {
    const dopo = loss * 1.019;
    const r = evaluateMerge({ lossBefore: loss, lossAfter: dopo, bestLoss: best, validationSize: V });
    if (!r.accept) continue;
    loss = dopo; best = r.nuovoBest;
  }
  assert.ok(loss <= 0.5 * TETTO_DERIVA + 0.01,
    'il tetto si misura sul MIGLIORE mai avuto, non sull\'ultimo: altrimenti basterebbe salire piano');
});

// ── IL SECONDO DIFETTO: l'accettazione alla cieca ──
test('SENZA abbastanza esempi di verifica NON si accetta (prima passava alla cieca)', () => {
  for (const n of [0, 1, 4]) {
    const r = evaluateMerge({ lossBefore: 1.0, lossAfter: 0.1, bestLoss: 1.0, validationSize: n });
    assert.equal(r.accept, false, `con ${n} esempi non si puo' giudicare`);
    assert.match(r.reason, /almeno 5 esempi/);
  }
});

test('un dispositivo NUOVO non e\' la porta d\'ingresso: nemmeno un modello che sembra ottimo entra', () => {
  // Uno "splendido" modello proposto a un dispositivo appena installato:
  // e' esattamente lo scenario che un attaccante costruirebbe.
  const r = evaluateMerge({ lossBefore: 1.0, lossAfter: 0.001, bestLoss: null, validationSize: 2 });
  assert.equal(r.accept, false, 'sembrare ottimo non e\' una prova quando non hai come verificarlo');
});

test('raggiunta la soglia di verifica, il dispositivo torna a poter imparare dagli altri', () => {
  const r = evaluateMerge({ lossBefore: 1.0, lossAfter: 0.7, bestLoss: null, validationSize: MIN_VERIFICA });
  assert.equal(r.accept, true);
});

test('misure non numeriche -> rifiuto, mai un merge "al buio" travestito da errore', () => {
  assert.equal(evaluateMerge({ lossBefore: NaN, lossAfter: 1, validationSize: V }).accept, false);
  assert.equal(evaluateMerge({ lossBefore: 1, lossAfter: undefined, validationSize: V }).accept, false);
  assert.equal(evaluateMerge({}).accept, false);
});

test('prima volta (nessun best noto): si usa la loss attuale come ancora', () => {
  const r = evaluateMerge({ lossBefore: 2.0, lossAfter: 1.5, bestLoss: null, validationSize: V });
  assert.equal(r.accept, true);
  assert.equal(r.ancora, 2.0);
  assert.equal(r.nuovoBest, 1.5);
});

test('CONFRONTO COL VECCHIO CANCELLO: dove quello cedeva, questo tiene', () => {
  // Vecchia regola: accetta finche' lossAfter <= lossBefore * 1.1
  const vecchio = (before, after) => after <= before * 1.1;
  let lossVecchio = 1.0, lossNuovo = 1.0, best = 1.0;
  for (let i = 0; i < 15; i++) {
    const passoV = lossVecchio * 1.09;
    if (vecchio(lossVecchio, passoV)) lossVecchio = passoV;
    const passoN = lossNuovo * 1.09;
    const r = evaluateMerge({ lossBefore: lossNuovo, lossAfter: passoN, bestLoss: best, validationSize: V });
    if (r.accept) { lossNuovo = passoN; best = r.nuovoBest; }
  }
  assert.ok(lossVecchio > 3, `il vecchio cancello lasciava degradare fino a ${lossVecchio.toFixed(2)}x`);
  assert.ok(lossNuovo < 1.2, `il nuovo tiene a ${lossNuovo.toFixed(2)}x`);
});

// ── evaluateMergePerCategoria: il buco che l'aggregato da solo non vede ──

test('per-categoria: IL CASO REALE che il cancello aggregato lascerebbe passare — una categoria rara devastata, annegata dalle altre nella media', () => {
  // 27 esempi "spesa" quasi invariati, 3 "salute" devastati: la media pesata
  // sull'insieme resta quasi piatta (la categoria rara pesa poco), ma
  // "salute" specificamente è da rifiutare.
  const perCatBefore = { spesa: { loss: 0.10, n: 27 }, salute: { loss: 0.20, n: 3 } };
  const perCatAfter = { spesa: { loss: 0.09, n: 27 }, salute: { loss: 3.5, n: 3 } };
  const r = evaluateMergePerCategoria({ perCatBefore, perCatAfter });
  assert.equal(r.accept, false);
  assert.equal(r.categoria, 'salute');
  assert.match(r.reason, /salute/);
});

test('per-categoria: nessuna categoria peggiora oltre soglia -> accettato', () => {
  const perCatBefore = { spesa: { loss: 0.10, n: 27 }, casa: { loss: 0.30, n: 10 } };
  const perCatAfter = { spesa: { loss: 0.11, n: 27 }, casa: { loss: 0.35, n: 10 } };
  const r = evaluateMergePerCategoria({ perCatBefore, perCatAfter });
  assert.equal(r.accept, true);
});

test(`per-categoria: sotto ${MIN_ESEMPI_PER_CAT} esempi non si giudica QUELLA categoria (troppo rumore per fidarsi)`, () => {
  const perCatBefore = { crypto: { loss: 0.1, n: 2 } }; // sotto la soglia minima
  const perCatAfter = { crypto: { loss: 9.0, n: 2 } }; // peggiora moltissimo, ma non abbastanza dati per giudicarlo
  const r = evaluateMergePerCategoria({ perCatBefore, perCatAfter });
  assert.equal(r.accept, true, 'con solo 2 esempi non si può distinguere un vero peggioramento dal rumore');
});

test('per-categoria: soglia in NAT assoluti, non solo rapporto — un salto minuscolo in valore assoluto non fa scattare il rifiuto anche se il "rapporto" sembra grande', () => {
  const perCatBefore = { etf: { loss: 0.001, n: 10 } };
  const perCatAfter = { etf: { loss: 0.01, n: 10 } }; // 10x in rapporto, ma +0,009 nat: trascurabile
  const r = evaluateMergePerCategoria({ perCatBefore, perCatAfter });
  assert.equal(r.accept, true);
});

test('per-categoria: senza perCatBefore/perCatAfter (nexus senza validatePerCategoria) accetta senza giudicare — mai un crash', () => {
  assert.equal(evaluateMergePerCategoria({}).accept, true);
  assert.equal(evaluateMergePerCategoria({ perCatBefore: null, perCatAfter: null }).accept, true);
});

test('per-categoria: una categoria nuova solo nel "dopo" (il merge l\'ha portata) non è motivo di rifiuto — può solo migliorare, mai peggiorare qualcosa che prima non esisteva', () => {
  const perCatBefore = { spesa: { loss: 0.1, n: 27 } };
  const perCatAfter = { spesa: { loss: 0.1, n: 27 }, salute: { loss: 5.0, n: 4 } };
  const r = evaluateMergePerCategoria({ perCatBefore, perCatAfter });
  assert.equal(r.accept, true);
});
