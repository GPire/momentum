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
import { parseCellAmount, detectCurrency } from './pdf-parser.js';
import { parseNotificationText } from './notification-parser.js';
import { monthKey } from '../core/constants.js';
import { getCatById, VaultDAO } from '../core/vault.js';
import { showToast } from '../ui/feedback.js';
import { NeuralNexus } from '../ai/neural-nexus.js';
import { safeCategorize } from './categorize.js';
import { ocrLanguagesFor } from './ocr-languages.js';
import { resolveUiLanguage, t as tShot } from '../i18n/ui-strings.js';

const lingua = () => (typeof document !== 'undefined' && document.documentElement?.lang) || resolveUiLanguage();

// Cattura importi con o senza separatore delle migliaia (1.500,00 / 1500,00
// col separatore assente non è distinguibile in modo affidabile da OCR e
// resta un limite noto — il formato con separatore, il più comune sugli
// estratti/notifiche italiane, è gestito correttamente).
const AMOUNT_RE_SRC = '\\d{1,3}(?:[.,]\\d{3})*[.,]\\d{2}';
// Parole "TOTALE" in ogni lingua/alfabeto selezionabile per l'OCR (vedi
// src/import/ocr-languages.js) — non solo IT/EN: uno scontrino giapponese/
// cinese/coreano/russo/greco/arabo/hindi/thai dice "totale" con una parola
// diversa, e senza queste l'euristica "il numero vicino alla parola totale"
// (l'unica che distingue il vero importo da un codice/quantità/telefono)
// non scatta MAI per quelle lingue — bug reale trovato testando dal vivo
// con uno scontrino giapponese sintetico (OCR corretto, importo comunque
// non riconosciuto, perché nessuna parola chiave combaciava).
const TOTAL_KEYWORDS = [
  'totale', 'total', 'importo', 'pagamento', 'addebito', 'accredito', // it/en
  'итого', 'сумма', 'к оплате',                                       // rus
  'συνολο', 'σύνολο', 'ποσο', 'ποσό',                                 // ell (entrambe le forme: le maiuscole di stampa "ΣΥΝΟΛΟ" non portano l'accento tonos per convenzione tipografica, il minuscolo corrente sì)
  'المجموع', 'الإجمالي',                                              // ara
  '合[计計]', '总计', '金额', '金額',                                   // chi_sim/jpn (合计/合計 coprono entrambe le varianti)
  '합계', '총액', '금액',                                              // kor
  'कुल', 'योग',                                                       // hin
  'รวม', 'ยอดรวม',                                                    // tha
];
// \D{0,24}: sugli scontrini reali tra la keyword e l'importo ci sono spesso
// parole intere ("TOTALE COMPLESSIVO 45,80", "IMPORTO PAGATO EUR 12,00") —
// con il vecchio limite di 12 caratteri questi casi finivano nel fallback
// "importo più alto", sbagliando quando lo scontrino riporta i contanti.
const AMOUNT_NEAR_KEYWORD = new RegExp(`(${TOTAL_KEYWORDS.join('|')})\\D{0,24}(${AMOUNT_RE_SRC})`, 'iu');
const ANY_AMOUNT = new RegExp(AMOUNT_RE_SRC, 'g');
// Valute reali senza sottounità decimale (yen, won, dong, tenge, ...): "4500
//円"/"4500원" non ha MAI due decimali, quindi AMOUNT_NEAR_KEYWORD non può
// mai scattare per un simile scontrino, in QUALUNQUE lingua sia scritto —
// non solo un problema giapponese/coreano, un problema di formato valuta.
// Stessa disciplina anti-falsi-positivi dell'importo decimale: scatta SOLO
// vicino a una parola "totale" nota (mai come numero più alto nel testo),
// quindi nessun limite minimo di cifre — un totale di "25" (yen/rubli/baht)
// è comune quanto uno a 4 cifre, e la parola chiave è già la protezione.
const WHOLE_AMOUNT_RE_SRC = '\\d{1,3}(?:[.,\\s]\\d{3})+|\\d+';
const AMOUNT_NEAR_KEYWORD_WHOLE = new RegExp(`(${TOTAL_KEYWORDS.join('|')})\\D{0,24}(${WHOLE_AMOUNT_RE_SRC})`, 'iu');
const parseWholeAmount = (s) => { const n = parseInt(String(s).replace(/[.,\s]/g, ''), 10); return Number.isFinite(n) ? n : null; };
const DATE_PATTERN = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/;
// Data giapponese/cinese "2026年7月12日" (anno-mese-giorno, ordine sempre
// inequivocabile a differenza di gg/mm vs mm/gg). Limite dichiarato: NON
// copre i numeri in cifre orientali (٠١٢٣.../๐๑๒๓... di arabo/thai) — resta
// mancante in quei casi, mai una data indovinata a caso.
// \s*: l'OCR di un testo CJK inserisce spesso uno spazio fra ogni singolo
// carattere/glifo ("2026 年 7 月 12 日", verificato dal vivo con Tesseract
// reale) — senza tollerare lo spazio la data veniva sempre dichiarata
// mancante anche quando l'OCR l'aveva letta correttamente cifra per cifra.
const DATE_PATTERN_YMD_CJK = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/;

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

