import test from 'node:test';
import assert from 'node:assert/strict';
import { taxReviewProgress } from './tax-review.js';
import { taxJourneyCopy } from '../i18n/tax-journey.js';
test('unanswered and uncertain answers never become negative answers', () => {
  assert.deepEqual(taxReviewProgress(['a','b'], {a:false}), {answered:1,total:2,complete:false,uncertain:[],answers:{a:false}});
  const uncertain = taxReviewProgress(['a','b'], {a:false,b:'unknown'});
  assert.equal(uncertain.complete, true);
  assert.deepEqual(uncertain.uncertain, ['b']);
  assert.deepEqual(uncertain.answers, {a:false});
});
test('accepts only explicit answers and ignores stale unrelated keys', () => {
  assert.equal(taxReviewProgress(['a'], {a:'false'}).complete,false);
  assert.deepEqual(taxReviewProgress(['a','b'], {a:true,b:false,c:true}).answers,{a:true,b:false});
});
test('review and export controls are translated in all supported languages', () => {
  const keys = Object.keys(taxJourneyCopy('en'));
  for (const lang of ['it','en','de','fr','es','nl','pt']) {
    const copy = taxJourneyCopy(lang);
    assert.deepEqual(Object.keys(copy),keys);
    assert.ok(Object.values(copy).every(value => typeof value === 'string' && value.length));
  }
  assert.deepEqual(taxJourneyCopy('unsupported'),taxJourneyCopy('en'));
});
