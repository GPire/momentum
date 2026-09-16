import test from 'node:test';
import assert from 'node:assert/strict';
import { signingKeyResolver } from './signing-keys.js';
test('100 concurrent verifications share public key retrieval and refresh after 60 seconds',async()=>{
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);let calls=0,time=0,kid='first',fail=false;
 const resolve=signingKeyResolver(async()=>{calls++;if(fail)return new Response('',{status:503});return Response.json({keys:[{...jwk,kid}]})},()=>time);
 const keys=await Promise.all(Array.from({length:100},()=>resolve('https://id.test/certs','first')));
 assert.equal(calls,1);assert.ok(keys.every(key=>key===keys[0]));
 await assert.rejects(resolve('https://id.test/certs','random'),/Unknown/);assert.equal(calls,1);
 time=60001;kid='second';const changed=await resolve('https://id.test/certs','second');assert.ok(changed);assert.equal(calls,2);
 await assert.rejects(resolve('https://id.test/certs','first'),/Unknown/);
 time=120002;fail=true;await assert.rejects(resolve('https://id.test/certs','second'),/unavailable/);
 fail=false;assert.ok(await resolve('https://id.test/certs','second'));assert.equal(calls,4);
});
test('public key cache respects no-store and keeps providers isolated',async()=>{
 let calls=0;
 const resolve=signingKeyResolver(async()=>{calls++;return Response.json({keys:[]},{headers:{'Cache-Control':'no-store'}})});
 await assert.rejects(resolve('https://a.test/keys','none'));
 await assert.rejects(resolve('https://a.test/keys','none'));
 await assert.rejects(resolve('https://b.test/keys','none'));
 assert.equal(calls,3);
});