// Prefisso di PROCESSORE di pagamento (mai il vero esercente): sugli
// estratti/ricevute digitali reali, chi incassa tramite un aggregatore
// mostra spesso "SQ *NOME LOCALE"/"TST* NOME LOCALE"/"PAYPAL *NOME NEGOZIO"
// invece del solo nome — il cliente non ha mai scelto Square/Toast/PayPal,
// li ha scelti il negozio. Pattern DOCUMENTATI dagli stessi processori (non
// indovinati): Square, Toast POS, PayPal, Clover, iZettle/Zettle, SumUp,
// Checkout.com, Shopify Payments. Rimosso PRIMA di mostrare la descrizione
// — "SQ *BLUE BOTTLE COFFEE" diventa "Blue Bottle Coffee".
// Limite dichiarato: elenco curato dei processori più comuni al mondo, non
// esaustivo — un processore non in lista passa comunque, solo senza pulizia
// (mai un nome troncato a caso su un prefisso non riconosciuto).
const PROCESSOR_PREFIX_RE = /^(SQ|TST|PAYPAL|CLV|IZ|SUMUP|CKO|SHOPIFY)\s*[*#:]\s*/i;
export function stripPaymentProcessorPrefix(text) {
  return String(text || '').replace(PROCESSOR_PREFIX_RE, '').trim();
}

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
    return stripPaymentProcessorPrefix(line).slice(0, 60);
  }
  return null;
}

// Direzione della transazione: parole specifiche di entrata vs uscita.
// Diverse da COLUMN_KEYWORDS in pdf-parser.js (quelle sono intestazioni di
// colonna in un estratto conto tabellare, qui serve capire il verso di UN
// singolo movimento raccontato in linguaggio naturale dalla notifica).
const INCOME_HINTS = /(accredito|accreditat|ricevut|stipendio|bonifico in entrata|incasso|rimborso)/i;
const EXPENSE_HINTS = /(addebito|addebitat|pagamento|pagat|acquisto|prelievo|acquistat)/i;

// Disambiguazione data "gg/mm" vs "mm/gg" — BUG REALE trovato rileggendo il
// codice (mai indovinato prima): con entrambi i numeri ≤12 ("03/04/2026") il
// formato è genuinamente ambiguo, e il codice assumeva SEMPRE gg/mm senza
// dirlo — uno scontrino USA vero ("03/04" = 4 marzo, non 3 aprile) veniva
// silenziosamente letto con la data sbagliata. Quando un numero supera 12
// non c'è ambiguità (non può essere un mese): si usa quello per capire
// l'ordine, a prescindere da qualunque preferenza. Solo quando ENTRAMBI i
// numeri sono ≤12 (e diversi) l'ordine è scelto da `preferisciMeseGiorno`
// (true per gli USA, unico Paese dove mm/gg è la norma) — e la scelta viene
// dichiarata onestamente (`ambigua: true`), mai spacciata per certa.
function interpretaDataGiornoMese(a, b, preferisciMeseGiorno) {
  if (a > 12 && b <= 12) return { giorno: a, mese: b, ambigua: false };
  if (b > 12 && a <= 12) return { giorno: b, mese: a, ambigua: false };
  if (a > 12 && b > 12) return null; // nessun numero può essere un mese: data invalida
  const ambigua = a !== b;
  return preferisciMeseGiorno ? { giorno: b, mese: a, ambigua } : { giorno: a, mese: b, ambigua };
}

