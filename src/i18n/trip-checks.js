import { tripEditCopy } from './trip-edit.js';
import { tripAttachmentCopy } from './trip-attachment.js';
const copy = {
  it: ['Controllo del resoconto', 'voci', 'allegati', 'Da verificare', 'Allegato assente', 'Identificativo assente', 'Identificativo ripetuto', 'Importo non valido', 'Data non valida', 'Puoi comunque scaricare tutti i dati. Un allegato assente non significa che la spesa non sia rimborsabile.'],
  en: ['Report check', 'entries', 'attachments', 'Review needed', 'No attachment', 'Missing ID', 'Repeated ID', 'Invalid amount', 'Invalid date', 'You can still download all data. A missing attachment does not mean the expense cannot be reimbursed.'],
  de: ['Bericht prüfen', 'Einträge', 'Belege', 'Bitte prüfen', 'Kein Beleg', 'ID fehlt', 'Doppelte ID', 'Ungültiger Betrag', 'Ungültiges Datum', 'Sie können weiterhin alle Daten herunterladen. Ein fehlender Beleg bedeutet nicht, dass die Ausgabe nicht erstattungsfähig ist.'],
  fr: ['Vérification du rapport', 'lignes', 'pièces jointes', 'À vérifier', 'Pièce jointe absente', 'Identifiant absent', 'Identifiant répété', 'Montant invalide', 'Date invalide', 'Vous pouvez télécharger toutes les données. Une pièce jointe absente ne signifie pas que la dépense ne peut pas être remboursée.'],
  es: ['Revisión del informe', 'entradas', 'adjuntos', 'Por revisar', 'Sin adjunto', 'Falta identificador', 'Identificador repetido', 'Importe no válido', 'Fecha no válida', 'Puedes descargar todos los datos. La ausencia de un adjunto no significa que el gasto no sea reembolsable.'],
  nl: ['Rapportcontrole', 'regels', 'bijlagen', 'Te controleren', 'Geen bijlage', 'ID ontbreekt', 'Herhaalde ID', 'Ongeldig bedrag', 'Ongeldige datum', 'Je kunt alle gegevens downloaden. Een ontbrekende bijlage betekent niet dat de uitgave niet vergoed kan worden.'],
  pt: ['Verificação do relatório', 'registos', 'anexos', 'A verificar', 'Sem anexo', 'Identificador em falta', 'Identificador repetido', 'Valor inválido', 'Data inválida', 'Pode descarregar todos os dados. Um anexo em falta não significa que a despesa não possa ser reembolsada.'],
};
export const tripChecksCopy = (lang, key) => (copy[lang] || copy.en)[key];
export const tripIssueLabel = (lang, code) => code === 'invalid_attachment' ? tripAttachmentCopy(lang, 0) : code === 'revision_conflict' ? tripEditCopy(lang, 3) : tripChecksCopy(lang, ({ missing_attachment: 4, missing_id: 5, duplicate_id: 6, invalid_amount: 7, invalid_date: 8 })[code]);
