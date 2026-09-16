const copy = {
  it: ['Regole dei giustificativi', 'Richiedi un allegato da questo importo (€)', '0 = per ogni spesa. Vale per questa trasferta. È una regola impostata da te, non una verifica fiscale.', 'Salva regola'],
  en: ['Receipt rules', 'Require an attachment from this amount (€)', '0 = every expense. Applies to this trip. This is your chosen rule, not a tax assessment.', 'Save rule'],
  de: ['Belegregeln', 'Beleg ab diesem Betrag verlangen (€)', '0 = jede Ausgabe. Gilt für diese Reise. Ihre gewählte Regel, keine steuerliche Prüfung.', 'Regel speichern'],
  fr: ['Règles des justificatifs', 'Exiger un justificatif à partir de ce montant (€)', '0 = chaque dépense. Pour ce déplacement. Votre règle, pas une vérification fiscale.', 'Enregistrer la règle'],
  es: ['Reglas de justificantes', 'Pedir un adjunto a partir de este importe (€)', '0 = cada gasto. Para este viaje. Es tu regla, no una comprobación fiscal.', 'Guardar regla'],
  nl: ['Bonnenregels', 'Bijlage vereisen vanaf dit bedrag (€)', '0 = elke uitgave. Geldt voor deze reis. Je eigen regel, geen fiscale beoordeling.', 'Regel opslaan'],
  pt: ['Regras dos comprovativos', 'Exigir um anexo a partir deste valor (€)', '0 = cada despesa. Para esta viagem. É a sua regra, não uma avaliação fiscal.', 'Guardar regra'],
};
export const tripPolicyCopy = (lang, key) => (copy[lang] || copy.en)[key];
