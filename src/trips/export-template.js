import { parseCsvRow } from '../import/revolut-csv.js';
import { defaultMapping, DEFAULT_REQUIRED_FIELDS } from './company-export-mapping.js';

const normalize = value => String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = {
  tripId: ['tripId', 'trip id', 'ID trasferta'],
  originalAmount: ['originalAmount', 'original amount', 'importo originale'],
  originalCurrency: ['originalCurrency', 'original currency', 'valuta originale'],
  exchangeRate: ['exchangeRate', 'exchange rate', 'tasso di cambio'],
  paymentMethod: ['paymentMethod', 'payment method', 'metodo di pagamento'],
  localId: ['localId', 'Momentum ID', 'ID Momentum'],
  date: ['date', 'data', 'expense date', 'transaction date', 'datum', 'fecha'],
  category: ['category', 'categoria', 'categorie', 'kategorie', 'expense category', 'categoria rimborso'],
  mealType: ['mealType', 'meal type', 'pasto', 'repas', 'mahlzeit', 'comida', 'maaltijd', 'refeição'],
  description: ['description', 'descrizione', 'beschrijving', 'beschreibung', 'descripción', 'descrição', 'merchant', 'esercente'],
  amount: ['amount', 'importo', 'montant', 'betrag', 'bedrag', 'importe', 'valor'],
  currency: ['currency', 'valuta', 'devise', 'währung', 'moneda', 'moeda', 'valutacode'],
  attachmentName: ['attachmentName', 'attachment name', 'nome allegato', 'receipt file', 'justificatif'],
  revisionFlag: ['revisionFlag', 'stato revisione', 'revision status'],
  provenance: ['provenance', 'provenienza', 'herkunft', 'origem', 'origen', 'herkomst'],
};
const lookup = new Map(Object.entries(aliases).flatMap(([field, names]) => names.map(name => [normalize(name), field])));

// Read only the supplied header. Never infer vendor requirements from its brand.
// Ambiguous and unknown columns require review rather than silent data loss.
export function suggestExportTemplate(header) {
  if (typeof header !== 'string' || header.length > 4096 || /[\r\n]/.test(header.trim())) return { mapping: null, issues: [{ code: 'header' }] };
  const line = header.replace(/^\uFEFF/, '').trim();
  const delimiters = [',', ';', '\t'];
  const delimiter = delimiters.reduce((best, next) => parseCsvRow(line, next).length > parseCsvRow(line, best).length ? next : best, ',');
  const columns = parseCsvRow(line, delimiter).map(value => value.trim());
  const mapping = defaultMapping(), issues = [], used = new Set(), names = new Set();
  if (columns.length < 2 || columns.length > 50) return { mapping: null, issues: [{ code: 'header' }] };
  for (const [order, column] of columns.entries()) {
    const name = normalize(column), field = lookup.get(name);
    if (!name || names.has(name)) { issues.push({ code: 'duplicate', column }); continue; }
    names.add(name);
    if (!field) { issues.push({ code: 'unknown', column }); continue; }
    if (used.has(field)) { issues.push({ code: 'ambiguous', column, field }); continue; }
    used.add(field);
    mapping[field].column = column;
    mapping[field].order = order;
  }
  for (const field of DEFAULT_REQUIRED_FIELDS) if (!used.has(field)) issues.push({ code: 'required', field });
  return { mapping, issues };
}
