import { flagAnomaly, predictExpenseShape } from '../split/split-intelligence.js';

const copy = {
  it: (n, value) => `Rispetto a ${n} spese simili in questo gruppo, l'importo è insolito (valore tipico ${value}). Controllalo: puoi comunque aggiungerlo.`,
  en: (n, value) => `Compared with ${n} similar expenses in this group, this amount is unusual (typical amount ${value}). Check it; you can still add it.`,
  de: (n, value) => `Verglichen mit ${n} ähnlichen Ausgaben in dieser Gruppe ist der Betrag ungewöhnlich (typisch ${value}). Prüfe ihn; du kannst ihn trotzdem hinzufügen.`,
  fr: (n, value) => `Par rapport à ${n} dépenses similaires de ce groupe, ce montant est inhabituel (montant habituel ${value}). Vérifiez-le ; vous pouvez quand même l'ajouter.`,
  es: (n, value) => `Comparado con ${n} gastos similares de este grupo, el importe es inusual (importe habitual ${value}). Revísalo; puedes añadirlo igualmente.`,
  nl: (n, value) => `Vergeleken met ${n} vergelijkbare uitgaven in deze groep is dit bedrag ongebruikelijk (gebruikelijk ${value}). Controleer het; je kunt het toch toevoegen.`,
  pt: (n, value) => `Em comparação com ${n} despesas semelhantes neste grupo, este valor é invulgar (valor habitual ${value}). Confira-o; pode adicioná-lo na mesma.`,
};
const shapeCopy = {
  it: (n, name) => `In ${n} spese simili ha pagato di solito ${name}. Usa questa scelta`,
  en: (n, name) => `In ${n} similar expenses, ${name} usually paid. Use this choice`,
  de: (n, name) => `Bei ${n} ähnlichen Ausgaben hat meist ${name} bezahlt. Auswahl übernehmen`,
  fr: (n, name) => `Sur ${n} dépenses similaires, ${name} a généralement payé. Utiliser ce choix`,
  es: (n, name) => `En ${n} gastos similares suele pagar ${name}. Usar esta opción`,
  nl: (n, name) => `Bij ${n} vergelijkbare uitgaven betaalde meestal ${name}. Keuze overnemen`,
  pt: (n, name) => `Em ${n} despesas semelhantes, normalmente pagou ${name}. Usar esta opção`,
};

// Amounts in another currency are not comparable until the real exchange rate
// has been fetched. With too little history the engine abstains as well.
export function splitAnomalyMessage(group, { description, amount, inputCurrency }, lang = 'en') {
  const currency = group.baseCurrency || 'EUR';
  if (inputCurrency && inputCurrency !== currency) return null;
  if (!description?.trim() || !(Number.isFinite(amount) && amount > 0)) return null;
  const observation = flagAnomaly(group, { description, amount });
  if (!observation.isAnomaly) return null;
  const typical = new Intl.NumberFormat(lang, { style: 'currency', currency }).format(observation.median);
  return (copy[lang] || copy.en)(observation.samples, typical);
}

export function splitShapeSuggestion(group, description, names, lang = 'en') {
  if (!description?.trim()) return null;
  const prediction = predictExpenseShape(group, description);
  if (!prediction || prediction.basis !== 'descrizione' || prediction.payerConfidence < 0.65) return null;
  const memberIds = new Set(group.members.map(member => member.id));
  if (!memberIds.has(prediction.payer) || prediction.involved.some(id => !memberIds.has(id))) return null;
  return {
    payer: prediction.payer,
    involved: prediction.involved,
    message: (shapeCopy[lang] || shapeCopy.en)(prediction.samples, names[prediction.payer] || prediction.payer),
  };
}
