import { encodeGroupShare, decodeGroupShare } from './split-engine.js';
import { packShare } from './invite-codec.js';

// Keep the engine's share whitelist and all balances; compress the snapshot.
// An invitation without expenses cannot explain a repayment offline.
export async function buildRepaymentCode(group) {
  const legacy = encodeGroupShare(group);
  try { return await packShare(decodeGroupShare(legacy)); } catch { return legacy; }
}
