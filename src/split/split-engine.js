// ============================================================
// SPLIT ENGINE — divisione spese di gruppo P2P, on-device (v10)
// ============================================================
// Il differenziatore: Splitwise/Settle Up vivono sul cloud con limiti/paywall;
// Momentum divide le spese 100% on-device (e sincronizzabile via mesh cifrata),
// senza server. Piu' intelligente della concorrenza:
//  - minimalSettlement: la MATRICE di compensazione minima (meno bonifici
//    possibili per azzerare i debiti) — il cuore matematico di Settle Up;
//  - suggestSettleTiming: QUANDO conviene saldare (predittivo, sulle entrate);
//  - ponte col bonifico SEPA on-device: salda un debito con QR/WhatsApp reali,
//    senza pagamenti in-app (che richiederebbero licenze/cloud).
// Onesta' (regola #1): niente numeri inventati; i saldi sono aritmetica esatta
// (somma sempre zero); il settlement greedy e' near-ottimo (il minimo assoluto e'
// NP-hard) e lo dichiariamo. Funzioni pure, nessun DOM, nessuna rete.
'use strict';

const round2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;
const EPS = 0.005;

// Crea un gruppo. members = [{id, name}] o [nomi]. Normalizza a {id, name}.
export function createGroup({ name = 'Gruppo', members = [] } = {}) {
  const norm = members.map((m, i) => typeof m === 'string' ? { id: `m${i}`, name: m } : { id: m.id || `m${i}`, name: m.name || `Membro ${i + 1}` });
  return { name, members: norm, expenses: [] };
}

// Aggiunge una spesa condivisa. `shares` opzionale:
//  - assente → divisione EQUA tra tutti i membri;
//  - { equalAmong:[id,...] } → equa solo tra alcuni;
//  - { byId:{id:quota} } → quote ESATTE in euro (devono sommare all'importo);
//  - { weights:{id:peso} } → ripartizione proporzionale ai pesi.
// payer = id del membro che ha pagato. Ritorna il nuovo gruppo (immutabile).
export function addSharedExpense(group, { payer, amount, description = '', date, shares } = {}) {
  const amt = round2(amount);
  if (!(amt > 0)) throw new Error('importo non valido');
  if (!group.members.some(m => m.id === payer)) throw new Error('pagante non nel gruppo');
  const ids = group.members.map(m => m.id);

  let owed = {};
  if (!shares) {
    const each = amt / ids.length;
    for (const id of ids) owed[id] = each;
  } else if (shares.equalAmong) {
    const grp = shares.equalAmong.filter(id => ids.includes(id));
    const each = amt / grp.length;
    for (const id of grp) owed[id] = each;
  } else if (shares.byId) {
    let sum = 0;
    for (const [id, q] of Object.entries(shares.byId)) { if (ids.includes(id)) { owed[id] = +q; sum += +q; } }
    if (Math.abs(round2(sum) - amt) > 0.01) throw new Error('le quote non sommano all\'importo');
  } else if (shares.weights) {
    const w = shares.weights; const tot = Object.values(w).reduce((a, b) => a + (+b || 0), 0);
    if (tot <= 0) throw new Error('pesi non validi');
    for (const [id, ww] of Object.entries(w)) if (ids.includes(id)) owed[id] = amt * (+ww) / tot;
  }
  // arrotonda le quote e aggiusta l'ultimo centesimo sul pagante (somma esatta)
  owed = balanceRounding(owed, amt);
  const expense = { id: `e${group.expenses.length}`, payer, amount: amt, description, date: date || new Date().toISOString().slice(0, 10), owed };
  return { ...group, expenses: [...group.expenses, expense] };
}

// Arrotonda le quote a 2 decimali facendo tornare la somma ESATTA all'importo
// (il residuo di arrotondamento va sulla quota maggiore): mai centesimi persi.
function balanceRounding(owed, amt) {
  const out = {}; let sum = 0; let maxId = null, maxV = -Infinity;
  for (const [id, v] of Object.entries(owed)) { out[id] = round2(v); sum += out[id]; if (v > maxV) { maxV = v; maxId = id; } }
  const diff = round2(amt - sum);
  if (maxId && Math.abs(diff) >= 0.01) out[maxId] = round2(out[maxId] + diff);
  return out;
}

