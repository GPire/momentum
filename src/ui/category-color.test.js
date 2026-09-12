import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHex,hexToHsl,hslToHex,categoryInk} from './category-color.js';
test('custom colors accept only CSS hex colors and expand shorthand',()=>{
  assert.equal(normalizeHex(' #AbC '),'#aabbcc');
  assert.equal(normalizeHex('12ABef'),'#12abef');
  for(const value of ['red','#12','url(test)','#12345g','<svg>',null]) assert.equal(normalizeHex(value),null);
});
test('color controls represent black, white, greys and primary colors',()=>{
  for(const hex of ['#000000','#ffffff','#ff0000','#00ff00','#0000ff']) assert.equal(hslToHex(...hexToHsl(hex)),hex);
  assert.deepEqual(hexToHsl('#808080'),[0,0,50]);
  assert.equal(hslToHex(0,0,50),'#808080');
});
test('light and dark custom backgrounds keep a distinct icon foreground',()=>{
  assert.equal(categoryInk('#ffffff'),'#10131a');
  assert.equal(categoryInk('#000000'),'#ffffff');
  assert.equal(categoryInk('#ffff00'),'#10131a');
});
