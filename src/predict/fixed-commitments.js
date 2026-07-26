// ============================================================
// IMPEGNI FISSI — mutuo, prestiti, rate CON scadenza (v1)
// ============================================================
// Il problema di mercato: le app trattano tutto come "abbonamento aperto". Ma un
// MUTUO o un PRESTITO non è un abbonamento: ha una rata fissa, un giorno del
// mese, e soprattutto UNA FINE (numero di rate residue, data di estinzione). E
// nessuna app incrocia gli impegni col GIORNO ESATTO dello stipendio per dirti
// "prima dell'accredito del 27 devi ancora coprire mutuo + prestito = 860€".
//
// Questo modulo modella impegni con termine e produce un forecast PRECISO AL
// GIORNO. Onesto: usa i dati che l'utente inserisce (nessuna invenzione), tace
// dove mancano, e dichiara sempre "stime, non certezze".
//
// Un impegno:
//   { id, name, amount>0, dayOfMonth 1..31, kind:'mutuo'|'prestito'|'affitto'|
//     'abbonamento', startDate?'YYYY-MM-DD', termMonths?>0 }
// Con startDate + termMonths → impegno FINITO (rate residue, data di estinzione).
// Senza termMonths → impegno APERTO (affitto/abbonamento): non finisce da solo.
//
// Funzioni pure, nessun DOM, nessuna rete, serializzabile nel vault.
'use strict';

import { descriptionSimilarity } from '../core/deduplicator.js';

// Tutta la matematica delle date è in UTC per coerenza: parse ISO ('YYYY-MM-DD')
// è UTC-midnight e la formattazione (toISOString) è UTC → nessuno sfasamento di
// giorno dovuto al fuso orario locale del dispositivo.
const clampDay = (day, year, month) => {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); // ultimo giorno del mese
  return Math.min(Math.max(1, day | 0), last);                     // 31 in febbraio → 28/29
};

const isoOf = (year, month, day) => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);

const parseISO = (s) => {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : null;
};

// Mesi interi trascorsi tra due date (per contare le rate già pagate).
function monthsElapsed(from, to) {
  if (!from || !to) return 0;
  let m = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) m -= 1; // il mese in corso non è ancora "compiuto"
  return Math.max(0, m);
}

// Rate residue di un impegno finito. null se aperto (nessun termine).
export function remainingInstallments(c, now = Date.now()) {
  if (!c || !(c.termMonths > 0) || !c.startDate) return null;
  const start = parseISO(c.startDate);
  if (!start) return null;
  const elapsed = monthsElapsed(start, new Date(now));
  return Math.max(0, c.termMonths - elapsed);
}

// Data di estinzione (ultima rata) di un impegno finito. null se aperto.
export function payoffDate(c) {
  if (!c || !(c.termMonths > 0) || !c.startDate) return null;
  const start = parseISO(c.startDate);
  if (!start) return null;
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth() + (c.termMonths - 1); // rata 1 = mese di partenza
  const day = clampDay(c.dayOfMonth || start.getUTCDate(), y, m);
  return isoOf(y, m, day);
}

// Un impegno è ATTIVO a una certa data se non è ancora estinto.
export function isActive(c, now = Date.now()) {
  const rem = remainingInstallments(c, now);
  return rem === null ? true : rem > 0;
}

// Capitale residuo APPROSSIMATO (rate residue × importo). Onesto: è una stima
// lineare, NON tiene conto degli interessi nella quota — dichiarato tale.
export function residualApprox(c, now = Date.now()) {
  const rem = remainingInstallments(c, now);
  if (rem === null) return null;
  return Math.round(rem * (+c.amount || 0) * 100) / 100;
}

// Prossima occorrenza (data e importo) di un impegno a partire da `from`.
// null se l'impegno è già estinto entro quella finestra.
export function nextOccurrence(c, from = Date.now()) {
  const fromD = new Date(from);
  let y = fromD.getUTCFullYear(), m = fromD.getUTCMonth();
  const dayThis = clampDay(c.dayOfMonth, y, m);
  // se il giorno di questo mese è già passato, vai al mese successivo
  if (dayThis < fromD.getUTCDate()) { m += 1; }
  const day = clampDay(c.dayOfMonth, y, m);
  const d = new Date(Date.UTC(y, m, day));
  if (!isActive(c, d.getTime())) return null;
  return { date: d.toISOString().slice(0, 10), amount: +c.amount || 0, name: c.name };
}

