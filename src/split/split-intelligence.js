// ============================================================
// SPLIT INTELLIGENCE — il gruppo divisione spese diventa PREDITTIVO (v1)
// ============================================================
// Splitwise/Settle Up sono registri passivi: scrivi tu ogni spesa, loro
// sommano. Momentum guarda avanti, on-device, dai SOLI dati del gruppo:
//
//  1. detectRecurring  — quali spese si ripetono e QUANDO tornerà la prossima
//     (affitto, bollette, abbonamenti condivisi): cadenza + data attesa.
//  2. predictExpenseShape — per una nuova spesa, CHI probabilmente paga e CHI è
//     coinvolto, dai pattern passati (meno tap, meno attrito).
//  3. flagAnomaly — un importo fuori scala rispetto allo storico di QUELLA
//     spesa (median/MAD robusti): "la bolletta è il triplo del solito".
//  4. forecastGroupBalances — proietta solo le ricorrenti per cui pagatore e
//     quote sono coerenti nello storico. Non trasforma quote custom in quote eque.
//
// REGOLA #1 (onestà): niente invenzioni. Ogni funzione TACE (ritorna null / lista
// vuota) sotto la soglia di evidenza. Nessuna confidenza gonfiata: deriva da
// quante volte l'ho visto e da quanto è regolare. Pure, nessun DOM, nessuna rete.
'use strict';

const DAY = 86_400_000;

// Normalizzazione descrizione: raggruppa "Affitto", "affitto  casa", "AFFITTO"
// come stessa spesa ricorrente, senza confondere spese diverse.
function normDesc(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\d+/g, ' ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const parseDate = (d) => {
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : null;
};

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Deviazione assoluta mediana (robusta agli outlier, a differenza della std):
// non si lascia gonfiare proprio dal valore anomalo che vogliamo scoprire.
function mad(nums, med) {
  if (nums.length < 2) return 0;
  return median(nums.map(n => Math.abs(n - med)));
}

// Raggruppa le spese di un gruppo per descrizione normalizzata, ordinate nel tempo.
function byDescription(group) {
  const map = new Map();
  for (const e of (group.expenses || [])) {
    const key = normDesc(e.description);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  for (const arr of map.values()) arr.sort((a, b) => (parseDate(a.date) || 0) - (parseDate(b.date) || 0));
  return map;
}

// ── 1. SPESE RICORRENTI + prossima attesa ───────────────────────────────────
// Una spesa è ricorrente se compare ≥ minOccurrences volte a intervalli
// REGOLARI (bassa dispersione relativa). Ritorna, per ognuna: cadenza mediana,
// importo tipico, ultima data e la PROSSIMA data attesa. Tace sulle sporadiche.
export function detectRecurring(group, { now = Date.now(), minOccurrences = 3, maxCv = 0.4 } = {}) {
  const out = [];
  for (const [key, exps] of byDescription(group)) {
    if (exps.length < minOccurrences) continue;
    const dates = exps.map(e => parseDate(e.date)).filter(Boolean);
    if (dates.length < minOccurrences) continue;
    const gaps = [];
    for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / DAY);
    const cad = median(gaps);
    if (cad <= 0) continue;
    // regolarità: coefficiente di variazione degli intervalli (dispersione/media).
    const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const varGap = gaps.reduce((a, b) => a + (b - meanGap) ** 2, 0) / gaps.length;
    const cv = meanGap > 0 ? Math.sqrt(varGap) / meanGap : Infinity;
    if (cv > maxCv) continue; // troppo irregolare → non è una vera ricorrente
    const lastDate = dates[dates.length - 1];
    const amounts = exps.map(e => e.amount);
    if (amounts.some(value => !Number.isFinite(value) || !(value > 0) || !Number.isSafeInteger(Math.round(value * 100)))) continue;
    // confidenza onesta: cresce col numero di occorrenze e con la regolarità.
    const regularity = Math.max(0, 1 - cv / maxCv);
    const confidence = Math.min(0.99, (1 - 1 / exps.length) * (0.5 + 0.5 * regularity));
    out.push({
      description: exps[exps.length - 1].description,
      key,
      occurrences: exps.length,
      cadenceDays: Math.round(cad),
      typicalAmount: Math.round(median(amounts) * 100) / 100,
      lastDate: new Date(lastDate).toISOString().slice(0, 10),
      nextExpectedDate: new Date(lastDate + cad * DAY).toISOString().slice(0, 10),
      daysUntilNext: Math.round((lastDate + cad * DAY - now) / DAY),
      confidence: Math.round(confidence * 100) / 100,
    });
  }
  return out.sort((a, b) => a.daysUntilNext - b.daysUntilNext);
}

