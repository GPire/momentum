// ==========================================
// INTENT SEGMENTER — segmentazione di intenti AD ANCORAGGIO (single-pass)
// ==========================================
// PROBLEMA (reale, segnalato): "20 spese con descrizioni + 20 appuntamenti con
// descrizioni in una frase sola" non venivano capiti. Il vecchio approccio
// spezzava PRIMA su ogni "e"/virgola e poi ricuciva: con molti elementi e
// descrizioni naturali (che contengono "e" e virgole) frammentava le descrizioni
// e la ricucitura non sempre recuperava. Inoltre il vocabolario delle "ancore"
// era incompleto (mancavano riunione/call/colloquio/conferenza/incontro) e gli
// ORARI ("alle 10") venivano contati come importi.
//
// SOLUZIONE proprietaria, on-device, senza LLM: un passaggio UNICO da sinistra a
// destra che NON frammenta mai. Ogni azione ha un'ANCORA (un verbo di spesa/
// entrata, un sostantivo di appuntamento, un verbo di promemoria/divisione, o un
// nuovo importo proprio in un elenco senza verbi). Si taglia SOLO all'inizio di
// una nuova ancora: tutto ciò che sta in mezzo (la descrizione, con le sue "e" e
// virgole) resta intatto dentro la stessa azione. Gli orari sono riconosciuti e
// non confusi con gli importi. Robusto a decine di azioni miste.
//
// Funzioni PURE e testabili: il chiamante (VoiceParser) interpreta ogni segmento.
//
// TOLLERANZA AI REFUSI DI TRASCRIZIONE (2026-08-17): il riconoscimento vocale
// del browser trascrive FONEMI, non intende parole — "appuntamento" può
// arrivare come "apputmaneot" o "apputnamneot" senza che sia un errore
// dell'utente. BUG REALE trovato testando dal vivo: una singola ancora non
// riconosciuta per un refuso (es. "apputmaneot" invece di "appuntamento")
// faceva collassare la segmentazione di TUTTA la frase a valanga — tutto ciò
// che seguiva restava incollato alla transazione precedente. Stesso motore
// già collaudato in qa-engine.js (correctTypos/levenshtein), applicato qui
// al piccolo vocabolario delle ANCORE invece che a un dizionario generico:
// un refuso, per definizione, non è una parola esistente — le parole vere e
// semplicemente vicine per ortografia (l'equivalente di "perdere"/"vendere"
// vs "spendere" già risolto in qa-engine.js) non vanno mai corrette.
import { levenshtein } from '../core/utils.js';

// UNA sola forma per famiglia (mai singolare+plurale/maschile+femminile
// insieme): la regex dell'ancora (es. APPT_NOUN, "appuntament[oi]") copre
// già l'altra forma una volta corretta questa, e avere entrambe nel
// dizionario crea PAREGGI inutili — bug reale trovato testando dal vivo:
// "apputmaneot" pareggiava fra "appuntamento" e "appuntamenti" (stessa
// distanza), e un pareggio fa rifiutare la correzione per prudenza,
// lasciando l'ancora non riconosciuta proprio quando serviva di più.
const ANCORE_TIPICHE = [
  'appuntamento', 'riunione', 'colloquio', 'conferenza', 'incontro', 'prenotazione',
  'ricordami', 'ricorda', 'promemoria', 'scadenza', 'calendario',
  'comprato', 'pagato', 'investito', 'acquistato', 'guadagnato', 'incassato',
  'accantonato', 'risparmiato', 'dividiamo', 'dividere', 'spartisci', 'spartire',
  'appointment', 'reminder', 'schedule',
];
// Parole vere, vicine per ortografia a un'ancora ma di significato diverso:
// non vanno mai "corrette" in un'ancora. Stessa disciplina di
// PAROLE_PROTETTE_IT in qa-engine.js. "parlare" trovato testando dal vivo:
// somiglianza 0,625 con "spartire" (distanza 3 su 8), sopra soglia — due
// verbi comuni e completamente diversi che la sola forma scritta avvicina.
const PAROLE_PROTETTE_ANCORE = new Set([
  'aggiornato', 'aggiornata', 'complicato', 'complicata', 'importante', 'importanti',
  'parlare', 'parlato', 'parlando', 'parliamo', 'colleghi', 'collega', 'collega',
]);

