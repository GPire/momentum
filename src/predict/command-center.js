// Command Center — selettore del singolo "prossimo passo probabile" da mostrare
// sulla Dashboard (un solo focus, mai un muro). Trasforma la predizione
// contestuale (context-predictor) in un nudge azionabile a UN tocco: "di solito
// ora compri X (~€Y) — aggiungilo". Anti-attrito: chi ha un'abitudine la registra
// in un gesto; onesto: appare SOLO con un pattern temporale netto e un importo
// tipico affidabile, e MAI se quella spesa è già stata registrata oggi nella
// stessa fascia oraria (non ripropone ciò che hai già fatto). Funzioni pure,
// nessun DOM — la UI (main.js) si limita a disegnare ciò che questo decide.
import { predictCategoriesNow, slotOf } from './context-predictor.js';
import { settlementView } from '../split/split-engine.js';

// Ritorna il nudge "prossima spesa probabile" per il momento presente, oppure
// { show:false } quando non c'è nulla di abbastanza solido da proporre.
// - allTx: mappa mese→transazioni (VaultDAO.state.transactions)
// - referenceDate: adesso reale
// - opts: soglie passate a predictCategoriesNow (minTx/minSupport/minLift)
export function nextExpenseNudge(allTx = {}, referenceDate = new Date(), opts = {}) {
  const ctx = predictCategoriesNow(allTx, referenceDate, opts);
  const pick = ctx.topPick;
  // Serve un pattern netto (topPick) E un importo tipico: senza cifra affidabile
  // il "tocco unico" non potrebbe pre-compilare nulla → meglio tacere.
  if (!pick || !(pick.typicalAmount > 0)) return { show: false };

  // Anti-ripetizione onesta: se OGGI, in QUESTA fascia oraria, hai già una spesa
  // di questa categoria, l'abitudine è già assolta → non insistere.
  const refSlot = slotOf(referenceDate);
  const y = referenceDate.getFullYear();
  const m = referenceDate.getMonth();
  const d = referenceDate.getDate();
  const alreadyLogged = Object.values(allTx || {})
    .flat()
    .some(t => {
      if (!t || t.type !== 'uscita' || t.category !== pick.category || !t.date) return false;
      const td = new Date(t.date);
      return (
        td.getFullYear() === y &&
        td.getMonth() === m &&
        td.getDate() === d &&
        slotOf(td) === refSlot
      );
    });
  if (alreadyLogged) return { show: false };

  return {
    show: true,
    category: pick.category,
    typicalAmount: pick.typicalAmount,
    reason: pick.reason,          // es. "di solito la mattina" — già in lingua umana
    lift: pick.lift,
  };
}

// ── DIVISIONE SPESE, integrazione intelligente sul Command Center ──
// Scelta di prodotto (richiesta esplicita "valuta tu"): NON aggiungo una card
// "Insieme" fissa sulla Dashboard — violerebbe "un solo focus" e sarebbe rumore
// quando non c'è nulla in sospeso. Integro invece SOLO il segnale che conta e
// solo quando esiste davvero: soldi che ti devono o che devi, calcolati sui
// gruppi reali (settlementView, netting minimo). È la leva anti-abbandono giusta
// (essere pagati / non dimenticare un debito riporta l'utente), ed è onesta:
// zero saldo in sospeso → { show:false }, niente da mostrare.
//
// groups: VaultDAO.state.splitGroups. me: nome dell'utente nei gruppi ('Io').
// Ritorna il gruppo con l'importo in gioco più rilevante:
//   { show, direction:'owed'|'owe', amount, groupId, groupName, groups, totalOwed, totalOwe }
export function splitReminder(groups = [], opts = {}) {
  const me = opts.meName || 'Io';
  let totalOwed = 0, totalOwe = 0;
  const perGroup = [];
  for (const g of groups || []) {
    if (!g || !Array.isArray(g.members) || !Array.isArray(g.expenses) || g.expenses.length === 0) continue;
    let view;
    try { view = settlementView(g); } catch (_) { continue; }
    let owed = 0, owe = 0;
    for (const t of view.transfers) {
      if (t.toName === me) owed += t.amount;        // qualcuno deve pagare TE
      else if (t.fromName === me) owe += t.amount;  // TU devi pagare qualcuno
    }
    totalOwed += owed; totalOwe += owe;
    const net = +(owed - owe).toFixed(2);
    if (Math.abs(net) > 0.009) perGroup.push({ id: g.id, name: g.name, net, gross: owed + owe });
  }
  if (perGroup.length === 0) return { show: false };
  // Priorità: importo netto più grande (poi lordo) — la cosa che pesa di più.
  perGroup.sort((a, b) => (Math.abs(b.net) - Math.abs(a.net)) || (b.gross - a.gross));
  const top = perGroup[0];
  return {
    show: true,
    direction: top.net >= 0 ? 'owed' : 'owe',
    amount: +Math.abs(top.net).toFixed(2),
    groupId: top.id,
    groupName: top.name,
    groups: perGroup.length,
    totalOwed: +totalOwed.toFixed(2),
    totalOwe: +totalOwe.toFixed(2),
  };
}
