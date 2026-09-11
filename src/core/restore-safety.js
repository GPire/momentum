// A restore is a deliberate replacement, never an implicit merge of weights.
// Keep a verified, separate copy first; a silent IndexedDB no-op is not success.
import { reconcileHead } from '../mesh/sync.js';
export const RESTORE_CHECKPOINT_KEY = 'before-restore-v1';
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function validateRestoredState(state, schemaVersion) {
  if (!record(state) || !record(state.transactions)
    || !Object.values(state.transactions).every(rows => Array.isArray(rows) && rows.every(record))) {
    throw new Error('restoreInvalid');
  }
  if (state.schemaVersion !== undefined && (!Number.isFinite(state.schemaVersion) || state.schemaVersion < 0 || state.schemaVersion > schemaVersion)) {
    throw new Error('restoreNewer');
  }
  for (const field of ['mlData', 'deletedTx', 'taxLearned']) {
    if (state[field] !== undefined && !record(state[field])) throw new Error('restoreInvalid');
  }
  if (state.onboardingProfile != null && !record(state.onboardingProfile)) throw new Error('restoreInvalid');
  for (const field of ['invoices', 'splitGroups', 'savingsGoals', 'customCategories', 'subscriptions']) {
    if (state[field] !== undefined && !Array.isArray(state[field])) throw new Error('restoreInvalid');
  }
  // No transaction normalization here: old dates, fields and hash chains stay
  // byte-for-byte values of the export, including unknown future extensions.
  return state;
}

export function prepareRestoredState(previous, restored, schemaVersion) {
  validateRestoredState(restored, schemaVersion);
  return { ...previous, ...restored, currentDate: new Date(),
    lastHash: restored.lastHash ?? reconcileHead(restored.transactions) ?? 'GENESIS' };
}

export async function checkpointBeforeRestore(state, durable, storage) {
  const payload = JSON.stringify({ format: 'momentum-restore-checkpoint-v1', createdAt: new Date().toISOString(), data: state });
  try {
    await durable.put('state', payload, RESTORE_CHECKPOINT_KEY);
    if (await durable.get('state', RESTORE_CHECKPOINT_KEY) === payload) return true;
  } catch { /* A full/disabled IndexedDB may still have a working local store. */ }
  try {
    storage.setItem(RESTORE_CHECKPOINT_KEY, payload);
    if (storage.getItem(RESTORE_CHECKPOINT_KEY) === payload) return true;
  } catch { /* Do not replace the only copy when both stores are unavailable. */ }
  throw new Error('restoreCheckpointFailed');
}

export async function readRestoreCheckpoint(durable, storage) {
  const candidates = [];
  try { candidates.push(await durable.get('state', RESTORE_CHECKPOINT_KEY)); } catch { /* fallback */ }
  try { candidates.push(storage.getItem(RESTORE_CHECKPOINT_KEY)); } catch { /* fallback */ }
  return candidates.flatMap(raw => {
    try {
      const cp = JSON.parse(raw);
      return cp?.format === 'momentum-restore-checkpoint-v1' && record(cp.data)
        && typeof cp.createdAt === 'string' && Number.isFinite(Date.parse(cp.createdAt)) ? [cp] : [];
    } catch { return []; }
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export async function writeRestoredArchive(previousState, nextState, durable, storage) {
  const keys = ['omega_core_db', 'omega_shadow_vault'];
  const previous = keys.map(key => storage.getItem(key));
  const durableBefore = await durable.get('state', 'main');
  const payload = JSON.stringify(nextState);
  const copies = [payload, btoa(unescape(encodeURIComponent(payload)))];
  try {
    for (let i = 0; i < keys.length; i++) {
      storage.setItem(keys[i], copies[i]);
      if (storage.getItem(keys[i]) !== copies[i]) throw new Error('Local write was not retained');
    }
    await durable.put('state', payload, 'main');
    const retained = await durable.get('state', 'main');
    // undefined is the explicit no-IndexedDB fallback. An existing durable
    // archive must never remain stale and win reconciliation after reload.
    if (retained !== payload && (durableBefore !== undefined || retained !== undefined)) throw new Error('Durable write was not retained');
  } catch (error) {
    // Best-effort rollback of active copies; the separate verified checkpoint
    // remains available even if a storage medium fails during rollback.
    for (let i = 0; i < keys.length; i++) {
      try { if (previous[i] == null) storage.removeItem(keys[i]); else storage.setItem(keys[i], previous[i]); } catch { /* checkpoint retained */ }
    }
    try { await durable.put('state', durableBefore ?? JSON.stringify(previousState), 'main'); } catch { /* checkpoint retained */ }
    throw error;
  }
}
