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
import { extractTransactionsFromItems, parseCellAmount, parseCellDate, COLUMN_KEYWORDS } from './pdf-parser.js';
import { parseScreenshotTransactions } from './screenshot-parser.js';
import { safeCategorize } from './categorize.js';
import { parseCamt053, isCamt053 } from './camt053.js';
import { rilevaAcquistoTitolo } from './security-purchase-detector.js';

// Categorizza (MCC/asset dal parser, altrimenti ML) e aggiunge in BULK una lista
// di transazioni normalizzate. `seenIds` = dedup esatta condivisa tra i file.
function addParsed(txs, seenIds, learned) {
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
    if (!duplicate) { added++; if (learned) learned.push({ description: t.description, category: cat.id, amount: t.amount, date: t.date }); }
  }
  return added;
}

// APPRENDIMENTO in BACKGROUND: i modelli imparano dalle categorizzazioni degli
// import, ma a CHUNK durante l'idle del browser → non blocca la UI anche con
// migliaia di transazioni. Ogni coppia (descrizione→categoria) rinforza
// l'orchestratore (DCGN online + reliability per-categoria).
// AUTO-ADATTAMENTO ai nuovi modelli senza perdere dati: se la firma dei modelli
// AI è cambiata (nuova versione dell'app / nuovi modelli/tecnologie), i modelli
// ONLINE (DCGN, affidabilità per-categoria) si RI-ADDESTRANO dai dati PRESERVATI
// dell'utente → convergenza. I dati (transazioni) sono la fonte di verità e
// sopravvivono via le migrazioni schema; i modelli ci si riallineano da soli.
// "Gli utenti non possono perdere dati tra una versione e 50 dopo."
export function reconcileModelsWithHistory(currentSignature) {
  if (typeof window === 'undefined' || !VaultDAO.state) return { reconciled: false };
  const ml = VaultDAO.state.mlData = VaultDAO.state.mlData || {};
  if (ml.modelSignature === currentSignature) return { reconciled: false };
  const pairs = [];
  for (const m of Object.values(VaultDAO.state.transactions || {}))
    for (const tx of m) if (tx.description && tx.category) pairs.push({ description: tx.description, category: tx.category, amount: tx.amount, date: new Date(tx.date) });
  learnInBackground(pairs);                 // ri-apprende in background (non blocca)
  ml.modelSignature = currentSignature;
  try { VaultDAO.save(); } catch (_) {}
  return { reconciled: true, count: pairs.length };
}

export function learnInBackground(pairs, chunk = 40) {
  if (typeof window === 'undefined' || !window.momentumOrchestrator || !pairs || !pairs.length) return;
  const orch = window.momentumOrchestrator;
  let i = 0;
  const idle = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 30));
  const step = () => {
    let n = 0;
    while (i < pairs.length && n < chunk) {
      const p = pairs[i++];
      try { orch.learn(p.description, p.category, p.amount, p.date); } catch (_) {}
      n++;
    }
    if (i < pairs.length) idle(step);
  };
  idle(step);
}

// CSV di PORTAFOGLIO (posizioni: ticker+quantità) vs CSV di MOVIMENTI: si
// riconosce dall'header, così l'utente seleziona qualsiasi file e ogni cosa
// finisce nel posto giusto da sola (zero attrito). Le posizioni NON sono
// transazioni: vanno in VaultDAO.state.positions (merge per ticker) e
// alimentano Patrimonio Netto + analisi portafoglio.
export function isPortfolioCsv(firstLine) {
  const h = String(firstLine || '').toLowerCase();
  const hasTicker = /(ticker|simbolo|symbol)/.test(h);
  const hasQty = /(quant|quantity|shares|azioni)/.test(h);
  const hasTxSignals = /(descri|importo|amount|debit|credit|uscit|entrat)/.test(h);
  return hasTicker && hasQty && !hasTxSignals;
}

function mergePositions(parsed) {
  if (!parsed.length) return 0;
  const positions = VaultDAO.state.positions = VaultDAO.state.positions || [];
  let merged = 0;
  for (const p of parsed) {
    const i = positions.findIndex(x => x.ticker === p.ticker);
    if (i >= 0) positions[i] = p; else positions.push(p);
    merged++;
  }
  return merged;
}

