const copy = {
  it: 'Prepara la prossima spesa · controlla prima di salvare',
  en: 'Prepare the next expense · review before saving',
  de: 'Nächste Ausgabe vorbereiten · vor dem Speichern prüfen',
  fr: 'Préparer la prochaine dépense · vérifier avant d’enregistrer',
  es: 'Preparar el próximo gasto · revisar antes de guardar',
  nl: 'Volgende uitgave voorbereiden · controleer vóór opslaan',
  pt: 'Preparar a próxima despesa · confirmar antes de guardar',
};
export const splitForesightActionCopy = lang => copy[lang] || copy.en;

const shareCopy = {
  it: (amount, count) => `La tua quota potrebbe essere ${amount}, come nelle ultime ${count} spese simili. Verificala prima di aggiungere.`,
  en: (amount, count) => `Your share could be ${amount}, as in the last ${count} similar expenses. Check it before adding.`,
  de: (amount, count) => `Dein Anteil könnte ${amount} betragen, wie bei den letzten ${count} ähnlichen Ausgaben. Vor dem Hinzufügen prüfen.`,
  fr: (amount, count) => `Votre part pourrait être de ${amount}, comme pour les ${count} dépenses similaires précédentes. Vérifiez avant d’ajouter.`,
  es: (amount, count) => `Tu parte podría ser ${amount}, como en los últimos ${count} gastos similares. Revísala antes de añadir.`,
  nl: (amount, count) => `Jouw deel kan ${amount} zijn, net als bij de laatste ${count} vergelijkbare uitgaven. Controleer het voor je toevoegt.`,
  pt: (amount, count) => `A tua parte pode ser ${amount}, como nas últimas ${count} despesas semelhantes. Confirma antes de adicionar.`,
};
export const splitForesightShareCopy = (lang, amount, count) => (shareCopy[lang] || shareCopy.en)(amount, count);

const evidenceCopy = {
  it: [n => `${n} precedenti`, 'La data è una stima. Le quote appaiono solo quando lo storico è coerente; nulla viene aggiunto senza conferma.'],
  en: [n => `${n} past expenses`, 'The date is an estimate. Shares appear only with consistent history; nothing is added without confirmation.'],
  de: [n => `${n} frühere Ausgaben`, 'Das Datum ist eine Schätzung. Anteile erscheinen nur bei übereinstimmender Historie; nichts wird ohne Bestätigung hinzugefügt.'],
  fr: [n => `${n} dépenses passées`, 'La date est estimée. Les parts n’apparaissent qu’avec un historique cohérent ; rien n’est ajouté sans confirmation.'],
  es: [n => `${n} gastos anteriores`, 'La fecha es estimada. Las cuotas solo aparecen con un historial coherente; nada se añade sin confirmación.'],
  nl: [n => `${n} eerdere uitgaven`, 'De datum is een schatting. Delen verschijnen alleen bij consistente geschiedenis; zonder bevestiging wordt niets toegevoegd.'],
  pt: [n => `${n} despesas anteriores`, 'A data é uma estimativa. As partes só aparecem com histórico coerente; nada é adicionado sem confirmação.'],
};
export const splitForesightEvidenceCopy = (lang, count) => (evidenceCopy[lang] || evidenceCopy.en)[0](count);
export const splitForesightDisclaimerCopy = lang => (evidenceCopy[lang] || evidenceCopy.en)[1];
