// ============================================================
// PUNTO 3 di docs/trip-market-and-interoperability-2026-09-13.md:
// "Primo collegamento verificabile: export con anteprima, errori per riga
// e mapping salvato. Nessuna perdita silenziosa di campi; nessun
// caricamento finanziario senza autorizzazione alla destinazione."
// ============================================================
// Generico per costruzione: nessuna soglia normativa di un singolo Paese
// qui dentro — il Paese/il gestionale li sceglie chi configura il mapping,
// non il codice (stesso principio già scelto per confrontaOfferte in
// debt-payoff.js). Ogni azienda pilota (SAP Concur, Expensify, Zoho
// Expense, Rydoo, o un foglio interno) ha nomi di colonna diversi per lo
// stesso concetto: questo modulo separa il CONTRATTO Momentum (fisso, gli
// stessi campi per chiunque) dalla MAPPATURA verso la destinazione
// (configurabile, salvabile, mai indovinata).
//
// Resta un export LOCALE: produce testo CSV da scaricare/condividere con
// gli strumenti già esistenti (trip-archive.js, expense-bridge.js). Nessuna
// credenziale, nessun upload automatico — quello è il connettore
// autorizzato (punto 4 dello stesso documento), un cantiere diverso.
'use strict';

import { nomeFileGiustificativo } from './expense-bridge.js';

// Contratto Momentum: un campo per ogni cosa che un sistema di nota spese
// aziendale chiede davvero (vedi tabella competitor nel documento). Stabile
// per chiunque usi questo modulo — cambia solo IN QUALE COLONNA finisce.
export const MOMENTUM_EXPORT_FIELDS = [
  'localId', 'date', 'category', 'mealType', 'description', 'amount',
  'currency', 'attachmentName', 'revisionFlag', 'provenance',
  'tripId', 'originalAmount', 'originalCurrency', 'exchangeRate', 'paymentMethod',
];

// Quali campi sono "di natura obbligatoria" per un giustificativo di spesa
// leggibile da chiunque — un default onesto, non un vincolo del gestionale:
// l'utente può comunque marcare un campo extra come richiesto, o togliere
// questo se la destinazione non lo pretende (validateMapping rispetta
// sempre ciò che l'utente ha scelto, mai questa lista da sola).
export const DEFAULT_REQUIRED_FIELDS = ['date', 'amount', 'category'];

export function defaultMapping() {
  const mapping = {};
  for (const field of MOMENTUM_EXPORT_FIELDS) {
    mapping[field] = { column: '', required: DEFAULT_REQUIRED_FIELDS.includes(field) };
  }
  return mapping;
}

// Generic Momentum format, not a certified vendor import template.
export function standardMapping() {
  return Object.fromEntries(MOMENTUM_EXPORT_FIELDS.map(field => [field, {
    column: field, required: DEFAULT_REQUIRED_FIELDS.includes(field),
  }]));
}

// Valida la MAPPATURA stessa (non ancora le righe): un campo richiesto
// senza nome colonna, o due campi mappati sulla stessa colonna (l'ultimo
// scriverebbe sopra il primo in silenzio) sono entrambi errori di
// configurazione, mai scoperti solo dopo aver scaricato il file.
export function validateMapping(mapping) {
  const errors = [];
  const colonnaDi = new Map();
  for (const field of MOMENTUM_EXPORT_FIELDS) {
    const m = mapping?.[field];
    if (!m) continue;
    const col = String(m.column || '').trim();
    if (m.required && !col) { errors.push({ field, code: 'missing_column' }); continue; }
    if (!col) continue;
    if (colonnaDi.has(col)) errors.push({ field, code: 'duplicate_column', column: col, other: colonnaDi.get(col) });
    else colonnaDi.set(col, field);
  }
  return errors;
}

// Trasforma UNA transazione di trasferta nel contratto Momentum piatto —
// stesso dominio di dati di exportTripData/inspectTripArchive
// (trip-engine.js/trip-archive.js), non un secondo modo di leggerli.
export function transactionToExportRecord(tx, trip) {
  const isPdf = String(tx?.receiptImage || '').startsWith('data:application/pdf');
  return {
    localId: tx?.id ?? null,
    date: (tx?.date || '').slice(0, 10) || null,
    category: tx?.tripCategory || null,
    mealType: tx?.mealType || null,
    description: tx?.description || '',
    amount: Number.isFinite(tx?.amount) ? tx.amount : null,
    currency: tx?.currency || trip?.receiptPolicy?.currency || 'EUR',
    attachmentName: tx?.receiptImage ? nomeFileGiustificativo(tx, isPdf) : null,
    revisionFlag: tx?.tripRevisionConflict ? 'conflict' : 'clean',
    provenance: 'momentum-app',
    tripId: trip?.id || null,
    originalAmount: Number.isFinite(tx?.originalAmount) ? tx.originalAmount : null,
    originalCurrency: tx?.originalCurrency || null,
    exchangeRate: Number.isFinite(tx?.exchangeRate) ? tx.exchangeRate : null,
    paymentMethod: tx?.paymentMethod || null,
  };
}

// Applica la mappatura a UN record: un campo RICHIESTO dalla destinazione
// ma vuoto in questa riga è un errore per riga — mai un vuoto scambiato per
// zero, mai una riga scartata in silenzio dall'anteprima.
export function applyMappingToRecord(record, mapping) {
  const row = {};
  const errors = [];
  for (const field of MOMENTUM_EXPORT_FIELDS) {
    const m = mapping?.[field];
    const col = m && String(m.column || '').trim();
    if (!col) continue; // campo non mappato: escluso di proposito, non un errore
    const value = record[field];
    const vuoto = value === null || value === undefined || value === '';
    if (m.required && vuoto) errors.push({ field, column: col, code: 'missing_value' });
    row[col] = vuoto ? '' : value;
  }
  return { row, errors };
}

// Anteprima completa: OGNI riga sorgente resta visibile (pronta o con
// errori) — l'export scaricabile filtra le sole righe pronte, ma
// l'anteprima non deve MAI far sparire una riga senza dirlo.
export function buildMappedExportPreview(records, mapping) {
  const mappingErrors = validateMapping(mapping);
  const rows = records.map((record, index) => {
    const { row, errors } = applyMappingToRecord(record, mapping);
    return { index, record, row, errors };
  });
  return {
    mappingErrors,
    rows,
    readyCount: rows.filter(r => !r.errors.length).length,
    errorCount: rows.filter(r => r.errors.length).length,
  };
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// CSV delle sole righe pronte (mai una riga con un campo obbligatorio
// mancante spacciata per completa) — le righe con errori restano
// nell'anteprima per la correzione, non nel file scaricato. Ritorna null
// se la mappatura stessa non è valida: mai un file parziale silenzioso.
export function mappedExportToCsv(preview, mapping) {
  if (preview.mappingErrors.length) return null;
  const orderedFields = MOMENTUM_EXPORT_FIELDS.map((field, index) => ({ field, order: Number.isSafeInteger(mapping?.[field]?.order) && mapping[field].order >= 0 ? mapping[field].order : MOMENTUM_EXPORT_FIELDS.length + index })).sort((a, b) => a.order - b.order).map(item => item.field);
  const colonne = orderedFields.map(f => mapping?.[f]?.column && String(mapping[f].column).trim()).filter(Boolean);
  if (!colonne.length) return null;
  const intestazione = colonne.map(csvEscape).join(',');
  const righe = preview.rows.filter(r => !r.errors.length).map(r => colonne.map(c => csvEscape(r.row[c])).join(','));
  return [intestazione, ...righe].join('\r\n') + '\r\n';
}
