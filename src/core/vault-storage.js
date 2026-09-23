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
    const revision = (Number(candidate.state?.storageRevision) || 0) - (Number(best.state?.storageRevision) || 0);
    if (tx && revision && candidate.state?.deviceId && candidate.state.deviceId === best.state?.deviceId) {
      const newer = revision > 0 ? candidate : best;
      const older = revision > 0 ? best : candidate;
      if (countTransactions(newer.state) < countTransactions(older.state)) {
        const newerIds = new Set(Object.values(newer.state.transactions || {}).flat().map(item => String(item?.id ?? '')));
        const removedIds = Object.values(older.state.transactions || {}).flat()
          .map(item => String(item?.id ?? '')).filter(id => id && !newerIds.has(id));
        if (removedIds.length && removedIds.every(id => Object.hasOwn(newer.state.deletedTx || {}, id))) return newer;
      }
    }
    if (tx) return tx > 0 ? candidate : best;
    if (revision) return revision > 0 ? candidate : best;
    return (priority[candidate.source] || 0) > (priority[best.source] || 0) ? candidate : best;
  }, null);
}

// Snapshots made by the same installation can diverge when one storage write
// succeeds and the other fails. Keep the newest settings, but recover every
// transaction still present in another copy unless its ID was deleted
// explicitly. Never combine archives from different device identities.
export function reconcileVaultCandidates(candidates, countTransactions) {
  const selected = chooseVaultCandidate(candidates, countTransactions);
  if (!selected || candidates.length < 2) return selected;
  const deviceId = selected.state?.deviceId;
  if (!deviceId || candidates.some(candidate => candidate.state?.deviceId !== deviceId)) return selected;
  const priority = { 'localStorage(shadow)': 1, indexedDB: 2, 'localStorage(main)': 3 };
  const ordered = [...candidates].sort((a, b) =>
    (Number(a.state?.storageRevision) || 0) - (Number(b.state?.storageRevision) || 0)
    || (priority[a.source] || 0) - (priority[b.source] || 0));
  const newest = ordered.at(-1);
  const deletedTx = Object.assign({}, ...ordered.map(candidate => candidate.state.deletedTx || {}));
  const byId = new Map();
  for (const candidate of ordered) {
    for (const [month, rows] of Object.entries(candidate.state.transactions || {})) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const id = row?.id;
        if (id === undefined || id === null) return selected;
        byId.set(String(id), { month, row });
      }
    }
  }
  const transactions = {};
  for (const [id, { month, row }] of byId) {
    if (Object.hasOwn(deletedTx, id)) continue;
    (transactions[month] ||= []).push(row);
  }
  for (const rows of Object.values(transactions)) {
    rows.sort((a, b) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0) || String(a.id).localeCompare(String(b.id)));
  }
  const recovered = Object.values(transactions).reduce((sum, rows) => sum + rows.length, 0);
  const latestCount = countTransactions(newest.state);
  const latestIds = new Set(Object.values(newest.state.transactions || {}).flat().map(row => String(row.id)));
  if (recovered === latestCount && [...byId.keys()].every(id => Object.hasOwn(deletedTx, id) || latestIds.has(id))
      && Object.keys(deletedTx).length === Object.keys(newest.state.deletedTx || {}).length) return newest;
  return {
    source: 'reconciled',
    state: { ...newest.state, transactions, deletedTx },
  };
}