// Funzione pura: dato il testo grezzo restituito dall'OCR, estrae una
// transazione plausibile. Nessuna dipendenza da Tesseract/DOM — testabile
// direttamente in Node. `opts.tripCountry`: unico segnale disponibile per
// scegliere l'ordine giorno/mese quando è ambiguo (vedi sopra) — 'US' è
// l'unico Paese, fra quelli già coperti dal modulo trasferte, dove mm/gg è
// la convenzione normale.
export function parseScreenshotText(rawText, opts = {}) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  // Priorità 1: pattern di NOTIFICA precisi (notification-parser.js). È il
  // caso più comune per davvero: questo modulo esiste apposta perché una
  // webapp non può leggere le notifiche di altre app (vedi commento in
  // testa al file) — l'utente fa uno screenshot DI UNA NOTIFICA e lo
  // importa qui. L'euristica sotto ("numero vicino a una parola chiave")
  // è pensata per gli SCONTRINI, dove non esiste una frase strutturata da
  // riconoscere; su una notifica tipo "You spent $45.00 on your Visa card
  // at TESCO" sbaglierebbe l'esercente (prenderebbe il titolo dell'app,
  // non "TESCO", perché extractMerchant non sa che è una frase) e su un
  // rimborso anche il verso (INCOME_HINTS non conosce "refund"). I pattern
  // di notifica lo sanno già: quando matchano, si fidano di loro; solo se
  // non matchano (scontrini, testo libero) si ricade sull'euristica di sempre.
  const notifica = parseNotificationText(null, rawText);

  let amount = notifica?.amount ?? null;
  // 'alta' per un pattern di notifica riconosciuto o un importo vicino a una
  // parola chiave (già il criterio di sempre) — 'media' solo per il
  // fallback "numero più alto nel testo", il meno affidabile dei tre.
  let confidenceAmount = amount !== null ? 'alta' : null;
  if (amount === null) {
    const keywordMatch = rawText.match(AMOUNT_NEAR_KEYWORD);
    if (keywordMatch) { amount = parseCellAmount(keywordMatch[2]); confidenceAmount = 'alta'; }
    // Valuta a zero decimali (yen/won/dong/...): nessun formato "xx,xx" da
    // trovare per costruzione. Stesso vincolo di sicurezza dell'importo
    // decimale (SOLO vicino a una parola "totale" nota, in una qualunque
    // delle lingue coperte) — mai il fallback "numero più alto" su un
    // intero, sarebbe un codice/quantità/telefono con probabilità reale.
    if (amount === null) {
      const wholeMatch = rawText.match(AMOUNT_NEAR_KEYWORD_WHOLE);
      if (wholeMatch) { amount = parseWholeAmount(wholeMatch[2]); confidenceAmount = amount !== null ? 'alta' : null; }
    }
    if (amount === null) {
      // fallback: importo più alto nel testo (stessa euristica del vecchio ReceiptScanner)
      const all = [...rawText.matchAll(ANY_AMOUNT)].map(m => parseCellAmount(m[0])).filter(v => v !== null);
      amount = all.length ? Math.max(...all) : null;
      confidenceAmount = amount !== null ? 'media' : null;
    }
  }

  // BUG REALE trovato testando dal vivo con uno scontrino giapponese: prima
  // di questo fix `date` valeva SEMPRE `new Date()` quando nessun pattern
  // combaciava — la trasparenza OCR (buildReceiptOcrReport) lo leggeva come
  // "data trovata, confidenza media" invece di "mancante", mostrando la
  // data di OGGI spacciata per quella letta dallo scontrino. Ora `date` è
  // `null` quando non riconosciuta — onesto per il chiamante di trasferta
  // (mostra "mancante"); l'import personale (handleScreenshotUpload sotto)
  // applica il proprio fallback "oggi" al punto d'uso, non qui.
  let date = null;
  let dateAmbiguous = false;
  const dmySlash = rawText.match(DATE_PATTERN);
  const ymdCjk = dmySlash ? null : rawText.match(DATE_PATTERN_YMD_CJK);
  if (dmySlash) {
    let yr = parseInt(dmySlash[3]);
    if (yr < 100) yr += 2000;
    const interpretata = interpretaDataGiornoMese(parseInt(dmySlash[1]), parseInt(dmySlash[2]), opts.tripCountry === 'US');
    if (interpretata) {
      const parsed = new Date(yr, interpretata.mese - 1, interpretata.giorno);
      if (!isNaN(parsed.getTime())) { date = parsed; dateAmbiguous = interpretata.ambigua; }
    }
  } else if (ymdCjk) {
    const parsed = new Date(parseInt(ymdCjk[1]), parseInt(ymdCjk[2]) - 1, parseInt(ymdCjk[3]));
    if (!isNaN(parsed.getTime())) date = parsed;
  }

  const type = notifica?.type || (INCOME_HINTS.test(rawText) && !EXPENSE_HINTS.test(rawText) ? 'entrata' : 'uscita');

  // descrizione: se un pattern di notifica ha riconosciuto l'esercente VERO
  // (non il titolo dell'app), è sempre più affidabile. Altrimenti prima
  // l'esercente da scontrino (nome del negozio in alto, filtrando P.IVA/
  // indirizzi/diciture fiscali), poi il vecchio fallback.
  const description = notifica?.description
    || extractMerchant(lines)
    || lines.find(l => !ANY_AMOUNT.test(l) || l.replace(ANY_AMOUNT, '').trim().length > 3)
    || 'Da screenshot';

  // Valuta: se il pattern di notifica l'ha già rilevata (i pattern carta
  // sono multi-valuta per natura) si usa quella; altrimenti si cerca
  // sull'intero testo OCR — AMOUNT_RE_SRC cattura di proposito solo cifre/
  // separatori (niente simboli), quindi un eventuale £/¥/CHF va cercato nel
  // contesto attorno. Assente quando non c'è traccia: il chiamante ricade
  // sulla valuta base.
  const currency = notifica?.currency || detectCurrency(rawText);

  return {
    amount, date, type, description: description.slice(0, 60),
    confidence: confidenceAmount || 'bassa',
    rawText,
    ...(currency ? { currency } : {}),
    ...(dateAmbiguous ? { dateAmbiguous: true } : {}),
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
  return stripPaymentProcessorPrefix(s)
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
  if (m) return { start: m.index, end: m.index + m[0].length, neg: isNeg(m[1], m[5]), pos: isPos(m[1]), val: parseFloat(m[2].replace(/[.\s]/g, '') + '.' + m[3]), currency: detectCurrency(m[4]) };
  // valuta SEGUITA dal numero, con segno EVENTUALE prima della valuta: "-£4,50", "$5.00", "€ 5,00"
  m = line.match(/([-−+])?\s*([€$£¥])\s*([-−+])?\s*(\d{1,3}(?:[.\s]\d{3})*)[.,](\d{2})\s*([-−])?/);
  if (m) return { start: m.index, end: m.index + m[0].length, neg: isNeg(m[1], m[3], m[6]), pos: isPos(m[1], m[3]), val: parseFloat(m[4].replace(/[.\s]/g, '') + '.' + m[5]), currency: detectCurrency(m[2]) };
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
    txs.push({ amount: a.val, type, description: desc.slice(0, 60), date: currentDate || inline, ...(a.currency ? { currency: a.currency } : {}) });
  }
  return txs;
}

