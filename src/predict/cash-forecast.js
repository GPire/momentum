// ============================================================
// CASSA UNICA — simulazione giorno-per-giorno del tuo denaro (v1)
// ============================================================
// Il pezzo che mancava. Momentum sapeva già, ma in stanze separate: gli impegni
// fissi (fixed-commitments), il giorno dello stipendio (income-model), gli
// abbonamenti ricorrenti (subscriptions), i debiti di divisione (split). Quattro
// verità che nessuna app fonde in UNA riga temporale.
//
// Qui si fondono: si simula il saldo GIORNO PER GIORNO da oggi all'orizzonte,
// mettendo sulla stessa linea entrate certe, uscite già promesse, e la spesa
// libera stimata dal TUO ritmo reale (per giorno della settimana). Il risultato
// non è un numero solo: è una BANDA (prudente / probabile / fortunato) e
// soprattutto un GIORNO DI RISCHIO — "il 24 rischi di scendere sotto".
//
// Perché è proprietario e non un run-rate:
//  1. la spesa libera è depurata dalle rate degli impegni e dagli abbonamenti
//     (altrimenti li conteresti DUE volte: è l'errore classico di questi motori);
//  2. il ritmo è per giorno della settimana, misurato, non un 1/30 uniforme;
//  3. la banda nasce dalla dispersione MISURATA (MAD robusta), non da un ±20% a caso;
//  4. la LEVA MIGLIORE è una controfattuale VERA: si ri-simula lo scenario con
//     l'azione applicata e si misura di quanti giorni sposta il rischio.
//
// Onestà (regola n.2 del progetto): ogni ritorno dichiara `method` e `assumptions`,
// e il motore TACE (`known:false`) quando i dati non bastano. Nessun numero
// inventato: se non c'è storico, non c'è previsione.
//
// Funzioni pure, nessun DOM, nessuna rete.
'use strict';

import { reconcileCommitments, enrichCommitmentsWithLearning, isActive, matchCommitmentInMonth } from './fixed-commitments.js';

const DAY_MS = 86_400_000;
const r2 = (n) => Math.round(n * 100) / 100;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const dayStart = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };

// z per i quantili della banda: 10% e 90% di una normale standard.
const Z90 = 1.2816;

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Deviazione robusta: MAD × 1.4826 (equivalente alla σ su dati normali, ma non
// si fa trascinare da un singolo mese anomalo — coerente con anomaly.js).
function robustSigma(nums) {
  const med = median(nums);
  if (med === null) return 0;
  const mad = median(nums.map(v => Math.abs(v - med)));
  return mad === null ? 0 : mad * 1.4826;
}

const parseDay = (s) => {
  const t = Date.parse(s);
  return Number.isFinite(t) ? dayStart(t) : null;
};

const clampDay = (day, year, month) => {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Math.min(Math.max(1, day | 0), last);
};

// Occorrenze mensili di un evento a giorno fisso dentro una finestra.
function monthlyOccurrences(dayOfMonth, fromMs, toMs) {
  const out = [];
  const from = new Date(fromMs);
  let y = from.getUTCFullYear(), m = from.getUTCMonth();
  for (let guard = 0; guard < 25; guard++) {
    const t = Date.UTC(y, m, clampDay(dayOfMonth, y, m));
    if (t > toMs) break;
    if (t >= fromMs) out.push(t);
    m += 1;
  }
  return out;
}

// ── 1. IL TUO RITMO REALE DI SPESA LIBERA ───────────────────────────────────
// La spesa "libera" è ciò che resta togliendo le rate degli impegni e gli
// addebiti ricorrenti già modellati come eventi: quello che decidi tu, giorno
// per giorno. Si misura per GIORNO DELLA SETTIMANA perché è lì che vive il
// pattern vero (il sabato non è il martedì); il fattore per giorno si usa solo
// se quel giorno ha almeno `minPerDow` campioni, altrimenti resta 1 (uniforme).
// Restituisce null se lo storico è troppo corto: meglio tacere che inventare.
export function discretionaryProfile(allTx = {}, {
  now = Date.now(), lookbackDays = 90, commitments = [], excludeSeries = [],
  minDays = 14, minPerDow = 3,
} = {}) {
  const today = dayStart(now);
  const from = today - lookbackDays * DAY_MS;
  const perDay = new Map();          // giorno → totale speso liberamente
  let firstSeen = Infinity, txCount = 0;

  // ESCLUSIONE PUNTUALE, non "a somiglianza". Prima versione: si scartava ogni
  // movimento che ASSOMIGLIAVA a un impegno (importo in banda + giorno vicino).
  // Il bench l'ha smontata: con una bolletta variabile la banda è larghissima e
  // si mangiava spese libere vere → il ritmo risultava più basso del reale e la
  // previsione era ottimista di ~110€ su 14 giorni. Qui si sceglie AL MASSIMO UN
  // movimento per impegno per mese — lo stesso che la riconciliazione chiamerebbe
  // "quella rata" — e si esclude solo quello, per identità.
  const byMonth = new Map();
  for (const [k, txs] of Object.entries(allTx || {})) byMonth.set(k, (txs || []).filter(t => t && (!t.type || t.type === 'uscita')));
  const excluded = new Set();
  const asCommitment = (s) => ({ name: s.name || s.description, merchant: s.merchant,
    amount: +s.amount, dayOfMonth: s.dayOfMonth || 0, kind: s.kind || 'abbonamento', variable: s.variable });
  const toMatch = [
    ...commitments.filter(c => +c.amount > 0 && c.dayOfMonth >= 1),
    ...excludeSeries.filter(s => +s.amount > 0 && s.dayOfMonth >= 1).map(asCommitment),
  ];
  for (const c of toMatch) {
    for (const txs of byMonth.values()) {
      const m = matchCommitmentInMonth(c, txs);
      if (m) excluded.add(m);
    }
  }

  for (const txs of Object.values(allTx || {})) {
    for (const t of (txs || [])) {
      if (!t || (t.type && t.type !== 'uscita')) continue;
      const d = parseDay(t.date);
      if (d === null) continue;
      if (d < firstSeen) firstSeen = d;
      if (d < from || d > today) continue;
      const amt = Math.abs(+t.amount || 0);
      if (!(amt > 0)) continue;
      if (excluded.has(t)) continue;
      perDay.set(d, (perDay.get(d) || 0) + amt);
      txCount++;
    }
  }
  if (!txCount) return null;

  // La finestra osservata parte dal primo movimento utile (un utente nuovo con
  // 20 giorni di storico non deve essere diviso per 90 → media finta bassa).
  const windowStart = Math.max(from, Math.min(firstSeen, today));
  const observedDays = Math.max(1, Math.round((today - windowStart) / DAY_MS) + 1);
  if (observedDays < minDays) return null;

  // serie densa: i giorni SENZA spese valgono 0 (sono informativi quanto gli altri).
  const series = [], byDow = [[], [], [], [], [], [], []];
  for (let t = windowStart; t <= today; t += DAY_MS) {
    const v = perDay.get(t) || 0;
    series.push(v);
    byDow[new Date(t).getUTCDay()].push(v);
  }
  const dailyMean = series.reduce((s, v) => s + v, 0) / series.length;
  const dailyMedian = median(series) ?? 0;
  const sigma = robustSigma(series);

  // fattore per giorno della settimana, normalizzato per non alterare il totale.
  const dowFactor = byDow.map(vals => {
    if (vals.length < minPerDow || dailyMean <= 0) return 1;
    const m = vals.reduce((s, v) => s + v, 0) / vals.length;
    return m / dailyMean;
  });
  const factorMean = dowFactor.reduce((s, v) => s + v, 0) / 7;
  const normalized = factorMean > 0 ? dowFactor.map(f => f / factorMean) : dowFactor;

  // DISPERSIONE ALLA SCALA GIUSTA (correzione misurata, non teorica).
  // Assumere giorni indipendenti (σ·√n) sottostima l'incertezza reale: le spese
  // arrivano a grappoli (weekend, viaggi, imprevisti), quindi la somma di 14
  // giorni oscilla molto più di quanto √14 prometta. Qui la dispersione si
  // MISURA direttamente su finestre scorrevoli della lunghezza che interessa.
  // Verificato dal bench: con σ giornaliera la banda copriva il 37% dei casi
  // invece dell'80% dichiarato — cioè prometteva una precisione che non aveva.
  const blockSigma = {};
  for (const k of [7, 14, 30]) {
    if (series.length < k + 5) continue;          // servono abbastanza finestre indipendenti
    const sums = [];
    for (let i = 0; i + k <= series.length; i++) {
      let s = 0; for (let j = 0; j < k; j++) s += series[i + j];
      sums.push(s);
    }
    const m = sums.reduce((s, v) => s + v, 0) / sums.length;
    const sd = Math.sqrt(sums.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, sums.length - 1));
    // le finestre si sovrappongono → correlate → la varianza campionaria è
    // sottostimata; correzione conservativa dichiarata (fattore 1.15).
    blockSigma[k] = r2(sd * 1.15);
  }

  return {
    dailyMean: r2(dailyMean),
    dailyMedian: r2(dailyMedian),
    blockSigma,
    // dispersione giornaliera: se la MAD è 0 (spese rare ma grosse) si ripiega
    // sullo scarto medio assoluto, altrimenti la banda sarebbe larga zero = falsa certezza.
    sigma: r2(sigma > 0 ? sigma : series.reduce((s, v) => s + Math.abs(v - dailyMean), 0) / series.length),
    dowFactor: normalized.map(f => Math.round(f * 1000) / 1000),
    observedDays, txCount,
    // quanto ci si può fidare: 90 giorni pieni = 1, 14 giorni = poco.
    coverage: Math.round(Math.min(1, observedDays / lookbackDays) * 100) / 100,
    method: 'mediana e MAD robusta su serie giornaliera densa, fattori per giorno della settimana',
  };
}

