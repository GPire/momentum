const copy = {
  it: ['Apri un resoconto ricevuto', 'File JSON di Momentum, fino a 50 MB. Non aggiunge spese ai tuoi conti.', 'Il file non è un resoconto valido o supera 50 MB.'],
  en: ['Open a received report', 'Momentum JSON file, up to 50 MB. Does not add expenses to your accounts.', 'The file is not a valid report or exceeds 50 MB.'],
  de: ['Erhaltenen Bericht öffnen', 'Momentum-JSON-Datei, bis 50 MB. Fügt Ihren Konten keine Ausgaben hinzu.', 'Die Datei ist kein gültiger Bericht oder überschreitet 50 MB.'],
  fr: ['Ouvrir un rapport reçu', 'Fichier JSON Momentum, jusqu’à 50 Mo. N’ajoute pas de dépenses à vos comptes.', 'Le fichier est invalide ou dépasse 50 Mo.'],
  es: ['Abrir un informe recibido', 'Archivo JSON de Momentum, hasta 50 MB. No añade gastos a tus cuentas.', 'El archivo no es un informe válido o supera 50 MB.'],
  nl: ['Ontvangen rapport openen', 'Momentum-JSON-bestand, maximaal 50 MB. Voegt geen uitgaven toe aan je rekeningen.', 'Het bestand is geen geldig rapport of is groter dan 50 MB.'],
  pt: ['Abrir um relatório recebido', 'Ficheiro JSON Momentum, até 50 MB. Não adiciona despesas às suas contas.', 'O ficheiro não é um relatório válido ou excede 50 MB.'],
};
export const reviewImportCopy = (lang, key) => (copy[lang] || copy.en)[key];
