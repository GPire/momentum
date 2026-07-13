// Import da screenshot (notifica bancaria, scontrino, ricevuta) via OCR.
// Alternativa reale alla lettura delle notifiche di altre app (impossibile
// da una PWA, vedi commento in main.js): l'utente fa uno screenshot quando
// arriva la notifica e lo trascina qui — stessa riduzione di attrito,
// nessun confine di sistema operativo violato.
//
// Porta nel progetto Vite l'euristica già verificata in una sessione
// precedente (vecchio momentum_document_parser.js: il totale è il numero
// vicino a "totale/importo/pagamento", non il più grande in assoluto —
// evita di confondere "contanti"/"resto" col totale reale) e riusa
// parseCellAmount dal parser PDF invece di duplicarne la logica.
import { parseCellAmount } from './pdf-parser.js';
import { monthKey } from '../core/constants.js';
import { getCatById, VaultDAO } from '../core/vault.js';
import { showToast } from '../ui/feedback.js';
import { NeuralNexus } from '../ai/neural-nexus.js';

// Cattura importi con o senza separatore delle migliaia (1.500,00 / 1500,00
// col separatore assente non è distinguibile in modo affidabile da OCR e
// resta un limite noto — il formato con separatore, il più comune sugli
// estratti/notifiche italiane, è gestito correttamente).
const AMOUNT_RE_SRC = '\\d{1,3}(?:[.,]\\d{3})*[.,]\\d{2}';
// \D{0,24}: sugli scontrini reali tra la keyword e l'importo ci sono spesso
// parole intere ("TOTALE COMPLESSIVO 45,80", "IMPORTO PAGATO EUR 12,00") —
// con il vecchio limite di 12 caratteri questi casi finivano nel fallback
// "importo più alto", sbagliando quando lo scontrino riporta i contanti.
const AMOUNT_NEAR_KEYWORD = new RegExp(`(totale|total|importo|pagamento|addebito|accredito)\\D{0,24}(${AMOUNT_RE_SRC})`, 'i');
const ANY_AMOUNT = new RegExp(AMOUNT_RE_SRC, 'g');
const DATE_PATTERN = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/;

// Righe di scontrino che NON sono il nome dell'esercente: dati fiscali,
// indirizzi, diciture di legge, contatti. Un nome di negozio non contiene
// mai questi pattern; la prima riga "pulita" in alto è quasi sempre lui.
const MERCHANT_NOISE = [
  /p\.?\s*iva|partita\s+iva|c\.?\s*f\.?[\s:]|codice\s+fiscale/i,
  /^(via|viale|piazza|corso|largo|vicolo|strada)\s/i,
  /\b\d{5}\b\s+[a-zà-ù]/i,                       // CAP + città
  /tel\.?[\s:]|fax[\s:]|www\.|@|http/i,
  /scontrino|documento\s+commerciale|ricevuta|fattura|fiscale|non\s+riscosso/i,
  /^\s*[\d.,\-/:\s€]+\s*$/,                       // righe di soli numeri/date/orari
  /reparto|cassa|operatore|cassiere/i,
];

// Esercente: prima riga sostanziosa (≥3 lettere) tra le prime 6 che non è
// rumore fiscale/indirizzo. null se non c'è niente di plausibile — il
// chiamante decide il fallback, qui mai un nome inventato.
export function extractMerchant(lines) {
  for (const line of lines.slice(0, 6)) {
    if (MERCHANT_NOISE.some(re => re.test(line))) continue;
    const letters = (line.match(/[a-zà-ùA-ZÀ-Ù]/g) || []).length;
    if (letters < 3) continue;
    // una riga con importo non è il nome (es. "TOTALE 45,80")
    if (new RegExp(AMOUNT_RE_SRC).test(line)) continue;
    return line.slice(0, 60);
  }
  return null;
}

// Direzione della transazione: parole specifiche di entrata vs uscita.
// Diverse da COLUMN_KEYWORDS in pdf-parser.js (quelle sono intestazioni di
// colonna in un estratto conto tabellare, qui serve capire il verso di UN
// singolo movimento raccontato in linguaggio naturale dalla notifica).
const INCOME_HINTS = /(accredito|accreditat|ricevut|stipendio|bonifico in entrata|incasso|rimborso)/i;
const EXPENSE_HINTS = /(addebito|addebitat|pagamento|pagat|acquisto|prelievo|acquistat)/i;

