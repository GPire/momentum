// A personalised wealth projection needs observed spending across more than
// one billing cycle. Demo transactions never enter this map.
export function forecastReadiness(transactions = {}) {
  const expenseMonths = Object.entries(transactions).filter(([month, rows]) =>
    /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Array.isArray(rows) &&
    rows.some(row => row?.type === 'uscita' && Number.isFinite(row.amount) && row.amount > 0)
  ).length;
  return { ready: expenseMonths >= 3, expenseMonths, neededMonths: Math.max(0, 3 - expenseMonths) };
}
