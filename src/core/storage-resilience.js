// Browser storage is best-effort unless persistence is granted. Keep the
// request tied to an actual user interaction and to an archive with data.
export async function inspectLocalStorageHealth(manager = globalThis.navigator?.storage) {
  if (!manager) return { supported: false, persistent: false, usage: null, quota: null };
  const [persistent, estimate] = await Promise.all([
    manager.persisted?.().catch(() => false) ?? false,
    manager.estimate?.().catch(() => null) ?? null,
  ]);
  return {
    supported: typeof manager.persist === 'function',
    persistent: persistent === true,
    usage: Number.isFinite(estimate?.usage) ? estimate.usage : null,
    quota: Number.isFinite(estimate?.quota) ? estimate.quota : null,
  };
}

export async function requestLocalStoragePersistence(manager = globalThis.navigator?.storage) {
  if (typeof manager?.persist !== 'function') return false;
  try {
    if (await manager.persisted?.()) return true;
    return await manager.persist() === true;
  } catch { return false; }
}

export function bindVaultDurability({ doc, win, vault, hasPersonalData, onResume = () => {}, storageManager }) {
  let requested = false;
  const flush = () => { Promise.resolve(vault.flushDurable()).catch(() => {}); };
  const visibility = () => {
    if (doc.visibilityState === 'hidden') flush();
    else if (doc.visibilityState === 'visible') onResume();
  };
  const requestAfterGesture = () => {
    if (requested || !hasPersonalData()) return;
    requested = true;
    doc.removeEventListener('pointerdown', requestAfterGesture);
    doc.removeEventListener('keydown', requestAfterGesture);
    requestLocalStoragePersistence(storageManager).catch(() => {});
  };
  doc.addEventListener('visibilitychange', visibility);
  doc.addEventListener('pointerdown', requestAfterGesture, { passive: true });
  doc.addEventListener('keydown', requestAfterGesture);
  win.addEventListener('pagehide', flush);
  return () => {
    doc.removeEventListener('visibilitychange', visibility);
    doc.removeEventListener('pointerdown', requestAfterGesture);
    doc.removeEventListener('keydown', requestAfterGesture);
    win.removeEventListener('pagehide', flush);
  };
}