// Funzione pura: dato il testo grezzo restituito dall'OCR, estrae una
// transazione plausibile. Nessuna dipendenza da Tesseract/DOM — testabile
// direttamente in Node.
export function parseScreenshotText(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  let amount = null;
  const keywordMatch = rawText.match(AMOUNT_NEAR_KEYWORD);
  if (keywordMatch) amount = parseCellAmount(keywordMatch[2]);
  if (amount === null) {
    // fallback: importo più alto nel testo (stessa euristica del vecchio ReceiptScanner)
    const all = [...rawText.matchAll(ANY_AMOUNT)].map(m => parseCellAmount(m[0])).filter(v => v !== null);
    amount = all.length ? Math.max(...all) : null;
  }

  const dateMatch = rawText.match(DATE_PATTERN);
  let date = new Date();
  if (dateMatch) {
    let yr = parseInt(dateMatch[3]);
    if (yr < 100) yr += 2000;
    const parsed = new Date(yr, parseInt(dateMatch[2]) - 1, parseInt(dateMatch[1]));
    if (!isNaN(parsed.getTime())) date = parsed;
  }

  const type = INCOME_HINTS.test(rawText) && !EXPENSE_HINTS.test(rawText) ? 'entrata' : 'uscita';

  // descrizione: prima l'esercente vero (scontrini: nome del negozio in alto,
  // filtrando P.IVA/indirizzi/diciture fiscali), poi il vecchio fallback
  // (prima riga non-importo, adatto alle notifiche bancarie).
  const description = extractMerchant(lines)
    || lines.find(l => !ANY_AMOUNT.test(l) || l.replace(ANY_AMOUNT, '').trim().length > 3)
    || 'Da screenshot';

  return {
    amount, date, type, description: description.slice(0, 60),
    confidence: amount !== null ? (keywordMatch ? 'alta' : 'media') : 'bassa',
    rawText,
  };
}

// Mesi italiani abbreviati (le liste movimenti mobile scrivono "12 Lug").
const SCREEN_MONTHS = { gen:0, feb:1, mar:2, apr:3, mag:4, giu:5, lug:6, ago:7, set:8, ott:9, nov:10, dic:11 };
// Data SENZA anno ("12 Lug - 09:49"): assume l'anno corrente; se cadrebbe nel
// futuro, è dell'anno scorso.
function parseYearlessDate(text) {
  const m = text.match(/(\d{1,2})\s+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)/i);
  if (!m) return null;
  const mo = SCREEN_MONTHS[m[2].toLowerCase()];
  const now = new Date();
  let d = new Date(now.getFullYear(), mo, parseInt(m[1]));
  if (d.getTime() - now.getTime() > 86400000) d.setFullYear(now.getFullYear() - 1);
  return d;
}

// Parser MULTI-transazione per liste movimenti mobile (buddybank, Revolut app,
// ecc.): una riga per movimento "Esercente -X,YY €". Corregge il bug per cui il
// vecchio parser prendeva UN solo importo (il massimo) da tutta la schermata.
// Gestisce anche il formato OCR "-2 50€" (virgola persa → spazio) e le date
// senza anno. Puro e testabile.
export function parseScreenshotTransactions(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  // int (con eventuali separatori migliaia) + separatore decimale (,/./spazio) + 2 cifre + €
  const amountRe = /([-−+])?\s*(\d{1,3}(?:[.\s]\d{3})*)\s*[.,\s]\s*(\d{2})\s*€/;
  const NOISE = /(carta di debito|mastercard|myone|cerca movimenti|^home$|prodotti|pagamenti|^altro$|saldo|disponibile|totale)/i;
  const txs = [];
  for (const line of lines) {
    if (NOISE.test(line)) continue;
    const m = line.match(amountRe);
    if (!m) continue;
    const intPart = m[2].replace(/[.\s]/g, '');
    const val = parseFloat(intPart + '.' + m[3]);
    if (!val || isNaN(val)) continue;
    const type = (m[1] === '-' || m[1] === '−') ? 'uscita' : 'entrata';
    let desc = line.slice(0, m.index)
      .replace(/(da contabilizzare|pagamento cless con device|pagamento con device)/ig, '')
      .replace(/[-–—|:·]+$/,'').trim();
    if (desc.replace(/[^a-zà-ù]/ig, '').length < 2) continue; // niente esercente plausibile
    txs.push({ amount: val, type, description: desc.slice(0, 60), date: parseYearlessDate(line) });
  }
  return txs;
}

