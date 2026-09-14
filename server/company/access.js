// Only the configured Access issuer supplies keys. Never follow URLs in a JWT.
const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
export async function accessIdentity(request, env, fetchKeys = fetch) {
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER || '') || !env.ACCESS_AUD) throw new Error('Access not configured');
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16384) throw new Error('Missing identity');
  const claims = await verifyIdentityToken(token,env.ACCESS_ISSUER,env.ACCESS_AUD,`${env.ACCESS_ISSUER}/cdn-cgi/access/certs`,fetchKeys);
  return { subject: claims.sub, email: claims.email_verified !== false && typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : null };
}
export async function accessSubject(request, env, fetchKeys = fetch) { return (await accessIdentity(request, env, fetchKeys)).subject; }

export async function verifyIdentityToken(token,issuer,audience,jwksUrl,fetchKeys=fetch){
  if(typeof token!=='string'||token.length>16384)throw Error('Invalid identity');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid identity');
  const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  const now = Date.now() / 1000;
  if (header.alg !== 'RS256' || header.crit !== undefined || typeof header.kid !== 'string' || claims.iss !== issuer ||
      !(Array.isArray(claims.aud) ? claims.aud.includes(audience) : claims.aud === audience) ||
      !Number.isFinite(claims.exp) || claims.exp <= now ||
      (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now)) ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255) throw new Error('Invalid identity');
  const response = await fetchKeys(jwksUrl, { redirect: 'error', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Identity unavailable');
  const jwks = await response.json();
  const jwk = jwks.keys?.find(key => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) throw new Error('Unknown identity key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) throw new Error('Invalid signature');
  return claims;
}
