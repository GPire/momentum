import test from 'node:test';
import assert from 'node:assert/strict';
import { companyIdentity } from './identity.js';
test('direct OIDC verifies API tokens and isolates authority without Access fallback',async()=>{
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);
 const env={IDENTITY_DRIVER:'oidc',OIDC_ISSUER:'https://identity.test/realm',OIDC_JWKS_URL:'https://identity.test/realm/certs',OIDC_AUDIENCE:'momentum-api',OIDC_SCOPE:'momentum:company'};
 const claims={iss:env.OIDC_ISSUER,aud:env.OIDC_AUDIENCE,sub:'employee',scope:env.OIDC_SCOPE,exp:Date.now()/1000+120,email:'A@EXAMPLE.COM',email_verified:true};
 const b64=v=>Buffer.from(v).toString('base64url');
 async function request(changes={},header={typ:'at+jwt'}){
  const message=b64(JSON.stringify({alg:'RS256',kid:'key',...header}))+'.'+b64(JSON.stringify({...claims,...changes}));
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(message));
  return new Request('https://momentum.test',{headers:{Authorization:'Bearer '+message+'.'+b64(signature),'Cf-Access-Jwt-Assertion':'ignored'}});
 }
 const fetchKeys=async(url,options)=>{assert.equal(options.redirect,'error');return Response.json({keys:[{...jwk,kid:'key'}]})};
 const identity=await companyIdentity(await request(),env,fetchKeys);
 assert.match(identity.subject,/^oidc:[a-f0-9]{64}$/);assert.equal(identity.email,'a@example.com');
 assert.equal((await companyIdentity(await request({email_verified:false}),env,fetchKeys)).email,null);
 for(const changes of [{aud:'web-login'},{scope:'openid'},{exp:1},{iss:'https://evil.test'}])await assert.rejects(companyIdentity(await request(changes),env,fetchKeys));
 await assert.rejects(companyIdentity(await request({}, {typ:'JWT'}),env,fetchKeys));
 assert.equal((await companyIdentity(await request({typ:'Bearer'},{typ:'JWT'}),env,fetchKeys)).subject,identity.subject);
 const other={...env,OIDC_ISSUER:'https://identity.test/another'};
 assert.notEqual((await companyIdentity(await request({iss:other.OIDC_ISSUER}),other,fetchKeys)).subject,identity.subject);
 await assert.rejects(companyIdentity(await request(),{...env,OIDC_JWKS_URL:'https://evil.test/keys'},fetchKeys));
 await assert.rejects(companyIdentity(new Request('https://momentum.test',{headers:{'Cf-Access-Jwt-Assertion':'anything'}}),env,fetchKeys));
 await assert.rejects(companyIdentity(await request(),{...env,IDENTITY_DRIVER:'typo'},fetchKeys));
 const forged=await request();const token=forged.headers.get('Authorization').split('.');token[1]=b64(JSON.stringify({...claims,sub:'owner'}));forged.headers.set('Authorization',token.join('.'));
 await assert.rejects(companyIdentity(forged,env,fetchKeys));
});
