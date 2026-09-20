import { simpleHash } from './utils.js';

export const VAULT_MAIN_KEY = 'omega_core_db';
export const VAULT_MANIFEST_KEY = 'omega_vault_manifest';
export const VAULT_LEGACY_SHADOW_KEY = 'omega_shadow_vault';

const utf8Size = text => {
  try { return new TextEncoder().encode(text).byteLength; }
  catch { return unescape(encodeURIComponent(text)).length; }
};

export function vaultManifest(payload, state, savedAt = new Date().toISOString()) {
  return {
    format: 'momentum-vault-manifest-v1',
    revision: Number(state?.storageRevision) || 0,
    hash: simpleHash(payload),
    bytes: utf8Size(payload),
    transactions: Object.values(state?.transactions || {}).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0),
    savedAt,
  };
}

export function readVaultManifest(storage) {
  try {
    const value = JSON.parse(storage.getItem(VAULT_MANIFEST_KEY));
    return value?.format === 'momentum-vault-manifest-v1' && typeof value.hash === 'string' ? value : null;
  } catch { return null; }
}

export function manifestMatches(payload, manifest) {
  return !!manifest && manifest.hash === simpleHash(payload) && manifest.bytes === utf8Size(payload);
}

// localStorage keeps one immediately readable snapshot plus a tiny integrity
// manifest. The historical base64 shadow duplicated the whole archive and used
// ~33% more space than the original; it is read for compatibility elsewhere,
// but removed after a verified main write. `durableSafe` permits freeing that
// legacy copy before retrying a quota-blocked write only after IndexedDB has
// retained the exact new payload.
export function writeLocalVaultSnapshot(storage, payload, state, { durableSafe = false, manifest: suppliedManifest = null } = {}) {
  const previous = storage.getItem(VAULT_MAIN_KEY);
  const currentManifest = readVaultManifest(storage);
  if (previous === payload && manifestMatches(payload, currentManifest)) {
    try { storage.removeItem(VAULT_LEGACY_SHADOW_KEY); } catch {}
    return { changed: false, manifest: currentManifest };
  }
  const preparedManifest = suppliedManifest || vaultManifest(payload, state);
  const write = () => {
    storage.setItem(VAULT_MAIN_KEY, payload);
    storage.setItem(VAULT_MANIFEST_KEY, JSON.stringify(preparedManifest));
    try { storage.removeItem(VAULT_LEGACY_SHADOW_KEY); } catch {}
    return preparedManifest;
  };
  try { return { changed: true, manifest: write() }; }
  catch (error) {
    if (!durableSafe) throw error;
    try { storage.removeItem(VAULT_LEGACY_SHADOW_KEY); } catch {}
    return { changed: true, manifest: write(), recoveredQuota: true };
  }
}

export function chooseVaultCandidate(candidates, countTransactions) {
  const priority = { 'localStorage(main)': 3, indexedDB: 2, 'localStorage(shadow)': 1 };
  return (candidates || []).reduce((best, candidate) => {
    if (!best) return candidate;
    const tx = countTransactions(candidate.state) - countTransactions(best.state);
    if (tx) return tx > 0 ? candidate : best;
    const revision = (Number(candidate.state?.storageRevision) || 0) - (Number(best.state?.storageRevision) || 0);
    if (revision) return revision > 0 ? candidate : best;
    return (priority[candidate.source] || 0) > (priority[best.source] || 0) ? candidate : best;
  }, null);
}
