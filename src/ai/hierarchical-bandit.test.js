import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initHierarchical, observeHierarchical, scoreHierarchical, predictHierarchical,
  explainHierarchical, poolingStrength, mergeHierarchical, pruneHierarchical,
  scoreGated, predictGated, predictHybrid, deepestEvidence,
} from './hierarchical-bandit.js';

const T0 = Date.parse('2026-07-21T10:00:00Z');
const DAY = 86_400_000;

test('modello vuoto: nessuna predizione inventata', () => {
  const m = initHierarchical();
  const r = predictHierarchical(m, ['it', 'momentum.it'], T0);
  assert.equal(r.label, null);
  assert.equal(r.support, 0);
});

test('chiavi gerarchiche non collidono: [a,b] diverso da [ab]', () => {
  const m = initHierarchical();
  observeHierarchical(m, ['a', 'b'], 'ok', T0, 10);
  observeHierarchical(m, ['ab'], 'ko', T0, 10);
  assert.equal(predictHierarchical(m, ['a', 'b'], T0).label, 'ok');
  assert.equal(predictHierarchical(m, ['ab'], T0).label, 'ko');
});

test('IL PUNTO: un sotto-dominio MAI VISTO eredita dal genitore', () => {
  const m = initHierarchical();
  // tre sotto-domini di momentum.it, tutti affidabili
  for (const sub of ['cdn.momentum.it', 'eu.momentum.it', 'app.momentum.it']) {
    observeHierarchical(m, ['it', 'momentum.it', sub], 'ok', T0, 12);
  }
  // un quarto sotto-dominio che il sistema non ha MAI visto
  const r = explainHierarchical(m, ['it', 'momentum.it', 'nuovo.momentum.it'], T0);
  assert.equal(r.label, 'ok');
  assert.ok(r.p > 0.8, `atteso >0.8, ottenuto ${r.p}`);
  assert.equal(r.inherited, true);
  assert.match(r.reason, /eredito da/);
  // il bandit piatto qui darebbe 0.5 neutro: e' esattamente il salto
});

test('rami ETEROGENEI: il figlio nuovo NON eredita con forza', () => {
  const m = initHierarchical();
  observeHierarchical(m, ['it', 'misto.it', 'a.misto.it'], 'ok', T0, 12);
  observeHierarchical(m, ['it', 'misto.it', 'b.misto.it'], 'ko', T0, 12);
  observeHierarchical(m, ['it', 'misto.it', 'c.misto.it'], 'ok', T0, 12);
  observeHierarchical(m, ['it', 'misto.it', 'd.misto.it'], 'ko', T0, 12);

  const kOmog = (() => {
    const h = initHierarchical();
    for (const s of ['a', 'b', 'c', 'd']) observeHierarchical(h, ['it', 'omog.it', s], 'ok', T0, 12);
    return poolingStrength(h, ['it', 'omog.it'].join(''), T0);
  })();
  const kEter = poolingStrength(m, ['it', 'misto.it'].join(''), T0);

  assert.ok(kOmog > kEter, `pooling omogeneo ${kOmog} deve superare eterogeneo ${kEter}`);
  // e la predizione sul mai-visto resta incerta dove i fratelli litigano
  const r = predictHierarchical(m, ['it', 'misto.it', 'nuovo.misto.it'], T0);
  assert.ok(r.margin < 0.35, `atteso incerto, margine ${r.margin}`);
});

test('evidenza propria del nodo domina il genitore', () => {
  const m = initHierarchical();
  for (const sub of ['a.x.it', 'b.x.it', 'c.x.it']) {
    observeHierarchical(m, ['it', 'x.it', sub], 'ok', T0, 20);
  }
  // un sotto-dominio che invece fallisce sistematicamente
  observeHierarchical(m, ['it', 'x.it', 'rotto.x.it'], 'ko', T0, 60);
  const r = predictHierarchical(m, ['it', 'x.it', 'rotto.x.it'], T0);
  assert.equal(r.label, 'ko', 'i fatti locali battono il prior del ramo');
});

test('il tempo toglie CONFIDENZA, non ribalta le proporzioni', () => {
  const m = initHierarchical();
  observeHierarchical(m, ['it', 'old.it', 'a.old.it'], 'ok', T0, 10);
  const fresco = scoreHierarchical(m, ['it', 'old.it', 'a.old.it'], T0);
  const vecchio = scoreHierarchical(m, ['it', 'old.it', 'a.old.it'], T0 + 180 * DAY);
  assert.ok(vecchio.support < fresco.support, 'il supporto deve calare');
  assert.ok(vecchio.dist.ok > 0.5, 'ma il vecchio non diventa falso');
});

