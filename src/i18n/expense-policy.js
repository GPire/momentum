const copy = {
  it: ['Limiti per singola spesa (€)', 'Lascia vuoto per non impostare un limite. Il superamento richiede una verifica, non rifiuta il rimborso.', 'Nessun limite', 'Supera il limite della categoria', 'Valuta diversa: verifica il limite manualmente', 'Limite non valido: correggi le regole'],
  en: ['Limits per expense (€)', 'Leave blank for no limit. Exceeding a limit requires review, not automatic rejection.', 'No limit', 'Above the category limit', 'Different currency: check the limit manually', 'Invalid limit: correct the rules'],
  de: ['Höchstbetrag pro Ausgabe (€)', 'Leer lassen für kein Limit. Überschreitungen erfordern eine Prüfung, keine automatische Ablehnung.', 'Kein Limit', 'Kategorielimit überschritten', 'Andere Währung: Limit manuell prüfen', 'Ungültiges Limit: Regeln korrigieren'],
  fr: ['Plafonds par dépense (€)', 'Laissez vide pour ne pas fixer de plafond. Un dépassement nécessite une vérification, pas un refus automatique.', 'Sans plafond', 'Plafond de la catégorie dépassé', 'Devise différente : vérifiez le plafond manuellement', 'Plafond invalide : corrigez les règles'],
  es: ['Límites por gasto (€)', 'Deja vacío para no fijar un límite. Superarlo requiere revisión, no un rechazo automático.', 'Sin límite', 'Supera el límite de la categoría', 'Otra moneda: revisa el límite manualmente', 'Límite no válido: corrige las reglas'],
  nl: ['Limieten per uitgave (€)', 'Laat leeg voor geen limiet. Overschrijding vraagt om controle, geen automatische afwijzing.', 'Geen limiet', 'Boven de categorielimiet', 'Andere valuta: controleer de limiet handmatig', 'Ongeldige limiet: pas de regels aan'],
  pt: ['Limites por despesa (€)', 'Deixe vazio para não definir limite. Ultrapassá-lo exige revisão, não rejeição automática.', 'Sem limite', 'Acima do limite da categoria', 'Moeda diferente: verifique o limite manualmente', 'Limite inválido: corrija as regras'],
};
export const expensePolicyCopy = (lang, key) => (copy[lang] || copy.en)[key];
