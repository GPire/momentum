// ============================================================
// IMPORT MULTI-FILE UNIFICATO — N file, formati MISTI (CSV+PDF+screenshot)
// ============================================================
// Architettura: un solo dispatcher accetta una selezione di N file (anche 50,
// anche di formato diverso insieme), instrada CIASCUNO al parser giusto per
// tipo, e aggiunge TUTTE le transazioni in modalità bulk con UN solo save e UNA
// sola render finale (efficiente, niente O(n²), niente freeze). Dedup unica
// (externalId esatto + fuzzy) attraverso tutti i file. Progress per file.
// Onestà (regola #1): ogni file è parsato dal parser reale già verificato;
// errori per-file raccolti e riportati, mai un dato inventato.
'use strict';

import { VaultDAO, getCatById } from '../core/vault.js';
import { monthKey } from '../core/constants.js';
import { parseRevolutExport, isRevolutExport } from './revolut-csv.js';
import { parseGenericCsv } from './csv-parser.js';
import { extractTransactionsFromItems } from './pdf-parser.js';
import { parseScreenshotTransactions } from './screenshot-parser.js';
import { safeCategorize } from './categorize.js';

// Categorizza (MCC/asset dal parser, altrimenti ML) e aggiunge in BULK una lista
// di transazioni normalizzate. `seenIds` = dedup esatta condivisa tra i file.
function addParsed(txs, seenIds) {
  let added = 0;
  for (const t of txs) {
    if (!t.date || !t.amount) continue;
    const extId = t.externalId || '';
    if (extId && seenIds.has(extId)) continue;   // già importata (anche da un altro file)
    if (extId) seenIds.add(extId);
    // categoria del parser (crypto/etf da asset_class Revolut = fidata) ha
    // precedenza; altrimenti categorizzazione SICURA (dizionario + ML con
    // guardrail anti-crypto/etf spurie).
    const catId = t.category || safeCategorize(t.description, t.amount, t.date, t.type);
    const cat = getCatById(catId) || getCatById('spesa');
    const tx = { id: Date.now() + Math.random(), amount: t.amount, type: t.type, category: cat.id, description: t.description, color: cat.color, date: t.date.toISOString(), externalId: extId };
    const { duplicate } = VaultDAO.addTransaction(monthKey(t.date), tx, { bulk: true, noDedup: !!extId });
    if (!duplicate) added++;
  }
  return added;
}

async function parseCsvFile(file) {
  const text = await file.text();
  const first = text.split(/\r?\n/)[0] || '';
  return isRevolutExport(first) ? parseRevolutExport(text) : parseGenericCsv(text);
}

async function parsePdfFile(file) {
  if (typeof pdfjsLib === 'undefined') throw new Error('pdf.js non caricato');
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const out = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items.map(i => ({ text: i.str, x: i.transform[4], y: i.transform[5], width: i.width }));
    out.push(...extractTransactionsFromItems(items));
  }
  return out;
}

async function parseImageFile(file) {
  if (typeof Tesseract === 'undefined') throw new Error('OCR (Tesseract) non caricato');
  const { data } = await Tesseract.recognize(file, 'ita+eng');
  return parseScreenshotTransactions(data.text);
}

// Tipo di file da estensione + MIME (robusto: alcune app non settano il MIME).
function fileKind(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'csv' || file.type === 'text/csv') return 'csv';
  if (ext === 'pdf' || file.type === 'application/pdf') return 'pdf';
  if ((file.type || '').startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'heic', 'gif', 'bmp'].includes(ext)) return 'image';
  return 'unknown';
}

// PUNTO D'INGRESSO: importa N file di formato misto. onProgress({i,n,name,kind}).
// Ritorna { files, added, byType:{csv,pdf,image}, perFile:[{name,kind,added}], errors:[] }.
export async function importFiles(fileList, { onProgress } = {}) {
  const files = Array.from(fileList || []);
  const seenIds = new Set();
  for (const m of Object.values(VaultDAO.state.transactions || {})) for (const tx of m) if (tx.externalId) seenIds.add(tx.externalId);

  const result = { files: files.length, added: 0, byType: { csv: 0, pdf: 0, image: 0 }, perFile: [], errors: [] };
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const kind = fileKind(f);
    onProgress?.({ i: i + 1, n: files.length, name: f.name, kind });
    if (kind === 'unknown') { result.errors.push(`${f.name}: formato non supportato`); continue; }
    try {
      const txs = kind === 'csv' ? await parseCsvFile(f) : kind === 'pdf' ? await parsePdfFile(f) : await parseImageFile(f);
      const added = addParsed(txs, seenIds);
      result.added += added;
      result.byType[kind] += 1;
      result.perFile.push({ name: f.name, kind, parsed: txs.length, added });
    } catch (e) {
      result.errors.push(`${f.name}: ${e.message || e}`);
    }
  }
  // UN solo salvataggio + UNA sola render alla fine di TUTTI i file.
  VaultDAO.save();
  if (typeof window !== 'undefined') (window.renderAfterImport ? window.renderAfterImport() : (window.renderDashboard?.(), window.renderAnalysis?.()));
  return result;
}
