// Cache only public verification keys, never sessions, memberships or decisions.
export function signingKeyResolver(fetchKeys=fetch,now=Date.now){
 const cache=new Map();
 return async(url,kid)=>{
  let entry=cache.get(url);
  if(!entry||entry.expires<=now()){
   if(cache.size>=16)cache.delete(cache.keys().next().value);
   entry={expires:Infinity,keys:new Map()};cache.set(url,entry);
   entry.loading=(async()=>{
    const response=await fetchKeys(url,{redirect:'error',signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw Error('Identity unavailable');
    const jwks=await response.json();
    if(!Array.isArray(jwks.keys)||jwks.keys.length>64)throw Error('Invalid signing keys');
    const policy=response.headers.get('Cache-Control')||'';
    const age=/max-age=(\d+)/i.exec(policy)?.[1];
    const ttl=/no-store|no-cache/i.test(policy)?0:Math.min(60,age===undefined?60:Number(age));
    entry.expires=now()+ttl*1000;return jwks.keys;
   })();
  }
  let keys;try{keys=await entry.loading}catch(error){if(cache.get(url)===entry)cache.delete(url);throw error}
  const candidates=keys.filter(key=>key.kid===kid&&key.kty==='RSA'&&(!key.use||key.use==='sig')&&(!key.alg||key.alg==='RS256'));
  if(candidates.length!==1)throw Error('Unknown or ambiguous identity key');
  if(!entry.keys.has(kid))entry.keys.set(kid,crypto.subtle.importKey('jwk',candidates[0],{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']));
  return entry.keys.get(kid);
 };
}
const resolvers=new WeakMap();
export function publicSigningKey(url,kid,fetchKeys=fetch){
 if(!resolvers.has(fetchKeys))resolvers.set(fetchKeys,signingKeyResolver(fetchKeys));
 return resolvers.get(fetchKeys)(url,kid);
}