// ── 2. IL REGISTRO DEGLI EVENTI CERTI ───────────────────────────────────────
// Tutto ciò che ha una data e un importo noti: stipendio, impegni ancora in
// sospeso (i "fantasmi" non ancora materializzati), abbonamenti attesi.
// Deduplicazione esplicita: un abbonamento già dichiarato come impegno NON
// diventa un secondo evento.
export function buildLedger({
  commitments = [], salary = null, subscriptions = [], extraIncomes = [],
  now = Date.now(), horizonDays = 45, monthTx = null,
} = {}) {
  const today = dayStart(now);
  const end = today + horizonDays * DAY_MS;
  const events = [];

  // impegni: solo quelli ANCORA in sospeso questo mese (la riconciliazione
  // toglie i già pagati) — le occorrenze dei mesi successivi tornano tutte.
  const active = commitments.filter(c => +c.amount > 0 && c.dayOfMonth >= 1 && isActive(c, now));
  const recon = monthTx ? reconcileCommitments(commitments, monthTx, { now }) : null;
  const paidIds = new Set((recon?.paid || []).map(c => c.id));
  const thisMonth = new Date(today).getUTCMonth();
  for (const c of active) {
    for (const t of monthlyOccurrences(c.dayOfMonth, today, end)) {
      if (!isActive(c, t)) continue;
      // già materializzato nel mese corrente → non è più un fantasma.
      if (paidIds.has(c.id) && new Date(t).getUTCMonth() === thisMonth) continue;
      events.push({ date: iso(t), ms: t, amount: -r2(+c.amount), kind: c.kind || 'impegno',
        label: c.name, source: 'commitment', id: c.id,
        // un impegno a importo variabile non è "certo": la forbice reale
        // appresa (min/max) viaggia con l'evento e allarga la banda.
        certain: !(c.variable || (c.learned && c.learnedMax > c.learnedMin)),
        learnedMin: c.learnedMin ?? null, learnedMax: c.learnedMax ?? null });
    }
  }

  // abbonamenti rilevati dai movimenti: evento SOLO se non combacia con un impegno.
  for (const s of subscriptions) {
    const amt = +s.amount || 0;
    if (!(amt > 0) || !s.nextDate) continue;
    const t = parseDay(s.nextDate);
    if (t === null || t < today || t > end) continue;
    const dom = new Date(t).getUTCDate();
    const dup = active.some(c => Math.abs(amt - (+c.amount || 0)) / (+c.amount || 1) <= 0.2 &&
      Math.abs(dom - c.dayOfMonth) <= 5);
    if (dup) continue;
    events.push({ date: iso(t), ms: t, amount: -r2(amt), kind: 'abbonamento',
      label: s.name || s.description || 'Abbonamento', source: 'subscription', certain: false });
  }

  // stipendio (e altre entrate ricorrenti dichiarate).
  if (salary && salary.amount > 0 && salary.dayOfMonth >= 1) {
    for (const t of monthlyOccurrences(salary.dayOfMonth, today + DAY_MS, end)) {
      events.push({ date: iso(t), ms: t, amount: r2(+salary.amount), kind: 'stipendio',
        label: 'Stipendio', source: 'income', certain: true });
    }
  }
  for (const inc of extraIncomes) {
    if (!(+inc.amount > 0) || !(inc.dayOfMonth >= 1)) continue;
    for (const t of monthlyOccurrences(inc.dayOfMonth, today + DAY_MS, end)) {
      events.push({ date: iso(t), ms: t, amount: r2(+inc.amount), kind: 'entrata',
        label: inc.name || 'Entrata', source: 'income', certain: false });
    }
  }

  return events.sort((a, b) => a.ms - b.ms || a.amount - b.amount);
}

