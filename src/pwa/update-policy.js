export const CANONICAL_APP_ORIGIN = 'https://momentum-finance.pages.dev';

// Only legacy Netlify production mirrors follow the canonical deployment.
// Pages previews, custom hosts and native shells have independent versions.
export function checksCanonicalVersion(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.hostname.endsWith('.netlify.app') && !url.hostname.includes('--');
  } catch { return false; }
}

// Persist across reloads. If a CDN keeps returning the old bundle, a flag in
// memory would reset at every boot and trap the user in an endless reload.
export function claimVersionReload(storage, current, remote) {
  if (typeof remote !== 'string' || !remote || remote === current) return false;
  try {
    const key = 'momentum-version-reload';
    if (storage.getItem(key) === current) return false;
    storage.setItem(key, current);
    return true;
  } catch { return false; }
}
