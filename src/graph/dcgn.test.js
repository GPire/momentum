import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenize, createGraph, observe, train, classify, decay,
  measureCompetence, mergeExpertWeighted, extractSubgraph,
} from './dcgn.js';

// ── Dataset deterministici (nessun Math.random: il grafo è riproducibile) ──
const CRYPTO = ['binance acquisto btc', 'coinbase ethereum', 'kraken bitcoin', 'bitpanda crypto deposito'];
const RESTO = ['trattoria da mario', 'pizzeria bella napoli', 'osteria del corso', 'ristorante il gambero'];
const SPESA = ['esselunga supermercato', 'conad city', 'lidl italia', 'carrefour express'];

function graphFrom(map, repeats = 1) {
  const g = createGraph();
  for (let r = 0; r < repeats; r++) {
    for (const [cat, phrases] of Object.entries(map)) {
      for (const p of phrases) observe(g, p, cat);
    }
  }
  return g;
}

test('tokenize: parole (w:) + n-grammi di caratteri (c:), stopwords filtrate', () => {
  const toks = tokenize('Pizzeria da Napoli');
  assert.ok(toks.includes('w:pizzeria'));
  assert.ok(toks.includes('w:napoli'));
  assert.ok(!toks.includes('w:da'), 'stopword "da" esclusa');
  assert.ok(toks.some(t => t.startsWith('c:')), 'presenti n-grammi di caratteri');
  // marcatori di bordo-parola nei char-gram
  assert.ok(toks.includes('c:^piz'));
});

test('osserva e classifica: impara un esempio visto', () => {
  const g = graphFrom({ crypto: CRYPTO, ristoranti: RESTO, spesa: SPESA });
  assert.equal(classify(g, 'binance acquisto btc').category, 'crypto');
  assert.equal(classify(g, 'trattoria da mario').category, 'ristoranti');
  assert.equal(classify(g, 'lidl italia').category, 'spesa');
});

test('generalizza su esercenti MAI visti via subword (il nemico del bench)', () => {
  const g = graphFrom({ crypto: CRYPTO, ristoranti: RESTO, spesa: SPESA }, 2);
  // nomi nuovi, categoria nota: condividono sub-token con i visti
  assert.equal(classify(g, 'pizzeria roma centro').category, 'ristoranti');
  assert.equal(classify(g, 'trattoria del porto').category, 'ristoranti');
  assert.equal(classify(g, 'binance deposito euro').category, 'crypto');
});

test('classify ritorna un percorso spiegabile (mai numero orfano)', () => {
  const g = graphFrom({ crypto: CRYPTO, ristoranti: RESTO });
  const r = classify(g, 'pizzeria bella napoli');
  assert.equal(r.category, 'ristoranti');
  assert.ok(r.path.length > 0, 'percorso non vuoto');
  assert.ok(r.confidence > 0 && r.confidence <= 100);
});

test('decay: smorza e pota gli archi (dimentica, non "memoria infinita")', () => {
  const g = graphFrom({ crypto: CRYPTO });
  const before = JSON.stringify(g.edges);
  decay(g, 0.5, 0.6); // fattore aggressivo + soglia alta → pota molto
  const after = JSON.stringify(g.edges);
  assert.notEqual(before, after);
  // dopo un decay aggressivo qualche arco è stato potato
  const nBefore = before.length, nAfter = after.length;
  assert.ok(nAfter < nBefore, 'il grafo si è alleggerito');
});

