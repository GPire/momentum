import { accessIdentity,verifyIdentityToken } from './access.js';
import { digestBytes } from '../../src/trips/company-attachments.js';
// One explicit authority per deployment. Never fall back after token rejection.
export async function companyIdentity(request,env,fetchKeys=fetch){
 if(!env.IDENTITY_DRIVER||env.IDENTITY_DRIVER==='access')return accessIdentity(request,env,fetchKeys);
 if(env.IDENTITY_DRIVER!=='oidc')throw Error('Unknown identity driver');
 const issuer=new URL(env.OIDC_ISSUER),jwks=new URL(env.OIDC_JWKS_URL);
 if([issuer,jwks].some(u=>u.protocol!=='https:'||u.username||u.password||u.hash||u.search)||issuer.origin!==jwks.origin||!env.OIDC_AUDIENCE||!env.OIDC_SCOPE)throw Error('Invalid OIDC configuration');
 const token=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(request.headers.get('Authorization')||'')?.[1];
 const claims=await verifyIdentityToken(token,env.OIDC_ISSUER,env.OIDC_AUDIENCE,env.OIDC_JWKS_URL,fetchKeys);
 const header=JSON.parse(atob(token.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));
 if(!(header.typ==='at+jwt'||(header.typ==='JWT'&&claims.typ==='Bearer'))||typeof claims.scope!=='string'||!claims.scope.split(' ').includes(env.OIDC_SCOPE))throw Error('API access token required');
 // Equal subject strings from different issuers must never share memberships.
 const subject='oidc:'+await digestBytes(new TextEncoder().encode(JSON.stringify([env.OIDC_ISSUER,claims.sub])));
 return {subject,email:claims.email_verified===true&&typeof claims.email==='string'?claims.email.trim().toLowerCase():null};
}