export async function scanScreenshot(imageFileOrBlob) {
  if (typeof Tesseract === 'undefined') {
    throw new Error('Tesseract.js non caricato in pagina.');
  }
  const { data } = await Tesseract.recognize(imageFileOrBlob, 'ita+eng');
  return parseScreenshotText(data.text);
}

// OCR → più transazioni (per le liste movimenti). Ritorna { transactions, rawText }.
export async function scanScreenshotMulti(imageFileOrBlob) {
  if (typeof Tesseract === 'undefined') throw new Error('Tesseract.js non caricato in pagina.');
  const { data } = await Tesseract.recognize(imageFileOrBlob, 'ita+eng');
  return { transactions: parseScreenshotTransactions(data.text), rawText: data.text };
}

// Flusso completo collegato alla UI: OCR -> categorizzazione via
// orchestratore -> inserimento (la deduplicazione fuzzy è già gestita
// centralmente da VaultDAO.addTransaction, non va ripetuta qui).
export async function handleScreenshotUpload(file) {
  try {
    showToast('Lettura screenshot in corso...', 'info');

    // Prima si prova la LISTA (più movimenti in una schermata): il caso reale
    // delle app bancarie. Se ne trova ≥1 li inserisce tutti; altrimenti ricade
    // sul parser a singola transazione (scontrino/notifica).
    const multi = await scanScreenshotMulti(file);
    if (multi.transactions.length >= 1) {
      let added = 0;
      for (const t of multi.transactions) {
        const date = t.date || new Date();
        const ml = window.momentumOrchestrator
          ? window.momentumOrchestrator.classify(t.description, t.amount, date)
          : NeuralNexus.predict(t.description, t.amount, date);
        const catId = ml && ml.confidence > 60 ? ml.cat : (t.type === 'entrata' ? 'stipendio' : 'spesa');
        const cat = getCatById(catId) || getCatById('spesa');
        const tx = { id: Date.now() + Math.random(), amount: t.amount, type: t.type, category: cat.id, description: t.description, color: cat.color, date: date.toISOString(), source: 'screenshot_ocr' };
        const { duplicate } = VaultDAO.addTransaction(monthKey(date), tx);
        if (!duplicate) { window.momentumOrchestrator?.learn(t.description, cat.id, t.amount, date); added++; }
      }
      if (added > 0) { window.renderDashboard?.(); window.renderAnalysis?.(); }
      showToast(added > 0 ? `${added} movimenti riconosciuti dallo screenshot.` : 'Movimenti già presenti (nessun nuovo).', added > 0 ? 'success' : 'info');
      return { count: added, transactions: multi.transactions };
    }

    // Fallback: singola transazione (scontrino/notifica).
    const parsed = await scanScreenshot(file);
    if (parsed.amount === null) {
      showToast('Nessun importo riconosciuto nello screenshot.', 'error');
      return null;
    }

    const mlResult = window.momentumOrchestrator
      ? window.momentumOrchestrator.classify(parsed.description, parsed.amount, parsed.date)
      : NeuralNexus.predict(parsed.description, parsed.amount, parsed.date);
    const catId = mlResult && mlResult.confidence > 60 ? mlResult.cat : (parsed.type === 'entrata' ? 'stipendio' : 'spesa');

    const tx = {
      id: Date.now() + Math.random(),
      amount: parsed.amount,
      type: parsed.type,
      category: catId,
      description: parsed.description,
      color: getCatById(catId).color,
      date: parsed.date.toISOString(),
      source: 'screenshot_ocr',
    };
    const k = monthKey(parsed.date);
    const { duplicate, route } = VaultDAO.addTransaction(k, tx);

    if (window.momentumOrchestrator) {
      window.momentumOrchestrator.learn(parsed.description, catId, parsed.amount, parsed.date);
    }

    showToast(
      duplicate
        ? `Screenshot riconosciuto come duplicato di una transazione già presente (unita automaticamente).`
        : `Transazione riconosciuta: ${parsed.description} ${parsed.amount}€ (confidenza OCR: ${parsed.confidence}).`,
      duplicate ? 'info' : 'success'
    );
    return { ...parsed, duplicate, route };
  } catch (err) {
    console.error('Errore import screenshot:', err);
    showToast('Errore nella lettura dello screenshot.', 'error');
    return null;
  }
}
