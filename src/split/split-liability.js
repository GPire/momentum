import { computeBalances, myMemberId } from './split-engine.js';
import { groupForSettlement } from './group-chat.js';

const centsOf = value => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) && Math.abs(value * 100 - cents) < 1e-6 ? cents : null;
};

// A cash scenario may include only identified, same-currency, uncontested
// liabilities. A matching display name is never proof of shared identity.
export function confirmedSplitLiability(groups = [], { deviceId, currency = 'EUR' } = {}) {
  let owedCents = 0;
  const excluded = [];
  const seenGroups = new Set();
  for (const group of groups) {
    if (!group?.expenses?.length) continue;
    if (!group.id || seenGroups.has(group.id)) {
      excluded.push({ groupId: group.id, reason: 'duplicate' });
      continue;
    }
    seenGroups.add(group.id);
    if (group.expenses.length !== groupForSettlement(group).expenses.length) {
      excluded.push({ groupId: group.id, reason: 'disputed' });
      continue;
    }
    if ((group.baseCurrency || 'EUR') !== currency) {
      excluded.push({ groupId: group.id, reason: 'currency' });
      continue;
    }
    const claims = deviceId ? (group.members || []).filter(member => member.claimedBy === deviceId) : [];
    const selfId = claims.length === 1 ? myMemberId(group, deviceId) : null;
    const ids = new Set((group.members || []).map(member => member.id));
    if (!selfId || ids.size !== group.members.length) {
      excluded.push({ groupId: group.id, reason: 'identity' });
      continue;
    }
    const expenseIds = new Set(group.expenses.map(expense => expense.id));
    const valid = expenseIds.size === group.expenses.length && group.expenses.every(expense => {
      if (typeof expense.id !== 'string' || !expense.id) return false;
      const amountCents = centsOf(expense.amount);
      const shares = Object.entries(expense.owed || {});
      return amountCents > 0 && ids.has(expense.payer) && shares.length > 0
        && shares.every(([id, value]) => ids.has(id) && centsOf(value) !== null && value >= 0)
        && shares.reduce((total, [, value]) => total + centsOf(value), 0) === amountCents;
    });
    if (!valid) {
      excluded.push({ groupId: group.id, reason: 'ledger' });
      continue;
    }
    const balance = centsOf(computeBalances(group)[selfId]);
    if (balance === null || !Number.isSafeInteger(owedCents + Math.max(0, -balance))) {
      excluded.push({ groupId: group.id, reason: 'balance' });
      continue;
    }
    owedCents += Math.max(0, -balance);
  }
  return { owed: owedCents / 100, complete: excluded.length === 0, excluded };
}
