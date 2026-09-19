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

// Lingue in alfabeto NON latino selezionabili esplicitamente dall'utente —
// nessuna euristica (Paese trasferta/lingua interfaccia) può indovinarle:
// l'interfaccia di Momentum è oggi solo in lingue a scrittura latina (vedi
// UI_LANGS in ui-strings.js) e trip.country copre solo DE/US/UK. Chi
// fotografa uno scontrino in Giappone/Russia/Tailandia deve poterlo
// dichiarare, non subire un OCR addestrato sull'alfabeto sbagliato in
// silenzio (reclamo reale trovato in ricerca: Zoho Expense dichiara "38+
// lingue" ma fallisce proprio su hindi/thai).
//
// Limite dichiarato, non un elenco esaustivo di ogni alfabeto esistente:
// copre le scritture più probabili per un viaggio di lavoro globale
// (cirillico, greco, arabo, cinese semplificato, giapponese, coreano,
// hindi/devanagari, thai). Mancano es. ebraico/armeno/georgiano — Tesseract
// li supporterebbe comunque passando il codice giusto, semplicemente non
// sono ancora in questo elenco curato finché non emerge una richiesta reale.
export const NON_LATIN_OCR_LANGUAGES = [
  { code: 'rus', labelKey: 'ocrLangRussian' },
  { code: 'ell', labelKey: 'ocrLangGreek' },
  { code: 'ara', labelKey: 'ocrLangArabic' },
  { code: 'chi_sim', labelKey: 'ocrLangChinese' },
  { code: 'jpn', labelKey: 'ocrLangJapanese' },
  { code: 'kor', labelKey: 'ocrLangKorean' },
  { code: 'hin', labelKey: 'ocrLangHindi' },
  { code: 'tha', labelKey: 'ocrLangThai' },
];
const NON_LATIN_CODES = new Set(NON_LATIN_OCR_LANGUAGES.map(l => l.code));
export function isNonLatinOcrLanguage(code) { return NON_LATIN_CODES.has(code); }

function withEnglishFallback(primary) {
  return primary === 'eng' ? 'eng' : `${primary}+eng`;
}

// `override`: scelta esplicita dell'utente (vince SEMPRE su Paese/lingua
// interfaccia — è l'unico segnale certo, tutto il resto è un'euristica).
export function ocrLanguagesFor({ tripCountry, uiLang, override } = {}) {
  if (override) return withEnglishFallback(override);
  const primary = TESS_LANG_BY_TRIP_COUNTRY[tripCountry] || TESS_LANG_BY_UI[uiLang] || 'ita';
  return withEnglishFallback(primary);
}
