'use strict';

// Explicit allowlist: device identity, trust, consent, API keys, UI state,
// telemetry and recovery material never enter the personal archive stream.
export const PRIVATE_ARCHIVE_FIELDS = Object.freeze([
  'subscriptions', 'monthlyBudget', 'monthlyBudgetAt', 'budgetDeclined',
  'salaryProfile', 'statedMonthlyIncome', 'onboardingProfile', 'profile',
  'events', 'savingsGoals', 'positions', 'manualAssets', 'liabilities',
  'fixedCommitments', 'paymentDeclarations', 'paymentOverrides', 'payoutProfile',
  'businessTrips', 'tripPolicyTemplate', 'tripReviewHistory',
  'customCategories', 'invoices', 'invoiceProfile', 'invoiceCollections',
  'invoiceReviewEvents', 'acquistiIva', 'taxPayments', 'taxRegime',
  'taxActiveCountry', 'taxLearned', 'taxCassaPropria', 'taxAltraCopertura',
  'chAttivitaTipo', 'chInvoiceProfile', 'esActive', 'esBaseChoice', 'esTerritorio',
  'emergencyFund', 'debiti', 'debitiExtraMensile', 'watchlist', 'priceAlerts',
  'investmentPrefs', 'voiceLearning', 'qaLearning', 'mlData', 'advisorBandit',
  'engagement', 'achievements', 'dataOverrides', 'sourceRegistry',
]);

const FIELD_SET = new Set(PRIVATE_ARCHIVE_FIELDS);
const RECEIPT_FIELDS = new Set([...FIELD_SET, 'transactions']);
const MAX_CONFLICTS = 50;
const MAX_RECEIPTS = 100;

