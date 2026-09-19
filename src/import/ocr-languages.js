// Lingua di lettura per Tesseract.js — prima di questo modulo era SEMPRE
// fissa a 'ita+eng' in ogni punto del codice che chiama OCR (screenshot
// personale, pagina PDF scansionata, scontrino di trasferta), anche per un
// prodotto che si dichiara globale (Germania/USA/UK già coperte da diaria e
// rimborso km — vedi trip-perdiem-rates.js/trip-mileage-rates.js). Un utente
// che fotografa uno scontrino tedesco/francese/spagnolo/olandese/portoghese
// riceveva un OCR addestrato solo su italiano+inglese: caratteri accentati
// (ü, ñ, ç) e vocabolario locale letti peggio, in silenzio.
//
// Limite dichiarato, non risolto qui: resta un'euristica (Paese della
// trasferta se noto, altrimenti lingua dell'interfaccia), non rilevamento
// automatico della lingua reale dello scontrino — Tesseract.js non supporta
// il rilevamento automatico prima del riconoscimento. 'eng' resta SEMPRE
// incluso: molte fatture/conferme hotel multinazionali sono in inglese
// indipendentemente dal Paese. Al massimo due lingue caricate (mai un pacco
// di traineddata multiplo): ogni lingua in più è un download reale (alcuni
// MB) prima che l'OCR possa partire.
const TESS_LANG_BY_UI = { it: 'ita', en: 'eng', de: 'deu', fr: 'fra', es: 'spa', nl: 'nld', pt: 'por' };

// Codici Paese già in uso altrove nel modulo trasferte (trip.country):
// 'DE'/'US'/'UK'/'ALTRO'/null (Italia, default). Nessun dato certo dalla
// destinazione per 'ALTRO'/null: si ricade sulla lingua dell'interfaccia.
const TESS_LANG_BY_TRIP_COUNTRY = { DE: 'deu', US: 'eng', UK: 'eng' };

export function ocrLanguagesFor({ tripCountry, uiLang } = {}) {
  const primary = TESS_LANG_BY_TRIP_COUNTRY[tripCountry] || TESS_LANG_BY_UI[uiLang] || 'ita';
  return primary === 'eng' ? 'eng' : `${primary}+eng`;
}
