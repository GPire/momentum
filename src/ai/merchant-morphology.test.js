import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { initMorphology, observeMorphology, predictMorphology, explainMorphology, typeTokens, pruneMorphology } =
  await import('./merchant-morphology.js');

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 6, 1);

// ── typeTokens: estrazione onesta di ancora + tipi ─────────────────────────
test('typeTokens: ancora = primo token, tipi = token informativi deduplicati', () => {
  const r = typeTokens('POS DA MARIO PIZZERIA 123');
  assert.equal(r.anchor, 'da'); // "pos" è rumore rimosso da normalizeMerchant
  assert.ok(r.tokens.includes('mario'));
  assert.ok(r.tokens.includes('pizzeria'));
  assert.ok(!r.tokens.includes('da'), 'token < 3 char esclusi dai tipi');
  assert.ok(!r.tokens.some(t => /\d{2,}/.test(t)), 'numeri lunghi rimossi');
});

// ── IL CASO CENTRALE: transfer cross-insegna su esercente mai visto ─────────
test('transfer: "pizzeria" imparata su 3 insegne diverse categorizza una quarta MAI vista', () => {
  let m = initMorphology();
  // tre pizzerie diverse (ancore diverse: 'da', 'pizzeria', 'gustose'), tutte svago
  m = observeMorphology(m, 'DA MARIO PIZZERIA', 'svago', T0);
  m = observeMorphology(m, 'PIZZERIA NAPOLI', 'svago', T0);
  m = observeMorphology(m, 'GUSTOSE PIZZERIA SUD', 'svago', T0);
  // quarta pizzeria mai vista, primo token ancora diverso ('trattoria')
  const p = predictMorphology(m, 'TRATTORIA PIZZERIA DEL CORSO', T0);
  assert.ok(p, 'deve trasferire: "pizzeria" è un tipo generico visto su 3 insegne');
  assert.equal(p.category, 'svago');
  assert.equal(p.via, 'pizzeria');
  assert.equal(p.anchors, 3);
  assert.equal(p.transferred, true);
});

// ── LA CRITICA DEL SECONDO RICERCATORE, resa contratto: un'INSEGNA non deve
// trasferire (rischio di contaminare esercenti scorrelati). Guardia: ≥2 ancore.
test('anti-contaminazione: un token visto su UNA sola insegna NON trasferisce', () => {
  let m = initMorphology();
  // "esselunga" appare molte volte ma sempre come stessa insegna (una ancora)
  for (let i = 0; i < 10; i++) m = observeMorphology(m, `ESSELUNGA VIA ${i}`, 'spesa', T0);
  // un esercente scorrelato che per caso contiene "esselunga" non deve ereditare
  const p = predictMorphology(m, 'BAR ESSELUNGA GELATERIA', T0);
  // 'esselunga' ha 1 ancora → non è un tipo; 'bar'/'gelateria' mai visti → nessun transfer
  assert.equal(p, null, 'una sola insegna non basta a fare di una parola un "tipo"');
});

// ── LA CRITICA DEL TERZO RICERCATORE: se il tipo è AMBIGUO (categorie sparse)
// deve TACERE, non tirare a indovinare con sicurezza.
test('ambiguità: un tipo che finisce in categorie molto diverse tace (margine basso)', () => {
  let m = initMorphology();
  // "centro" appare su insegne diverse ma in categorie sparse (casa/svago/salute)
  m = observeMorphology(m, 'ALFA CENTRO', 'casa', T0);
  m = observeMorphology(m, 'BETA CENTRO', 'svago', T0);
  m = observeMorphology(m, 'GAMMA CENTRO', 'salute', T0);
  const p = predictMorphology(m, 'DELTA CENTRO NUOVO', T0);
  assert.equal(p, null, 'categorie troppo sparse → nessuna concentrazione → tace');
});

// ── IL GUARDRAIL CHIAVE: un NOME proprio che ricorre su più insegne ma con
// categorie DISCORDI (accordo basso) NON trasferisce, anche se la sua media
// aggregata per caso concentra. È ciò che tiene a 0 il falso-parlato (bench).
test('accordo tra insegne: un nome discorde tra insegne non trasferisce (anche con media concentrata)', () => {
  let m = initMorphology();
  // "centrale" appare su 4 insegne diverse ma con categorie DISCORDI, sbilanciate
  // verso 'spesa' (media concentrata) — però NON è un tipo: le insegne dissentono.
  m = observeMorphology(m, 'ALFA CENTRALE', 'spesa', T0);
  m = observeMorphology(m, 'BETA CENTRALE', 'spesa', T0);
  m = observeMorphology(m, 'GAMMA CENTRALE', 'trasporti', T0);
  m = observeMorphology(m, 'DELTA CENTRALE', 'svago', T0);
  const p = predictMorphology(m, 'OMEGA CENTRALE NUOVO', T0);
  assert.equal(p, null, 'accordo tra insegne 2/4 = 0.5 < 0.67 → tace: non è un tipo, è un nome');
});

