import test from 'node:test';
import assert from 'node:assert/strict';
import { keyboardViewportInset } from './viewport-inset.js';

test('keeps room for an overlay keyboard and avoids double subtraction when the layout resizes', () => {
  assert.equal(keyboardViewportInset(844, 510), 334);
  assert.equal(keyboardViewportInset(510, 510), 0);
});
test('pinch zoom does not enable keyboard compression', () => {
  assert.equal(keyboardViewportInset(844, 422, 2), 0);
  assert.equal(keyboardViewportInset(844, 675, 1.25), 0);
});
test('handles rotation, expanded windows and invalid measurements', () => {
  assert.equal(keyboardViewportInset(390, 390), 0);
  assert.equal(keyboardViewportInset(844, 900), 0);
  assert.equal(keyboardViewportInset(NaN, 500), 0);
  assert.equal(keyboardViewportInset(844, 0), 0);
});