// BUG REALE trovato dal vivo (2026-09-19): `opts.override`/`opts.uiLang` non
// venivano mai propagati a `ocrLanguagesFor` — la scelta esplicita
// dell'utente ("Scontrino in un altro alfabeto?") veniva ignorata in
// silenzio e l'OCR restava sempre su 'ita+eng', anche selezionando
// Giapponese. Un test unitario non l'aveva preso perché testava
// `ocrLanguagesFor` isolata, non la sua chiamata da qui — verificato dal
// vivo con Tesseract reale (jpn+eng legge correttamente uno scontrino
// giapponese sintetico al 93% di confidenza se invocato con la lingua
// giusta, prova che il motore funziona: il bug era solo nel non passarla).
function resolveOcrLang(opts) {
  return opts.lang || ocrLanguagesFor({ tripCountry: opts.tripCountry, uiLang: opts.uiLang || resolveUiLanguage(), override: opts.override });
}

export async function scanScreenshot(imageFileOrBlob, opts = {}) {
  if (typeof Tesseract === 'undefined') {
    throw new Error('Tesseract.js non caricato in pagina.');
  }
  const lang = resolveOcrLang(opts);
  const { data } = await Tesseract.recognize(imageFileOrBlob, lang);
  return { ...parseScreenshotText(data.text, { tripCountry: opts.tripCountry }), ocrLang: lang };
}