// Corregge SOLO i refusi vicini a un'ancora nota, mai un dizionario generico
// (che rischierebbe di alterare descrizioni/nomi propri).
//
// BUG REALE trovato testando dal vivo con una trascrizione reale (2026-08-17):
// "apputmaneot" per "appuntamento" ha distanza di Levenshtein 5 (lettere
// trasposte in blocco, non solo scambiate una a una) — una soglia FISSA
// (come quella di qa-engine.js, tarata su refusi di battitura corti) non la
// prende mai. Il parlato trascritto foneticamente produce errori più estesi
// di un refuso di tastiera: qui la soglia è un RAPPORTO sulla lunghezza
// della parola (quanto resta "riconoscibile"), non un numero fisso di
// caratteri — cresce naturalmente con parole più lunghe, dove l'ambiguità
// di un singolo carattere sbagliato pesa meno sul significato complessivo.
export function correctAnchorTypos(text) {
  return String(text || '').split(/(\s+)/).map((tok) => {
    const m = tok.match(/^([^a-zàèéìòù]*)([a-zàèéìòù]+)([^a-zàèéìòù]*)$/i);
    if (!m) return tok;
    const [, pre, word, post] = m;
    const lower = word.toLowerCase();
    if (lower.length < 7) return tok; // refusi corti sono troppo ambigui da correggere
    if (ANCORE_TIPICHE.includes(lower)) return tok; // già corretta
    if (PAROLE_PROTETTE_ANCORE.has(lower)) return tok;
    let best = null, bestDist = Infinity, ties = 0;
    for (const cand of ANCORE_TIPICHE) {
      if (cand.length < 7) continue; // le ancore corte non partecipano al confronto fuzzy
      // Le prime 3 lettere devono coincidere: un refuso di trascrizione
      // vocale scombina soprattutto il CENTRO della parola, raramente
      // l'inizio — vincolo che scarta parole vere e diverse ma vagamente
      // simili nel mezzo (bug reale trovato testando dal vivo: "vestiti"
      // veniva "corretto" in "investito", "colleghi" in "colloquio").
      if (lower.slice(0, 3) !== cand.slice(0, 3)) continue;
      const dist = levenshtein(lower, cand);
      if (dist < bestDist) { bestDist = dist; best = cand; ties = 1; }
      else if (dist === bestDist) ties++;
    }
    if (!best || bestDist === 0 || ties !== 1) return tok;
    const maxLen = Math.max(lower.length, best.length);
    const somiglianza = 1 - bestDist / maxLen; // 1 = identiche, 0 = niente in comune
    return somiglianza >= 0.55 ? pre + best + post : tok;
  }).join('');
}

// BUG REALE trovato testando dal vivo con frasi discorsive (2026-08-17):
// "undici".."diciannove" (11-19) mancavano DEL TUTTO, e i composti
// "ventitré"/"trentacinque"/... (21-99) non c'erano — in italiano sono
// UNA sola parola (a differenza dell'inglese "twenty three", due token che
// il motore già somma correttamente), quindi senza queste voci esplicite
// nel dizionario "ho speso ventitré euro" perdeva l'importo in silenzio.
// Generati con l'elisione vocalica reale dell'italiano (venti+uno→ventuno,
// non ventiuno) invece di essere scritti a mano uno per uno — un refuso di
// battitura in una lista di 70 voci sarebbe stato facile da non notare.
function generaComposti() {
  const decine = { venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60, settanta: 70, ottanta: 80, novanta: 90 };
  const unita = { 1: 'uno', 2: 'due', 3: 'tre', 4: 'quattro', 5: 'cinque', 6: 'sei', 7: 'sette', 8: 'otto', 9: 'nove' };
  const out = {};
  for (const [parola, valore] of Object.entries(decine)) {
    for (let u = 1; u <= 9; u++) {
      // Elisione: la vocale finale della decina cade se l'unità inizia per
      // vocale ("uno", "otto") — "ventuno"/"ventotto", non "ventiuno".
      const radice = (u === 1 || u === 8) ? parola.slice(0, -1) : parola;
      let composta = radice + unita[u];
      out[composta] = valore + u;
      if (u === 3) out[composta.slice(0, -1) + 'é'] = valore + u; // "tre" finale accentato: "ventitré"
    }
  }
  return out;
}