function stableRecursive(value) {
  if (value === undefined) return 'undefined:';
  if (Array.isArray(value)) return `[${value.map(stableRecursive).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableRecursive(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

function stableIterative(value) {
  const output = [], active = new Set(), stack = [{ kind: 'value', value }];
  while (stack.length) {
    const frame = stack.pop();
    if (frame.kind === 'literal') { output.push(frame.text); continue; }
    if (frame.kind === 'close') { active.delete(frame.value); output.push(frame.text); continue; }
    const item = frame.value;
    if (item === undefined) { output.push('undefined:'); continue; }
    if (!item || typeof item !== 'object') { output.push(JSON.stringify(item)); continue; }
    if (active.has(item)) throw new TypeError('Circular archive data cannot be hashed');
    active.add(item);
    const array = Array.isArray(item);
    const keys = array ? Array.from({ length: item.length }, (_, index) => index) : Object.keys(item).sort();
    output.push(array ? '[' : '{');
    stack.push({ kind: 'close', value: item, text: array ? ']' : '}' });
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      stack.push(array && !(key in item) ? { kind: 'literal', text: '' } : { kind: 'value', value: item[key] });
      if (!array) stack.push({ kind: 'literal', text: `${JSON.stringify(key)}:` });
      if (index) stack.push({ kind: 'literal', text: ',' });
    }
  }
  return output.join('');
}

function stable(value) {
  try { return stableRecursive(value); }
  catch (error) { if (!(error instanceof RangeError)) throw error; }
  return stableIterative(value);
}

export function archiveHash(value) {
  const text = stable(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

const vector = value => {
  const out = {};
  for (const [id, counter] of Object.entries(value || {}).slice(0, 32)) {
    if (id && id.length <= 128 && Number.isSafeInteger(counter) && counter >= 0) out[id] = counter;
  }
  return out;
};
const mergeVector = (a, b) => {
  const out = { ...vector(a) };
  for (const [id, n] of Object.entries(vector(b))) out[id] = Math.max(out[id] || 0, n);
  return out;
};

export function compareVectors(a, b) {
  const ids = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  let aNewer = false, bNewer = false;
  for (const id of ids) {
    const av = a?.[id] || 0, bv = b?.[id] || 0;
    if (av > bv) aNewer = true;
    if (bv > av) bNewer = true;
  }
  return aNewer && bNewer ? 'concurrent' : aNewer ? 'local' : bNewer ? 'remote' : 'equal';
}

function metadata(state) {
  const current = state.privateArchiveMeta;
  if (current?.version === 1 && current.fields && current.deviceId) {
    if (!Array.isArray(current.conflicts)) current.conflicts = [];
    if (!Array.isArray(current.receipts)) current.receipts = [];
    return current;
  }
  const deviceId = String(state.deviceId || 'unknown-device');
  return (state.privateArchiveMeta = { version: 1, deviceId, fields: {}, conflicts: [], receipts: [] });
}

export function observePrivateArchive(state) {
  const meta = metadata(state);
  for (const field of PRIVATE_ARCHIVE_FIELDS) {
    if (!(field in state)) continue;
    const hash = archiveHash(state[field]);
    const previous = meta.fields[field];
    if (previous?.hash === hash) continue;
    const versions = mergeVector(previous?.versions, {});
    versions[meta.deviceId] = (versions[meta.deviceId] || 0) + 1;
    meta.fields[field] = { hash, versions };
  }
  return meta;
}

export function privateArchiveManifest(state) {
  const meta = observePrivateArchive(state);
  return { version: 1, fields: Object.fromEntries(Object.entries(meta.fields).map(([field, revision]) => [field, revision])) };
}

export function privateArchivePatch(state, remoteManifest = {}) {
  const meta = observePrivateArchive(state);
  const fields = {};
  for (const [field, revision] of Object.entries(meta.fields)) {
    const remote = remoteManifest?.fields?.[field];
    const order = remote ? compareVectors(revision.versions, remote.versions) : 'local';
    if (!remote || (remote.hash === revision.hash ? order !== 'equal' : order !== 'remote')) {
      fields[field] = { value: state[field], revision };
    }
  }
  return { version: 1, fields };
}

export function applyPrivateArchivePatch(state, patch, { peerId = 'peer', now = Date.now() } = {}) {
  const meta = observePrivateArchive(state);
  const results = [];
  let changed = false, conflicted = false;
  for (const [field, incoming] of Object.entries(patch?.fields || {})) {
    if (!FIELD_SET.has(field) || !incoming?.revision?.hash || archiveHash(incoming.value) !== incoming.revision.hash) {
      results.push({ field, status: 'rejected' });
      continue;
    }
    const local = meta.fields[field];
    if (!local) {
      state[field] = incoming.value;
      meta.fields[field] = { hash: incoming.revision.hash, versions: vector(incoming.revision.versions) };
      changed = true; results.push({ field, status: 'applied', hash: incoming.revision.hash }); continue;
    }
    if (local.hash === incoming.revision.hash) {
      local.versions = mergeVector(local.versions, incoming.revision.versions);
      results.push({ field, status: 'matched', hash: local.hash }); continue;
    }
    const order = compareVectors(local.versions, incoming.revision.versions);
    if (order === 'remote') {
      state[field] = incoming.value;
      meta.fields[field] = { hash: incoming.revision.hash, versions: mergeVector(local.versions, incoming.revision.versions) };
      changed = true; results.push({ field, status: 'applied', hash: incoming.revision.hash }); continue;
    }
    if (order === 'local') { results.push({ field, status: 'kept-newer', hash: local.hash }); continue; }
    const id = `${field}:${local.hash}:${incoming.revision.hash}`;
    if (!meta.conflicts.some(item => item.id === id)) {
      meta.conflicts.push({ id, field, peerId, at: now, localHash: local.hash, remoteHash: incoming.revision.hash,
        localVersions: vector(local.versions), remoteVersions: vector(incoming.revision.versions), remoteValue: incoming.value });
      meta.conflicts = meta.conflicts.slice(-MAX_CONFLICTS);
    }
    conflicted = true; results.push({ field, status: 'conflict', hash: local.hash });
  }
  return { changed, conflicted, results };
}

export function resolvePrivateArchiveConflict(state, conflictId, choice) {
  const meta = metadata(state);
  const conflict = meta.conflicts.find(item => item.id === conflictId);
  if (!conflict || !['local', 'remote'].includes(choice)) return false;
  if (choice === 'remote') state[conflict.field] = conflict.remoteValue;
  const versions = mergeVector(conflict.localVersions, conflict.remoteVersions);
  versions[meta.deviceId] = (versions[meta.deviceId] || 0) + 1;
  meta.fields[conflict.field] = { hash: archiveHash(state[conflict.field]), versions };
  meta.conflicts = meta.conflicts.filter(item => item.id !== conflictId);
  return true;
}

export function recordPrivateArchiveReceipt(state, peerId, receipt, now = Date.now()) {
  const meta = metadata(state);
  const statuses = new Set(['applied', 'matched', 'kept-newer', 'conflict', 'rejected']);
  const safe = (receipt?.results || []).filter(r => RECEIPT_FIELDS.has(r.field) && statuses.has(r.status)).map(r => ({
    field: r.field,
    status: r.status,
    hash: typeof r.hash === 'string' ? r.hash.slice(0, 64) : undefined,
  }));
  if (!safe.length) return 0;
  meta.receipts.push({ peerId: String(peerId || '').slice(0, 128), at: now, results: safe });
  meta.receipts = meta.receipts.slice(-MAX_RECEIPTS);
  return safe.length;
}

export function privateArchiveStatus(state) {
  const meta = metadata(state);
  return { conflicts: meta.conflicts.length, lastReceipt: meta.receipts.at(-1) || null, coveredFields: Object.keys(meta.fields).length };
}
