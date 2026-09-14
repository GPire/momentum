import { createCompanyWorker } from '../company/worker.js';
import { digestBytes } from '../../src/trips/company-attachments.js';

// Server composition only: never accept an identity resolver from request data.
export function createSessionIdentityResolver(auth, authority) {
  const origin = new URL(auth.options.baseURL).origin;
  if (typeof authority !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(authority)) throw Error('Stable identity authority required');
  return async (request, env) => {
    if (new URL(request.url).origin !== origin || env.APP_ORIGIN !== origin) throw Error('Wrong origin');
    if (!['GET','HEAD'].includes(request.method) && request.headers.get('Origin') !== origin) throw Error('Wrong request origin');
    // Cookies only; caller-supplied identity headers and bearer tokens are ignored.
    const headers = new Headers();
    if (request.headers.has('Cookie')) headers.set('Cookie', request.headers.get('Cookie'));
    const session = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
    if (!session || session.user.emailVerified !== true || typeof session.user.id !== 'string' || !session.user.id ||
        session.session.userId !== session.user.id || new Date(session.session.expiresAt).getTime() <= Date.now()) throw Error('Unauthenticated');
    const subject = 'momentum:' + await digestBytes(new TextEncoder().encode(JSON.stringify([authority, session.user.id])));
    return { subject, email: session.user.email.trim().toLowerCase() };
  };
}
export function createSessionCompanyWorker(auth, authority) {
  return createCompanyWorker(createSessionIdentityResolver(auth, authority));
}
