import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mediana, quantile, statiMensili, simili, rendimentoFuturo,
  testBlocchi, previsioneCondizionata, testoPrevisione, MIN_CASI,
} from './previsione-condizionata.js';
import { SERIE_STORICHE } from './historical-returns.js';

const SPY = SERIE_STORICHE.spy.rendimenti;
// Generatore riproducibile: un test che dipende da Math.random e' un test che
// prima o poi fallisce da solo e fa perdere fiducia in tutta la suite.
const seme = (s) => () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

test('mediana e quantili ignorano i valori non finiti invece di propagarli', () => {
  assert.equal(mediana([1, 2, 3, NaN, undefined]), 2);
  assert.equal(mediana([]), null);
  assert.equal(quantile([0, 10], 0.5), 5);
});

test('i primi mesi non hanno uno stato: senza un anno di storia non si inventa', () => {
  const stati = statiMensili(SPY, { finestra: 12 });
  assert.equal(stati.length, SPY.length);
  for (let i = 0; i < 12; i++) assert.equal(stati[i], null);
  assert.ok(stati[12] && Number.isFinite(stati[12].calo));
});

test('il calo dal massimo non e mai positivo (si misura da un picco, non da un minimo)', () => {
  for (const s of statiMensili(SPY, { finestra: 12 }).filter(Boolean)) {
    assert.ok(s.calo <= 1e-12, `calo positivo: ${s.calo}`);
  }
});

test('rendimentoFuturo restituisce null se la storia finisce prima (mai un orizzonte troncato)', () => {
  const r = [0.01, 0.02, 0.03];
  assert.ok(Math.abs(rendimentoFuturo(r, 0, 2) - (1.02 * 1.03 - 1)) < 1e-12);
  assert.equal(rendimentoFuturo(r, 1, 5), null);
  assert.equal(rendimentoFuturo(r, 2, 1), null);
});

test('con pochi casi simili si RIFIUTA invece di produrre una percentuale', () => {
  const r = previsioneCondizionata(SPY, {
    orizzonte: 12, rng: seme(1), permutazioni: 99,
    // Uno stato che nell'archivio non esiste quasi: guadagno enorme e calma
    // totale insieme.
    statoCorrente: { calo: -0.0001, rendimentoAnno: 1.8, volatilita: 0.002 },
    tolleranza: 0.2,
  });
  assert.equal(r.disponibile, false);
  assert.ok(r.casi < MIN_CASI);
  assert.match(r.motivo, /aneddoto/);
});

test('serie troppo corta: si dichiara invece di calcolare su nulla', () => {
  const r = previsioneCondizionata([0.01, 0.02], { orizzonte: 3 });
  assert.equal(r.disponibile, false);
  assert.match(r.motivo, /almeno 13 mesi/);
});

// ── IL CUORE DEL MODULO ──
test('LA TRAPPOLA DELLA SOVRAPPOSIZIONE: il test ingenuo esagera di cento volte', () => {
  // Stesso effetto, stessi dati: cambia solo se le finestre sovrapposte
  // vengono trattate come indipendenti. E' la ragione per cui questo modulo
  // esiste nella forma in cui e' scritto.
  const orizzonte = 12;
  const stati = statiMensili(SPY, { finestra: 12 });
  const crisi = { calo: -0.28, rendimentoAnno: -0.22, volatilita: 0.06 };
  const idx = simili(stati, crisi, { tolleranza: 1.0 })
    .map((s) => s.indice)
    .filter((i) => Number.isFinite(rendimentoFuturo(SPY, i, orizzonte)));
  const futuri = SPY.map((_, i) => rendimentoFuturo(SPY, i, orizzonte));

  const blocchi = testBlocchi(futuri, idx, orizzonte, { permutazioni: 1999, rng: seme(7) });
  const ingenuo = testBlocchi(futuri, idx, 1, { permutazioni: 1999, rng: seme(7) });

  // L'effetto misurato e' identico: cambia SOLO la significativita'.
  assert.equal(blocchi.differenzaMediana, ingenuo.differenzaMediana);
  assert.ok(blocchi.differenzaMediana < -10, 'l\'effetto grezzo e grande');
  assert.equal(ingenuo.informativo, true, 'il test ingenuo grida al risultato');
  assert.equal(blocchi.informativo, false, 'quello corretto non lo conferma');
  assert.ok(blocchi.p > ingenuo.p * 20, `p a blocchi ${blocchi.p} vs ingenuo ${ingenuo.p}`);
  // Il numero che spiega tutto: due prove indipendenti, non ventisette.
  assert.ok(blocchi.casiEfficaci <= 3, `casi efficaci: ${blocchi.casiEfficaci}`);
});

test('sui dati veri di oggi: si dichiara che lo stato attuale NON informa', () => {
  const r = previsioneCondizionata(SPY, { orizzonte: 12, rng: seme(42), permutazioni: 499 });
  assert.equal(r.disponibile, true);
  assert.equal(r.test.informativo, false);
  assert.match(testoPrevisione(r), /NON cambia in modo distinguibile/);
});

test('i casi efficaci sono sempre molto meno dei casi apparenti su orizzonti lunghi', () => {
  const r = previsioneCondizionata(SPY, { orizzonte: 12, rng: seme(3), permutazioni: 199 });
  assert.ok(r.test.casiEfficaci < r.casi / 5, `${r.test.casiEfficaci} vs ${r.casi}`);
  assert.ok(r.avvisi.some((a) => /sovrappongono/.test(a)));
});

test('la distribuzione e coerente: quartili ordinati dentro il minimo e il massimo', () => {
  const r = previsioneCondizionata(SPY, { orizzonte: 6, rng: seme(11), permutazioni: 199 });
  const c = r.condizionata;
  assert.ok(c.peggiore <= c.primoQuartile);
  assert.ok(c.primoQuartile <= c.mediana);
  assert.ok(c.mediana <= c.terzoQuartile);
  assert.ok(c.terzoQuartile <= c.migliore);
  assert.ok(c.quotaPositivi >= 0 && c.quotaPositivi <= 100);
});

test('il testo non promette il futuro e non suggerisce mosse', () => {
  const t = testoPrevisione(previsioneCondizionata(SPY, { orizzonte: 12, rng: seme(5), permutazioni: 199 }));
  assert.ok(!/\b(compra|vendi|conviene|ti consiglio|dovresti|salira|scendera|prevedo)\b/i.test(t), t);
  assert.match(t, /non e' una previsione/i);
  assert.match(t, /prove davvero indipendenti/);
});

test('la forbice viene mostrata sempre, anche quando la mediana e positiva', () => {
  const r = previsioneCondizionata(SPY, { orizzonte: 12, rng: seme(9), permutazioni: 199 });
  const t = testoPrevisione(r);
  assert.ok(t.includes(`${r.condizionata.peggiore}%`), 'il caso peggiore deve comparire nel testo');
  assert.ok(t.includes(`${r.condizionata.migliore}%`));
});
