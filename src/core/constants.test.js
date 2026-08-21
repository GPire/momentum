'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAT_RULES } from './lexicon.js';
// constants.js legge `window`/`navigator` a livello di modulo (isTouch):
// import dinamico DOPO lo stub, perché un `import` statico verrebbe issato
// prima (le import sono hoisted in ESM, non importa dove sta nel file).
globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
const { ALL_CATS, DEFAULT_CATEGORIES } = await import('./constants.js');

// ── Il bug che questo file esiste per impedire ──
// core/lexicon.js aveva regole (CAT_RULES) che rispondevano 'bollette',
// 'salute', 'casa', 'svago' a parole come "enel" o "farmacia" — ma nessuna
// categoria con quegli id esisteva in constants.js. Il classificatore capiva
// giusto e la risposta finiva comunque nel fallback "Altro", perché
// getCatById (core/vault.js) non trovava l'id e ripiegava sul generico.
// Un secondo motore (neural-nexus.js: CAT_RULES) può proporre lo stesso id
// domani per una categoria nuova: questo test lo scopre subito, non quando
// un utente vede "Altro" al posto di "Bollette".
test('ogni id in CAT_RULES esiste davvero come categoria', () => {
  const validi = new Set(ALL_CATS.map((c) => c.id));
  for (const regola of CAT_RULES) {
    assert.ok(validi.has(regola.id), `CAT_RULES propone "${regola.id}", ma nessuna categoria in constants.js ha quell'id`);
  }
});

test('ogni categoria ha id, nome, colore e icona — niente voci a metà', () => {
  for (const c of ALL_CATS) {
    assert.ok(c.id && typeof c.id === 'string', `categoria senza id: ${JSON.stringify(c)}`);
    assert.ok(c.name && typeof c.name === 'string', `"${c.id}" senza nome`);
    assert.match(c.color, /^#[0-9a-f]{6}$/i, `"${c.id}" ha un colore non valido: "${c.color}"`);
    assert.ok(c.icon && c.icon.includes('<svg'), `"${c.id}" senza icona SVG`);
    assert.ok(['uscita', 'entrata', 'invest'].includes(c.type), `"${c.id}" ha type non valido: "${c.type}"`);
  }
});

test('nessun id di categoria duplicato', () => {
  const ids = ALL_CATS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'ci sono id ripetuti in DEFAULT_CATEGORIES');
});

test('nessun colore riusato fra le categorie di spesa — servono a distinguerle a colpo d\'occhio', () => {
  const spesa = DEFAULT_CATEGORIES.expense;
  const colori = spesa.map((c) => c.color.toLowerCase());
  assert.equal(new Set(colori).size, colori.length, 'due categorie di spesa condividono lo stesso colore');
});

// Le sei categorie aggiunte per colmare il buco misurato in sessione (5
// categorie di spesa non bastavano: il demo era costretto a mettere affitto
// e bolletta della luce dentro "Abbonamenti").
test('le sei categorie nuove esistono, con lo stesso id delle regole in lexicon.js', () => {
  const attese = ['casa', 'bollette', 'salute', 'istruzione', 'viaggi', 'svago'];
  const ids = new Set(ALL_CATS.map((c) => c.id));
  for (const id of attese) assert.ok(ids.has(id), `manca la categoria "${id}"`);
  // E devono essere di spesa: sono voci che escono, non entrano o si investono.
  const spesaIds = new Set(DEFAULT_CATEGORIES.expense.map((c) => c.id));
  for (const id of attese) assert.ok(spesaIds.has(id), `"${id}" non è fra le categorie di uscita`);
});