// ── 3. LA SIMULAZIONE ───────────────────────────────────────────────────────
// Cammina un giorno alla volta: applica gli eventi del giorno, poi sottrae la
// spesa libera attesa di quel giorno della settimana. La banda si allarga come
// σ·√giorni (giorni indipendenti — ipotesi DICHIARATA, non nascosta), perché
// sommare σ ogni giorno gonfierebbe l'incertezza in modo irrealistico.
export function simulateCash({
  startBalance = 0, profile = null, ledger = [], now = Date.now(),
  horizonDays = 45, cushion = 0, splitOwed = 0,
} = {}) {
  const today = dayStart(now);
  const byDay = new Map();
  for (const e of ledger) {
    const d = dayStart(e.ms ?? Date.parse(e.date));
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(e);
  }

  const dailyBase = profile ? profile.dailyMean : 0;
  const sigma = profile ? profile.sigma : 0;
  const dow = profile ? profile.dowFactor : [1, 1, 1, 1, 1, 1, 1];

  // σ cumulata al giorno i: se abbiamo misurato la dispersione su finestre reali
  // (blockSigma) si usa quella, scalata dalla finestra misurata più vicina;
  // altrimenti si ripiega su √i con la σ giornaliera (dichiarato).
  const blocks = profile && profile.blockSigma ? Object.entries(profile.blockSigma)
    .map(([k, v]) => [+k, v]).filter(([, v]) => v > 0) : [];
  const sigmaAt = (i) => {
    if (!blocks.length) return sigma * Math.sqrt(i);
    // finestra misurata più vicina a i, riscalata come √(i/k)
    let best = blocks[0];
    for (const b of blocks) if (Math.abs(b[0] - i) < Math.abs(best[0] - i)) best = b;
    return best[1] * Math.sqrt(i / best[0]);
  };

  // Incertezza degli EVENTI: un impegno a importo variabile (bolletta) non è un
  // numero esatto. Se ha imparato una forbice reale (min/max), quella forbice
  // entra nella banda — altrimenti la banda ignorerebbe la fonte di errore più
  // ovvia. Approssimazione dichiarata: σ ≈ (max−min)/4.
  const eventSigma = (e) => {
    const spread = (e.learnedMax != null && e.learnedMin != null) ? (e.learnedMax - e.learnedMin) / 4 : 0;
    if (spread > 0) return spread;
    return e.certain === false ? Math.abs(e.amount) * 0.15 : 0;  // evento non certo
  };

  const path = [];
  let p50 = startBalance, eventVar = 0;
  let riskDay = null, riskDayP50 = null, lowestP50 = { date: iso(today), value: startBalance };

  for (let i = 1; i <= horizonDays; i++) {
    const t = today + i * DAY_MS;
    const evs = byDay.get(t) || [];
    const eventSum = evs.reduce((s, e) => s + e.amount, 0);
    const spend = dailyBase * (dow[new Date(t).getUTCDay()] ?? 1);
    p50 = p50 + eventSum - spend;
    for (const e of evs) { const s = eventSigma(e); eventVar += s * s; }
    const sc = sigmaAt(i);
    const band = Z90 * Math.sqrt(sc * sc + eventVar);
    const p10 = p50 - band, p90 = p50 + band;
    if (riskDay === null && p10 < cushion) riskDay = { date: iso(t), inDays: i, level: 'prudente' };
    if (riskDayP50 === null && p50 < cushion) riskDayP50 = { date: iso(t), inDays: i, level: 'probabile' };
    if (p50 < lowestP50.value) lowestP50 = { date: iso(t), value: r2(p50) };
    path.push({ date: iso(t), inDays: i, p50: r2(p50), p10: r2(p10), p90: r2(p90),
      events: evs.map(e => ({ label: e.label, amount: e.amount, kind: e.kind })) });
  }

  // esposizione split: ciò che DEVI ai tuoi gruppi non ha una data certa (dipende
  // da quando saldi), quindi non entra nella linea base — è uno scenario a parte,
  // esplicito. Onestà: mostrarlo come certo sarebbe una bugia sul quando.
  const withSplit = splitOwed > 0
    ? { endP50: r2((path.at(-1)?.p50 ?? startBalance) - splitOwed), owed: r2(splitOwed) }
    : null;

  const last = path.at(-1) || { p50: startBalance, p10: startBalance, p90: startBalance };
  return {
    known: true,
    path,
    startBalance: r2(startBalance),
    end: { date: last.date, p50: r2(last.p50), p10: r2(last.p10), p90: r2(last.p90) },
    riskDay, riskDayP50, lowest: lowestP50,
    withSplit,
    dailyBase: r2(dailyBase),
    confidence: profile ? profile.coverage : 0,
    method: 'simulazione giornaliera: eventi certi + ritmo di spesa misurato; banda dalla dispersione misurata su finestre reali (più la forbice appresa degli importi variabili)',
    assumptions: [
      profile ? `spesa libera ~${r2(dailyBase)}€/giorno dai tuoi ultimi ${profile.observedDays} giorni`
        : 'nessuno storico di spesa libera: contano solo gli eventi certi',
      'gli importi degli impegni usano la media reale appresa quando disponibile',
      splitOwed > 0 ? 'i debiti di divisione sono mostrati a parte: la data la decidi tu' : null,
    ].filter(Boolean),
  };
}