// OCR → più transazioni (per le liste movimenti). Ritorna { transactions, rawText }.
export async function scanScreenshotMulti(imageFileOrBlob, opts = {}) {
  if (typeof Tesseract === 'undefined') throw new Error('Tesseract.js non caricato in pagina.');
  const lang = resolveOcrLang(opts);
  const { data } = await Tesseract.recognize(imageFileOrBlob, lang);
  return { transactions: parseScreenshotTransactions(data.text), rawText: data.text };
}

// Flusso completo collegato alla UI: OCR -> categorizzazione via
// orchestratore -> inserimento (la deduplicazione fuzzy è già gestita
// centralmente da VaultDAO.addTransaction, non va ripetuta qui).
export async function handleScreenshotUpload(file) {
  try {
    showToast(tShot('shotReading', lingua()), 'info');

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
        const tx = { id: Date.now() + Math.random(), amount: t.amount, type: t.type, category: cat.id, description: t.description, color: cat.color, date: date.toISOString(), source: 'screenshot_ocr', ...(t.currency ? { currency: t.currency } : {}) };
        const { duplicate } = VaultDAO.addTransaction(monthKey(date), tx, { bulk: true });
        if (!duplicate) added++;
      }
      if (added > 0) { VaultDAO.save(); window.renderAfterImport ? window.renderAfterImport() : (window.renderDashboard?.(), window.renderAnalysis?.()); }
      showToast(added > 0 ? tShot('shotMultiAdded', lingua(), added) : tShot('shotAlreadyThere', lingua()), added > 0 ? 'success' : 'info');
      return { count: added, transactions: multi.transactions };
    }

    // Fallback: singola transazione (scontrino/notifica).
    const parsed = await scanScreenshot(file);
    if (parsed.amount === null) {
      showToast(tShot('shotNoAmount', lingua()), 'error');
      return null;
    }
    // `parsed.date` è null quando lo scontrino non riporta una data
    // riconoscibile (onesto per il chiamante di trasferta) — qui l'import
    // personale ricade su oggi, unico punto dove questo default ha senso.
    const dataRisolta = parsed.date || new Date();

    const catId = safeCategorize(parsed.description, parsed.amount, dataRisolta, parsed.type); // guardrail

    const tx = {
      id: Date.now() + Math.random(),
      amount: parsed.amount,
      type: parsed.type,
      category: catId,
      description: parsed.description,
      color: getCatById(catId).color,
      date: dataRisolta.toISOString(),
      source: 'screenshot_ocr',
      // BUG REALE trovato dal vivo (2026-09-19): `parsed.currency` era già
      // rilevato da parseScreenshotText (detectCurrency), ma non veniva mai
      // scritto sulla transazione salvata — uno scontrino in sterline/
      // dollari/qualunque valuta diversa dall'euro veniva importato come se
      // fosse EUR, in silenzio. Vedi src/core/currency-convert.js: la
      // Dashboard sa già tenere separate le valute non base, ma solo se
      // `tx.currency` è presente.
      ...(parsed.currency ? { currency: parsed.currency } : {}),
    };
    const k = monthKey(dataRisolta);
    const { duplicate, route } = VaultDAO.addTransaction(k, tx);

    if (window.momentumOrchestrator) {
      window.momentumOrchestrator.learn(parsed.description, catId, parsed.amount, dataRisolta);
    }

    showToast(
      duplicate
        ? tShot('shotDuplicate', lingua())
        : tShot('shotSingleAdded', lingua(), parsed.description, `${parsed.amount} ${parsed.currency || 'EUR'}`, parsed.confidence),
      duplicate ? 'info' : 'success'
    );
    return { ...parsed, date: dataRisolta, duplicate, route };
  } catch (err) {
    console.error('Errore import screenshot:', err);
    showToast(tShot('shotReadError', lingua()), 'error');
    return null;
  }
}
