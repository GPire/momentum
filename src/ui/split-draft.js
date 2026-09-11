export function splitAmount(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  if (!/^\d+(?:[.,]\d{0,2})?$/.test(raw)) return null;
  const amount = Number(raw.replace(',', '.'));
  return Number.isFinite(amount) && amount <= Number.MAX_SAFE_INTEGER / 100 ? Math.round(amount * 100) / 100 : null;
}

export function splitInputEdit(value, previous = '') {
  let text = String(value ?? '');
  if (/^[.,]/.test(text)) text = `0${text}`;
  return splitAmount(text) === null ? { value: String(previous), rejected: true } : { value: text, rejected: false };
}

export function validSplitAmounts(people, paid, owed, mode) {
  const rows = people.map(name => splitAmount(paid[name]));
  if (rows.some(value => value === null)) return false;
  const cents = rows.reduce((sum, value) => sum + Math.round(value * 100), 0);
  if (!Number.isSafeInteger(cents) || cents <= 0) return false;
  if (mode !== 'custom') return true;
  const shares = people.map(name => splitAmount(owed[name]));
  return !shares.includes(null) && shares.reduce((sum, value) => sum + Math.round(value * 100), 0) === cents;
}

// Adapt a multi-payer form to the existing engine. Stable IDs distinguish
// namesakes; integer cents preserve both payer totals and the chosen shares.
export function buildSplitDraft({ members, paid, owed = {}, mode = 'equal', name, id, deviceId, selfId = 'Io' }) {
  const ids = members.map(member => member.id);
  if (new Set(ids).size !== ids.length || !ids.includes(selfId)) throw new Error('Invalid split identities');
  if (!validSplitAmounts(ids, paid, owed, mode)) throw new Error('Invalid split amounts');
  let group = createGroup({ name, id, members });
  if (deviceId) group = claimMember(group, selfId, deviceId);
  const total = ids.reduce((sum, key) => sum + Math.round(splitAmount(paid[key]) * 100), 0);
  const offset = [...String(id || '')].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % ids.length;
  const remaining = ids.map((key, i) => mode === 'custom' ? Math.round(splitAmount(owed[key]) * 100)
    : Math.floor(total / ids.length) + ((i - offset + ids.length) % ids.length < total % ids.length ? 1 : 0));
  let left = total;
  for (const payer of ids) {
    const cents = Math.round(splitAmount(paid[payer]) * 100);
    if (!cents) continue;
    const ideal = remaining.map(value => cents * (value / left));
    const shares = ideal.map(Math.floor);
    let rest = cents - shares.reduce((sum, value) => sum + value, 0);
    const order = ids.map((_, i) => i).sort((a, b) => (ideal[b] - shares[b]) - (ideal[a] - shares[a]) || a - b);
    for (const i of order) if (rest > 0 && shares[i] < remaining[i]) { shares[i]++; rest--; }
    if (rest !== 0) throw new Error('Split rounding could not preserve the total');
    const byId = Object.fromEntries(ids.map((key, i) => { remaining[i] -= shares[i]; return [key, shares[i] / 100]; }));
    group = addSharedExpense(group, { payer, amount: cents / 100, description: name, shares: { byId } });
    left -= cents;
  }
  return group;
}
import { createGroup, claimMember, addSharedExpense } from '../split/split-engine.js';
