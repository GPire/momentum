const copy = {
  it: ['Allegato non supportato o incompleto. Scegli un PDF o un’immagine JPEG, PNG, WebP o GIF.', 'Rimuovi dalla spesa', 'Non riesco a leggere il file. Riprova: l’allegato precedente è rimasto invariato.'],
  en: ['Unsupported or incomplete attachment. Choose a PDF or a JPEG, PNG, WebP or GIF image.', 'Remove from expense', 'Could not read the file. Try again: the previous attachment is unchanged.'],
  de: ['Nicht unterstützter oder unvollständiger Beleg. Wählen Sie PDF, JPEG, PNG, WebP oder GIF.', 'Aus der Ausgabe entfernen', 'Die Datei konnte nicht gelesen werden. Versuchen Sie es erneut. Der bisherige Beleg bleibt erhalten.'],
  fr: ['Pièce jointe non prise en charge ou incomplète. Choisissez un PDF ou une image JPEG, PNG, WebP ou GIF.', 'Retirer de la dépense', 'Impossible de lire le fichier. Réessayez : la pièce jointe précédente est conservée.'],
  es: ['Adjunto no compatible o incompleto. Elige un PDF o una imagen JPEG, PNG, WebP o GIF.', 'Quitar del gasto', 'No se pudo leer el archivo. Inténtalo de nuevo: el adjunto anterior no ha cambiado.'],
  nl: ['Niet-ondersteunde of onvolledige bijlage. Kies een PDF of een JPEG-, PNG-, WebP- of GIF-afbeelding.', 'Verwijder uit uitgave', 'Het bestand kon niet worden gelezen. Probeer opnieuw: de vorige bijlage is ongewijzigd.'],
  pt: ['Anexo não suportado ou incompleto. Escolha um PDF ou uma imagem JPEG, PNG, WebP ou GIF.', 'Retirar da despesa', 'Não foi possível ler o ficheiro. Tente novamente: o anexo anterior mantém-se.'],
};
export const tripAttachmentCopy = (lang, key) => (copy[lang] || copy.en)[key];
