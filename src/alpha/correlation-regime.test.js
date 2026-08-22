import test from 'node:test';
import assert from 'node:assert/strict';
import {
  finestreCorrelazione, distanzaFrobenius, serieDistanzeStrutturali,
  rilevaCambiRegime, mds2D, mappaRegimi, testoRegimeStrutturale,
  LARGHEZZA_DEFAULT, K_SOGLIA, dataDiIndiceMese,
} from './correlation-regime.js';
import { PANNELLO_SETTORI } from './historical-panel.js';

// ── finestreCorrelazione ──

test('finestreCorrelazione: una finestra per ogni mese in cui la finestra è piena, matrici simmetriche con diagonale 1', () => {
  const nMesi = Math.min(...PANNELLO_SETTORI.map((s) => s.r.length));
  const f = finestreCorrelazione(PANNELLO_SETTORI, 24);
  assert.equal(f.length, nMesi - 24 + 1);
  const m = f[0].matrice;
  for (let i = 0; i < m.length; i++) {
    assert.ok(Math.abs(m[i][i] - 1) < 1e-9, 'diagonale deve essere 1');
    for (let j = 0; j < m.length; j++) assert.ok(Math.abs(m[i][j] - m[j][i]) < 1e-12, 'deve essere simmetrica');
  }
});

test('finestreCorrelazione: le date sono coerenti con dataDiIndiceMese', () => {
  const f = finestreCorrelazione(PANNELLO_SETTORI, 24);
  assert.equal(f[0].mese, dataDiIndiceMese(23));
});

// ── distanzaFrobenius ──

test('distanzaFrobenius: una matrice contro sé stessa è zero', () => {
  const m = [[1, 0.5, 0.2], [0.5, 1, 0.3], [0.2, 0.3, 1]];
  assert.equal(distanzaFrobenius(m, m), 0);
});

test('distanzaFrobenius: esempio a mano — una sola entrata cambiata di 0.2', () => {
  const m1 = [[1, 0.5], [0.5, 1]];
  const m2 = [[1, 0.7], [0.7, 1]];
  assert.ok(Math.abs(distanzaFrobenius(m1, m2) - 0.2) < 1e-9);
});

test('distanzaFrobenius: simmetrica', () => {
  const m1 = [[1, 0.1, 0.4], [0.1, 1, -0.2], [0.4, -0.2, 1]];
  const m2 = [[1, 0.6, -0.1], [0.6, 1, 0.5], [-0.1, 0.5, 1]];
  assert.equal(distanzaFrobenius(m1, m2), distanzaFrobenius(m2, m1));
});

// ── serieDistanzeStrutturali ──

test('serieDistanzeStrutturali: una distanza in meno delle finestre, tutte >= 0', () => {
  const f = finestreCorrelazione(PANNELLO_SETTORI, 24);
  const d = serieDistanzeStrutturali(f);
  assert.equal(d.length, f.length - 1);
  for (const x of d) assert.ok(x.distanza >= 0);
});

// ── rilevaCambiRegime ──

test('rilevaCambiRegime: con troppo poche finestre si dichiara, non si inventa una soglia', () => {
  const pannelloCorto = PANNELLO_SETTORI.map((s) => ({ ...s, r: s.r.slice(0, 26) })); // 26 mesi, finestra 24 -> 3 finestre < MIN_FINESTRE
  const r = rilevaCambiRegime(pannelloCorto, { larghezza: 24 });
  assert.equal(r.disponibile, false);
  assert.match(r.motivo, /almeno/);
});

test('rilevaCambiRegime: sul pannello vero, la soglia è media + K deviazioni della serie stessa', () => {
  const r = rilevaCambiRegime(PANNELLO_SETTORI, { larghezza: LARGHEZZA_DEFAULT });
  assert.ok(r.disponibile);
  assert.ok(Math.abs(r.soglia - (r.distanzaMedia + K_SOGLIA * r.distanzaDeviazione)) < 1e-6);
  for (const c of r.cambi) assert.ok(c.distanza >= r.soglia - 1e-9);
});

