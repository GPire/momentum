import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { getMigrations } from 'better-auth/db/migration';
import { createMomentumAuth } from './auth.js';

test('real auth database: verified email, session, origin rejection, passkey challenge and logout',async()=>{
 const database=new DatabaseSync(':memory:');let verification,reset;
 const auth=createMomentumAuth({database,baseURL:'http://localhost:4321',allowLoopback:true,secret:crypto.randomUUID()+crypto.randomUUID(),sendVerificationEmail:async data=>{verification=data.url},sendResetPassword:async data=>{reset=data.url}});
 try{
 await (await getMigrations(auth.options)).runMigrations();
 const request=(path,body,cookie='',origin='http://localhost:4321')=>auth.handler(new Request('http://localhost:4321/api/auth'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})}));
 const credentials={email:'synthetic@example.test',password:'Synthetic-test-password-872!',name:'Synthetic'};
 const signup=await request('/sign-up/email',credentials);assert.equal(signup.status,200);assert.ok(verification);
 assert.equal((await request('/sign-in/email',credentials)).status,403);
 const verified=await auth.handler(new Request(verification));assert.ok([200,302].includes(verified.status));
 const signin=await request('/sign-in/email',credentials);assert.equal(signin.status,200);
 const cookie=signin.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.ok(cookie);
 const session=await(await request('/get-session',null,cookie)).json();assert.equal(session.user.email,credentials.email);
 assert.equal((await request('/sign-out',{},cookie,'https://evil.test')).status,403);
 const challenge=await request('/passkey/generate-register-options',null,cookie);assert.equal(challenge.status,200);
 const options=await challenge.json();assert.ok(options.challenge);assert.equal(options.rp.name,'Momentum');
 assert.equal((await request('/request-password-reset',{email:credentials.email,redirectTo:'http://localhost:4321/reset'})).status,200);
 assert.ok(reset);const token=new URL(reset).pathname.split('/').pop();
 assert.equal((await request('/reset-password',{token,newPassword:'New-synthetic-password-991!'})).status,200);
 assert.equal(await(await request('/get-session',null,cookie)).json(),null);
 assert.notEqual((await request('/sign-in/email',credentials)).status,200);
 assert.equal((await request('/sign-in/email',{...credentials,password:'New-synthetic-password-991!'})).status,429);
 // Reset only the synthetic limiter bucket, leaving production throttling intact.
 database.exec('DELETE FROM rateLimit');
 const renewed=await request('/sign-in/email',{...credentials,password:'New-synthetic-password-991!'});assert.equal(renewed.status,200);
 const renewedCookie=renewed.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 assert.equal((await request('/sign-out',{},renewedCookie)).status,200);
 assert.equal(await(await request('/get-session',null,renewedCookie)).json(),null);
 assert.equal(await(await request('/get-session',null,cookie)).json(),null);
 }finally{database.close()}
});
test('auth refuses incomplete delivery and insecure nonlocal configuration',()=>{
 assert.throws(()=>createMomentumAuth({baseURL:'http://example.com'}));
 assert.throws(()=>createMomentumAuth({baseURL:'https://example.com',secret:'short'}));
});
