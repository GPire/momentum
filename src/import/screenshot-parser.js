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
import { safeCategorize } from './categorize.js';

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

// Mesi MULTI-LINGUA (banche globali, non solo IT): chiave = prefisso a 3 lettere
// senza accenti. IT/EN/ES/FR/DE/PT. Le sovrapposizioni mappano allo stesso mese.
const MONTHS_MULTI = {};
[
  ['gen','jan','ene','jan','jan','jan'],                     // 0 gennaio
  ['feb','feb','feb','fev','feb','fev'],                     // 1
  ['mar','mar','mar','mar','mar','mar'],                     // 2
  ['apr','apr','abr','avr','apr','abr'],                     // 3
  ['mag','may','may','mai','mai','mai'],                     // 4
  ['giu','jun','jun','jui','jun','jun'],                     // 5 (giugno/june/junio/juin)
  ['lug','jul','jul','jul','jul','jul'],                     // 6
  ['ago','aug','ago','aou','aug','ago'],                     // 7
  ['set','sep','sep','sep','sep','set'],                     // 8
  ['ott','oct','oct','oct','okt','out'],                     // 9
  ['nov','nov','nov','nov','nov','nov'],                     // 10
  ['dic','dec','dic','dec','dez','dez'],                     // 11
].forEach((keys, mo) => keys.forEach(k => { MONTHS_MULTI[k] = mo; }));
// giugno/luglio in FR ("juin"/"juillet") condividono "jui": disambigua sotto.
const RELATIVE = /^(oggi|today|hoy|aujourd|heute|hoje)$/i;
const RELATIVE_YEST = /^(ieri|yesterday|ayer|hier|gestern|ontem)$/i;
const stripA = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Nomi di mese COMPLETI (IT/EN/ES/FR/DE/PT). Servono per NON scambiare una
// parola qualunque che inizia per un prefisso-mese (es. "Genova"→"gen") per un
// mese: un mese valido è o un nome completo, o un'abbreviazione ≤4 lettere.
const FULL_MONTHS = new Set(([
  'gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre',
  'january','february','march','april','may','june','july','august','september','october','november','december',
  'enero','febrero','abril','mayo','junio','julio','septiembre','octubre','noviembre','diciembre',
  'janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','decembre',
  'januar','februar','maerz','marz','juni','juli','oktober','dezember',
  'janeiro','fevereiro','marco','maio','junho','julho','setembro','outubro','dezembro',
]).map(s => s.normalize('NFD').replace(/[̀-ͯ]/g, '')));
function isMonthWord(w) {
  const s = stripA(w);
  return FULL_MONTHS.has(s) || (s.length <= 4 && MONTHS_MULTI[s.slice(0, 3)] !== undefined);
}
function monthOf(w) { return MONTHS_MULTI[stripA(w).slice(0, 3)]; }

// Data da un'intestazione/riga, multi-lingua e multi-formato:
// "13 Luglio", "13 Jul 2025", "July 13", "2025-07-13", "13/07/2025", "13/07",
// "Oggi/Today/Yesterday...". Senza anno: corrente (o -1 se nel futuro).
function parseListDate(text) {
  const t = text.trim();
  const now = new Date();
  if (RELATIVE.test(stripA(t))) return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (RELATIVE_YEST.test(stripA(t))) { const d = new Date(now); d.setDate(d.getDate() - 1); return d; }
  // ISO 2025-07-13
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  // gg/mm[/aaaa]
  m = t.match(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/);
  if (m && +m[1] <= 31 && +m[2] <= 12) { let y = m[3] ? +m[3] : now.getFullYear(); if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); }
  // "13 Luglio [2025]" (giorno-mese) oppure "July 13[, 2025]" (mese-giorno).
  // Il mese dev'essere una PAROLA-MESE valida (isMonthWord), non un prefisso
  // dentro un'altra parola ("Genova" non è "Gennaio").
  const dm = t.match(/(\d{1,2})\s+([a-zà-üçñ]{3,})\.?(?:\s+(\d{4}))?/i);
  const md = t.match(/([a-zà-üçñ]{3,})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/i);
  let day, mo, yr;
  if (dm && isMonthWord(dm[2])) { day = +dm[1]; mo = monthOf(dm[2]); yr = dm[3] ? +dm[3] : null; }
  else if (md && isMonthWord(md[1])) { mo = monthOf(md[1]); day = +md[2]; yr = md[3] ? +md[3] : null; }
  else return null;
  const year = yr ?? now.getFullYear();
  let d = new Date(year, mo, day);
  if (yr == null && d.getTime() - now.getTime() > 86400000) d.setFullYear(year - 1);
  return d;
}

// Una riga è SOLO un'intestazione-data? (niente valuta/importo, e parsabile)
function isDateHeader(line) {
  const t = line.trim();
  if (/[€$£¥]|\d+[.,]\d{2}/.test(t)) return false;
  if (t.length > 24) return false;
  return parseListDate(t) !== null;
}

// Pulisce il nome esercente dal rumore: codici località ("Ita16100ita",
// "Genova Ita16126ita"), circuiti di pagamento, diciture di stato.
function cleanMerchant(s) {
  return s
    .replace(/\b[Il1]ta\d{2,}\w*/gi, '')                             // codici "Ita16100ita"/"Ita999" (OCR: I→1/l)
    .replace(/(apple pay|google pay|pagamento nfc|pagamento cless con device|pagamento con device|contactless|da contabilizzare|nfc)/ig, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[-–—|:·*]+\s*$/,'')
    .trim();
}

