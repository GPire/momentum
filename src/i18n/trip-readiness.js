const copy = {
  it: ['Prima di inviare', 'Da correggere', 'Giustificativi da verificare', 'Nessun errore bloccante rilevato.', 'Apri la spesa', 'Correggi gli errori indicati prima di preparare la richiesta. Puoi sempre esportare il file completo.'],
  en: ['Before sending', 'Fix needed', 'Receipts to check', 'No blocking errors found.', 'Open expense', 'Fix the listed errors before preparing the request. You can always export the complete file.'],
  de: ['Vor dem Senden', 'Korrektur nötig', 'Belege prüfen', 'Keine blockierenden Fehler gefunden.', 'Ausgabe öffnen', 'Korrigieren Sie die angezeigten Fehler vor der Anfrage. Die vollständige Datei lässt sich weiterhin exportieren.'],
  fr: ['Avant l’envoi', 'À corriger', 'Justificatifs à vérifier', 'Aucune erreur bloquante détectée.', 'Ouvrir la dépense', 'Corrigez les erreurs indiquées avant de préparer la demande. Vous pouvez toujours exporter le fichier complet.'],
  es: ['Antes de enviar', 'Por corregir', 'Justificantes por revisar', 'No se detectaron errores que bloqueen el envío.', 'Abrir gasto', 'Corrige los errores antes de preparar la solicitud. Siempre puedes exportar el archivo completo.'],
  nl: ['Voor het versturen', 'Te herstellen', 'Bonnen controleren', 'Geen blokkerende fouten gevonden.', 'Uitgave openen', 'Herstel de aangegeven fouten voordat je de aanvraag voorbereidt. Je kunt het volledige bestand altijd exporteren.'],
  pt: ['Antes de enviar', 'A corrigir', 'Comprovativos por verificar', 'Nenhum erro bloqueante encontrado.', 'Abrir despesa', 'Corrija os erros antes de preparar o pedido. Pode sempre exportar o ficheiro completo.'],
};
export const tripReadinessCopy = (lang, key) => (copy[lang] || copy.en)[key];
const archive = {
  it: 'Il link contiene il riepilogo, senza foto. Per far controllare anche gli allegati, scarica il file completo e consegnalo al responsabile: può aprirlo in Momentum da “Richieste da verificare”.',
  en: 'The link contains the summary, without photos. To have attachments checked too, download the complete file and give it to the reviewer: they can open it in Momentum under “Requests to review”.',
  de: 'Der Link enthält die Zusammenfassung ohne Fotos. Laden Sie für die Belegprüfung die vollständige Datei herunter und geben Sie sie weiter. Sie lässt sich in Momentum unter „Anfragen prüfen“ öffnen.',
  fr: 'Le lien contient le résumé sans photos. Pour vérifier les pièces jointes, téléchargez le fichier complet et transmettez-le au responsable : il peut l’ouvrir dans Momentum, sous « Demandes à vérifier ».',
  es: 'El enlace contiene el resumen sin fotos. Para revisar los adjuntos, descarga el archivo completo y entrégalo al responsable: puede abrirlo en Momentum desde «Solicitudes para revisar».',
  nl: 'De link bevat de samenvatting zonder foto’s. Download voor controle van de bijlagen het volledige bestand en geef het aan de beoordelaar. Die kan het openen in Momentum via “Aanvragen beoordelen”.',
  pt: 'O link contém o resumo sem fotografias. Para verificar os anexos, descarregue o ficheiro completo e entregue-o ao responsável: pode abri-lo no Momentum em «Pedidos para verificar».',
};
export const tripArchiveShareCopy = lang => archive[lang] || archive.en;
