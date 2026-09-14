import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionIdentityResolver } from './company-session.js';

const auth = {
  options: { baseURL: 'https://momentum.example/' },
  api: { getSession: async ({ headers }) => {
    assert.equal(headers.get('Authorization'), null);
    return { user: { id: 'user-1', email: 'Person@Example.test', emailVerified: true }, session: { userId: 'user-1', expiresAt: new Date(Date.now() + 60_000).toISOString() } };
  } },
};
test('session bridge binds verified Better Auth identity to a stable tenant-scoped subject', async () => {
  const resolve = createSessionIdentityResolver(auth, 'pilot');
  const first = await resolve(new Request('https://momentum.example/v1/me/companies', { headers: { Cookie: 'better-auth.session_token=x', Authorization: 'Bearer forged' } }), { APP_ORIGIN: 'https://momentum.example' });
  const second = await resolve(new Request('https://momentum.example/v1/me/companies', { headers: { Cookie: 'better-auth.session_token=x' } }), { APP_ORIGIN: 'https://momentum.example' });
  assert.equal(first.subject, second.subject);
  assert.match(first.subject, /^momentum:[a-f0-9]{64}$/);
  assert.equal(first.email, 'person@example.test');
});
test('session bridge rejects wrong origin and unverified or expired sessions', async () => {
  const badOrigin = createSessionIdentityResolver(auth, 'pilot');
  await assert.rejects(badOrigin(new Request('https://evil.example/'), { APP_ORIGIN: 'https://momentum.example' }), /Wrong origin/);
  const unverified = { options: auth.options, api: { getSession: async () => ({ user: { id: 'u', email: 'x@y.test', emailVerified: false }, session: { userId: 'u', expiresAt: new Date(Date.now() + 60_000).toISOString() } }) } };
  await assert.rejects(createSessionIdentityResolver(unverified, 'pilot')(new Request('https://momentum.example/'), { APP_ORIGIN: 'https://momentum.example' }), /Unauthenticated/);
});
