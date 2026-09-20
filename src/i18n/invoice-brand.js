const words = {
  it: ['Logo della fattura','Scegli immagine','Cambia immagine','Facoltativo · PNG o JPG · massimo 400 KB','Nessuna immagine scelta','Immagine pronta','Scegli un file PNG o JPG fino a 400 KB.','Non riesco a leggere questa immagine. Riprova.'],
  en: ['Invoice logo','Choose image','Change image','Optional · PNG or JPG · up to 400 KB','No image selected','Image ready','Choose a PNG or JPG up to 400 KB.','Unable to read this image. Try again.'],
  de: ['Rechnungslogo','Bild auswählen','Bild ändern','Optional · PNG oder JPG · bis 400 KB','Kein Bild ausgewählt','Bild bereit','Wähle eine PNG- oder JPG-Datei bis 400 KB.','Bild kann nicht gelesen werden. Versuche es erneut.'],
  fr: ['Logo de la facture','Choisir une image','Changer d’image','Facultatif · PNG ou JPG · 400 Ko maximum','Aucune image choisie','Image prête','Choisissez un PNG ou JPG de 400 Ko maximum.','Impossible de lire cette image. Réessayez.'],
  es: ['Logo de la factura','Elegir imagen','Cambiar imagen','Opcional · PNG o JPG · máximo 400 KB','Ninguna imagen elegida','Imagen lista','Elige un PNG o JPG de hasta 400 KB.','No se puede leer esta imagen. Inténtalo de nuevo.'],
  nl: ['Factuurlogo','Afbeelding kiezen','Afbeelding wijzigen','Optioneel · PNG of JPG · maximaal 400 KB','Geen afbeelding gekozen','Afbeelding gereed','Kies een PNG of JPG van maximaal 400 KB.','Afbeelding kan niet worden gelezen. Probeer opnieuw.'],
  pt: ['Logótipo da fatura','Escolher imagem','Alterar imagem','Opcional · PNG ou JPG · até 400 KB','Nenhuma imagem escolhida','Imagem pronta','Escolha um PNG ou JPG até 400 KB.','Não foi possível ler a imagem. Tente novamente.'],
};
export const invoiceBrandCopy = lang => Object.fromEntries(['title','choose','change','hint','empty','ready','invalid','error'].map((key,i) => [key,(words[lang] || words.en)[i]]));
