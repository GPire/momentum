const copy = {
  it: ['Portala nel sistema aziendale', '1. Controlla le spese', '2. Scarica il file', '3. Importalo nel sistema aziendale', 'Il CSV contiene i dati, non gli scontrini. Le colonne vanno adattate al modello della tua azienda. Nessun invio automatico è attivo.', 'Adatta le colonne al tuo gestionale', 'Guide ufficiali', 'Zoho: importare resoconti', 'Concur: collegamento autorizzato', 'Expensify: collegamento autorizzato'],
  en: ['Take it to your company system', '1. Check expenses', '2. Download the file', '3. Import into your company system', 'The CSV contains data, not receipts. Columns must match your company template. No automatic delivery is active.', 'Adapt columns to your system', 'Official guides', 'Zoho: import reports', 'Concur: authorized connection', 'Expensify: authorized connection'],
  de: ['Ins Firmensystem übertragen', '1. Ausgaben prüfen', '2. Datei herunterladen', '3. Ins Firmensystem importieren', 'Die CSV enthält Daten, keine Belege. Spalten müssen zur Firmenvorlage passen. Kein automatischer Versand aktiv.', 'Spalten an Ihr System anpassen', 'Offizielle Anleitungen', 'Zoho: Berichte importieren', 'Concur: autorisierte Verbindung', 'Expensify: autorisierte Verbindung'],
  fr: ['Transférer vers le système de l’entreprise', '1. Vérifier les dépenses', '2. Télécharger le fichier', '3. Importer dans le système de l’entreprise', 'Le CSV contient les données, pas les justificatifs. Adaptez les colonnes au modèle de votre entreprise. Aucun envoi automatique actif.', 'Adapter les colonnes à votre système', 'Guides officiels', 'Zoho : importer des rapports', 'Concur : connexion autorisée', 'Expensify : connexion autorisée'],
  es: ['Llévalo al sistema de tu empresa', '1. Revisa los gastos', '2. Descarga el archivo', '3. Importa en el sistema de tu empresa', 'El CSV contiene datos, no recibos. Las columnas deben adaptarse a la plantilla de tu empresa. No hay envío automático activo.', 'Adapta las columnas a tu sistema', 'Guías oficiales', 'Zoho: importar informes', 'Concur: conexión autorizada', 'Expensify: conexión autorizada'],
  nl: ['Naar het bedrijfssysteem', '1. Controleer uitgaven', '2. Download het bestand', '3. Importeer in het bedrijfssysteem', 'De CSV bevat gegevens, geen bonnen. Pas de kolommen aan het bedrijfssjabloon aan. Automatische verzending is niet actief.', 'Kolommen aan je systeem aanpassen', 'Officiële handleidingen', 'Zoho: rapporten importeren', 'Concur: geautoriseerde verbinding', 'Expensify: geautoriseerde verbinding'],
  pt: ['Leve para o sistema da empresa', '1. Verifique as despesas', '2. Descarregue o ficheiro', '3. Importe no sistema da empresa', 'O CSV contém dados, não recibos. Adapte as colunas ao modelo da empresa. Nenhum envio automático está ativo.', 'Adaptar colunas ao seu sistema', 'Guias oficiais', 'Zoho: importar relatórios', 'Concur: ligação autorizada', 'Expensify: ligação autorizada'],
};
export const tripHandoffCopy = lang => copy[lang] || copy.en;

const sender = {
  it: ['Invia dalla tua email verificata nel gestionale. Aprire il messaggio non conferma la consegna.', 'Copia l’indirizzo di ricezione scontrini dalle impostazioni del tuo gestionale.'],
  en: ['Send from your verified email in the company system. Opening a message does not confirm delivery.', 'Copy the receipt inbox address from your company system settings.'],
  de: ['Von Ihrer im Firmensystem bestätigten E-Mail senden. Das Öffnen bestätigt keine Zustellung.', 'Belegadresse aus den Einstellungen Ihres Firmensystems kopieren.'],
  fr: ['Envoyez depuis votre adresse vérifiée dans le logiciel. Ouvrir le message ne confirme pas sa livraison.', 'Copiez l’adresse de réception des justificatifs depuis les paramètres du logiciel.'],
  es: ['Envía desde tu correo verificado en el sistema. Abrir el mensaje no confirma la entrega.', 'Copia la dirección de recepción de recibos de la configuración de tu sistema.'],
  nl: ['Verzend vanaf je geverifieerde e-mailadres in het systeem. Het openen bevestigt geen aflevering.', 'Kopieer het bonnenadres uit de instellingen van je bedrijfssysteem.'],
  pt: ['Envie pelo email verificado no sistema. Abrir a mensagem não confirma a entrega.', 'Copie o endereço de receção de recibos das definições do seu sistema.'],
};
export const tripSenderCopy = lang => sender[lang] || sender.en;

