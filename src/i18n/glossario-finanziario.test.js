'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import { categorieTrovate, coerenzaGlossario, GLOSSARIO } from './glossario-finanziario.js';

// ── Il precedente diretto: qa-engine.js aveva già preso lo stesso identico
// bug (correctTypos riscriveva "perdere"→"spendere", "vendere"→"spendere").
// Questi test verificano che il glossario distingua correttamente le
// categorie che quel bug confondeva. ──

test('categorieTrovate: distingue perdita, vendita e spesa — non sono la stessa cosa', () => {
  assert.deepEqual(categorieTrovate('Quanto posso perdere nel caso peggiore?', 'it'), ['perdita']);
  assert.deepEqual(categorieTrovate('Ho deciso di vendere quel titolo', 'it'), ['vendita']);
  assert.deepEqual(categorieTrovate('Quanto ho speso questo mese?', 'it'), ['spesa']);
});

test('categorieTrovate: confine di parola vero — "renderà" non è "rendimento"', () => {
  // "rendera'" contiene le lettere di "rend..." ma NON e' una forma del
  // glossario: deve restare fuori. Stesso principio del confine di parola
  // gia' usato in titoloParlaDi() (news.js) contro "apple"/"applying".
  assert.deepEqual(categorieTrovate('Questo cambiamento renderà tutto più semplice', 'it'), []);
});

test('categorieTrovate: una frase può toccare più categorie insieme', () => {
  const cats = categorieTrovate('Ho investito i miei risparmi e ora rischio di perdere tutto', 'it');
  assert.ok(cats.includes('investimento'));
  assert.ok(cats.includes('risparmio'));
  assert.ok(cats.includes('rischio'));
  assert.ok(cats.includes('perdita'));
});

test('categorieTrovate: funziona per le altre 5 lingue, non solo IT', () => {
  assert.deepEqual(categorieTrovate('How much could I lose in the worst case?', 'en'), ['perdita']);
  assert.deepEqual(categorieTrovate('¿Cuánto podría perder en el peor caso?', 'es'), ['perdita']);
  assert.deepEqual(categorieTrovate('Combien pourrais-je perdre dans le pire des cas ?', 'fr'), ['perdita']);
  assert.deepEqual(categorieTrovate('Wie viel könnte ich im schlimmsten Fall verlieren?', 'de'), ['perdita']);
  assert.deepEqual(categorieTrovate('Quanto poderia perder no pior caso?', 'pt'), ['perdita']);
});

test('categorieTrovate: termine inglese di due parole ("net worth") via sottostringa', () => {
  assert.deepEqual(categorieTrovate('What is my net worth today?', 'en'), ['patrimonio']);
});

test('categorieTrovate: lingua non coperta o testo vuoto → nessun crash, nessuna categoria', () => {
  assert.deepEqual(categorieTrovate('Quanto posso perdere?', 'ja'), []);
  assert.deepEqual(categorieTrovate('', 'it'), []);
  assert.deepEqual(categorieTrovate(null, 'it'), []);
});

// ── coerenzaGlossario: LA SERRATURA — il pezzo che il Cantiere J userà
// davvero per bloccare una traduzione che ha fatto slittare un termine. ──

test('coerenzaGlossario: traduzione fedele → nessuno slittamento', () => {
  const slittati = coerenzaGlossario(
    'Quanto posso perdere nel caso peggiore?', 'it',
    'How much could I lose in the worst case?', 'en'
  );
  assert.deepEqual(slittati, []);
});

test('coerenzaGlossario: IL CASO CHE DEVE BLOCCARE — "perdere" tradotto come "spendere"', () => {
  // Esattamente il bug reale di correctTypos, ma nella direzione traduzione:
  // una "traduzione" che confonde perdita con spesa deve essere rifiutata.
  const slittati = coerenzaGlossario(
    'Quanto posso perdere nel caso peggiore?', 'it',
    'How much could I spend in the worst case?', 'en'
  );
  assert.deepEqual(slittati, ['perdita']);
});

test('coerenzaGlossario: "vendere" tradotto come "spendere" — l\'altro bug reale', () => {
  const slittati = coerenzaGlossario(
    'Ho deciso di vendere quel titolo', 'it',
    'I decided to spend that stock', 'en'
  );
  assert.deepEqual(slittati, ['vendita']);
});

test('coerenzaGlossario: quattro categorie insieme, tradotte tutte fedelmente', () => {
  const slittati = coerenzaGlossario(
    'Ho investito i miei risparmi e rischio una perdita', 'it',
    'I invested my savings and risk a loss', 'en'
  );
  assert.deepEqual(slittati, []);
});

test('coerenzaGlossario: fra più categorie, solo quella davvero mancante viene segnalata', () => {
  // La traduzione perde SOLO "rischio" (nessuna parola equivalente), le
  // altre tre restano: il cancello deve isolare esattamente quella, non
  // bocciare l'intera frase in blocco né lasciarla passare del tutto.
  const slittati = coerenzaGlossario(
    'Ho investito i miei risparmi e rischio una perdita', 'it',
    'I invested my savings and now face a loss', 'en'
  );
  assert.deepEqual(slittati, ['rischio']);
});

test('coerenzaGlossario: nessuna categoria nell\'originale → nessuno slittamento possibile', () => {
  assert.deepEqual(coerenzaGlossario('Che tempo fa oggi?', 'it', 'What is the weather today?', 'en'), []);
});

// ── Integrità del glossario stesso: ogni categoria copre tutte e 6 le lingue,
// nessuna forma vuota. Se domani si aggiunge una categoria a metà, questo
// test lo dice subito invece di scoprirlo quando una lingua "non funziona". ──

test('ogni categoria del glossario ha le 6 lingue, ognuna con almeno 2 forme', () => {
  const LINGUE = ['it', 'en', 'es', 'fr', 'de', 'pt'];
  for (const [categoria, perLingua] of Object.entries(GLOSSARIO)) {
    for (const lingua of LINGUE) {
      const forme = perLingua[lingua];
      assert.ok(Array.isArray(forme) && forme.length >= 2, `"${categoria}" manca o è incompleta per "${lingua}"`);
    }
  }
});

test('nessuna forma duplicata fra categorie diverse nella stessa lingua (ambiguità)', () => {
  // Se "rendimento" e "guadagno" condividessero una forma in una lingua, il
  // cancello non saprebbe mai quale categoria è davvero slittata.
  const LINGUE = ['it', 'en', 'es', 'fr', 'de', 'pt'];
  for (const lingua of LINGUE) {
    const visti = new Map();
    for (const [categoria, perLingua] of Object.entries(GLOSSARIO)) {
      for (const forma of perLingua[lingua] || []) {
        const altra = visti.get(forma);
        assert.ok(!altra || altra === categoria, `"${forma}" (${lingua}) compare sia in "${altra}" sia in "${categoria}"`);
        visti.set(forma, categoria);
      }
    }
  }
});
