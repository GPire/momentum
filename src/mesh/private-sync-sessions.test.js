import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity } from './device-trust.js';
import { PrivateSyncSessions } from './private-sync-sessions.js';
const fp = n => 'a=fingerprint:sha-256 ' + Array(32).fill(n).join(':');
const entry = (a='AA', b='BB') => ({ channel: { readyState: 'open' }, pc: { localDescription: { sdp: fp(a) }, remoteDescription: { sdp: fp(b) } } });
async function fixture() {
  const a=await generateIdentity(), b=await generateIdentity();
  let granted=true, trusted=[{publicKey:b.publicKey}];
  const gate=new PrivateSyncSessions({scope:()=>'personal-vault-test-001',identity:async()=>a,trusted:()=>trusted,consent:()=>granted});
  const remote=new PrivateSyncSessions({scope:()=>'personal-vault-test-001',identity:async()=>b,trusted:()=>[],consent:()=>false});
  return {a,b,gate,remote,revoke:()=>{granted=false;},forget:()=>{trusted=[];}};
}
test('proof authorizes only the explicitly consented current channel', async()=>{
  const f=await fixture(), e=entry();
  assert.equal(f.gate.allows('b',e),false);
  const request=f.gate.begin('b',e,f.b.publicKey);
  const proof=await f.remote.answer(entry('BB','AA'),request);
  assert.equal(await f.gate.complete('b',e,proof),true);
  assert.equal(f.gate.allows('b',entry()),false);
  f.revoke(); assert.equal(f.gate.allows('b',e),false);
});
test('unknown devices, missing DTLS and relayed proofs are rejected', async()=>{
  const f=await fixture();
  assert.equal(f.gate.begin('x',entry(),f.a.publicKey),null);
  assert.equal(f.gate.begin('b',{channel:{readyState:'open'}},f.b.publicKey),null);
  const request=f.gate.begin('b',entry(),f.b.publicKey);
  assert.equal(await f.remote.answer(entry('AA','CC'),request),null);
});
test('old proof cannot authorize a replacement session or survive revocation', async()=>{
  const f=await fixture(), e=entry();
  const proof=await f.remote.answer(entry(),f.gate.begin('b',e,f.b.publicKey));
  f.gate.begin('b',e,f.b.publicKey);
  assert.equal(await f.gate.complete('b',e,proof),false);
  const next=await f.remote.answer(entry(),f.gate.begin('b',e,f.b.publicKey));
  f.forget(); assert.equal(await f.gate.complete('b',e,next),false);
});
test('expired challenges and duplicate responses fail closed', async()=>{
  const f=await fixture(),e=entry(); let clock=0;f.gate.now=()=>clock;
  const proof=await f.remote.answer(entry(),f.gate.begin('b',e,f.b.publicKey));
  clock=60001;assert.equal(await f.gate.complete('b',e,proof),false);
  const fresh=await f.remote.answer(entry(),f.gate.begin('b',e,f.b.publicKey));
  assert.equal(await f.gate.complete('b',e,fresh),true);
  assert.equal(await f.gate.complete('b',e,fresh),false);
});
test('an older verification cannot authorize a new challenge while crypto is pending', async()=>{
  const f=await fixture(),e=entry();
  const proof=await f.remote.answer(entry(),f.gate.begin('b',e,f.b.publicKey));
  const pending=f.gate.complete('b',e,proof);
  f.gate.begin('b',e,f.b.publicKey);
  assert.equal(await pending,false);
  assert.equal(f.gate.allows('b',e),false);
});
test('trusted does not mean consented and closed channels stop authorization', async()=>{
  const f=await fixture(),e=entry();
  const proof=await f.remote.answer(entry(),f.gate.begin('b',e,f.b.publicKey));
  assert.equal(await f.gate.complete('b',e,proof),true);
  e.channel.readyState='closed';assert.equal(f.gate.allows('b',e),false);
  f.revoke();assert.equal(f.gate.begin('b',entry(),f.b.publicKey),null);
});
test('different personal archives never authorize each other', async()=>{
  const f=await fixture(),e=entry();
  const request=f.gate.begin('b',e,f.b.publicKey);
  f.remote.scope=()=> 'another-person-vault-002';
  assert.equal(await f.remote.answer(entry(),request),null);
  assert.equal(f.gate.allows('b',e),false);
});
test('switching archives invalidates an authenticated session immediately', async()=>{
  const f=await fixture(),e=entry();
  const proof=await f.remote.answer(entry(),f.gate.begin('b',e,f.b.publicKey));
  assert.equal(await f.gate.complete('b',e,proof),true);
  f.gate.scope=()=> 'another-person-vault-002';
  assert.equal(f.gate.allows('b',e),false);
});
test('no archive identity means no private session', async()=>{
  const f=await fixture(); f.gate.scope=()=>null;
  assert.equal(f.gate.begin('b',entry(),f.b.publicKey),null);
});