test('multi-classe: funziona oltre il binario (serve a Momentum Core)', () => {
  const m = initHierarchical();
  observeHierarchical(m, ['esselunga', 'esselunga via'], 'spesa', T0, 15);
  observeHierarchical(m, ['esselunga', 'esselunga corso'], 'spesa', T0, 15);
  observeHierarchical(m, ['q8', 'q8 statale'], 'trasporti', T0, 15);
  // esercente mai visto della catena nota
  const r = predictHierarchical(m, ['esselunga', 'esselunga rizzoli'], T0);
  assert.equal(r.label, 'spesa');
  assert.ok(r.inherited !== false || r.p > 0.7);
  // catena diversa non contamina
  assert.equal(predictHierarchical(m, ['q8', 'q8 nuova'], T0).label, 'trasporti');
});

test('exclude: si puo' + ' escludere un esito (astensione a valle)', () => {
  const m = initHierarchical();
  observeHierarchical(m, ['a'], 'ok', T0, 10);
  observeHierarchical(m, ['a'], 'ko', T0, 3);
  const r = scoreHierarchical(m, ['a'], T0, { exclude: ['ok'] });
  assert.ok(!('ok' in r.dist));
  assert.ok(Math.abs(r.dist.ko - 1) < 1e-9);
});

test('federazione mesh: il contributo di un peer e limitato (anti-poisoning)', () => {
  const locale = initHierarchical();
  observeHierarchical(locale, ['it', 'buono.it'], 'ok', T0, 10);

  const peerCattivo = initHierarchical();
  observeHierarchical(peerCattivo, ['it', 'buono.it'], 'ko', T0, 100000);

  mergeHierarchical(locale, peerCattivo, { maxPeerWeight: 5 });
  const r = predictHierarchical(locale, ['it', 'buono.it'], T0);
  assert.equal(r.label, 'ok', 'un peer da solo non deve ribaltare il locale');
});

test('potatura: tiene i rami forti, scarta i deboli', () => {
  const m = initHierarchical();
  observeHierarchical(m, ['it', 'forte.it'], 'ok', T0, 50);
  observeHierarchical(m, ['it', 'debole.it'], 'ok', T0, 0.05);
  pruneHierarchical(m, { minSupport: 0.2, now: T0 });
  assert.ok(m.nodes[['it', 'forte.it'].join('')]);
  assert.ok(!m.nodes[['it', 'debole.it'].join('')]);
});

// ── Primitivo v2: confidence-gating + ibrido (validato da bench/research-gating.mjs)
test('gating: sceglie il ramo confidente e IGNORA il genitore fuorviante', () => {
  const m = initHierarchical();
  // dominio eterogeneo: ramo cdn tutto OK, ramo api tutto KO → genitore ~50/50 inutile
  for (let i = 0; i < 4; i++) observeHierarchical(m, ['com', 'd.com', 'cdn.d.com', `n${i}.cdn.d.com`], 'ok', T0);
  for (let i = 0; i < 4; i++) observeHierarchical(m, ['com', 'd.com', 'api.d.com', `n${i}.api.d.com`], 'ko', T0);
  // sotto-dominio MAI VISTO del ramo cdn: il gating deve dire OK (non il 50/50 del dominio)
  const g = predictGated(m, ['com', 'd.com', 'cdn.d.com', 'nuovo.cdn.d.com'], T0);
  assert.equal(g.label, 'ok');
  const g2 = predictGated(m, ['com', 'd.com', 'api.d.com', 'nuovo.api.d.com'], T0);
  assert.equal(g2.label, 'ko');
});

test('gating: astensione su modello vuoto e su segnale al livello del caso', () => {
  const m = initHierarchical();
  assert.equal(scoreGated(m, ['com', 'd.com'], T0).label, null);
});

test('deepestEvidence: e\' l\'evidenza del ramo piu\' profondo, non della radice', () => {
  const m = initHierarchical();
  for (let i = 0; i < 10; i++) observeHierarchical(m, ['com', 'd.com', 'cdn.d.com', `n${i}.cdn.d.com`], 'ok', T0);
  // ramo noto con 10 osservazioni
  assert.ok(deepestEvidence(m, ['com', 'd.com', 'cdn.d.com', 'mai.cdn.d.com'], T0) >= 10);
});

test('ibrido: additivo — su evidenza abbondante coincide col pooling', () => {
  const m = initHierarchical();
  for (let i = 0; i < 20; i++) observeHierarchical(m, ['com', 'd.com', 'cdn.d.com', `n${i}.cdn.d.com`], 'ok', T0);
  const path = ['com', 'd.com', 'cdn.d.com', 'mai.cdn.d.com'];
  const hy = predictHybrid(m, path, T0, { gateBelow: 6 });
  const pool = predictHierarchical(m, path, T0);
  assert.equal(hy.label, pool.label); // evidenza 20 >= 6 → usa pooling, stesso esito
});
