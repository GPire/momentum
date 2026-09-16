const copy = {
  it: 'Ci sono versioni diverse di una spesa. Chiedi al mittente di confermare i dati corretti e inviare un nuovo resoconto prima di approvare.',
  en: 'An expense has conflicting versions. Ask the sender to confirm the correct details and send a new report before approving.',
  de: 'Für eine Ausgabe gibt es widersprüchliche Versionen. Bitten Sie den Absender, die richtigen Daten zu bestätigen und vor der Freigabe einen neuen Bericht zu senden.',
  fr: 'Une dépense a des versions contradictoires. Demandez à l’expéditeur de confirmer les bonnes données et d’envoyer un nouveau rapport avant de valider.',
  es: 'Un gasto tiene versiones distintas. Pide al remitente que confirme los datos correctos y envíe un nuevo informe antes de aprobar.',
  nl: 'Een uitgave heeft tegenstrijdige versies. Vraag de afzender de juiste gegevens te bevestigen en een nieuw rapport te sturen voordat je goedkeurt.',
  pt: 'Uma despesa tem versões diferentes. Peça ao remetente que confirme os dados corretos e envie um novo relatório antes de aprovar.',
};
export const reviewConflictCopy = lang => copy[lang] || copy.en;
