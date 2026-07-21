// Rilevatore di abbonamenti ricorrenti e aumenti di prezzo silenziosi
// (es. uno streaming che passa da 9,99€ a 14,99€ senza che l'utente se ne
// accorga). Motivo: è una delle cause più concrete per cui le persone
// smettono di fidarsi della propria gestione finanziaria — se non lo nota
// l'app, lo nota la banca a fine mese. Funzioni pure sui dati (stesso
// principio di deduplicator.js/dispatcher.js), nessuna dipendenza da DOM.
import { descriptionSimilarity } from '../core/deduplicator.js';

const DEFAULT_OPTS = {
  minOccurrences: 2,       // almeno 2 addebiti per parlare di "ricorrente"
  intervalDays: { min: 25, max: 35 }, // tolleranza attorno al mese
  similarityThreshold: 0.72, // stessa soglia del merge del deduplicatore
  hikeThreshold: 0.10,     // 10% di aumento rispetto alla media precedente
  creepThreshold: 0.12,    // 12% di aumento CUMULATO (creep silenzioso)
  minForTrend: 3,          // addebiti minimi per parlare di "trend"
  anticipateWindow: 12,    // giorni: quanto prima avvisare del prossimo addebito
};

function flattenTx(allTx) {
  return Object.values(allTx || {}).flat().filter(t => t.type === 'uscita');
}

// Raggruppa le transazioni per descrizione simile (stesso giudice del
// deduplicatore) all'interno della stessa categoria, poi tiene solo i
// gruppi con cadenza plausibilmente mensile.
export function detectRecurring(allTx, opts = {}) {
  const { minOccurrences, intervalDays, similarityThreshold } = { ...DEFAULT_OPTS, ...opts };
  const txs = flattenTx(allTx).sort((a, b) => new Date(a.date) - new Date(b.date));

  const groups = [];
  for (const tx of txs) {
    let group = groups.find(g =>
      g.category === tx.category &&
      descriptionSimilarity(g.representative, tx.description) >= similarityThreshold
    );
    if (!group) {
      group = { representative: tx.description, category: tx.category, items: [] };
      groups.push(group);
    }
    group.items.push(tx);
  }

  return groups
    .filter(g => g.items.length >= minOccurrences)
    .map(g => {
      const intervals = [];
      for (let i = 1; i < g.items.length; i++) {
        const days = (new Date(g.items[i].date) - new Date(g.items[i - 1].date)) / 86_400_000;
        intervals.push(days);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / (intervals.length || 1);
      const isMonthly = intervals.every(d => d >= intervalDays.min && d <= intervalDays.max);
      return { ...g, avgInterval, isMonthly };
    })
    .filter(g => g.isMonthly);
}

// Per ogni serie ricorrente, confronta l'ultimo addebito con la media dei
// precedenti: se l'aumento supera la soglia, lo segnala con i numeri veri
// (mai un giudizio, solo il fatto misurato — coerente col resto del progetto).
// Riepilogo pronto per la UI e PREDITTIVO: abbonamenti trovati + PROSSIMO
// addebito stimato (dalla cadenza reale) + costo mensile totale + aumenti di
// prezzo + addebiti in arrivo nei prossimi 31 giorni. Semplice e chiaro
// (usabile da un bambino di 8 anni): "questi ti si ripetono, questo il totale,
// il prossimo arriva il …". Onestà: sono fatti misurati, non giudizi.
export function subscriptionSummary(allTx, referenceDate = new Date(), opts = {}) {
  const recurring = detectRecurring(allTx, opts);
  const hikes = detectPriceHikes(allTx, opts);
  const now = new Date(referenceDate);
  const subs = recurring.map(g => {
    const items = g.items;
    const last = items[items.length - 1];
    const recent = items.slice(-3);
    const amount = +(recent.reduce((a, t) => a + t.amount, 0) / recent.length).toFixed(2); // media ultimi 3 = prezzo attuale
    const next = new Date(last.date); next.setDate(next.getDate() + Math.round(g.avgInterval || 30));
    return { name: g.representative, category: g.category, amount, occurrences: items.length, lastDate: last.date, nextDate: next.toISOString(), avgInterval: Math.round(g.avgInterval || 30) };
  }).sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate));
  const monthlyTotal = +subs.reduce((s, x) => s + x.amount, 0).toFixed(2);
  const upcoming = subs.filter(s => { const days = (new Date(s.nextDate) - now) / 86_400_000; return days >= -2 && days <= 31; });
  const upcomingTotal = +upcoming.reduce((s, x) => s + x.amount, 0).toFixed(2);
  const anticipated = anticipatePriceHikes(allTx, referenceDate, opts);
  return { subscriptions: subs, count: subs.length, monthlyTotal, hikes, upcoming, upcomingTotal, anticipated };
}