// `file.text()` decodifica SEMPRE come UTF-8 — nessun modo di dirgli altro.
// Molti export bancari italiani/europei più vecchi sono Windows-1252: gli
// accenti (à, è, é) diventano byte che UTF-8 non sa interpretare, e il
// risultato erano lettere rotte in silenzio, mai un errore.
// Il test è affidabile: un file VERAMENTE UTF-8 non contiene MAI una
// sequenza di byte non valida per quella codifica, quindi la decodifica
// `fatal:true` fallisce in modo affidabile proprio (e solo) quando serve.
// Windows-1252 non può mai fallire (mappa tutti i 256 byte), quindi non è
// un test valido di per sé: va usato come fallback, non come primo tentativo.
export async function readCsvText(file) {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

async function parseCsvFile(file) {
  const text = await readCsvText(file);
  const first = text.split(/\r?\n/)[0] || '';
  if (isPortfolioCsv(first)) {
    const { parsePortfolioCsv } = await import('../alpha/portfolio-import.js');
    return { positions: parsePortfolioCsv(text) };
  }
  return isRevolutExport(first) ? parseRevolutExport(text) : parseGenericCsv(text);
}

// OCR di una pagina PDF SENZA testo estraibile (estratto conto scansionato,
// non generato digitalmente). Prima d'ora questa capacità esisteva — scritta,
// testata — ma in una funzione orfana (handlePDFUpload) mai collegata alla
// pipeline vera: una pagina scansionata importava ZERO righe IN SILENZIO,
// "0 transazioni trovate" su un file che a occhio si leggeva benissimo.
// Colonne per POSIZIONE (gap di ≥2 spazi), non per parola chiave nel testo
// intero: cercare "accredito" in OGNI riga scambierebbe una normalissima
// "Accredito Stipendio Azienda SRL" per un'intestazione di colonna.
async function ocrPdfPage(page) {
  if (typeof Tesseract === 'undefined') return [];
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  const { data: { text } } = await Tesseract.recognize(canvas, 'ita+eng');

  const lines = text.split('\n').filter(l => l.trim().length > 3);
  const headerLine = lines.find(l => COLUMN_KEYWORDS.expense.test(l) || COLUMN_KEYWORDS.income.test(l));
  let expenseColIdx = -1, incomeColIdx = -1, dateColIdx = 0;
  if (headerLine) {
    const tokens = headerLine.split(/\s{2,}/);
    expenseColIdx = tokens.findIndex(t => COLUMN_KEYWORDS.expense.test(t));
    incomeColIdx = tokens.findIndex(t => COLUMN_KEYWORDS.income.test(t));
    dateColIdx = tokens.findIndex(t => COLUMN_KEYWORDS.date.test(t));
    if (dateColIdx === -1) dateColIdx = 0;
  }

  const out = [];
  let lastDate = null;
  for (const line of lines) {
    if (line === headerLine) continue;
    const parts = line.split(/\s{2,}/);
    const datePart = parts[dateColIdx] ? parts[dateColIdx].trim() : '';
    // Molte righe di uno statement portano la data solo sulla prima riga di
    // un gruppo: quelle sotto ereditano l'ultima data vista, non oggi.
    let date = parseCellDate(datePart);
    if (!date) date = lastDate; else lastDate = date;
    if (!date) continue;
    const desc = parts.filter((p, idx) => idx !== dateColIdx && idx !== expenseColIdx && idx !== incomeColIdx).join(' ').trim() || 'Transazione OCR';
    const expAmt = expenseColIdx >= 0 && parts[expenseColIdx] ? parseCellAmount(parts[expenseColIdx]) : null;
    const incAmt = incomeColIdx >= 0 && parts[incomeColIdx] ? parseCellAmount(parts[incomeColIdx]) : null;
    if (expAmt !== null && expAmt !== 0) out.push({ date, amount: Math.abs(expAmt), type: 'uscita', description: desc });
    if (incAmt !== null && incAmt !== 0) out.push({ date, amount: Math.abs(incAmt), type: 'entrata', description: desc });
  }
  return out;
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
    let txs = extractTransactionsFromItems(items);
    // Nessuna transazione dal testo → probabile pagina scansionata (immagine
    // senza livello di testo). Un pdf.js che restituisce testo vuoto è
    // esattamente il segnale che serve l'OCR, non un errore da propagare.
    if (txs.length === 0) txs = await ocrPdfPage(page);
    out.push(...txs);
  }
  return out;
}

