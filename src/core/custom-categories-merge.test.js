import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeCategoryPair, mergeCategoryLists, visibleCategories,
  isCategoryDeleted, touchCategory, deleteCategory, restoreCategory,
} from './custom-categories-merge.js';

const cat = (id, name, extra = {}) => ({ id, name, type: 'uscita', color: '#fff', icon: '<svg/>', ...extra });

test('una categoria creata su un dispositivo arriva sull altro', () => {
  const fuse = mergeCategoryLists([cat('c1', 'Palestra')], [cat('c2', 'Benzina')]);
  assert.equal(fuse.length, 2);
  assert.deepEqual(fuse.map(c => c.name).sort(), ['Benzina', 'Palestra']);
});

test('la stessa categoria rinominata: vince il nome scritto più di recente, in qualunque ordine', () => {
  const vecchia = cat('c1', 'Palestra', { updatedAt: 1000 });
  const nuova = cat('c1', 'Palestra e piscina', { updatedAt: 2000 });
  assert.equal(mergeCategoryPair(vecchia, nuova).name, 'Palestra e piscina');
  assert.equal(mergeCategoryPair(nuova, vecchia).name, 'Palestra e piscina');
});

test('anche colore e icona seguono l ultima modifica, non si mescolano a metà', () => {
  const a = cat('c1', 'Palestra', { updatedAt: 1000, color: '#111', icon: '<svg>vecchia</svg>' });
  const b = cat('c1', 'Palestra', { updatedAt: 2000, color: '#222', icon: '<svg>nuova</svg>' });
  const fusa = mergeCategoryPair(a, b);
  assert.equal(fusa.color, '#222');
  assert.equal(fusa.icon, '<svg>nuova</svg>');
});

test('cancellazione: una categoria cancellata non torna in vita dal dispositivo che non lo sapeva', () => {
  const originale = touchCategory(cat('c1', 'Palestra'), 1000);
  const cancellata = deleteCategory(originale, 2000);
  const copiaViva = { ...originale, updatedAt: 5000 }; // l'altro l'ha pure modificata
  assert.equal(isCategoryDeleted(mergeCategoryPair(cancellata, copiaViva)), true);
  assert.equal(isCategoryDeleted(mergeCategoryPair(copiaViva, cancellata)), true);
  assert.equal(visibleCategories(mergeCategoryLists([copiaViva], [cancellata])).length, 0);
});

test('ripristino: annullare una cancellazione vince, anche a sincronizzazione già avvenuta', () => {
  const cancellata = deleteCategory(cat('c1', 'Palestra'), 1000);
  const ripristinata = restoreCategory(cancellata, 2000);
  assert.equal(isCategoryDeleted(ripristinata), false);
  assert.equal(isCategoryDeleted(mergeCategoryPair(cancellata, ripristinata)), false);
  // E una cancellazione ANCORA successiva richiude davvero.
  assert.equal(isCategoryDeleted(mergeCategoryPair(ripristinata, deleteCategory(ripristinata, 3000))), true);
});

test('fondere due volte non cambia più niente, e l ordine non conta', () => {
  const a = touchCategory(cat('c1', 'Palestra'), 1000);
  const b = touchCategory(cat('c1', 'Palestra e piscina'), 2000);
  const ab = mergeCategoryPair(a, b);
  assert.deepEqual(mergeCategoryPair(ab, ab), ab);
  assert.deepEqual(mergeCategoryPair(ab, a), ab);
  assert.equal(mergeCategoryPair(b, a).name, mergeCategoryPair(a, b).name);
});

// Il caso che ha motivato tutto: la spesa arriva, la categoria no.
test('la categoria di una spesa già sincronizzata non deve più mancare sull altro dispositivo', () => {
  const suTelefono = [cat('custom-palestra-ab12', 'Palestra')];
  const suPortatile = [];
  const dopoSync = mergeCategoryLists(suPortatile, suTelefono);
  const trovata = dopoSync.find(c => c.id === 'custom-palestra-ab12');
  assert.ok(trovata, 'senza questa, la spesa comparirebbe come "Altro" sul portatile');
  assert.equal(trovata.name, 'Palestra');
  assert.equal(trovata.icon, '<svg/>');
});

test('dati sporchi o incompleti non rompono la fusione', () => {
  const c = cat('c1', 'Palestra');
  assert.equal(mergeCategoryPair(c, null), c);
  assert.equal(mergeCategoryPair(null, c), c);
  assert.equal(mergeCategoryPair(c, cat('c2', 'Altra')).name, 'Palestra'); // id diversi: non si fondono
  assert.deepEqual(mergeCategoryLists([c], [null, undefined, {}]), [c]);
  assert.deepEqual(mergeCategoryLists(), []);
});

test('a scala: 200 categorie da due dispositivi, nessun id perso né duplicato', () => {
  const a = Array.from({ length: 100 }, (_, i) => touchCategory(cat(`a${i}`, `Cat A ${i}`)));
  const b = Array.from({ length: 100 }, (_, i) => touchCategory(cat(`b${i}`, `Cat B ${i}`)));
  const fuse = mergeCategoryLists(a, b);
  assert.equal(fuse.length, 200);
  assert.equal(new Set(fuse.map(c => c.id)).size, 200);
});
