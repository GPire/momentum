'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAT_RULES } from './lexicon.js';
// constants.js legge `window`/`navigator` a livello di modulo (isTouch):
// import dinamico DOPO lo stub, perché un `import` statico verrebbe issato
// prima (le import sono hoisted in ESM, non importa dove sta nel file).
globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
const { ALL_CATS, DEFAULT_CATEGORIES, formatMoney } = await import('./constants.js');

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

// ── formatMoney multi-valuta (chi viaggia il mondo, non solo EUR) ──
// BUG REALE: formatMoney era codificata in modo fisso su 'it-IT'/'EUR' —
// ogni transazione, anche una in sterline/yen/franchi correttamente
// importata (vedi src/import/pdf-parser.js, detectCurrency), veniva
// comunque MOSTRATA come se fosse in euro. Ora accetta una valuta opzionale.

test('formatMoney: senza secondo argomento il comportamento è IDENTICO a prima (default EUR/it-IT)', () => {
  // Regex, non stringa esatta: il separatore delle migliaia in it-IT dipende
  // dai dati ICU della versione Node (quirk noto, già visto altrove in
  // questa sessione) — qui si verifica il formato (virgola decimale, simbolo
  // euro), non un dettaglio di build ambientale.
  assert.match(formatMoney(1234.5), /1[.,]?234,50\s?€/);
});

test('formatMoney: valute diverse si formattano con la LORO convenzione, non forzate all\'italiana', () => {
  assert.match(formatMoney(45.2, 'GBP'), /£/);
  assert.match(formatMoney(45.2, 'GBP'), /45\.20/, 'inglese: punto decimale, non virgola');
  assert.match(formatMoney(4500, 'JPY'), /4,500/, 'yen: senza decimali, migliaia con virgola');
});

test('formatMoney: una valuta non in tabella non fa mai crashare — ricade sulla formattazione it-IT', () => {
  assert.doesNotThrow(() => formatMoney(10, 'XYZ'));
});