test('supporto minimo: un tipo visto una volta sola non trasferisce', () => {
  let m = initMorphology();
  m = observeMorphology(m, 'DA MARIO PIZZERIA', 'svago', T0);
  // 'pizzeria' ha 1 ancora e supporto 1 → sotto entrambe le soglie
  const p = predictMorphology(m, 'PIZZERIA NAPOLI', T0);
  assert.equal(p, null);
});

test('vero sconosciuto: nessun token noto → tace (contratto di astensione)', () => {
  let m = initMorphology();
  m = observeMorphology(m, 'DA MARIO PIZZERIA', 'svago', T0);
  m = observeMorphology(m, 'PIZZERIA NAPOLI', 'svago', T0);
  const p = predictMorphology(m, 'OFFICINA MECCANICA ROSSI', T0);
  assert.equal(p, null, 'nessuna parola-tipo conosciuta qui: non inventa');
});

// ── Recency: l'evidenza vecchia NON rinforzata decade sotto soglia → tace,
// ma un rinforzo recente la riporta viva. Il vecchio non diventa falso, diventa
// meno vincolante (stesso principio della gerarchia).
test('decadimento: un tipo appreso e poi mai più visto scende sotto soglia; un rinforzo recente lo riattiva', () => {
  let m = initMorphology({ halfLifeMs: 30 * DAY });
  m = observeMorphology(m, 'DA MARIO PIZZERIA', 'svago', T0);
  m = observeMorphology(m, 'PIZZERIA NAPOLI', 'svago', T0);
  m = observeMorphology(m, 'GUSTOSE PIZZERIA SUD', 'svago', T0);
  // un anno dopo, senza rinforzo: l'evidenza (support 3, halflife 30g) è decaduta
  // ben sotto la soglia minSupport=3 → il sistema non si fida più → tace.
  const later = T0 + 365 * DAY;
  assert.equal(predictMorphology(m, 'ALTRA PIZZERIA QUI', later), null,
    'evidenza vecchia decaduta sotto soglia: tace invece di insistere');
  // rinforzo recente su nuove insegne → torna a parlare, categoria coerente.
  for (const a of ['forno', 'bella', 'antica']) m = observeMorphology(m, `${a.toUpperCase()} PIZZERIA`, 'svago', later);
  const p = predictMorphology(m, 'ALTRA PIZZERIA QUI', later);
  assert.ok(p, 'il rinforzo recente riattiva il transfer');
  assert.equal(p.category, 'svago');
});

test('explainMorphology: motivazione in italiano coerente col transfer', () => {
  let m = initMorphology();
  m = observeMorphology(m, 'DA MARIO PIZZERIA', 'svago', T0);
  m = observeMorphology(m, 'PIZZERIA NAPOLI', 'svago', T0);
  m = observeMorphology(m, 'GUSTOSE PIZZERIA SUD', 'svago', T0);
  const e = explainMorphology(m, 'TRATTORIA PIZZERIA DEL CORSO', T0);
  assert.match(e.reason, /pizzeria/);
  assert.match(e.reason, /svago/);
});

test('pruneMorphology: elimina i token con evidenza decaduta sotto soglia', () => {
  let m = initMorphology({ halfLifeMs: 10 * DAY });
  m = observeMorphology(m, 'DA MARIO PIZZERIA', 'svago', T0);
  const pruned = pruneMorphology(m, { now: T0 + 200 * DAY, minSupport: 0.5 });
  assert.equal(Object.keys(pruned.tokens).length, 0, 'tutto decaduto sotto soglia → rimosso');
});

test('serializzabile: JSON round-trip preserva il modello', () => {
  let m = initMorphology();
  m = observeMorphology(m, 'DA MARIO PIZZERIA', 'svago', T0);
  m = observeMorphology(m, 'PIZZERIA NAPOLI', 'svago', T0);
  m = observeMorphology(m, 'GUSTOSE PIZZERIA SUD', 'svago', T0);
  const round = JSON.parse(JSON.stringify(m));
  const p = predictMorphology(round, 'TRATTORIA PIZZERIA DEL CORSO', T0);
  assert.ok(p && p.category === 'svago');
});