// Saldi netti per membro: pagato − dovuto. Positivo = deve ricevere; negativo =
// deve dare. La somma e' sempre ~0 (invariante verificata nei test).
export function computeBalances(group) {
  const bal = {};
  for (const m of group.members) bal[m.id] = 0;
  for (const e of group.expenses) {
    bal[e.payer] = round2((bal[e.payer] || 0) + e.amount);
    for (const [id, q] of Object.entries(e.owed)) bal[id] = round2((bal[id] || 0) - q);
  }
  for (const k of Object.keys(bal)) bal[k] = round2(bal[k]);
  return bal;
}

// Compensazione MINIMA: chi paga chi, col minor numero di bonifici, per azzerare
// tutti i debiti. Greedy: il debitore piu' grande paga il creditore piu' grande.
// Onesto: e' l'euristica di Settle Up (near-ottima; il minimo assoluto e' NP-hard),
// ma per gruppi reali (pochi membri) e' quasi sempre ottima e sempre corretta
// (azzera tutti i saldi). Ritorna [{from, to, amount}].
export function minimalSettlement(balances) {
  const creditors = [], debtors = [];
  for (const [m, v] of Object.entries(balances)) {
    const r = round2(v);
    if (r > EPS) creditors.push({ m, v: r });
    else if (r < -EPS) debtors.push({ m, v: -r });
  }
  creditors.sort((a, b) => b.v - a.v);
  debtors.sort((a, b) => b.v - a.v);
  const tx = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = round2(Math.min(debtors[i].v, creditors[j].v));
    if (pay > EPS) tx.push({ from: debtors[i].m, to: creditors[j].m, amount: pay });
    debtors[i].v = round2(debtors[i].v - pay);
    creditors[j].v = round2(creditors[j].v - pay);
    if (debtors[i].v <= EPS) i++;
    if (creditors[j].v <= EPS) j++;
  }
  return tx;
}

// Vista "chi deve cosa a chi" pronta per la UI, con i nomi risolti.
export function settlementView(group) {
  const byId = Object.fromEntries(group.members.map(m => [m.id, m.name]));
  const balances = computeBalances(group);
  const transfers = minimalSettlement(balances).map(t => ({ ...t, fromName: byId[t.from], toName: byId[t.to] }));
  return { balances, transfers, total: round2(group.expenses.reduce((s, e) => s + e.amount, 0)) };
}

// PREDITTIVO: quando conviene a un debitore saldare. Se sono note le entrate
// ricorrenti in arrivo (es. dallo storico), suggerisce di aspettare il prossimo
// accredito se il debito supera il disponibile attuale. Onesto: senza dati sulle
// entrate, dice semplicemente "quando puoi"; niente promesse.
export function suggestSettleTiming({ amountDue, currentAvailable = null, nextIncome = null } = {}) {
  if (currentAvailable == null) return { when: 'quando puoi', reason: null };
  if (amountDue <= currentAvailable) return { when: 'ora', reason: 'hai il disponibile per saldarlo senza scoperti' };
  if (nextIncome && nextIncome.date) return { when: 'dopo il prossimo accredito', reason: `il debito supera il tuo disponibile ora; dopo il ${nextIncome.date} avrai margine` };
  return { when: 'a rate o appena hai margine', reason: 'il debito supera il tuo disponibile attuale' };
}

// PONTE COL BONIFICO SEPA on-device: da una riga di settlement + gli IBAN noti dei
// membri, produce i dati pronti per openSepaTransfer (QR/WhatsApp/copia). Cosi'
// saldi un amico DAVVERO, on-device, senza pagamenti in-app. Ritorna null se non
// si conosce l'IBAN del destinatario (allora resta la richiesta a voce).
export function settlementToSepa(transfer, group, ibansById = {}) {
  const byId = Object.fromEntries(group.members.map(m => [m.id, m.name]));
  const iban = ibansById[transfer.to];
  if (!iban) return null;
  return {
    mode: 'pay',
    name: byId[transfer.to] || 'Amico',
    iban,
    amount: transfer.amount,
    remittance: `Rimborso ${group.name}`.slice(0, 140),
    title: `Rimborsa ${byId[transfer.to] || ''}`.trim(),
  };
}