// ── 2. FORMA PREDETTA di una nuova spesa (chi paga, chi è coinvolto) ─────────
// Dai pattern passati per QUELLA descrizione (fallback: tutto lo storico):
// il pagatore più frequente e i membri di solito coinvolti. Tace se non ha
// abbastanza esempi per dire qualcosa di sensato.
export function predictExpenseShape(group, description, { minSamples = 2, involveThreshold = 0.5 } = {}) {
  const key = normDesc(description);
  const all = group.expenses || [];
  let matches = key ? all.filter(e => normDesc(e.description) === key) : [];
  let basis = 'descrizione';
  if (matches.length < minSamples) { matches = all; basis = 'storico'; } // fallback
  if (matches.length < minSamples) return null;

  const payerCount = {};
  for (const e of matches) payerCount[e.payer] = (payerCount[e.payer] || 0) + 1;
  let payer = null, pv = 0;
  for (const [id, v] of Object.entries(payerCount)) if (v > pv) { payer = id; pv = v; }
  const payerConfidence = matches.length ? pv / matches.length : 0;

  // coinvolti: membri che compaiono nella ripartizione (owed>0) in almeno
  // involveThreshold delle spese campione.
  const involveCount = {};
  for (const e of matches) for (const [id, q] of Object.entries(e.owed || {})) if (q > 0) involveCount[id] = (involveCount[id] || 0) + 1;
  const involved = Object.entries(involveCount)
    .filter(([, c]) => c / matches.length >= involveThreshold)
    .map(([id]) => id);

  const typicalAmount = Math.round(median(matches.map(e => e.amount)) * 100) / 100;
  return {
    payer,
    payerConfidence: Math.round(payerConfidence * 100) / 100,
    involved: involved.length ? involved : group.members.map(m => m.id),
    typicalAmount,
    basis,          // 'descrizione' = match preciso, 'storico' = ripiego generico
    samples: matches.length,
  };
}

// ── 3. ANOMALIA DI IMPORTO (robusta) ────────────────────────────────────────
// Un importo è anomalo se dista dalla mediana storica di QUELLA spesa più di
// k deviazioni assolute mediane (robusto agli outlier). Tace sotto minSamples:
// senza storico non esiste "normale", quindi niente allarmi inventati.
export function flagAnomaly(group, { description, amount }, { minSamples = 4, k = 3.5 } = {}) {
  const key = normDesc(description);
  const past = (group.expenses || []).filter(e => normDesc(e.description) === key).map(e => e.amount);
  if (past.length < minSamples) return { isAnomaly: false, reason: 'storico insufficiente', samples: past.length };
  const med = median(past);
  const dispersion = mad(past, med) || (med * 0.05); // se MAD=0 (tutti uguali), tolleranza minima 5%
  const deviations = Math.abs(amount - med) / (dispersion || 1);
  const isAnomaly = deviations > k;
  return {
    isAnomaly,
    direction: amount > med ? 'sopra' : 'sotto',
    median: Math.round(med * 100) / 100,
    ratio: med ? Math.round((amount / med) * 100) / 100 : null,
    deviations: Math.round(deviations * 10) / 10,
    samples: past.length,
  };
}

