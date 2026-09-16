import { betterAuth } from 'better-auth';
import { passkey } from '@better-auth/passkey';

// Separate identity database. No migrations or mail delivery happen at import time.
export function createMomentumAuth({database,baseURL,secret,sendVerificationEmail,sendResetPassword,allowLoopback=false}){
 const url=new URL(baseURL);
 const local=allowLoopback&&url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname);
 if((url.protocol!=='https:'&&!local)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Invalid authentication origin');
 if(!database||typeof secret!=='string'||secret.length<32||typeof sendVerificationEmail!=='function'||typeof sendResetPassword!=='function')throw Error('Authentication configuration incomplete');
 return betterAuth({
  database,baseURL:url.origin,secret,trustedOrigins:[url.origin],
  emailAndPassword:{enabled:true,requireEmailVerification:true,minPasswordLength:12,revokeSessionsOnPasswordReset:true,sendResetPassword},
  emailVerification:{sendVerificationEmail,sendOnSignUp:true,autoSignInAfterVerification:false},
  session:{expiresIn:86400*7,updateAge:86400,freshAge:300,cookieCache:{enabled:false}},
  rateLimit:{enabled:true,storage:'database',window:60,max:60},
  advanced:{useSecureCookies:!local},
  plugins:[passkey({rpID:url.hostname,rpName:'Momentum',origin:url.origin})],
 });
}
