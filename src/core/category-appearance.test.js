import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCategories, editCategoryAppearance } from './category-appearance.js';
import { mergeCategoryLists } from './custom-categories-merge.js';

test('renaming a built-in preserves IDs, transactions and hashes across sync', () => {
  const base = [{ id:'food', name:'Food', type:'uscita', color:'#fff', icon:'svg' }];
  const tx = { id:1, category:'food', amount:12, hash:'original' };
  const before = JSON.stringify(tx);
  const overrides = editCategoryAppearance([], base[0], '  La mia spesa  ', '#123456', 'new-svg', 123);
  const received = mergeCategoryLists([], JSON.parse(JSON.stringify(overrides)));
  const result = resolveCategories(base, received);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, tx.category);
  assert.equal(result[0].displayName, 'La mia spesa');
  assert.equal(result[0].type, 'uscita');
  assert.equal(JSON.stringify(tx), before);
  assert.equal(base[0].name, 'Food');
});
test('repeated edits do not duplicate categories or change unrelated entries', () => {
  const cat = {id:'custom-1',name:'Original',type:'entrata'};
  const other = {id:'other',name:'Other',type:'uscita'};
  const once = editCategoryAppearance([cat,other], cat, 'First', '#123456', 'svg', 1);
  const twice = editCategoryAppearance(once, once[1], 'Second', '#123456', 'svg', 2);
  assert.equal(twice.length, 2);
  assert.deepEqual(twice[0], other);
  assert.equal(twice[1].displayName, 'Second');
});
test('empty, oversized and markup names are rejected', () => {
  for (const name of ['', '   ', 'a'.repeat(25), '<img src=x>', 'a\u0000b']) {
    assert.throws(() => editCategoryAppearance([], {id:'food'}, name, '#fff', 'svg'));
  }
});