async function parseImageFile(file) {
  if (typeof Tesseract === 'undefined') throw new Error('OCR (Tesseract) non caricato');
  const { data } = await Tesseract.recognize(file, 'ita+eng');
  return parseScreenshotTransactions(data.text);
}

// Tipo di file da estensione + MIME (robusto: alcune app non settano il MIME).
// Il .xml è AMBIGUO di per sé (anche una FatturaPA è .xml): non basta
// l'estensione, va sniffato il contenuto — per questo 'xml' resta un tipo a
// parte, deciso più avanti in parseCamtFile invece che qui.
function fileKind(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'csv' || file.type === 'text/csv') return 'csv';
  if (ext === 'pdf' || file.type === 'application/pdf') return 'pdf';
  if (ext === 'xml' || file.type === 'text/xml' || file.type === 'application/xml') return 'xml';
  if ((file.type || '').startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'heic', 'gif', 'bmp'].includes(ext)) return 'image';
  return 'unknown';
}

// Un .xml è supportato SOLO se è un CAMT.053 riconosciuto dal contenuto (mai
// dall'estensione, che un'altra fonte — es. una FatturaPA — condivide). Un
// .xml di tipo diverso resta esplicitamente "non supportato": mai un dato
// inventato da un tracciato che questo parser non conosce.
async function parseCamtFile(file) {
  const text = await readCsvText(file); // nome storico, ma è un lettore di testo robusto generico (UTF-8 con ricaduta Windows-1252)
  if (!isCamt053(text)) throw new Error('XML non riconosciuto: non è un estratto conto CAMT.053 (ISO 20022)');
  return parseCamt053(text);
}

// PUNTO D'INGRESSO: importa N file di formato misto. onProgress({i,n,name,kind}).
// Ritorna { files, added, byType:{csv,pdf,image,xml}, perFile:[{name,kind,added}], errors:[] }.
export async function importFiles(fileList, { onProgress } = {}) {
  const files = Array.from(fileList || []);
  const seenIds = new Set();
  for (const m of Object.values(VaultDAO.state.transactions || {})) for (const tx of m) if (tx.externalId) seenIds.add(tx.externalId);

  const learned = [];
  const result = { files: files.length, added: 0, byType: { csv: 0, pdf: 0, image: 0, xml: 0 }, perFile: [], errors: [], learned, acquistiDaConfermare: [] };
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const kind = fileKind(f);
    onProgress?.({ i: i + 1, n: files.length, name: f.name, kind });
    if (kind === 'unknown') { result.errors.push(`${f.name}: formato non supportato`); continue; }
    try {
      const txs = kind === 'csv' ? await parseCsvFile(f) : kind === 'pdf' ? await parsePdfFile(f) : kind === 'xml' ? await parseCamtFile(f) : await parseImageFile(f);
      // CSV di portafoglio: posizioni, non transazioni → merge dedicato.
      if (txs && txs.positions) {
        const merged = mergePositions(txs.positions);
        result.byType[kind] += 1;
        result.perFile.push({ name: f.name, kind: 'portfolio', parsed: txs.positions.length, added: merged });
        continue;
      }
      const added = addParsed(txs, seenIds, learned);
      result.added += added;
      result.byType[kind] += 1;
      result.perFile.push({ name: f.name, kind, parsed: txs.length, added });
      // Transazioni che sembrano un acquisto di titoli/cripto ma con
      // ticker/quantità non chiari dal testo: raccolte per file, mai
      // aggiunte automaticamente al portafoglio — tocca all'interfaccia
      // chiederle all'utente dopo l'import (vedi security-purchase-detector.js).
      for (const t of txs) {
        const rilevato = await rilevaAcquistoTitolo({ description: t.description, amount: t.amount });
        if (rilevato.rilevato && !rilevato.certo) {
          result.acquistiDaConfermare.push({ description: t.description, amount: t.amount, date: t.date, ...rilevato });
        }
      }
    } catch (e) {
      result.errors.push(`${f.name}: ${e.message || e}`);
    }
  }
  // UN solo salvataggio + UNA sola render alla fine di TUTTI i file.
  VaultDAO.save();
  if (typeof window !== 'undefined') (window.renderAfterImport ? window.renderAfterImport() : (window.renderDashboard?.(), window.renderAnalysis?.()));
  // I modelli imparano dagli import, ma in background (non blocca la UI).
  learnInBackground(learned);
  return result;
}
