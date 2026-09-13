const copy = {
  it: ['Scarica tutti i dati della trasferta', 'File JSON con spese, allegati ed esito. Per archiviazione o integrazione tecnica; non viene inviato al gestionale.'],
  en: ['Download all trip data', 'JSON file with expenses, attachments and decision. For archiving or technical integration; it is not sent to your company system.'],
  de: ['Alle Reisedaten herunterladen', 'JSON-Datei mit Ausgaben, Belegen und Entscheidung. Zur Archivierung oder technischen Integration; kein Versand an das Firmensystem.'],
  fr: ['Télécharger toutes les données du déplacement', 'Fichier JSON avec dépenses, pièces jointes et décision. Pour archivage ou intégration technique ; aucun envoi au système de l’entreprise.'],
  es: ['Descargar todos los datos del viaje', 'Archivo JSON con gastos, adjuntos y decisión. Para archivo o integración técnica; no se envía al sistema de la empresa.'],
  nl: ['Alle reisgegevens downloaden', 'JSON-bestand met uitgaven, bijlagen en besluit. Voor archivering of technische integratie; niet verzonden naar het bedrijfssysteem.'],
  pt: ['Descarregar todos os dados da viagem', 'Ficheiro JSON com despesas, anexos e decisão. Para arquivo ou integração técnica; não é enviado ao sistema da empresa.'],
};
export const tripExportCopy = (lang, key) => (copy[lang] || copy.en)[key];
