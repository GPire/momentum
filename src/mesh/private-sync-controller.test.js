import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity } from './device-trust.js';
import { bindPrivateSync } from './private-sync-controller.js';
const fp = n => 'a=fingerprint:sha-256 '+Array(32).fill(n).join(':');
async function fixture(overrides = {}) {
 const a=await generateIdentity(),b=await generateIdentity(),queue=[];
 const A={peers:new Map(),requestSync(){this.synced=(this.synced||0)+1;}},B={peers:new Map(),requestSync(){this.synced=(this.synced||0)+1;}};
 const ea={pc:{localDescription:{sdp:fp('AA')},remoteDescription:{sdp:fp('BB')}},channel:{readyState:'open',send:data=>queue.push(()=>B.onPrivateSyncControl('a',JSON.parse(data),eb))}};
 const eb={pc:{localDescription:{sdp:fp('BB')},remoteDescription:{sdp:fp('AA')}},channel:{readyState:'open',send:data=>queue.push(()=>A.onPrivateSyncControl('b',JSON.parse(data),ea))}};
 A.peers.set('b',ea);B.peers.set('a',eb);
 let allowB=true;
 const ca=bindPrivateSync(A,{identity:async()=>a,trusted:()=>[{publicKey:b.publicKey}],consent:()=>true,scope:()=> 'personal-test-archive',peerKey:()=>b.publicKey,...overrides});
 const cb=bindPrivateSync(B,{identity:async()=>b,trusted:()=>[{publicKey:a.publicKey}],consent:()=>allowB,scope:()=> 'personal-test-archive',peerKey:()=>a.publicKey});
 return {a,b,A,B,ea,eb,ca,cb,denyB:()=>{allowB=false;},allowB:()=>{allowB=true;},async drain(){let n=0;while(queue.length){assert.ok(++n<30,'bounded handshake');await queue.shift()();}}};
}
test('both sides authenticate before movement sync, with bounded ready exchange',async()=>{
 const f=await fixture();f.ca.start('b',f.b.publicKey);await f.drain();
 assert.equal(f.A.authorizePrivatePeer('b','sync_txs',f.ea),true);
 assert.equal(f.B.authorizePrivatePeer('a','sync_txs',f.eb),true);
 assert.ok(f.A.synced && f.B.synced);
 for(const type of ['split_share','weights','user_data_share','trip_share']) assert.equal(f.A.authorizePrivatePeer('b',type,f.ea),false);
});
test('one-sided consent cannot activate either side',async()=>{
 const f=await fixture();f.denyB();f.ca.start('b',f.b.publicKey);await f.drain();
 assert.equal(f.A.authorizePrivatePeer('b','sync_txs',f.ea),false);assert.equal(f.A.synced,undefined);assert.equal(f.B.synced,undefined);
});
test('revocation removes live access',async()=>{
 const f=await fixture();f.ca.start('b',f.b.publicKey);await f.drain();f.ca.revoke('b');
 assert.equal(f.A.authorizePrivatePeer('b','sync_txs',f.ea),false);
});
test('consent granted later restarts the previously unanswered exchange',async()=>{
 const f=await fixture();f.denyB();f.ca.start('b',f.b.publicKey);await f.drain();
 f.allowB();f.cb.start('a',f.a.publicKey);await f.drain();
 assert.equal(f.A.authorizePrivatePeer('b','sync_txs',f.ea),true);
 assert.equal(f.B.authorizePrivatePeer('a','sync_txs',f.eb),true);
});
test('lost challenge is retried, retry stops after authentication',async()=>{
 const jobs=new Map();let id=0;
 const f=await fixture({schedule:fn=>{jobs.set(++id,fn);return id;},cancel:key=>jobs.delete(key)});
 f.denyB();f.ca.start('b',f.b.publicKey);await f.drain();assert.equal(jobs.size,1);
 f.allowB();const [key,job]=jobs.entries().next().value;jobs.delete(key);job();await f.drain();
 assert.equal(f.A.authorizePrivatePeer('b','sync_txs',f.ea),true);assert.equal(jobs.size,0);
});
test('retries are bounded, timeout permits a fresh user attempt',async()=>{
 const jobs=new Map(),states=[];let id=0;
 const f=await fixture({schedule:fn=>{jobs.set(++id,fn);return id;},cancel:key=>jobs.delete(key),status:(peer,state)=>states.push(state)});
 f.denyB();f.ca.start('b',f.b.publicKey);await f.drain();
 for(let i=0;i<3;i++){const [key,job]=jobs.entries().next().value;jobs.delete(key);job();await f.drain();}
 assert.equal(jobs.size,0);assert.equal(states.at(-1),'timeout');
 assert.equal(f.A.authorizePrivatePeer('b','sync_txs',f.ea),false);
 f.allowB();assert.equal(f.ca.start('b',f.b.publicKey),true);await f.drain();
 assert.equal(f.A.authorizePrivatePeer('b','sync_txs',f.ea),true);f.ca.dispose();
});
test('revocation cancels pending network work',async()=>{
 const jobs=new Map();let id=0;
 const f=await fixture({schedule:fn=>{jobs.set(++id,fn);return id;},cancel:key=>jobs.delete(key)});
 f.ca.start('b',f.b.publicKey);assert.equal(jobs.size,1);f.ca.revoke('b');assert.equal(jobs.size,0);
});

test('a cancelled timer cannot revoke the replacement session',async()=>{
 const jobs=new Map();let id=0;
 const f=await fixture({schedule:fn=>{jobs.set(++id,fn);return id;},cancel:key=>jobs.delete(key)});
 f.denyB();f.ca.start('b',f.b.publicKey);await f.drain();
 const staleJob=jobs.values().next().value;
 f.ca.revoke('b');f.allowB();f.ca.start('b',f.b.publicKey);await f.drain();
 staleJob();
 assert.equal(f.A.authorizePrivatePeer('b','sync_txs',f.ea),true);
 assert.equal(jobs.size,0);f.ca.dispose();f.cb.dispose();
});

test('removing trust stops retries even if consent remains',async()=>{
 const jobs=new Map(),trusted=[];let id=0;
 const f=await fixture({trusted:()=>trusted,schedule:fn=>{jobs.set(++id,fn);return id;},cancel:key=>jobs.delete(key)});
 trusted.push({publicKey:f.b.publicKey});f.denyB();f.ca.start('b',f.b.publicKey);await f.drain();
 trusted.length=0;
 const [key,job]=jobs.entries().next().value;jobs.delete(key);job();await f.drain();
 assert.equal(jobs.size,0);assert.equal(f.A.authorizePrivatePeer('b','sync_txs',f.ea),false);
 assert.equal(f.ca.sessions.sessions.size,0);f.ca.dispose();f.cb.dispose();
});
