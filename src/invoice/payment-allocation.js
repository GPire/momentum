// Validates explicit allocation plans; never infers a payment or changes source data.
// Adapters must supply stable IDs and the actual amount due, not the taxable base.
function cents(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const n = Number(value), c = Math.round(n * 100);
  return Number.isFinite(n) && n > 0 && Number.isSafeInteger(c) && c > 0 && Math.abs(n * 100 - c) < 1e-7 ? c : null;
}

export function reconcileInvoiceAllocations(invoices = [], receipts = [], allocations = []) {
  const errors = [];
  const validId = id => typeof id === 'string' && id.trim().length > 0;
  function index(items, kind, amountField) {
    const map = new Map();
    if (!Array.isArray(items)) { errors.push({code:'invalid-list',kind}); return map; }
    for (const item of items) {
      const amount = cents(item?.[amountField]);
      const currency = typeof item?.currency === 'string' ? item.currency.trim().toUpperCase() : '';
      if (!validId(item?.id) || amount === null || !['EUR','CHF'].includes(currency) || item?.taxable === false) {
        errors.push({code:'invalid-source',kind,id:item?.id ?? null}); continue;
      }
      if (map.has(item.id)) { errors.push({code:'duplicate-source',kind,id:item.id}); continue; }
      map.set(item.id,{id:item.id,currency,amount,allocated:0});
    }
    return map;
  }
  const invoiceMap = index(invoices,'invoice','amountDue');
  const receiptMap = index(receipts,'receipt','amount');
  const seen = new Set();
  if (!Array.isArray(allocations)) errors.push({code:'invalid-list',kind:'allocation'});
  for (const a of Array.isArray(allocations) ? allocations : []) {
    const amount = cents(a?.amount);
    const invoice = invoiceMap.get(a?.invoiceId), receipt = receiptMap.get(a?.receiptId);
    if (!validId(a?.id) || amount === null || !invoice || !receipt) {
      errors.push({code:'invalid-allocation',id:a?.id ?? null}); continue;
    }
    if (seen.has(a.id)) { errors.push({code:'duplicate-allocation',id:a.id}); continue; }
    seen.add(a.id);
    if (invoice.currency !== receipt.currency) { errors.push({code:'currency-mismatch',id:a.id}); continue; }
    // Subtraction before addition keeps arithmetic inside the safe integer range.
    if (amount > invoice.amount - invoice.allocated || amount > receipt.amount - receipt.allocated) {
      errors.push({code:'over-allocation',id:a.id}); continue;
    }
    invoice.allocated += amount;
    receipt.allocated += amount;
  }
  const ok = errors.length === 0;
  const rows = map => [...map.values()].map(r => ({
    id:r.id, currency:r.currency, amount:r.amount / 100,
    allocated:ok ? r.allocated / 100 : 0,
    remaining:(r.amount - (ok ? r.allocated : 0)) / 100,
  }));
  return {ok,errors,invoices:rows(invoiceMap),receipts:rows(receiptMap)};
}
