import { indirizzoValido } from './expense-bridge.js';

// Both the one-receipt and whole-trip actions use the same transport rules.
// A resolved share means handoff, never delivery or reimbursement.
export async function shareTripReceipts({ files, address, navigator: nav, download, openEmail }) {
  if (!Array.isArray(files) || !files.length || !indirizzoValido(address)) throw new TypeError('Invalid receipt sharing request');
  const payload = { files };
  let supported = false;
  try { supported = typeof nav?.share === 'function' && nav.canShare?.(payload) === true; } catch { /* Fall back when capability detection fails. */ }
  if (supported) {
    try {
      // No awaited clipboard operation before share: mobile activation is transient.
      const pending = nav.share(payload);
      await pending;
      return { status: 'prepared', channel: 'share', count: files.length };
    } catch (error) {
      return { status: error?.name === 'AbortError' ? 'cancelled' : 'failed', count: 0 };
    }
  }
  for (const file of files) await download(file);
  await openEmail(address.trim());
  return { status: 'prepared', channel: 'email', count: files.length };
}