export const FUZZY_AMOUNTS = {
  'uno': 1, 'due': 2, 'tre': 3, 'quattro': 4, 'cinque': 5, 'sei': 6, 'sette': 7, 'otto': 8, 'nove': 9, 'dieci': 10,
  'undici': 11, 'dodici': 12, 'tredici': 13, 'quattordici': 14, 'quindici': 15, 'sedici': 16, 'diciassette': 17, 'diciotto': 18, 'diciannove': 19,
  'venti': 20, 'trenta': 30, 'quaranta': 40, 'cinquanta': 50, 'sessanta': 60, 'settanta': 70, 'ottanta': 80, 'novanta': 90,
  ...generaComposti(),
  'cento': 100, 'duecento': 200, 'trecento': 300, 'quattrocento': 400, 'cinquecento': 500, 'seicento': 600, 'settecento': 700, 'ottocento': 800, 'novecento': 900,
  'mille': 1000, 'mila': 1000, 'duemila': 2000, 'tremila': 3000, 'cinquemila': 5000, 'diecimila': 10000,
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000
};

// Verbi che introducono una TRANSAZIONE (spesa/entrata/investimento).
const SPEND_VERB = /^(comprat[oa]|pagat[oa]|spes[oa]|pres[oa]|acquistat[oa]|investit[oa]|ricevut[oa]|guadagnat[oa]|mess[oa]|incassat[oa]|accantonat[oa]|risparmiat[oa]|spent|paid|bought|got|received|invested)$/i;
const HO_AUX = /^(ho|hai|abbiamo|hanno)$/i;
// Equivalente inglese di HO_AUX, usato SOLO per il lookahead "have/has an
// appointment" — in inglese i verbi di transazione (SPEND_VERB) sono già al
// passato semplice ("spent", "earned") e non richiedono un ausiliare, quindi
// HAVE_EN non entra nella regola 1 sopra, solo in quella dell'appuntamento.
const HAVE_EN = /^(have|has)$/i;
// Articolo indeterminativo, italiano E inglese insieme: "ho UN appuntamento"
// e "I have AN appointment" sono la stessa identica costruzione.
const ARTICOLO_INDET = /^(un|uno|una|a|an)$/i;
// Sostantivi/verbi che introducono un APPUNTAMENTO o un PROMEMORIA.
const APPT_NOUN = /^(appuntament[oi]|appointment|riunion[ei]|meeting|call|chiamat[ae]|visit[ae]|colloqui[oi]|conferenz[ae]|incontr[oi]|prenotazion[ei]|prenot[ao]|prenotare|cena|pranzo)$/i;
const REMIND = /^(ricordami|ricorda|promemoria|svegli[ae]|scadenz[ae]|remind|reminder|schedule|calendario|calendar|evento|eventi)$/i;
// "ricordami DI chiamare... E DI pagare...": il secondo "ricordami" è
// sottinteso — in italiano non si ripete l'ancora per ogni voce di un
// elenco di cose da fare, ma il connettivo "e di [VERBO]" segnala
// comunque un'azione NUOVA (bug reale trovato testando dal vivo,
// 2026-08-17: due promemoria distinti restavano fusi in uno solo, con la
// data del primo applicata anche al secondo). Lista curata deliberatamente
// piccola (verbi comuni nei promemoria) invece di un riconoscitore
// generico di infiniti italiani — troppe parole finiscono per "-are/-ere/
// -ire" senza essere verbi ("mare", "sale") per rischiare un pattern largo.
const REMIND_VERB_INFINITIVE = /^(pagare|chiamare|comprare|prenotare|mandare|scrivere|portare|ritirare|rinnovare|disdire|cancellare|confermare|controllare|contattare|rispondere|inviare|prendere|passare|fare)$/i;
// Verbi di DIVISIONE (split).
const SPLIT_VERB = /^(dividi\w*|dividere|spartisci|spartire|split)$/i;
// Prefissi temporali che appartengono all'azione SEGUENTE (una data per un appt).
const TEMPORAL_LEAD = /^(domani|dopodomani|oggi|stasera|stamattina|stanotte|lunedì|lunedi|martedì|martedi|mercoledì|mercoledi|giovedì|giovedi|venerdì|venerdi|sabato|domenica|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight)$/i;
// Connettivi puri: mai un'ancora, si scartano all'inizio di un nuovo segmento.
const CONNECTIVE = /^(e|ed|and|poi|then|inoltre|allora|quindi)$/i;
// Introduttori di orario: il numero che segue è un ORARIO, non un importo.
const TIME_LEAD = /^(alle|alla|all|ore|at)$/i;