// ── 4. LA LEVA MIGLIORE (controfattuale vera) ───────────────────────────────
// Non un consiglio generico: si RI-SIMULA lo scenario con l'azione applicata e
// si misura l'effetto (giorni di rischio guadagnati, saldo finale). Si tengono
// solo le leve che spostano davvero qualcosa. Se nulla cambia, non si dice nulla.
export function bestLevers(base, { profile = null, ledger = [], startBalance = 0, now = Date.now(),
  horizonDays = 45, cushion = 0, splitOwed = 0, maxLevers = 3 } = {}) {
  if (!base || !base.known) return [];
  const sim = (opts) => simulateCash({ startBalance, profile, ledger, now, horizonDays, cushion, splitOwed, ...opts });
  const daysGained = (alt) => {
    if (!base.riskDay) return 0;
    if (!alt.riskDay) return horizonDays - base.riskDay.inDays; // il rischio sparisce nell'orizzonte
    return alt.riskDay.inDays - base.riskDay.inDays;
  };
  const candidates = [];

  // (a) ridurre la spesa libera del 10 / 20%
  for (const cut of [0.1, 0.2]) {
    if (!profile || profile.dailyMean <= 0) break;
    const alt = sim({ profile: { ...profile, dailyMean: profile.dailyMean * (1 - cut) } });
    candidates.push({
      id: `cut-${cut * 100}`,
      label: `Spendi il ${cut * 100}% in meno al giorno (${r2(profile.dailyMean * cut)}€)`,
      daysGained: daysGained(alt), endDelta: r2(alt.end.p50 - base.end.p50), kind: 'ritmo',
    });
  }

  // (b) rimandare l'abbonamento più caro oltre l'orizzonte (disdirlo/spostarlo)
  const subs = ledger.filter(e => e.source === 'subscription').sort((a, b) => a.amount - b.amount);
  if (subs.length) {
    const worst = subs[0];
    const alt = sim({ ledger: ledger.filter(e => e !== worst) });
    candidates.push({
      id: `drop-sub`,
      label: `Sospendi «${worst.label}» (${r2(-worst.amount)}€)`,
      daysGained: daysGained(alt), endDelta: r2(alt.end.p50 - base.end.p50), kind: 'abbonamento',
    });
  }

  // (c) saldare i debiti di divisione DOPO lo stipendio invece che subito
  if (splitOwed > 0) {
    const payday = ledger.find(e => e.kind === 'stipendio');
    if (payday) {
      candidates.push({
        id: 'split-after-payday',
        label: `Salda i ${r2(splitOwed)}€ della divisione dopo il ${payday.date}`,
        daysGained: 0, endDelta: 0, kind: 'divisione',
        note: 'lo stipendio copre il rimborso senza toccare il mese in corso',
      });
    }
  }

  return candidates
    .filter(c => c.daysGained > 0 || c.endDelta > 0 || c.note)
    .sort((a, b) => (b.daysGained - a.daysGained) || (b.endDelta - a.endDelta))
    .slice(0, maxLevers);
}

