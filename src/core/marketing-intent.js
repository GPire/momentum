// Public landing links may request only these local, user-visible actions.
const allowed = new Set(['split', 'trips', 'tax']);

export function marketingIntent(url) {
  const parsed = new URL(url);
  const type = parsed.searchParams.get('intent');
  if (!allowed.has(type)) return null;
  parsed.searchParams.delete('intent');
  return { type, cleanUrl: parsed.pathname + parsed.search + parsed.hash };
}

export function splitIntentUrl(url) {
  const request = marketingIntent(url);
  return request?.type === 'split' ? request.cleanUrl : null;
}
