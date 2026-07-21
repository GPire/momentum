import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initMerchantHierarchy, merchantPath, observeMerchant, predictMerchant, explainMerchant,
} from './merchant-hierarchy.js';

const T0 = Date.parse('2026-07-21T10:00:00Z');

test('merchantPath: prefissi cumulativi, rumore bancario tolto', () => {
  assert.deepEqual(merchantPath('POS ESSELUNGA VIA RIZZOLI 12'),
    ['esselunga', 'esselunga via', 'esselunga via rizzoli']);
  assert.deepEqual(merchantPath('   '), []);
});

test('a freddo NON vota (zero rumore, zero effetto)', () => {
  const m = initMerchantHierarchy();
  assert.equal(predictMerchant(m, 'ESSELUNGA VIA RIZZOLI'), null);
});

test('IL PUNTO: punto vendita MAI VISTO eredita dalla catena', () => {
  const m = initMerchantHierarchy();
  observeMerchant(m, 'ESSELUNGA VIA MONTENAPOLEONE', 'spesa', T0, 4);
  observeMerchant(m, 'ESSELUNGA CORSO BUENOS AIRES', 'spesa', T0, 4);
  observeMerchant(m, 'ESSELUNGA VIALE CERTOSA 9', 'spesa', T0, 4);

  const p = predictMerchant(m, 'POS ESSELUNGA VIA RIZZOLI 12', T0); // mai visto
  assert.ok(p, 'deve dire qualcosa');
  assert.equal(p.category, 'spesa');
  assert.equal(p.inherited, true, 'sta ereditando, non ricordando');
  assert.ok(p.confidence > 0.7, `confidenza ${p.confidence}`);

  const e = explainMerchant(m, 'POS ESSELUNGA VIA RIZZOLI 12', T0);
  // mostra il nodo piu' profondo che ha fatto match, non tutta la catena
  assert.match(e.reason, /assomiglia a "esselunga( via)?"/);
  assert.ok(!e.reason.includes('›'), 'niente catena concatenata nel testo utente');
});

test('catene diverse non si contaminano', () => {
  const m = initMerchantHierarchy();
  observeMerchant(m, 'ESSELUNGA VIA A', 'spesa', T0, 5);
  observeMerchant(m, 'Q8 STATALE 16', 'trasporti', T0, 5);
  assert.equal(predictMerchant(m, 'ESSELUNGA VIA B', T0).category, 'spesa');
  assert.equal(predictMerchant(m, 'Q8 TANGENZIALE', T0).category, 'trasporti');
});

test('la correzione dell\'utente sul punto vendita batte la catena', () => {
  const m = initMerchantHierarchy();
  for (let i = 0; i < 6; i++) observeMerchant(m, `ESSELUNGA VIA ${i}`, 'spesa', T0, 3);
  // un "Esselunga" che per questo utente e' sempre altro (es. bar interno)
  observeMerchant(m, 'ESSELUNGA BAR CENTRALE', 'svago', T0, 20);
  assert.equal(predictMerchant(m, 'ESSELUNGA BAR CENTRALE', T0).category, 'svago');
});

test('AUTO-CORREZIONE: rami eterogenei smettono di generalizzare', () => {
  const m = initMerchantHierarchy();
  // un primo token spazzatura condiviso da categorie diverse
  observeMerchant(m, 'ADDEBITO XYZ ALFA', 'casa', T0, 6);
  observeMerchant(m, 'ADDEBITO XYZ BETA', 'svago', T0, 6);
  observeMerchant(m, 'ADDEBITO XYZ GAMMA', 'trasporti', T0, 6);
  observeMerchant(m, 'ADDEBITO XYZ DELTA', 'spesa', T0, 6);
  const p = predictMerchant(m, 'ADDEBITO XYZ OMEGA', T0);
  // deve restare molto incerto invece di inventare una categoria
  assert.ok(!p || p.margin < 0.3, `atteso incerto, margine ${p && p.margin}`);
});

test('soglia di supporto: una sola osservazione non basta', () => {
  const m = initMerchantHierarchy();
  observeMerchant(m, 'NEGOZIO STRANO', 'spesa', T0, 1);
  assert.equal(predictMerchant(m, 'NEGOZIO ALTRO', T0, { minSupport: 2 }), null);
});