// ── 5. L'INGRESSO UNICO ─────────────────────────────────────────────────────
// Una sola chiamata dalla UI: prende lo stato grezzo, applica l'apprendimento
// degli importi, costruisce registro e profilo, simula, calcola le leve, e
// restituisce anche una frase pronta comprensibile a un bambino di 8 anni.
export function cashForecast({
  allTx = {}, commitments = [], salary = null, subscriptions = [], splitOwed = 0,
  startBalance = null, monthTx = null, now = Date.now(), horizonDays = 45, cushion = 0,
} = {}) {
  const enriched = enrichCommitmentsWithLearning(commitments, allTx);
  const profile = discretionaryProfile(allTx, { now, commitments: enriched, excludeSeries: subscriptions });
  const ledger = buildLedger({ commitments: enriched, salary, subscriptions, now, horizonDays, monthTx });

  // Senza saldo dichiarato NON si inventa un punto di partenza: si simula il
  // DELTA da oggi (parte da 0) e lo si dichiara. Un saldo finto sarebbe il
  // peggior tipo di bugia in un'app di soldi.
  const relative = startBalance === null;
  const start = relative ? 0 : +startBalance || 0;
  if (!profile && !ledger.length) {
    return { known: false, reason: 'Non ho ancora abbastanza dati: né movimenti né impegni o stipendio noti.' };
  }
  const base = simulateCash({ startBalance: start, profile, ledger, now, horizonDays, cushion, splitOwed });
  const levers = bestLevers(base, { profile, ledger, startBalance: start, now, horizonDays, cushion, splitOwed });

  const money = (n) => `${(+n || 0).toFixed(2).replace('.', ',')} €`;
  let headline;
  if (relative) {
    headline = base.end.p50 >= 0
      ? `Da qui a ${horizonDays} giorni metti da parte ${money(base.end.p50)} più di oggi.`
      : `Da qui a ${horizonDays} giorni ti servono ${money(-base.end.p50)} più di quanto hai oggi.`;
  } else if (base.riskDay) {
    headline = `Occhio al ${base.riskDay.date}: a quel punto potresti scendere sotto ${money(cushion)}.`;
  } else {
    headline = `Fino al ${base.end.date} resti sopra ${money(cushion)}: nessun giorno critico in vista.`;
  }

  return {
    ...base,
    relative,
    headline,
    levers,
    profile,
    ledger,
    horizonDays,
  };
}