const template = {
 it: ['Hai un modello aziendale?', 'Incolla solo la prima riga del CSV: i nomi delle colonne, senza dati personali.', 'Data,Categoria,Importo,Valuta', 'Usa queste colonne', 'Colonne riconosciute. Controlla l’anteprima prima di esportare.', 'Non tutte le colonne sono riconoscibili in modo sicuro. Controlla i nomi e adatta le colonne qui sotto.'],
 en: ['Have a company template?', 'Paste only the first CSV row: column names without personal data.', 'Date,Category,Amount,Currency', 'Use these columns', 'Columns recognized. Check the preview before exporting.', 'Some columns cannot be recognized safely. Check their names and adjust the columns below.'],
 de: ['Eine Firmenvorlage vorhanden?', 'Nur die erste CSV-Zeile einfügen: Spaltennamen ohne persönliche Daten.', 'Datum,Kategorie,Betrag,Währung', 'Diese Spalten verwenden', 'Spalten erkannt. Vorschau vor dem Export prüfen.', 'Einige Spalten sind nicht eindeutig. Namen prüfen und Spalten unten anpassen.'],
 fr: ['Vous avez un modèle d’entreprise ?', 'Collez uniquement la première ligne du CSV : noms des colonnes sans données personnelles.', 'Date,Catégorie,Montant,Devise', 'Utiliser ces colonnes', 'Colonnes reconnues. Vérifiez l’aperçu avant l’export.', 'Certaines colonnes ne sont pas reconnues avec certitude. Vérifiez les noms et adaptez les colonnes ci-dessous.'],
 es: ['¿Tienes una plantilla de empresa?', 'Pega solo la primera fila del CSV: nombres de columnas sin datos personales.', 'Fecha,Categoría,Importe,Moneda', 'Usar estas columnas', 'Columnas reconocidas. Revisa la vista previa antes de exportar.', 'Algunas columnas no se reconocen con seguridad. Revisa los nombres y ajusta las columnas debajo.'],
 nl: ['Heb je een bedrijfssjabloon?', 'Plak alleen de eerste CSV-rij: kolomnamen zonder persoonsgegevens.', 'Datum,Categorie,Bedrag,Valuta', 'Deze kolommen gebruiken', 'Kolommen herkend. Controleer het voorbeeld voor export.', 'Niet alle kolommen zijn eenduidig. Controleer de namen en pas de kolommen hieronder aan.'],
 pt: ['Tem um modelo da empresa?', 'Cole apenas a primeira linha do CSV: nomes das colunas sem dados pessoais.', 'Data,Categoria,Valor,Moeda', 'Usar estas colunas', 'Colunas reconhecidas. Verifique a pré-visualização antes de exportar.', 'Algumas colunas não são reconhecidas com segurança. Verifique os nomes e ajuste as colunas abaixo.'],
};
export const tripTemplateCopy = lang => template[lang] || template.en;

const extraFields = {
 it: ['ID trasferta', 'Importo originale', 'Valuta originale', 'Tasso di cambio', 'Metodo di pagamento'],
 en: ['Trip ID', 'Original amount', 'Original currency', 'Exchange rate', 'Payment method'],
 de: ['Reise-ID', 'Originalbetrag', 'Originalwährung', 'Wechselkurs', 'Zahlungsart'],
 fr: ['ID du déplacement', 'Montant original', 'Devise originale', 'Taux de change', 'Moyen de paiement'],
 es: ['ID del viaje', 'Importe original', 'Moneda original', 'Tipo de cambio', 'Método de pago'],
 nl: ['Reis-ID', 'Oorspronkelijk bedrag', 'Oorspronkelijke valuta', 'Wisselkoers', 'Betaalmethode'],
 pt: ['ID da viagem', 'Valor original', 'Moeda original', 'Taxa de câmbio', 'Método de pagamento'],
};
export function tripExportExtraLabel(field, lang) {
 const index = ['tripId', 'originalAmount', 'originalCurrency', 'exchangeRate', 'paymentMethod'].indexOf(field);
 return index < 0 ? null : (extraFields[lang] || extraFields.en)[index];
}
