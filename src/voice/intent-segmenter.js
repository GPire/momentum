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

export const FUZZY_AMOUNTS = {
  'uno': 1, 'due': 2, 'tre': 3, 'quattro': 4, 'cinque': 5, 'sei': 6, 'sette': 7, 'otto': 8, 'nove': 9, 'dieci': 10,
  'venti': 20, 'trenta': 30, 'quaranta': 40, 'cinquanta': 50, 'sessanta': 60, 'settanta': 70, 'ottanta': 80, 'novanta': 90,
  'cento': 100, 'duecento': 200, 'trecento': 300, 'quattrocento': 400, 'cinquecento': 500, 'seicento': 600, 'settecento': 700, 'ottocento': 800, 'novecento': 900,
  'mille': 1000, 'mila': 1000, 'duemila': 2000, 'tremila': 3000, 'cinquemila': 5000, 'diecimila': 10000,
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000
};

// Verbi che introducono una TRANSAZIONE (spesa/entrata/investimento).
const SPEND_VERB = /^(comprat[oa]|pagat[oa]|spes[oa]|pres[oa]|acquistat[oa]|investit[oa]|ricevut[oa]|guadagnat[oa]|mess[oa]|incassat[oa]|accantonat[oa]|risparmiat[oa]|spent|paid|bought|got|received|invested)$/i;
const HO_AUX = /^(ho|hai|abbiamo|hanno)$/i;
// Sostantivi/verbi che introducono un APPUNTAMENTO o un PROMEMORIA.
const APPT_NOUN = /^(appuntament[oi]|appointment|riunion[ei]|meeting|call|chiamat[ae]|visit[ae]|colloqui[oi]|conferenz[ae]|incontr[oi]|prenotazion[ei]|prenot[ao]|prenotare|cena|pranzo)$/i;
const REMIND = /^(ricordami|ricorda|promemoria|svegli[ae]|scadenz[ae]|remind|reminder|schedule|calendario|calendar|evento|eventi)$/i;
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
  // Verbo nudo ("pagato 30 …" senza "ho"): apre un'azione SOLO se non preceduto
  // dall'ausiliare/"i" E non da articolo/preposizione — altrimenti è un
  // SOSTANTIVO omografo ("di spesa" = la spesa, non spendere; "la presa").
  if (SPEND_VERB.test(w) && !HO_AUX.test(prev) && prev !== 'i' &&
      !/^(di|del|della|dello|dei|degli|delle|a|per|il|lo|la|un|uno|una|le|gli|i)$/i.test(prev)) return true;

  // 2) Sostantivo di appuntamento / verbo di promemoria / divisione.
  //    Ma NON se è preceduto da articolo/preposizione ("una riunione", "di
  //    lavoro", "con Marco"): quella parola non apre un nuovo appuntamento.
  if (APPT_NOUN.test(w) || REMIND.test(w) || SPLIT_VERB.test(w)) {
    if (/^(di|del|della|dello|dei|degli|delle|a|per|il|lo|la|con|un|uno|una)$/i.test(prev)) return false;
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
  const norm = normalizeForSegmentation(text);
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
      if (cur.length && segmentIsComplete(cur) && segmentIsComplete(tokensUntilNextConnective(tokens, i + 1))) {
        flush();
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