test('determinismo: stessa sequenza di osservazioni → grafo identico', () => {
  const a = graphFrom({ crypto: CRYPTO, ristoranti: RESTO });
  const b = graphFrom({ crypto: CRYPTO, ristoranti: RESTO });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

// ============================================================
// Federazione a competenza per-argomento ("gruppo di esperti")
// ============================================================

test('measureCompetence: l\'esperto di un argomento ha competenza alta, il poison bassa', () => {
  const expert = graphFrom({ crypto: CRYPTO }, 2);
  const validation = CRYPTO.map(text => ({ text, category: 'crypto' }));
  const compExpert = measureCompetence(expert, validation);
  assert.ok(compExpert.crypto > 0.7, `esperto competente su crypto (${compExpert.crypto})`);

  // peer che NON sa nulla di crypto (sa solo ristoranti) → bassa competenza crypto
  const ignorant = graphFrom({ ristoranti: RESTO }, 2);
  const compIgnorant = measureCompetence(ignorant, validation);
  assert.ok((compIgnorant.crypto ?? 0) < compExpert.crypto, 'l\'ignorante è meno competente dell\'esperto');
});

test('adozione: un device SENZA una categoria eredita quella dell\'esperto del gruppo', () => {
  // Local conosce solo ristoranti; non ha MAI visto crypto.
  const local = graphFrom({ ristoranti: RESTO }, 2);
  const cryptoText = 'binance acquisto btc';
  assert.notEqual(classify(local, cryptoText).category, 'crypto', 'prima della fusione non può dire crypto');

  const expert = graphFrom({ crypto: CRYPTO }, 2);
  const validation = [
    ...CRYPTO.map(text => ({ text, category: 'crypto' })),
    ...RESTO.map(text => ({ text, category: 'ristoranti' })),
  ];
  const { graph: merged, competence } = mergeExpertWeighted(local, [expert], { validationSet: validation });
  assert.ok(competence[0].crypto > 0.7, 'competenza crypto dell\'esperto riconosciuta');
  assert.equal(classify(merged, cryptoText).category, 'crypto', 'dopo la fusione adotta la conoscenza dell\'esperto');
});

test('cambio argomento → domina un esperto diverso (competenza per-categoria)', () => {
  const local = createGraph();
  const cryptoExpert = graphFrom({ crypto: CRYPTO }, 2);
  const restoExpert = graphFrom({ ristoranti: RESTO }, 2);
  const validation = [
    ...CRYPTO.map(text => ({ text, category: 'crypto' })),
    ...RESTO.map(text => ({ text, category: 'ristoranti' })),
  ];
  const { graph: merged } = mergeExpertWeighted(local, [cryptoExpert, restoExpert], { validationSet: validation });
  assert.equal(classify(merged, 'kraken bitcoin').category, 'crypto');
  assert.equal(classify(merged, 'osteria del corso').category, 'ristoranti');
});

test('anti-poisoning: un peer che avvelena (etichette sbagliate) NON degrada le previsioni giuste', () => {
  // Local sa fare ristoranti bene.
  const local = graphFrom({ ristoranti: RESTO }, 3);
  const restoVal = RESTO.map(text => ({ text, category: 'ristoranti' }));
  const accBefore = restoVal.filter(v => classify(local, v.text).category === 'ristoranti').length;
  assert.equal(accBefore, restoVal.length, 'local parte perfetto su ristoranti');

  // Peer poison: mappa i token dei ristoranti alla categoria SBAGLIATA (crypto).
  const poison = createGraph();
  for (const p of RESTO) observe(poison, p, 'crypto');

  const { graph: merged, competence } = mergeExpertWeighted(local, [poison], { validationSet: restoVal });
  // Validato sui dati locali, il poison risulta incompetente su ristoranti → basso peso.
  assert.ok((competence[0].ristoranti ?? 0) < 0.5, 'poison giudicato incompetente sui MIEI dati');
  const accAfter = restoVal.filter(v => classify(merged, v.text).category === 'ristoranti').length;
  assert.equal(accAfter, restoVal.length, 'le previsioni giuste restano giuste dopo la fusione');
});

test('floor: si assorbe SEMPRE un po\' da tutti (l\'informazione del gruppo)', () => {
  const local = graphFrom({ ristoranti: RESTO }, 2);
  const peer = graphFrom({ crypto: CRYPTO }, 2);
  // nessun validation set → competenza sconosciuta → entra solo il floor (>0)
  const wBefore = local.edges['w:binance']?.crypto?.w ?? 0;
  const { graph: merged } = mergeExpertWeighted(local, [peer], { validationSet: [], floor: 0.15 });
  const wAfter = merged.edges['w:binance']?.crypto?.w ?? 0;
  assert.ok(wAfter > wBefore, 'anche senza competenza dichiarata, un po\' di conoscenza entra');
});

test('extractSubgraph: sotto-grafo serializzabile e indipendente (deep copy)', () => {
  const g = graphFrom({ crypto: CRYPTO });
  const sub = extractSubgraph(g);
  observe(sub, 'nuovo token isolato zzz', 'spesa'); // muta la copia
  assert.equal(g.cats.spesa, undefined, 'la sorgente non è stata toccata');
  assert.equal(JSON.stringify(sub), JSON.stringify(JSON.parse(JSON.stringify(sub))), 'JSON-round-trippabile');
});

test('adattività device: maxTokens limita il calcolo mantenendo la predizione sui casi netti', () => {
  const g = createGraph();
  // esercente ben appreso
  for (let i = 0; i < 20; i++) observe(g, 'supermercato esselunga milano', 'spesa');
  for (let i = 0; i < 20; i++) observe(g, 'ristorante pizzeria napoli', 'ristoranti');
  const full = classify(g, 'supermercato esselunga milano');
  const limited = classify(g, 'supermercato esselunga milano', { maxTokens: 8 });
  // su un caso netto la categoria non cambia; il calcolo è ridotto
  assert.equal(limited.category, full.category);
  assert.equal(limited.category, 'spesa');
});