// Parser MULTI-transazione con CONTESTO-DATA (architettura innovativa): scorre
// le righe dall'alto, ricorda l'ultima intestazione-data ("13 Luglio") e la
// assegna a ogni movimento sotto — così OGNI importo prende la SUA data reale,
// non quella di oggi. Corregge il bug "prende 1 su N": ora estrae tutti i
// movimenti della lista. Gestisce il formato OCR "-2 50€" (virgola persa).
// Puro e testabile.
// Importo ANCORATO alla valuta (€ $ £ ¥), simbolo prima o dopo, segno davanti o
// in coda ("12,00-"). Ancorare alla valuta evita che codici località ("Ita16100",
// "466") o numeri di carta vengano scambiati per importi. Gestisce anche il
// caso OCR "-2 50€" (virgola persa → spazio). Ritorna { start, neg, val } o null.
const isNeg = (...s) => s.some(x => x === '-' || x === '−');
const isPos = (...s) => s.some(x => x === '+');
function detectAmount(line) {
  // numero SEGUITO dalla valuta: "-5,00 €", "-2 50€", "12,00-" (segno in coda)
  let m = line.match(/([-−+])?\s*(\d{1,3}(?:[.\s]\d{3})*)[.,\s](\d{2})\s*([€$£¥])\s*([-−])?/);
  if (m) return { start: m.index, end: m.index + m[0].length, neg: isNeg(m[1], m[5]), pos: isPos(m[1]), val: parseFloat(m[2].replace(/[.\s]/g, '') + '.' + m[3]) };
  // valuta SEGUITA dal numero, con segno EVENTUALE prima della valuta: "-£4,50", "$5.00", "€ 5,00"
  m = line.match(/([-−+])?\s*([€$£¥])\s*([-−+])?\s*(\d{1,3}(?:[.\s]\d{3})*)[.,](\d{2})\s*([-−])?/);
  if (m) return { start: m.index, end: m.index + m[0].length, neg: isNeg(m[1], m[3], m[6]), pos: isPos(m[1], m[3]), val: parseFloat(m[4].replace(/[.\s]/g, '') + '.' + m[5]) };
  return null;
}

// Parole di ENTRATA (multi-lingua): un movimento senza segno esplicito in una
// lista è di norma una SPESA, ma questi indizi lo rendono un'entrata.
const SCREEN_INCOME = /(ricevut|accredit|bonifico.*ricev|rimbors|versament|stipendio|received|refund|salary|payout|cashback|incoming|deposit|top.?up|abono|ingreso|gutschrift)/i;

export function parseScreenshotTransactions(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const NOISE = /(carta di debito|mastercard|myone|cerca movimenti|^home$|prodotti|^pagamenti$|^altro$|saldo disponibile|^disponibile|available balance)/i;
  const txs = [];
  let currentDate = null;
  for (const line of lines) {
    if (isDateHeader(line)) { currentDate = parseListDate(line); continue; } // cambia contesto-data
    if (NOISE.test(line)) continue;
    const a = detectAmount(line);
    if (!a || !a.val || isNaN(a.val)) continue;
    // esercente: testo PRIMA dell'importo; se vuoto (valuta a inizio riga), DOPO.
    let desc = cleanMerchant(line.slice(0, a.start));
    if (desc.replace(/[^a-zà-ü]/ig, '').length < 2) desc = cleanMerchant(line.slice(a.end));
    if (desc.replace(/[^a-zà-ü]/ig, '').length < 2) continue; // niente esercente plausibile
    // Verso PREDITTIVO: segno '-' → uscita; '+' o parola d'entrata → entrata;
    // senza segno in una lista movimenti → spesa (il caso dominante).
    const type = a.neg ? 'uscita' : (a.pos || SCREEN_INCOME.test(desc)) ? 'entrata' : 'uscita';
    // data: PRIORITÀ al contesto-data della sezione (intestazione "13 Luglio");
    // l'inline solo se non c'è un header (liste con la data per-riga). Evita che
    // un numero dentro il nome esercente ("Lidl 466...") venga preso per data.
    const inline = parseListDate(line);
    txs.push({ amount: a.val, type, description: desc.slice(0, 60), date: currentDate || inline });
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
        const catId = safeCategorize(t.description, t.amount, date, t.type); // guardrail anti-crypto spurie
        const cat = getCatById(catId) || getCatById('spesa');
        const tx = { id: Date.now() + Math.random(), amount: t.amount, type: t.type, category: cat.id, description: t.description, color: cat.color, date: date.toISOString(), source: 'screenshot_ocr' };
        const { duplicate } = VaultDAO.addTransaction(monthKey(date), tx, { bulk: true });
        if (!duplicate) added++;
      }
      if (added > 0) { VaultDAO.save(); window.renderAfterImport ? window.renderAfterImport() : (window.renderDashboard?.(), window.renderAnalysis?.()); }
      showToast(added > 0 ? `${added} movimenti riconosciuti dallo screenshot.` : 'Movimenti già presenti (nessun nuovo).', added > 0 ? 'success' : 'info');
      return { count: added, transactions: multi.transactions };
    }

    // Fallback: singola transazione (scontrino/notifica).
    const parsed = await scanScreenshot(file);
    if (parsed.amount === null) {
      showToast('Nessun importo riconosciuto nello screenshot.', 'error');
      return null;
    }

    const catId = safeCategorize(parsed.description, parsed.amount, parsed.date, parsed.type); // guardrail

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