// Quote storiche abbastanza stabili da mostrare come ipotesi, non come debito.
// Un nuovo membro, un pagatore incerto o ripartizioni discordanti richiedono
// una scelta umana: in quei casi la ricorrente si vede ma non sposta i saldi.
function recurringProfile(group, key) {
  const samples = byDescription(group).get(key) || [];
  if (samples.length < 3) return null;
  const members = group.members.map(m => m.id);
  const memberSet = new Set(members);
  const payerCounts = new Map();
  const fractions = [];
  for (const expense of samples) {
    if (!(expense.amount > 0) || !memberSet.has(expense.payer)) return null;
    const shares = Object.entries(expense.owed || {});
    if (!shares.length || shares.some(([id, value]) => !memberSet.has(id) || !Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100)) || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6)) return null;
    if (expense.split?.mode === 'equal' && shares.length !== members.length) return null;
    const sumCents = shares.reduce((total, [, value]) => total + Math.round(value * 100), 0);
    if (sumCents !== Math.round(expense.amount * 100)) return null;
    payerCounts.set(expense.payer, (payerCounts.get(expense.payer) || 0) + 1);
    fractions.push(Object.fromEntries(members.map(id => [id, (expense.owed[id] || 0) / expense.amount])));
  }
  const [payer, count] = [...payerCounts].sort((a, b) => b[1] - a[1])[0] || [];
  if (!payer || count / samples.length < .75) return null;
  const share = Object.fromEntries(members.map(id => [id, median(fractions.map(row => row[id]))]));
  if (fractions.some(row => members.some(id => Math.abs(row[id] - share[id]) > .1))) return null;
  const total = Object.values(share).reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return null;
  return { payer, share: Object.fromEntries(members.map(id => [id, share[id] / total])), samples: samples.length };
}

function projectedCents(amount, share, memberIds) {
  const cents = Math.round(amount * 100);
  const rows = memberIds.map(id => ({ id, exact: cents * share[id] }));
  const result = Object.fromEntries(rows.map(row => [row.id, Math.floor(row.exact)]));
  let remaining = cents - Object.values(result).reduce((sum, value) => sum + value, 0);
  rows.sort((a, b) => (b.exact % 1) - (a.exact % 1) || a.id.localeCompare(b.id));
  for (let i = 0; i < remaining; i++) result[rows[i].id]++;
  return result;
}

// ── 4. FORECAST DEI SALDI a fine orizzonte ──────────────────────────────────
// Simulazione revocabile, mai un addebito o una spesa salvata. Richiede
// computeBalances dall'esterno per non accoppiare i moduli.
export function forecastGroupBalances(group, computeBalances, { horizonDays = 30, now = Date.now() } = {}) {
  const current = computeBalances(group);
  const projected = { ...current };
  const recurring = detectRecurring(group, { now });
  const upcoming = [];
  const memberIds = group.members.map(m => m.id);
  const today = Date.parse(new Date(now).toISOString().slice(0, 10));
  for (const r of recurring) {
    // Un vecchio abbonamento fermo da tempo non deve riapparire come previsione.
    if (r.daysUntilNext < -3 || r.cadenceDays < 1) continue;
    const profile = recurringProfile(group, r.key);
    // Quante occorrenze cadono nella finestra [now, now+horizon].
    let t = parseDate(r.nextExpectedDate);
    while (t !== null && t <= today + horizonDays * DAY) {
      if (t >= today) {
        const owedCents = profile ? projectedCents(r.typicalAmount, profile.share, memberIds) : null;
        upcoming.push({
          key: r.key, description: r.description, date: new Date(t).toISOString().slice(0, 10),
          amount: r.typicalAmount, predictedPayer: profile?.payer || null,
          estimatedShares: owedCents && Object.fromEntries(memberIds.map(id => [id, owedCents[id] / 100])),
          samples: profile?.samples || 0,
          basis: profile ? 'consistent-history' : 'needs-confirmation',
        });
        if (owedCents) {
          for (const id of memberIds) projected[id] = Math.round((projected[id] || 0) * 100 - owedCents[id]) / 100;
          projected[profile.payer] = Math.round((projected[profile.payer] || 0) * 100 + Math.round(r.typicalAmount * 100)) / 100;
        }
      }
      t += r.cadenceDays * DAY;
    }
  }
  return {
    current,
    projected,
    upcoming: upcoming.sort((a, b) => a.date.localeCompare(b.date)),
    horizonDays,
  };
}