test('rilevaCambiRegime: individua la crisi 2008 (episodio noto) fra i cambi rilevati', () => {
  const r = rilevaCambiRegime(PANNELLO_SETTORI, { larghezza: LARGHEZZA_DEFAULT });
  const anni2008 = r.cambi.some((c) => c.mese.startsWith('2008'));
  assert.ok(anni2008, `attesa almeno una anomalia nel 2008, trovati: ${r.cambi.map((c) => c.mese).join(', ')}`);
});

test('rilevaCambiRegime: una serie piatta (correlazioni identiche ogni mese) non trova nessun cambio', () => {
  // 9 serie IDENTICHE fra loro ma variabili nel tempo: la correlazione fra
  // loro resta sempre 1 in ogni finestra -> distanza zero ovunque -> nessun
  // cambio possibile per costruzione (non per fortuna).
  const base = Array.from({ length: 60 }, (_, i) => Math.sin(i / 3) * 0.02);
  const pannelloPiatto = Array.from({ length: 9 }, (_, k) => ({ simbolo: `X${k}`, nome: `x${k}`, r: base.slice() }));
  const r = rilevaCambiRegime(pannelloPiatto, { larghezza: 12 });
  assert.ok(r.disponibile);
  assert.equal(r.cambi.length, 0);
  assert.equal(r.distanzaMedia, 0);
});

// ── mds2D: l'invariante vero è che le distanze RICOSTRUITE dalle coordinate
// assomiglino alle distanze ORIGINALI (l'orientamento/riflessione del piano è
// arbitrario, la geometria delle distanze no) ──

test('mds2D: su 4 punti con distanze note, le distanze ricostruite dalle coordinate coincidono', () => {
  // Quadrato di lato 1: punti A,B,C,D con distanze note (lato=1, diagonale=√2).
  const D = [
    [0, 1, Math.SQRT2, 1],
    [1, 0, 1, Math.SQRT2],
    [Math.SQRT2, 1, 0, 1],
    [1, Math.SQRT2, 1, 0],
  ];
  const coords = mds2D(D);
  const dist = (p, q) => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      assert.ok(Math.abs(dist(coords[i], coords[j]) - D[i][j]) < 1e-4, `(${i},${j}): ricostruita ${dist(coords[i], coords[j])}, attesa ${D[i][j]}`);
    }
  }
});

test('mds2D: con meno di 3 punti non tenta nulla, ritorna l\'origine per ciascuno', () => {
  const r = mds2D([[0, 1], [1, 0]]);
  assert.deepEqual(r, [{ x: 0, y: 0 }, { x: 0, y: 0 }]);
});

// ── mappaRegimi ──

test('mappaRegimi: sul pannello vero produce un punto ogni `passo` mesi', () => {
  const mp = mappaRegimi(PANNELLO_SETTORI, { larghezza: 24, passo: 12 });
  assert.ok(mp.disponibile);
  assert.equal(mp.risoluzioneMesi, 12);
  for (const p of mp.punti) { assert.equal(typeof p.x, 'number'); assert.equal(typeof p.y, 'number'); }
});

test('mappaRegimi: con troppo pochi punti campionati si dichiara', () => {
  const pannelloCorto = PANNELLO_SETTORI.map((s) => ({ ...s, r: s.r.slice(0, 30) }));
  const mp = mappaRegimi(pannelloCorto, { larghezza: 24, passo: 12 });
  assert.equal(mp.disponibile, false);
});

// ── testoRegimeStrutturale: mai un consiglio, sempre i numeri veri ──

test('testoRegimeStrutturale: dati insufficienti restituisce il motivo, non un testo inventato', () => {
  const t = testoRegimeStrutturale({ disponibile: false, motivo: 'poca storia' });
  assert.equal(t, 'poca storia');
});

test('testoRegimeStrutturale: non promette direzioni di mercato né consiglia mosse', () => {
  const r = rilevaCambiRegime(PANNELLO_SETTORI, { larghezza: LARGHEZZA_DEFAULT });
  const t = testoRegimeStrutturale(r);
  assert.ok(!/dovresti|conviene|compra|vendi/i.test(t));
});
