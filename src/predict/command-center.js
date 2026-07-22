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

// ── TASTIERINO VIVO E PREDITTIVO: la conseguenza REALE di ciò che digiti ──
// Mentre inserisci l'importo di un'uscita, mostra cosa resta del tuo "Oggi puoi
// spendere". Non è un numero decorativo: è safeToday − importo, con soglie
// semantiche (verde = ok, ambra = stai per esaurire, rosso = sfori). Onesto:
// senza budget (safeToday null) o importo 0 → non mostra nulla. Pura, testabile.
export function amountEntryImpact({ safeToday = null, isOverBudget = false, pendingAmount = 0 } = {}) {
  if (safeToday == null || !(pendingAmount > 0)) return { show: false };
  if (isOverBudget) {
    // Già oltre il budget della settimana: qualunque spesa aumenta lo sforamento.
    return { show: true, level: 'over', remaining: 0, overBy: +pendingAmount.toFixed(2) };
  }
  const remaining = +(safeToday - pendingAmount).toFixed(2);
  if (remaining < 0) return { show: true, level: 'over', remaining: 0, overBy: +Math.abs(remaining).toFixed(2) };
  // "Attenzione" quando dopo questa spesa resta ≤20% del margine di oggi.
  const level = remaining <= safeToday * 0.2 ? 'warn' : 'ok';
  return { show: true, level, remaining, overBy: 0 };
}

// "È più del tuo solito?": confronta l'importo digitato con quello TIPICO della
// categoria (da amount-memory, sui dati reali dell'utente). Segnala solo scarti
// netti verso l'alto (≥ factor×tipico) — aiuta a non sbagliare uno zero o a
// fermarsi un attimo su una spesa fuori-norma. Mai un giudizio: consapevolezza.
// Onesto: senza un tipico affidabile → { show:false }. Pura.
export function amountVsTypical({ typicalAmount = null, pendingAmount = 0, factor = 1.8 } = {}) {
  if (!(typicalAmount > 0) || !(pendingAmount > 0)) return { show: false, ratio: null, typicalAmount: null };
  const ratio = +(pendingAmount / typicalAmount).toFixed(2);
  if (ratio >= factor) return { show: true, level: 'high', ratio, typicalAmount: +typicalAmount.toFixed(2) };
  return { show: false, ratio, typicalAmount: +typicalAmount.toFixed(2) };
}

// ── TRAIETTORIA DEL MESE (forward-looking, proprietaria) ──
// "Di questo passo, come chiudi il mese?" Sintetizza la proiezione a fine mese
// (Holt-Winters destagionalizzato se disponibile, altrimenti run-rate) in UN
// segnale onesto e semanticamente colorato, complementare a "Oggi puoi spendere"
// (che guarda a OGGI): qui è l'orizzonte MESE. Onesto: tace a inizio mese (troppo
// pochi giorni per una stima sensata) o senza budget; dichiara sempre se la stima
// è "forte" (holt-winters) o solo "sul ritmo del mese" (run-rate). Pura, testabile.
//   projection = output di getMonthEndProjection({...})
export function monthTrajectoryFocus({ projection = null, monthlyBudget = 0, referenceDate = new Date(), minDayOfMonth = 4 } = {}) {
  if (!projection || !(monthlyBudget > 0)) return { show: false };
  const { projectedTotal, projectedDelta, spentSoFar, method } = projection;
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const dayOfMonth = ref.getDate();
  // Serve un minimo di mese trascorso E qualcosa di speso: altrimenti la
  // proiezione amplificherebbe rumore (onestà > completezza).
  if (dayOfMonth < minDayOfMonth || !(spentSoFar > 0) || projectedDelta == null) return { show: false };
  let level;
  if (projectedDelta < 0) level = 'over';                       // chiudi OLTRE il budget
  else if (projectedDelta <= monthlyBudget * 0.1) level = 'tight'; // margine risicato (≤10%)
  else level = 'ok';                                            // sotto controllo
  return {
    show: true,
    projectedTotal: +projectedTotal.toFixed(2),
    delta: +projectedDelta.toFixed(2),
    level,
    confident: method === 'holt-winters',
    method,
  };
}
