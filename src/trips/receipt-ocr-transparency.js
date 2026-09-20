// Onestà sul risultato della lettura di uno scontrino/giustificativo di
// trasferta: MAI un campo riempito o mancante in silenzio. Ricerca
// competitor 2026-09-19 (Concur/Expensify/Zoho): il difetto più lamentato
// dagli utenti reali non è che l'OCR sbagli — è che sbagli SENZA DIRLO
// (Expensify: la spesa resta bloccata a zero senza nessun errore visibile
// quando manca data/totale leggibili). Funzione pura, nessuna dipendenza da
// Tesseract/pdf.js/DOM: riceve il risultato già estratto altrove.
//
// 'pdf' ha sempre confidenza 'alta' sui campi trovati: è testo VERO estratto
// dal livello testuale del documento (pdf.js), non un'ipotesi OCR su pixel —
// a differenza di un'immagine, dove anche un importo "vicino a una parola
// chiave" resta un'inferenza (vedi screenshot-parser.js:parseScreenshotText).
import { giornoLocale } from '../core/date-utils.js';

export function buildReceiptOcrReport(result, opts = {}) {
  const { tripCurrency = 'EUR', source = 'image', currentDate = null } = opts;
  const found = [];
  const missing = [];

  if (result?.amount != null && result.amount > 0) {
    found.push({ field: 'amount', value: result.amount, confidence: source === 'pdf' ? 'alta' : (result.confidence || 'bassa') });
  } else {
    missing.push('amount');
  }

  const merchant = result?.description ? String(result.description).trim() : '';
  if (merchant) {
    found.push({ field: 'merchant', value: merchant, confidence: source === 'pdf' ? 'alta' : 'media' });
  } else {
    missing.push('merchant');
  }

  let dateValue = null;
  if (result?.date instanceof Date && !isNaN(result.date.getTime())) dateValue = giornoLocale(result.date);
  if (dateValue) {
    // Formato gg/mm vs mm/gg genuinamente ambiguo (vedi screenshot-parser.js:
    // interpretaDataGiornoMese) — mai una confidenza "media" spacciata per
    // certa quanto le altre quando in realtà è un colpo di moneta fra due
    // date valide. L'alternativa (giorno/mese scambiati) si mostra sempre,
    // mai solo la scelta fatta in silenzio.
    found.push({ field: 'date', value: dateValue, confidence: result?.dateAmbiguous ? 'bassa' : (source === 'pdf' ? 'alta' : 'media') });
  } else {
    missing.push('date');
  }

  const warnings = [];
  if (result?.currency) {
    found.push({ field: 'currency', value: result.currency, confidence: source === 'pdf' ? 'alta' : 'media' });
    if (tripCurrency && result.currency !== tripCurrency) {
      warnings.push({ type: 'currency-mismatch', receiptCurrency: result.currency, tripCurrency });
    }
  } else {
    missing.push('currency');
  }

  if (dateValue && currentDate && dateValue !== currentDate) {
    warnings.push({ type: 'date-differs', ocrDate: dateValue, currentDate });
  }

  if (dateValue && result?.dateAmbiguous) {
    const [y, m, d] = dateValue.split('-');
    warnings.push({ type: 'date-ambiguous', chosenDate: dateValue, alternateDate: `${y}-${d}-${m}` });
  }

  return {
    source,
    ok: found.some(f => f.field === 'amount'),
    found,
    missing,
    warnings,
    // Testo grezzo per verifica manuale — SOLO per un'immagine (OCR reale,
    // può sbagliare pixel per pixel): un PDF con testo vero non ha bisogno
    // di essere "riverificato", il testo estratto È il documento.
    rawText: source === 'image' && result?.rawText ? String(result.rawText).slice(0, 2000) : null,
  };
}