const clean = (w) => String(w || '').replace(/[.,;:!?)("»«'"']/g, '').trim().toLowerCase();

// Normalizza il testo PRIMA di tokenizzare: protegge i decimali e unisce i
// numeri-parola composti così non vengono spezzati o scambiati per due importi.
export function normalizeForSegmentation(text) {
  let t = String(text || '');
  // Decimale con virgola "12,50" → "12.50" (prima di toccare le virgole).
  t = t.replace(/(\d),(\d{1,2})\b/g, '$1.$2');
  // Decimale detto a voce "12 e 50" → "12.50" (num 1-4 cifre + e + 2 cifre).
  t = t.replace(/\b(\d{1,4})\s+e\s+(\d{2})\b(?!\s*\d)/gi, '$1.$2');
  // Numeri-parola uniti da "e": "mille e duecento" → un solo importo (togli "e").
  const NUM = Object.keys(FUZZY_AMOUNTS).join('|');
  t = t.replace(new RegExp('\\b(' + NUM + ')\\s+e\\s+(?=(?:' + NUM + ')\\b)', 'gi'), '$1 ');
  // Virgole/; residue → spazio (i decimali sono già protetti sopra).
  t = t.replace(/[,;]/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

// Un token è un IMPORTO proprio? (numero, o numero-parola). Serve a spezzare gli
// elenchi senza verbi ("caffè 3 e pranzo 12"). Va usato ignorando gli orari.
function isAmountToken(w) {
  const c = clean(w);
  if (/^\d+(?:\.\d{1,2})?$/.test(c)) return true;
  return Object.prototype.hasOwnProperty.call(FUZZY_AMOUNTS, c);
}

// Il segmento corrente contiene già un importo? (ignora i numeri che sono ORARI,
// cioè preceduti da alle/ore/at). Determina se un NUOVO importo apre un'azione.
function spanHasAmount(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    if (isAmountToken(tokens[i]) && !(i > 0 && TIME_LEAD.test(clean(tokens[i - 1])))) return true;
  }
  return false;
}

// Decide se all'indice i inizia una NUOVA azione, dato il segmento accumulato.
function startsNewAction(tokens, i, cur) {
  const w = clean(tokens[i]);
  const next = clean(tokens[i + 1] || '');
  if (!cur.length) return false; // il primo token non apre nulla, lo accumula

  const prev = clean(cur[cur.length - 1] || '');

  // 1) Verbo di transazione. L'ausiliare resta col verbo: si taglia a "ho"
  //    (non a "speso"), e un verbo nudo ("pagato") apre solo se NON preceduto
  //    dall'ausiliare o da "i" inglese (già coperti dalle due righe sopra).
  if (HO_AUX.test(w) && SPEND_VERB.test(next)) return true;
  if (w === 'i' && SPEND_VERB.test(next)) return true;
  // "ho un appuntamento…"/"ho una riunione…"/"I have an appointment…": il
  // taglio va PRIMA di "ho"/"have", non prima di "appuntamento" — a quel
  // punto sono già dentro `cur` (consumati nei passaggi precedenti del
  // ciclo) e non si possono più spostare nel segmento nuovo. Bug reale
  // trovato testando dal vivo: "…dle mare blu ho un appuntamento…" restava
  // spezzato come "…blu ho un" + "appuntamento…", con "ho un" abbandonato
  // in coda al segmento sbagliato — stesso bug ritrovato in inglese
  // ("I have an" + "appointment…") perché l'articolo indeterminativo va
  // riconosciuto in entrambe le lingue, non solo in italiano. Stesso
  // requisito di completezza del ramo APPT_NOUN sotto: taglia solo se
  // PRIMA dell'ausiliare c'è già un'azione vera.
  if ((HO_AUX.test(w) || HAVE_EN.test(w)) && ARTICOLO_INDET.test(next) &&
      (APPT_NOUN.test(clean(tokens[i + 2] || '')) || REMIND.test(clean(tokens[i + 2] || '')))) {
    return segmentIsComplete(cur);
  }
  // Verbo nudo ("pagato 30 …" senza "ho"): apre un'azione SOLO se non preceduto
  // dall'ausiliare/"i" E non da articolo/preposizione — altrimenti è un
  // SOSTANTIVO omografo ("di spesa" = la spesa, non spendere; "la presa";
  // "la ricevuta"). BUG REALE trovato testando dal vivo (2026-08-17): "ho
  // speso 20 euro ALLA spesa" si spezzava a metà frase, perdendo la parola
  // "spesa" e inquinando il segmento successivo — la lista escludeva solo le
  // preposizioni articolate con "di" (del/della/dello/...) e dimenticava
  // quelle con "a/da/su/in" (alla/dalla/nella/sulla/...), pur essendo
  // "alla spesa"/"al bar"/"dal dentista" fra le costruzioni più comuni del
  // parlato italiano — non un caso limite, la norma.
  if (SPEND_VERB.test(w) && !HO_AUX.test(prev) && prev !== 'i' &&
      !/^(di|del|della|dello|dei|degli|delle|a|al|allo|alla|ai|agli|alle|da|dal|dallo|dalla|dai|dagli|dalle|su|sul|sullo|sulla|sui|sugli|sulle|in|nel|nello|nella|nei|negli|nelle|con|per|tra|fra|il|lo|la|un|uno|una|le|gli|i)$/i.test(prev)) return true;

  // 2) Sostantivo di appuntamento / verbo di promemoria / divisione.
  //    Ma NON se è preceduto da articolo/preposizione ("una riunione", "di
  //    lavoro", "con Marco"): quella parola non apre un nuovo appuntamento.
  if (APPT_NOUN.test(w) || REMIND.test(w) || SPLIT_VERB.test(w)) {
    // BUG REALE trovato testando in inglese (2026-08-17): "remind me TO CALL
    // the accountant" apriva DUE azioni — "call" e' anche un sostantivo
    // d'appuntamento ("I have a call at 3pm"), ma qui e' il verbo "to call"
    // (telefonare), preceduto dal marcatore d'infinito "to". Stessa logica
    // degli articoli/preposizioni italiane sopra: "to" prima della parola
    // dice che non sta aprendo un nuovo appuntamento.
    // BUG REALE trovato testando dal vivo (2026-08-17): "ho UN appuntamento…"
    // — la costruzione standard con cui in italiano si introduce un NUOVO
    // appuntamento — veniva bloccata dalla stessa regola pensata per i
    // riferimenti indiretti ("di un appuntamento", "per un appuntamento").
    // La differenza è cosa precede "un/una/uno": se è l'ausiliare "ho" (o
    // "abbiamo"), sta introducendo un'azione nuova, non descrivendone una
    // già in corso — va aperta comunque.
    if (ARTICOLO_INDET.test(prev)) {
      // "ho un appuntamento"/"I have an appointment" apre una nuova azione
      // SOLO se PRIMA c'è già un'azione COMPLETA accumulata (un importo o
      // un'altra ancora) — non basta che ci sia qualche parola prima: un
      // prefisso temporale puro ("giovedì ho una riunione") non è un'azione
      // precedente da cui separarsi, è parte della STESSA riunione. Rete di
      // sicurezza per i casi che la regola 1 sopra non ha già tagliato
      // (es. ausiliare non riconosciuto): stessa logica, stesso risultato.
      const primaAncora = clean(cur[cur.length - 2] || '');
      const restoAncoraPrima = cur.slice(0, Math.max(0, cur.length - 2));
      if (!(HO_AUX.test(primaAncora) || HAVE_EN.test(primaAncora)) || !segmentIsComplete(restoAncoraPrima)) return false;
    } else if (/^(di|del|della|dello|dei|degli|delle|a|per|il|lo|la|con|to)$/i.test(prev)) return false;
    return true;
  }

  // 3) Prefisso temporale (domani/giovedì): apre una nuova azione SOLO se poco
  //    dopo compare un'ancora di appuntamento/promemoria/transazione (la data
  //    appartiene a QUELL'azione). Evita di tagliare "appuntamento ... giovedì"
  //    dove la data sta in coda e non introduce nulla di nuovo.
  if (TEMPORAL_LEAD.test(w)) {
    for (let k = i + 1; k < Math.min(tokens.length, i + 7); k++) {
      const t = clean(tokens[k]);
      if (CONNECTIVE.test(t)) break; // un connettivo chiude la finestra di lookahead
      if (APPT_NOUN.test(t) || REMIND.test(t) || SPEND_VERB.test(t) ||
          (HO_AUX.test(t) && SPEND_VERB.test(clean(tokens[k + 1] || ''))) ||
          SPLIT_VERB.test(t)) {
        return true;
      }
    }
    return false;
  }

  return false;
}

// Un gruppo di token è un'azione COMPLETA? Una transazione lo è quando ha un
// importo (non un orario); un appuntamento/promemoria quando ha il suo
// sostantivo/verbo-ancora. Un verbo di spesa da SOLO (senza importo) NON basta:
// "ho comprato pane e latte per 5€" è UNA spesa (il prezzo è a destra del "e"),
// quindi il connettivo lì non deve tagliare. Serve a decidere se un CONNETTIVO
// separa due azioni: si taglia solo se ENTRAMBI i lati sono completi.
function segmentIsComplete(tokens) {
  if (spanHasAmount(tokens)) return true;
  for (let i = 0; i < tokens.length; i++) {
    const w = clean(tokens[i]);
    if (APPT_NOUN.test(w) || REMIND.test(w)) return true;
  }
  return false;
}

// I token dall'indice `from` fino al prossimo connettivo (o fine) — la "prossima
// unità" che un connettivo introduce. Serve al lookahead sul connettivo.
function tokensUntilNextConnective(tokens, from) {
  const out = [];
  for (let k = from; k < tokens.length; k++) {
    if (CONNECTIVE.test(clean(tokens[k]))) break;
    out.push(tokens[k]);
  }
  return out;
}

// Punto d'ingresso: testo libero → array di segmenti (uno per azione).
export function segmentIntents(text) {
  const norm = normalizeForSegmentation(correctAnchorTypos(text));
  if (!norm) return [];
  const tokens = norm.split(/\s+/);
  const segments = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    const s = cur.join(' ').trim();
    if (s) segments.push(s);
    cur = [];
  };
  for (let i = 0; i < tokens.length; i++) {
    const w = clean(tokens[i]);
    // CONNETTIVO ("e"/"and"/"poi"…): separa DUE azioni SOLO se entrambi i lati
    // sembrano azioni complete (il segmento corrente ha un segnale, e la prossima
    // unità fino al connettivo successivo ne ha uno). Così "caffè 3 e pranzo 12"
    // e "riunione alle 10 e caffè 3" si tagliano, ma "pane e latte 5€",
    // "appuntamento con Marco e Luca", "mille duecento" NO.
    if (CONNECTIVE.test(w)) {
      const restoDopo = tokensUntilNextConnective(tokens, i + 1);
      // "ricordami di chiamare X e DI pagare Y": il secondo "ricordami" è
      // sottinteso, ma "e di [verbo noto]" da solo basta a separare —
      // anche se la seconda metà non avrebbe la sua ANCORA esplicita e
      // quindi non passerebbe segmentIsComplete (nessun REMIND/APPT_NOUN
      // nella frase "pagare la bolletta entro venerdì").
      const curHaGiaUnPromemoria = cur.some((t) => REMIND.test(clean(t)) || APPT_NOUN.test(clean(t)));
      const restoEContinuazioneImplicita = curHaGiaUnPromemoria &&
        clean(restoDopo[0]) === 'di' && REMIND_VERB_INFINITIVE.test(clean(restoDopo[1] || ''));
      if (cur.length && (restoEContinuazioneImplicita || (segmentIsComplete(cur) && segmentIsComplete(restoDopo)))) {
        flush();
        // Ricostruisce l'ancora sottintesa: senza "ricordami" davanti, il
        // nuovo segmento ("di pagare la bolletta...") non avrebbe nessuna
        // parola che _parseClause riconosce come promemoria e sparirebbe
        // invece di diventare un secondo promemoria — peggio che fonderlo.
        if (restoEContinuazioneImplicita) cur.push('ricordami');
        continue; // il connettivo è il confine: si scarta
      }
      if (!cur.length) continue; // connettivo in testa a un nuovo segmento: scarta
      cur.push(tokens[i]); // dentro una descrizione: resta
      continue;
    }
    // Ancora esplicita (verbo/sostantivo d'azione o data che introduce un'azione).
    if (cur.length && startsNewAction(tokens, i, cur)) flush();
    cur.push(tokens[i]);
  }
  flush();
  return segments;
}
