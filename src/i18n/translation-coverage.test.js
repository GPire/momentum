import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {t, UI_LANGS} from './ui-strings.js';

// Inspect the source dictionaries: t() deliberately falls back, so it cannot prove coverage.
const source = readFileSync(new URL('./ui-strings.js',import.meta.url),'utf8');
const start = source.indexOf('const S = {');
const end = source.indexOf('// t(key, lang',start);
assert.ok(start >= 0 && end > start, 'dictionary source boundaries');
const literal = source.slice(start + 'const S = '.length,end).trim().replace(/;$/,'');
const dictionaries = runInNewContext(`(${literal})`,{}, {timeout:1000});
const keys = [...new Set(Object.values(dictionaries).flatMap(Object.keys))];
for (const lang of UI_LANGS) test(`every UI dictionary key is supplied directly in ${lang}, without fallback`,()=>{
 const missing = keys.filter(key=>!Object.hasOwn(dictionaries[lang],key));
 assert.deepEqual(missing,[]);
 for(const key of keys) assert.equal(typeof dictionaries[lang][key],typeof dictionaries.en[key],`${lang}: ${key}`);
});

test('new fiscal translations preserve dynamic values without raw placeholders',()=>{
 for(const lang of UI_LANGS){
  for(const [key,args] of [['esResultTitle',['2345']],['esRetencionNote',['17']],['esTramoChanged',['1357','2468']],['esBaseChoiceNote',['9876']],['esCardNoteFn',[2,'1234','567','890']],['chResultTitle',['5432']],['chAvsDegressiveText',['8765','432']]]){
   const value=t(key,lang,...args);
   for(const arg of args)assert.ok(value.includes(String(arg)),`${lang}: ${key} lost ${arg}`);
   assert.ok(!/\{\d+\}|undefined/.test(value),`${lang}: ${key}`);
  }
 }
});

test('the QA language chooser exposes every language already supported by the interface',()=>{
 const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
 const select=html.match(/<select id="qa-language-select"[\s\S]*?<\/select>/)?.[0];
 assert.ok(select);
 const offered=[...select.matchAll(/<option value="([a-z]+)"/g)].map(match=>match[1]);
 assert.deepEqual(offered.sort(),[...UI_LANGS].sort());
});