// Occorrenze di TUTTI gli impegni nella finestra [fromMs, toMs] inclusa.
export function commitmentsDueBetween(commitments = [], fromMs, toMs) {
  const out = [];
  for (const c of commitments) {
    if (!(+c.amount > 0) || !(c.dayOfMonth >= 1)) continue;
    let cursor = fromMs;
    // avanza mese per mese finché resta nella finestra
    for (let guard = 0; guard < 400; guard++) {
      const occ = nextOccurrence(c, cursor);
      if (!occ) break;
      const t = Date.parse(occ.date);
      if (t > toMs) break;
      if (t >= fromMs) out.push({ ...occ, kind: c.kind || 'impegno', id: c.id });
      // salta al giorno dopo questa occorrenza per trovare la successiva
      cursor = t + 86_400_000;
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Prossimo giorno di stipendio a partire da una data, dato dayOfMonth.
function nextPaydayDate(dayOfMonth, from) {
  const fromD = new Date(from);
  let y = fromD.getUTCFullYear(), m = fromD.getUTCMonth();
  const dayThis = clampDay(dayOfMonth, y, m);
  if (dayThis < fromD.getUTCDate()) m += 1;
  const day = clampDay(dayOfMonth, y, m);
  return new Date(Date.UTC(y, m, day));
}

// Ultimo giorno di stipendio già passato (inizio del ciclo corrente).
function prevPaydayDate(dayOfMonth, from) {
  const fromD = new Date(from);
  let y = fromD.getUTCFullYear(), m = fromD.getUTCMonth();
  const dayThis = clampDay(dayOfMonth, y, m);
  if (dayThis > fromD.getUTCDate()) m -= 1;
  const day = clampDay(dayOfMonth, y, m);
  return new Date(Date.UTC(y, m, day));
}

// Una transazione È il pagamento di un impegno? (per NON contarla come spesa
// discrezionale). Stessa logica di tolleranza tipo-aware del matching.
function txMatchesAnyCommitment(t, commitments) {
  const amt = Math.abs(+t.amount || 0);
  const d = parseISO(t.date) || new Date(t.date);
  if (Number.isNaN(d.getTime())) return false;
  for (const c of commitments) {
    const target = +c.amount || 0;
    const dayDelta = Math.abs(d.getUTCDate() - c.dayOfMonth);
    // stessa doppia via del matching: importo in banda, oppure nome riconosciuto
    // in una finestra più larga (una bolletta fuori banda resta una bolletta, non
    // una spesa libera — altrimenti il "quanto puoi spendere" crollerebbe a caso).
    if (target > 0 && Math.abs(amt - target) / target <= toleranceFor(c, null) && dayDelta <= 6) return true;
    if (dayDelta <= 12 && nameMatches(c, t)) return true;
  }
  return false;
}

// ── DISPONIBILITÀ ADATTIVA (burn-rate auto-correttivo) ──────────────────────
// Più intelligente della semplice divisione pool/giorni: legge quanto hai GIÀ
// speso (in modo discrezionale, escludendo le rate degli impegni) da inizio
// ciclo, e ricalcola quanto ti resta DAVVERO al giorno. Se hai speso troppo, il
// giornaliero scende da solo — si auto-corregge ogni giorno. Dice anche se sei
// 'in linea' o 'oltre' il ritmo che ti porterebbe a fine mese senza restare a
// secco. Deterministico dai tuoi dati reali: nessuna invenzione.
export function cycleAllowance(commitments = [], salary = null, { now = Date.now(), allTx = {} } = {}) {
  if (!salary || !(salary.amount > 0) || !(salary.dayOfMonth >= 1)) return null;
  const r2 = (n) => Math.round(n * 100) / 100;
  const next = nextPaydayDate(salary.dayOfMonth, now);
  const prev = prevPaydayDate(salary.dayOfMonth, now);
  const cycleLen = Math.max(1, Math.round((next.getTime() - prev.getTime()) / 86_400_000));
  const daysElapsed = Math.max(0, Math.round((now - prev.getTime()) / 86_400_000));
  const daysLeft = Math.max(1, Math.round((next.getTime() - now) / 86_400_000));
  const active = commitments.filter(c => +c.amount > 0 && c.dayOfMonth >= 1 && isActive(c, now));
  const fixedTotal = active.reduce((s, c) => s + (+c.amount || 0), 0);
  const budget = Math.max(0, r2(salary.amount - fixedTotal)); // per le spese libere del ciclo

  // spesa discrezionale reale da inizio ciclo (esclude le rate degli impegni).
  let spent = 0;
  for (const txs of Object.values(allTx)) {
    for (const t of (txs || [])) {
      if (t.type && t.type !== 'uscita') continue;
      const d = parseISO(t.date) || new Date(t.date);
      const ms = d.getTime();
      if (Number.isNaN(ms) || ms < prev.getTime() || ms > now) continue;
      if (txMatchesAnyCommitment(t, active)) continue;
      spent += Math.abs(+t.amount || 0);
    }
  }
  spent = r2(spent);
  const remaining = Math.max(0, r2(budget - spent));
  const perDay = r2(remaining / daysLeft);
  const perWeek = r2(Math.min(remaining, perDay * 7));
  // ritmo: quanto AVRESTI dovuto aver speso a oggi con un passo uniforme.
  const idealByNow = budget * (daysElapsed / cycleLen);
  const pace = spent <= idealByNow * 1.03 ? 'in linea'
    : spent <= idealByNow * 1.2 ? 'un po\' sopra' : 'oltre il ritmo';
  return {
    budget, spent, remaining, perDay, perWeek,
    daysLeft, daysElapsed, cycleLen,
    pace, onTrack: spent <= idealByNow * 1.03,
    overBy: spent > idealByNow ? r2(spent - idealByNow) : 0,
  };
}

// ── RICONCILIAZIONE (anti doppio-conteggio) ─────────────────────────────────
// Il fantasma è una STIMA finché la transazione vera non arriva (import CSV/
// estratto/screenshot). Quando una spesa reale del mese COMBACIA con un impegno
// (importo simile, intorno al suo giorno), quel fantasma è "materializzato": va
// tolto dai fantasmi da accantonare, così NON lo si conta due volte. Onesto: la
// tolleranza è dichiarata; una bolletta variabile combacia entro una banda.
// Tolleranza d'importo CONSAPEVOLE DEL TIPO: un mutuo/affitto è fisso (banda
// stretta), una bolletta varia molto mese su mese (banda larga), un abbonamento
// sta nel mezzo. Così una bolletta da 120€ combacia con la stima di 70€ (è la
// stessa bolletta, importo diverso) senza che il mutuo accetti un importo sbagliato.
// Override esplicito: c.variable=true → banda molto larga; opts.amountTol vince su tutto.
const TOL_BY_KIND = { mutuo: 0.12, prestito: 0.12, affitto: 0.15, abbonamento: 0.25, bolletta: 0.75 };
function toleranceFor(c, optTol) {
  if (optTol != null) return optTol;
  if (c.variable) return 0.9;
  return TOL_BY_KIND[c.kind] ?? 0.2;
}

// Seconda via di riconoscimento: il NOME. Se la descrizione del movimento
// somiglia al nome dell'impegno (o all'esercente dichiarato in `merchant`), è
// quello stesso impegno anche se l'importo è fuori banda — è il caso reale di
// una bolletta digitata a 50€ e arrivata a 120€: sull'importo non combacerebbe
// mai, quindi non imparerebbe MAI la cifra vera. Il giorno resta un vincolo
// (una banda più larga, perché le bollette slittano): nome + finestra temporale
// insieme sono un'identificazione solida, il nome da solo no.
function nameMatches(c, t, threshold = 0.72) {
  const desc = t.description || t.merchant || '';
  if (!desc) return false;
  for (const label of [c.merchant, c.name]) {
    if (label && descriptionSimilarity(label, desc) >= threshold) return true;
  }
  return false;
}

// IL NOME VIENE PRIMA DELL'IMPORTO. Verificato dal vivo su dati realistici: una
// bolletta "variabile" ha una banda d'importo larghissima (per forza: varia), e
// con la sola banda agganciava la prima spesa qualunque capitata vicino al suo
// giorno — imparando 12€ al posto di ~90€. Una descrizione che coincide
// ("Enel Energia" per l'impegno Enel) identifica; un importo dentro una banda
// larga è una coincidenza numerica. Quindi: prima si cerca per nome, e solo se
// nessun movimento porta quel nome si ripiega sulla banda d'importo.
export function matchCommitmentInMonth(c, monthTx = [], { amountTol = null, dayTol = 6, nameDayTol = 12 } = {}) {
  const target = +c.amount || 0;
  const tol = toleranceFor(c, amountTol);
  let byName = null, byNameDelta = Infinity;
  let byAmount = null, byAmountDelta = Infinity;
  for (const t of monthTx) {
    if (t.type && t.type !== 'uscita') continue;
    const amt = Math.abs(+t.amount || 0);
    if (!(amt > 0)) continue;
    const d = parseISO(t.date) || new Date(t.date);
    if (Number.isNaN(d.getTime())) continue;
    const dayDelta = Math.abs(d.getUTCDate() - c.dayOfMonth);
    if (dayDelta <= nameDayTol && nameMatches(c, t) && dayDelta < byNameDelta) {
      byName = t; byNameDelta = dayDelta;
    }
    if (dayDelta <= dayTol && !(target > 0 && Math.abs(amt - target) / target > tol) && dayDelta < byAmountDelta) {
      byAmount = t; byAmountDelta = dayDelta;
    }
  }
  return byName || byAmount;
}

// Divide gli impegni ATTIVI del mese in "già pagati" (materializzati in una
// transazione reale) e "in sospeso" (ancora fantasmi da tenere da parte).
export function reconcileCommitments(commitments = [], monthTx = [], { now = Date.now(), ...opts } = {}) {
  const paid = [], pending = [];
  for (const c of commitments) {
    if (!(+c.amount > 0) || !(c.dayOfMonth >= 1) || !isActive(c, now)) continue;
    const m = matchCommitmentInMonth(c, monthTx, opts);
    if (m) paid.push({ ...c, matchedAmount: Math.abs(+m.amount || 0) });
    else pending.push(c);
  }
  const round = (n) => Math.round(n * 100) / 100;
  return {
    paid, pending,
    pendingTotal: round(pending.reduce((s, c) => s + (+c.amount || 0), 0)),
    paidTotal: round(paid.reduce((s, c) => s + c.matchedAmount, 0)),
  };
}

// ── AUTO-ADDESTRAMENTO DEGLI IMPORTI ────────────────────────────────────────
// La stima migliora da sola: invece del numero fisso digitato, l'impegno impara
// la MEDIA dei suoi pagamenti reali passati (mediana robusta agli straordinari).
// Vitale per le bollette (variabili): dopo qualche mese la card mostra l'importo
// vero medio, non un'ipotesi. È il segnale che alimenta anche gli altri modelli
// (media/varianza per impegno = feature per forecast di cassa e anomalie).
function medianOf(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function learnCommitmentAmount(c, allTx = {}, opts = {}) {
  const matches = [];
  // una occorrenza reale per mese (la più vicina al giorno atteso), su tutto lo storico.
  for (const txs of Object.values(allTx)) {
    const m = matchCommitmentInMonth(c, txs || [], opts);
    if (m) matches.push(Math.abs(+m.amount || 0));
  }
  if (!matches.length) return null;
  const med = medianOf(matches);
  const mean = matches.reduce((s, v) => s + v, 0) / matches.length;
  return {
    learnedAmount: Math.round(med * 100) / 100,
    samples: matches.length,
    min: Math.round(Math.min(...matches) * 100) / 100,
    max: Math.round(Math.max(...matches) * 100) / 100,
    variability: mean ? Math.round((Math.max(...matches) - Math.min(...matches)) / mean * 100) / 100 : 0,
  };
}

// Arricchisce gli impegni con l'importo APPRESO (quando c'è abbastanza storico):
// il forecast userà la media reale al posto del numero digitato, in modo
// trasparente (typedAmount conservato, learned:true). Sotto minSamples resta il
// valore inserito dall'utente — mai una media inventata su un solo dato.
export function enrichCommitmentsWithLearning(commitments = [], allTx = {}, { minSamples = 2, ...opts } = {}) {
  return commitments.map(c => {
    const learned = learnCommitmentAmount(c, allTx, opts);
    if (!learned || learned.samples < minSamples) return { ...c, learned: false };
    return {
      ...c,
      amount: learned.learnedAmount,      // il forecast usa la media reale
      typedAmount: c.amount,              // resta consultabile ciò che avevi scritto
      learned: true,
      learnedSamples: learned.samples,
      learnedMin: learned.min,
      learnedMax: learned.max,
    };
  });
}

// ── IL FORECAST PRECISO AL GIORNO ───────────────────────────────────────────
// Incrocia stipendio (giorno+importo) e impegni fissi per rispondere alle
// domande che nessuna app risponde con precisione:
//  - quanto ti serve DA QUI al prossimo stipendio per coprire gli impegni;
//  - quali impegni restano questo mese, e quanto pesano;
//  - quali stanno per ESTINGUERSI (mutuo/prestito quasi finiti).
// `salary` = { dayOfMonth, amount } (da income-model.resolveSalary) o null.
export function commitmentForecast(commitments = [], salary = null, { now = Date.now(), monthTx = null } = {}) {
  const active = commitments.filter(c => +c.amount > 0 && c.dayOfMonth >= 1 && isActive(c, now));
  // Riconciliazione: se abbiamo le transazioni del mese, distingui i fantasmi
  // già materializzati (pagati) da quelli ancora in sospeso — anti doppio-conteggio.
  const recon = monthTx ? reconcileCommitments(commitments, monthTx, { now }) : null;
  const payday = salary && salary.dayOfMonth >= 1
    ? nextPaydayDate(salary.dayOfMonth, now) : null;

  // impegni da qui al prossimo stipendio: quanto devi tenere da parte SUBITO.
  const dueBeforePayday = payday
    ? commitmentsDueBetween(active, now, payday.getTime())
    : [];
  const dueBeforePaydayTotal = Math.round(dueBeforePayday.reduce((s, o) => s + o.amount, 0) * 100) / 100;

  // impegni residui nel mese solare corrente.
  const endOfMonth = (() => { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59); })();
  const dueThisMonth = commitmentsDueBetween(active, now, endOfMonth);
  const dueThisMonthTotal = Math.round(dueThisMonth.reduce((s, o) => s + o.amount, 0) * 100) / 100;

  // impegni in via di estinzione (≤3 rate residue): buona notizia da mostrare.
  const endingSoon = active
    .map(c => ({ name: c.name, kind: c.kind, remaining: remainingInstallments(c, now), payoff: payoffDate(c) }))
    .filter(x => x.remaining !== null && x.remaining <= 3)
    .sort((a, b) => a.remaining - b.remaining);

  const monthlyFixedTotal = Math.round(active.reduce((s, c) => s + (+c.amount || 0), 0) * 100) / 100;
  const pendingGhostTotal = recon ? recon.pendingTotal : monthlyFixedTotal;

  // ── QUANTO PUOI GESTIRE AL GIORNO / A SETTIMANA ─────────────────────────────
  // La domanda che un bambino capisce: "tolto tutto, quanto posso spendere ogni
  // giorno finché non mi ripagano?". Disponibile = stipendio − fantasmi ancora
  // da pagare; diviso i giorni fino al prossimo accredito → al giorno; ×7 → a
  // settimana. Onesto: è una ripartizione uniforme, una GUIDA non una certezza.
  // Migliora da sé perché usa gli importi APPRESI (media reale) degli impegni.
  const daysToNext = payday ? Math.max(1, Math.round((payday.getTime() - now) / 86_400_000)) : null;
  let allowance = null;
  if (salary && salary.amount > 0 && daysToNext) {
    const pool = Math.max(0, Math.round((salary.amount - pendingGhostTotal) * 100) / 100);
    const perDay = pool / daysToNext;
    // il settimanale non può superare il POOL: se lo stipendio arriva tra meno
    // di 7 giorni, verrai ripagato prima — mostrare perDay×7 sarebbe una bugia.
    const perWeek = Math.min(pool, perDay * 7);
    allowance = {
      pool,
      perDay: Math.round(perDay * 100) / 100,
      perWeek: Math.round(perWeek * 100) / 100,
      daysToNext,
    };
  }

  return {
    allowance,
    payday: payday ? { date: payday.toISOString().slice(0, 10), amount: salary.amount || null,
      daysToNext: Math.max(0, Math.round((payday.getTime() - now) / 86_400_000)) } : null,
    dueBeforePayday, dueBeforePaydayTotal,
    dueThisMonth, dueThisMonthTotal,
    endingSoon,
    monthlyFixedTotal,
    activeCount: active.length,
    // Con le transazioni del mese: quanto è ancora da tenere da parte (fantasmi
    // in sospeso) vs quanto è già stato pagato per davvero (materializzato).
    pendingGhostTotal,
    paidTotal: recon ? recon.paidTotal : 0,
    paid: recon ? recon.paid : [],
    pending: recon ? recon.pending : active,
  };
}
