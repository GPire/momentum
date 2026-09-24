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

export function equalGroupShareDraft(memberIds, amount, involved = memberIds) {
  const cents = Math.round((splitAmount(amount) || 0) * 100);
  const active = memberIds.filter(id => involved.includes(id));
  if (!active.length) return {};
  const each = Math.floor(cents / active.length), extra = cents % active.length;
  return Object.fromEntries(memberIds.map(id => {
    const index = active.indexOf(id);
    return [id, index < 0 ? '0' : ((each + (index < extra ? 1 : 0)) / 100).toFixed(2)];
  }));
}

export function weightedGroupShareDraft(memberIds, weights, amount) {
  const parsed = splitAmount(amount);
  const values = memberIds.map(id => weights?.[id]);
  if (!(parsed > 0) || !memberIds.length || values.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) return null;
  const totalWeight = values.reduce((sum, value) => sum + value, 0);
  if (!(totalWeight > 0) || !Number.isFinite(totalWeight)) return null;
  const cents = Math.round(parsed * 100);
  const exact = values.map(value => cents * value / totalWeight);
  const parts = exact.map(Math.floor);
  let remaining = cents - parts.reduce((sum, value) => sum + value, 0);
  const order = memberIds.map((_, index) => index).sort((a, b) => (exact[b] - parts[b]) - (exact[a] - parts[a]) || a - b);
  for (let index = 0; index < remaining; index++) parts[order[index]]++;
  return Object.fromEntries(memberIds.map((id, index) => [id, (parts[index] / 100).toFixed(2)]));
}

// Converts the editable per-person amounts to the existing split engine rule.
// Foreign-currency inputs are weights: conversion and final cent allocation
// happen once in the base currency, so no exchange-rate rounding can invent a
// missing or extra cent. The form never saves while the input total differs.
export function groupShareDraft(memberIds, values, amount, { foreignCurrency = false } = {}) {
  const total = splitAmount(amount);
  if (!(total > 0) || !Number.isSafeInteger(Math.round(total * 100))) return { valid: false, reason: 'amount' };
  if (!memberIds.length || new Set(memberIds).size !== memberIds.length) return { valid: false, reason: 'members' };
  const cents = {};
  for (const id of memberIds) {
    if (values?.[id] == null || String(values[id]).trim() === '') return { valid: false, reason: 'invalid' };
    const value = splitAmount(values?.[id]);
    if (value == null) return { valid: false, reason: 'invalid' };
    cents[id] = Math.round(value * 100);
  }
  const differenceCents = Math.round(total * 100) - Object.values(cents).reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(differenceCents) || differenceCents !== 0) return { valid: false, reason: 'difference', differenceCents };
  return { valid: true, shares: foreignCurrency
    ? { weights: cents }
    : { byId: Object.fromEntries(memberIds.map(id => [id, cents[id] / 100])) } };
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