// ANTICIPATORIO + CREEP SILENZIOSO (evoluzione di detectPriceHikes, che è
// reattivo): coglie gli aumenti che il controllo salto-singolo NON vede — tanti
// piccoli rincari sotto-soglia che sommati erodono il budget (es. 9,99→10,49→
// 10,99→11,49: nessun salto >10%, ma +15% totale) — e PREVEDE il prossimo
// importo quando c'è un trend crescente consistente, avvisando PRIMA
// dell'addebito. Calcola l'impatto ANNUALE (rende concreto il "poco" mensile).
// Onestà: nessuna previsione senza trend reale; se è piatto, silenzio. Pura.
export function anticipatePriceHikes(allTx, referenceDate = new Date(), opts = {}) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const recurring = detectRecurring(allTx, opts);
  const now = new Date(referenceDate);
  const alerts = [];
  for (const g of recurring) {
    const items = g.items; // già ordinati per data
    if (items.length < o.minForTrend) continue;
    const amounts = items.map(t => t.amount);
    const baseline = amounts[0];
    if (!(baseline > 0)) continue;
    const last = items[items.length - 1];
    const current = +last.amount.toFixed(2); // prezzo ATTUALE = ultimo addebito reale
    const next = new Date(last.date); next.setDate(next.getDate() + Math.round(g.avgInterval || 30));
    const daysToNext = Math.round((next - now) / 86_400_000);

    const steps = [];
    for (let i = 1; i < amounts.length; i++) steps.push(amounts[i] - amounts[i - 1]);
    const posSteps = steps.filter(s => s > 0.01);
    const totalCreep = (current - baseline) / baseline;
    const singleJump = Math.max(0, ...steps);
    const hadBigJump = singleJump / baseline > o.hikeThreshold; // già coperto da detectPriceHikes

    // Predizione prudente del prossimo importo: solo con trend crescente netto
    // (≥2 rincari) → proietta il rincaro medio; altrimenti resta l'attuale.
    let predictedNext = current;
    if (posSteps.length >= 2) {
      const avgRise = posSteps.reduce((a, b) => a + b, 0) / posSteps.length;
      predictedNext = +(current + avgRise).toFixed(2);
    }
    const annualImpact = +((current - baseline) * 12).toFixed(2);

    // (1) CREEP silenzioso: aumento cumulato oltre soglia SENZA un singolo salto
    // grosso (quelli li prende già detectPriceHikes) → il valore aggiunto qui.
    if (totalCreep >= o.creepThreshold && !hadBigJump) {
      alerts.push({
        type: 'creep', name: g.representative, category: g.category,
        baseline: +baseline.toFixed(2), current, totalPct: +(totalCreep * 100).toFixed(1),
        annualImpact, occurrences: items.length, nextDate: next.toISOString(), predictedNext,
      });
    }
    // (2) ANTICIPATORIO: il prossimo addebito è vicino E si prevede più alto
    // dell'attuale → avvisa PRIMA che colpisca, con la stima.
    if (daysToNext >= 0 && daysToNext <= o.anticipateWindow && predictedNext > current * 1.001) {
      alerts.push({
        type: 'upcoming-rise', name: g.representative, category: g.category,
        current, predictedNext, delta: +(predictedNext - current).toFixed(2),
        nextDate: next.toISOString(), daysToNext, annualImpact,
      });
    }
  }
  // prima gli addebiti in arrivo (più urgenti), poi i creep per impatto annuale
  return alerts.sort((a, b) =>
    (a.type === 'upcoming-rise' ? 0 : 1) - (b.type === 'upcoming-rise' ? 0 : 1)
    || (b.annualImpact || 0) - (a.annualImpact || 0));
}

export function detectPriceHikes(allTx, opts = {}) {
  const { hikeThreshold } = { ...DEFAULT_OPTS, ...opts };
  const recurring = detectRecurring(allTx, opts);
  const hikes = [];

  for (const group of recurring) {
    const items = group.items;
    const latest = items[items.length - 1];
    const previous = items.slice(0, -1);
    const avgPrevious = previous.reduce((a, t) => a + t.amount, 0) / previous.length;
    if (avgPrevious === 0) continue;

    const increase = (latest.amount - avgPrevious) / avgPrevious;
    if (increase > hikeThreshold) {
      hikes.push({
        description: group.representative,
        category: group.category,
        previousAmount: +avgPrevious.toFixed(2),
        newAmount: latest.amount,
        increasePct: +(increase * 100).toFixed(1),
        occurrences: items.length,
        latestDate: latest.date,
      });
    }
  }
  return hikes.sort((a, b) => b.increasePct - a.increasePct);
}
