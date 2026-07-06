// Predittore contestuale: "cosa compri DI SOLITO a quest'ora, in questo
// giorno?" — trasforma i tasti rapidi da lista per frequenza a lista per
// probabilità ADESSO (il caffè in cima alle 8 del mattino, la spesa in cima
// il sabato). Tutto misurato dalle occorrenze reali dell'utente:
// - istogramma per fascia oraria (mattina/pranzo/pomeriggio/sera)
// - istogramma per giorno della settimana
// con lisciatura di Laplace: senza pattern il "lift" vale ~1 (neutro) e
// l'ordine per frequenza resta invariato — il contesto non inventa mai,
// al massimo tace. Funzioni pure, nessun DOM.
import { descriptionSimilarity } from '../core/deduplicator.js';

// Fasce orarie: [5-11) mattina, [11-15) pranzo, [15-19) pomeriggio, resto sera/notte.
export function slotOf(date) {
  const h = date.getHours();
  if (h >= 5 && h < 11) return 0;
  if (h >= 11 && h < 15) return 1;
  if (h >= 15 && h < 19) return 2;
  return 3;
}

const SLOT_LABELS = ['la mattina', 'a pranzo', 'il pomeriggio', 'la sera'];
const DAY_LABELS = ['la domenica', 'il lunedì', 'il martedì', 'il mercoledì', 'il giovedì', 'il venerdì', 'il sabato'];

// Affinità temporale di una serie di occorrenze rispetto a un momento.
// lift = P(fascia|storico) / P(uniforme) — 1 = nessun pattern, >1 = "è il
// suo momento". Laplace: mai 0, mai certezze da due soli dati.
export function getTemporalAffinity(dates, referenceDate) {
  const n = dates.length;
  if (n === 0) return { slotLift: 1, dayLift: 1, lift: 1, reason: null };

  const refSlot = slotOf(referenceDate);
  const refDay = referenceDate.getDay();

  let slotCount = 0, dayCount = 0;
  for (const d of dates) {
    const dd = d instanceof Date ? d : new Date(d);
    if (slotOf(dd) === refSlot) slotCount++;
    if (dd.getDay() === refDay) dayCount++;
  }

  const slotProb = (slotCount + 1) / (n + 4);   // prior uniforme su 4 fasce
  const dayProb = (dayCount + 1) / (n + 7);     // prior uniforme su 7 giorni
  const slotLift = slotProb / 0.25;
  const dayLift = dayProb / (1 / 7);

  // Il "perché" mostrato all'utente: solo se il pattern è netto (mai
  // spiegazioni deboli spacciate per forti).
  let reason = null;
  if (slotLift >= 1.6 && slotLift >= dayLift) reason = `di solito ${SLOT_LABELS[refSlot]}`;
  else if (dayLift >= 1.6) reason = `di solito ${DAY_LABELS[refDay]}`;

  return {
    slotLift: +slotLift.toFixed(3),
    dayLift: +dayLift.toFixed(3),
    lift: +(slotLift * dayLift).toFixed(3),
    reason,
  };
}

// Riordina i quick-add (da getQuickAddSuggestions) per punteggio contestuale:
// occorrenze × lift temporale. Ogni suggerimento esce arricchito con
// { contextScore, reason } — la UI può spiegare il primo posto.
export function rankSuggestionsByContext(suggestions, allTx, referenceDate = new Date(), opts = {}) {
  const threshold = opts.similarityThreshold ?? 0.72;
  const all = Object.values(allTx || {}).flat().filter(t => t.type === 'uscita');

  return suggestions
    .map(s => {
      const dates = all
        .filter(t => t.category === s.category && descriptionSimilarity(t.description || '', s.description) >= threshold)
        .map(t => new Date(t.date));
      const aff = getTemporalAffinity(dates, referenceDate);
      return { ...s, contextScore: +(s.occurrences * aff.lift).toFixed(3), reason: aff.reason };
    })
    .sort((a, b) => b.contextScore - a.contextScore);
}
