export function parseSalaryDraft(dayText, amountText) {
  const dayRaw = String(dayText ?? '').trim();
  const amountRaw = String(amountText ?? '').trim();
  const day = /^\d{1,2}$/.test(dayRaw) ? Number(dayRaw) : NaN;
  const amount = /^\d+(?:[.,]\d{1,2})?$/.test(amountRaw) ? Number(amountRaw.replace(',', '.')) : NaN;
  if (!Number.isInteger(day) || day < 1 || day > 31) return { error: 'day' };
  if (!Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER / 100) return { error: 'amount' };
  return { day, amount: Math.round(amount * 100) / 100 };
}

export function parseReminderDraft({ title, date, amount = '' }) {
  const name = String(title ?? '').trim();
  const day = String(date ?? '');
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T12:00:00Z`) : null;
  if (!name || !parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return { error: 'required' };
  const raw = String(amount).trim();
  const value = raw === '' ? 0 : /^\d+(?:[.,]\d{1,2})?$/.test(raw) ? Number(raw.replace(',', '.')) : NaN;
  if (!Number.isFinite(value) || (raw !== '' && value <= 0) || value > Number.MAX_SAFE_INTEGER / 100) return { error: 'amount' };
  return { title: name, date: day, amount: Math.round(value * 100) / 100 };
}
