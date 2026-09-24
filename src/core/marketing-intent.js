// Only known public landing intents may request an in-app action.
export function splitIntentUrl(url) {
  const parsed = new URL(url);
  if (parsed.searchParams.get('intent') !== 'split') return null;
  parsed.searchParams.delete('intent');
  return parsed.pathname + parsed.search + parsed.hash;
}
