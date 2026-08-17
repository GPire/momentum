import { monthKey } from '../core/constants.js';
import { logETL } from '../core/utils.js';
import { AudioSynth } from '../core/audio.js';
import { VaultDAO } from '../core/vault.js';
import { showToast } from '../ui/feedback.js';
import { NeuralNexus } from '../ai/neural-nexus.js';
import { segmentIntents, FUZZY_AMOUNTS } from './intent-segmenter.js';
import { predictAmount } from '../predict/amount-memory.js';
import { detectDeviceLanguage } from '../i18n/detect.js';
import { suggestVoiceCorrection } from './voice-learning.js';

// Locale pieno che il Web Speech API richiede (BCP-47), a partire dal codice
// corto già usato ovunque nell'app per il QA testuale — un'unica mappa,
// niente formati diversi in posti diversi.
export const SPEECH_LOCALE = { it: 'it-IT', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-PT' };

// BUG REALE trovato facendo ricerca sui problemi di chi usa la voce in
// italiano E in inglese (2026-08-17): il riconoscimento vocale era fissato
// su 'it-IT' SEMPRE, a prescindere da tutto. Un dispositivo impostato in
// inglese — o un utente italiano che parla inglese per un termine
// finanziario — veniva ascoltato con un modello linguistico sbagliato:
// il riconoscimento vocale non "capisce parole", trascrive FONEMI secondo
// le regole della lingua impostata, quindi l'inglese pronunciato con un
// riconoscitore italiano produce quasi sempre spazzatura, non un errore
// dichiarato — il tipo di fallimento silenzioso peggiore, perché sembra
// che l'app "non capisca mai" invece di dire perché.
// Stessa priorità già usata per il QA testuale (resolveQaLanguage):
// scelta manuale nelle Impostazioni > lingua del dispositivo > italiano.
function linguaVoceAttiva() {
  try {
    const manuale = VaultDAO?.state?.qaLanguageOverride;
    if (manuale && SPEECH_LOCALE[manuale]) return manuale;
  } catch (_) {}
  return detectDeviceLanguage() || 'it';
}

// ==========================================
// VOICECORE™ v2 (🎙️)
// ==========================================
const VoiceCore = {
  recognition: null,
  isListening: false,
  init(container) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;
    // BUG REALE segnalato dal vivo (2026-08-17): "in ascolto" scattava più
    // volte, anche al primo tocco. Causa trovata: attachFormListeners (e con
    // esso VoiceCore.init) viene richiamato a ogni apertura del modulo sullo
    // STESSO #modal-body persistente (mai un nuovo elemento). Se il
    // microfono era rimasto attivo da un'apertura precedente — modulo
    // chiuso senza toccare stop, o riaperto in fretta — la vecchia sessione
    // di riconoscimento non veniva mai fermata: ne restavano DUE vive
    // insieme, ciascuna con i propri onstart/onresult che scrivevano sullo
    // stesso bottone e mostravano lo stesso toast, in parallelo. Fermare
    // sempre la sessione precedente prima di crearne una nuova la rende
    // impossibile per costruzione, non solo probabile.
    if (this.recognition) { try { this.recognition.abort(); } catch (_) {} }
    this.isListening = false;
    this.recognition = new SpeechRec();
    // Bug reale segnalato dall'utente: con continuous=false il microfono
    // catturava UN SOLO comando e si fermava, ignorando tutto quello detto
    // dopo. Con continuous=true resta in ascolto e processa ogni frase
    // pronunciata via via, finché l'utente non ferma manualmente.
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this._lingua = linguaVoceAttiva();
    this.recognition.lang = SPEECH_LOCALE[this._lingua] || 'it-IT';
    
    this.recognition.onstart = () => {
      this.isListening = true;
      const btn = container.querySelector('#voice-rec-btn');
      if (btn) btn.classList.add('mic-listening');
      showToast("In ascolto vocale...", "info");
    };
    
    this.recognition.onend = () => {
      this.isListening = false;
      const btn = container.querySelector('#voice-rec-btn');
      if (btn) btn.classList.remove('mic-listening');
    };

    // Feedback visivo di ESITO (2026-08-17), non solo "sto ascoltando": prima
    // il microfono tornava allo stato di riposo identico sia che avesse
    // capito tutto sia che non avesse capito niente — l'unico segnale era il
    // toast, facile da perdere con lo sguardo già tornato sulla tastiera.
    // Un lampo verde/ambra sul bottone stesso, dove l'occhio sta già.
    const flashMic = (esito) => {
      const btn = container.querySelector('#voice-rec-btn');
      if (!btn) return;
      const cls = esito === 'ok' ? 'mic-success' : 'mic-error';
      btn.classList.add(cls);
      setTimeout(() => btn.classList.remove(cls), 900);
    };
    this._flashMic = flashMic;

    // BUG REALE: nessun gestore d'errore esisteva. Se l'utente negava il
    // permesso del microfono (o lo aveva già bloccato da prima), l'app non
    // diceva NIENTE — solo il popup nativo del browser, che sparisce da
    // solo, e poi silenzio: nessun modo di capire cosa fare per rimediare.
    // Ogni codice d'errore del Web Speech API ha qui la sua frase, mai un
    // generico "errore" che non aiuta a risolvere.
    this.recognition.onerror = (e) => {
      this.isListening = false;
      const btn = container.querySelector('#voice-rec-btn');
      if (btn) btn.classList.remove('mic-listening');
      flashMic('no');
      const MESSAGGI = {
        'not-allowed': 'Microfono bloccato: dai il permesso nelle impostazioni del browser per usare la dettatura.',
        'service-not-allowed': 'Microfono bloccato: dai il permesso nelle impostazioni del browser per usare la dettatura.',
        'no-speech': 'Non ho sentito niente. Riprova parlando più vicino al microfono.',
        'audio-capture': 'Nessun microfono trovato su questo dispositivo.',
        'network': 'Il riconoscimento vocale ha bisogno di rete: controlla la connessione.',
        'aborted': null, // fermato di proposito (nuova sessione che sostituisce questa): non è un errore da mostrare
      };
      const msg = MESSAGGI[e.error];
      if (msg) { AudioSynth.play('friction'); showToast(msg, 'error'); }
    };

    this.recognition.onresult = (e) => {
      // Con continuous=true, e.results accumula TUTTE le frasi pronunciate
      // nella sessione — va processata solo l'ultima appena finalizzata,
      // non sempre la prima (bug che avrebbe ripetuto in loop il primo comando).
      const lastIdx = e.results.length - 1;
      if (!e.results[lastIdx].isFinal) return;
      const text = e.results[lastIdx][0].transcript;
      logETL(`Dettatura Vocale: "${text}"`);

      // Domanda vocale → motore Q&A (src/ai/qa-engine.js): risposta
      // calcolata sui dati veri e letta ad alta voce. Va controllata PRIMA
      // del parser transazioni: "quanto ho speso questo mese?" contiene
      // "ho" e verrebbe scambiata per una spesa da registrare.
      const QUESTION_RE = /^(quanto|quando|quali|quale|dove|come chiudo|come finisco|posso permettermi|cosa posso|a che punto)/i;
      if (window.askMomentum && (QUESTION_RE.test(text.trim()) || text.trim().endsWith('?'))) {
        const res = window.askMomentum(text);
        showToast(res.answer, 'info');
        if ('speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance(res.answer);
          u.lang = SPEECH_LOCALE[this._lingua] || 'it-IT';
          window.speechSynthesis.speak(u);
        }
        AudioSynth.play('success');
        flashMic('ok');
        return;
      }

      // "Aggiungi il solito [caffè]" → quick-add via memoria importi
      // (src/predict/amount-memory.js): registra in 2 secondi l'acquisto
      // abituale, con la sua cifra stabile. La guardia richiede che la frase
      // INIZI col verbo — "ho preso il solito treno" resta una spesa normale
      // gestita dal parser sotto.
      const solitoMatch = window.matchSolito && text.trim().match(/^(aggiungi|metti|segna|registra)\s+il solito\s*(.*)$/i);
      if (solitoMatch) {
        const hit = window.matchSolito(solitoMatch[2].trim());
        if (hit) {
          window.registerQuickAdd?.(hit);
          AudioSynth.play('success');
          flashMic('ok');
          showToast(`Registrato: ${hit.description} ${hit.amount}€`, 'success');
        } else {
          AudioSynth.play('friction');
          flashMic('no');
          showToast('Non ho ancora un "solito" abbastanza chiaro. Registralo qualche volta prima.', 'error');
        }
        return;
      }

      // VoiceParser.parse() ora ritorna un array (gestisce frasi composte
      // con più azioni distinte, es. "ho speso 20 euro e ricordami di...").
      const results = VoiceParser.parse(text);
      if (results && results.length) {
        const recordDirect = (parsed) => {
          momentumOrchestrator?.recordTransaction({
            description: parsed.description, catId: parsed.category,
            amount: parsed.amount, date: new Date(), type: parsed.type,
          }) || VaultDAO.addTransaction(monthKey(new Date()), {
            id: Date.now() + Math.random(), amount: parsed.amount, type: parsed.type,
            category: parsed.category, description: parsed.description, date: new Date().toISOString(),
          });
        };

        // Eventi calendario (promemoria/appuntamenti) sempre esportati in .ics.
        results.filter(r => r.intent === 'reminder' || r.intent === 'appointment').forEach(parsed => {
          CalendarBridge.createEvent(parsed);
          // Esporta subito il singolo evento in .ics: è il modo reale (unico
          // possibile da una webapp) per farlo arrivare nel Calendario di
          // sistema — l'utente tocca il file per confermare l'aggiunta,
          // nessuna scrittura silenziosa è permessa dal sistema operativo.
          const lastEvent = (VaultDAO.state.events || []).slice(-1)[0];
          if (lastEvent) window.exportSingleEventToICS(lastEvent);
        });
        if (results.some(r => r.intent === 'reminder' || r.intent === 'appointment')) {
          renderCalendarEvents();
        }

        // STIMA PREDITTIVA degli importi mancanti: una spesa detta senza cifra
        // ("ho preso il caffè") prende l'importo TIPICO dalla tua storia (memoria
        // importi) — mai un numero inventato: se non c'è uno storico affidabile,
        // predictAmount ritorna null e la voce resta "senza importo" (segnalata,
        // non registrata a caso). Onestà + anti-attrito.
        const stimati = [];
        const senzaImporto = [];
        results.forEach(r => {
          if (r.intent === 'transaction' && r.amountMissing) {
            const pred = predictAmount(r.category, r.description, VaultDAO.state.transactions);
            if (pred && pred.amount > 0) { r.amount = pred.amount; r.amountEstimated = true; delete r.amountMissing; stimati.push(r); }
            else senzaImporto.push(r);
          }
        });

        const splits = results.filter(r => r.intent === 'split');
        // Solo le transazioni con un importo (stimato o detto) si registrano;
        // quelle senza importo stimabile si SEGNALANO, non si inventano.
        const txs = results.filter(r => r.intent === 'transaction' && !r.amountMissing);

        // CATEGORIZZAZIONE COL MOMENTUM CORE: la categoria delle uscite passa per
        // l'ensemble APPRESO (orchestrator.classify), non solo per la rete di
        // base — così la voce usa lo STESSO cervello che impara da tutto il resto,
        // e ogni voce registrata lo addestra ancora (recordTransaction→learn).
        if (window.momentumOrchestrator) {
          txs.forEach(t => {
            if (t.type === 'uscita') {
              try {
                const c = window.momentumOrchestrator.classify(t.description, t.amount, new Date());
                if (c && c.cat) t.category = c.cat;
              } catch (_) { /* fallback: resta la categoria della rete di base */ }
            }
          });
        }

        if (splits.length) {
          // Una DIVISIONE apre il suo modulo (importi/persone si aggiustano lì e
          // vanno confermati). Non si possono impilare due form: si apre il primo
          // split pre-compilato; le eventuali spese semplici concomitanti si
          // registrano direttamente (nessuna spesa in sospeso in un form nascosto).
          txs.forEach(recordDirect);
          const s = splits[0];
          if (typeof window.openSplitExpense === 'function') {
            window.openSplitExpense({ amount: s.amount, description: s.description, people: s.people });
          }
        } else if (txs.length === 1) {
          // BUG REALE segnalato dall'utente (2026-08-17): dire UN solo importo/
          // spesa popolava il modulo e restava lì fermo — l'utente doveva
          // comunque toccare "Conferma", la stessa sensazione di doverlo
          // registrare a mano che la voce dovrebbe evitare. Incoerente anche
          // con questa stessa funzione: se dici DUE transazioni, la seconda si
          // salva DA SOLA senza chiedere nulla — solo la prima (isolata)
          // restava in sospeso. Un'unica transazione chiara si salva subito,
          // esattamente come farebbe la seconda di due.
          recordDirect(txs[0]);
        } else {
          // Più transazioni: non si possono mostrare N moduli — la prima va
          // nel form (per rifinire categoria), le altre si registrano
          // direttamente, comportamento storico invariato.
          const firstTransaction = txs[0] || null;
          txs.slice(1).forEach(recordDirect);
          if (firstTransaction) {
            const descInput = container.querySelector('#tx-desc');
            // Salva cosa la voce aveva capito PRIMA che l'utente la corregga:
            // se al salvataggio il testo è diverso, main.js lo registra come
            // correzione da imparare (src/voice/voice-learning.js).
            if (descInput) { descInput.value = firstTransaction.description; descInput.dataset.voiceOriginal = firstTransaction.description; }
            const typeBtn = container.querySelector(`[data-type="${firstTransaction.type}"]`);
            if (typeBtn) typeBtn.click();
            window.updateRawVal(firstTransaction.amount.toString());
            setTimeout(() => {
              const chip = container.querySelector(`[data-cat-id="${firstTransaction.category}"]`);
              if (chip) chip.click();
            }, 100);
          }
        }

        // Riepilogo semplice e leggibile (feedback chiaro, comprensibile da
        // chiunque): cosa ho capito, cosa ho stimato, cosa mi manca.
        const usable = results.filter(r => !(r.intent === 'transaction' && r.amountMissing));
        const summary = usable.map(r =>
          r.intent === 'transaction' ? `${r.description} ${r.amount}€${r.amountEstimated ? ' (stima)' : ''}`
          : r.intent === 'split' ? `dividi ${r.amount ? r.amount + '€ ' : ''}con ${r.people.filter(p => p !== 'Io').join(', ') || '…'}`
          : `${r.intent === 'appointment' ? 'appuntamento' : 'promemoria'}: ${r.description}`).join(' · ');
        AudioSynth.play('success');
        flashMic('ok');
        showToast(`Fatto: ${summary}`, 'success');
        // Avvisi ONESTI e distinti, così l'utente sa cosa controllare.
        if (stimati.length) {
          showToast(`${stimati.length === 1 ? 'Un importo stimato' : stimati.length + ' importi stimati'} dalla tua storia: controlla che siano giusti.`, 'info');
        }
        if (senzaImporto.length) {
          showToast(`Non ho l'importo di: ${senzaImporto.map(r => r.description).join(', ')}. Dimmelo e le registro.`, 'info');
        }
      } else {
        AudioSynth.play('friction');
        flashMic('no');
        showToast("Non ho capito l'importo o la descrizione.", "error");
      }
    };
  },
  toggle() {
    if (this.recognition) {
      if (this.isListening) this.recognition.stop();
      else this.recognition.start();
    } else {
      showToast("Microfono non supportato nel browser.", "error");
    }
  }
};

const VoiceParser = {
  // Punto d'ingresso: gestisce frasi composte ("ho speso 20 euro dal
  // panettiere e ricordami di pagare l'affitto domani") scomponendole
  // in più clausole indipendenti, ciascuna interpretata separatamente.
  // Ritorna un array di risultati (anche con un solo elemento per le
  // frasi semplici) — il chiamante deve iterare, non assumere un solo esito.
  parse(text) {
    // Segmentazione AD ANCORAGGIO (src/voice/intent-segmenter.js): un passaggio
    // unico che non frammenta le descrizioni e riconosce ogni azione dalla sua
    // ancora — regge decine di azioni miste (spese + appuntamenti) in una frase.
    const clauses = segmentIntents(text);
    let results = clauses.map(c => this._parseClause(c)).filter(Boolean);
    results = this._resolveSplitAnaphora(results);
    results = this._resolveAmountlessPurchase(results);
    return results.length ? results : null;
  },

  // "ho comprato magliette e ho speso 1039,49 euro": due clausole con la
  // stessa ancora verbale (compra + spendi) restano DUE segmenti distinti
  // per il segmentatore — corretto nella maggioranza dei casi reali ("ho
  // comprato il pane, ho speso 5 euro, ho comprato il latte, ho speso 3
  // euro" SONO due spese separate). Ma quando la seconda non porta NESSUNA
  // descrizione propria (il chiamante l'ha già segnalato con descGeneric —
  // stesso segnale già calcolato da _parseClause, nessuna euristica nuova
  // indovinata sul testo grezzo), è quasi sempre la stessa frase spezzata
  // in due: "cosa ho comprato" + "quanto ho speso", non due acquisti.
  // Stesso schema di _resolveSplitAnaphora (eredita ed elimina), applicato
  // qui a coppie transazione-senza-importo / importo-senza-descrizione,
  // e SOLO fra lo stesso tipo (una spesa non eredita un importo detto per
  // un investimento appena dopo — sarebbe un dato inventato, non ereditato).
  _resolveAmountlessPurchase(results) {
    const out = [];
    for (const r of results) {
      const prev = out[out.length - 1];
      if (
        prev && prev.intent === 'transaction' && prev.amountMissing &&
        r.intent === 'transaction' && r.type === prev.type && r.descGeneric && !r.amountMissing
      ) {
        prev.amount = r.amount;
        prev.amountEstimated = false;
        delete prev.amountMissing;
        continue; // il segmento-importo viene assorbito, non registrato a parte
      }
      out.push(r);
    }
    return out;
  },

  // Anafora dello split: "ho speso 40 di cena E DIVIDILA con Marco" — la clausola
  // di divisione non porta un importo proprio, si riferisce alla spesa appena
  // detta. La divisione EREDITA importo+descrizione dalla spesa precedente e la
  // CONSUMA (la spesa non va anche registrata a parte: sarebbe doppio conteggio,
  // perché la conferma dello split registra già la mia quota come spesa reale).
  // Uno split con importo PROPRIO ("dividi 40 di cena con Marco") resta autonomo.
  _resolveSplitAnaphora(results) {
    const out = [];
    for (const r of results) {
      if (r.intent === 'split' && !(r.amount > 0)) {
        let consumed = false;
        for (let i = out.length - 1; i >= 0; i--) {
          if (out[i].intent === 'transaction' && out[i].type === 'uscita') {
            r.amount = out[i].amount;
            if (!r.description) r.description = out[i].description;
            out.splice(i, 1); // la spesa piatta è assorbita dalla divisione
            consumed = true;
            break;
          }
        }
        // se non c'è spesa da cui ereditare, lo split resta con importo 0:
        // apre comunque il modulo di divisione con le persone già inserite.
      }
      out.push(r);
    }
    return out;
  },

  // Estrae un orario esplicito ("alle 15", "alle 7", "at 3pm") PRIMA di
  // cercare importi, così "alle 15" non viene mai letto come 15 euro
  // (bug reale corretto: prima veniva confuso con un importo).
  //
  // BUG REALE trovato testando dal vivo con frasi discorsive (2026-08-17):
  // "alle 11 e mezza"/"alle 9 e un quarto" — il modo più comune di dire un
  // orario non in punto — non veniva riconosciuto affatto: "e mezza"
  // restava come rumore nella descrizione E l'orario restava sbagliato
  // (le mezz'ore/quarti d'ora si perdevano in silenzio).
  _MINUTI_PARLATI: { 'mezza': 30, 'mezzo': 30, 'un quarto': 15, 'tre quarti': 45, 'quindici': 15, 'trenta': 30, 'quarantacinque': 45 },
  _extractTime(text) {
    const suffisso = '(?:\\s+e\\s+(mezza|mezzo|un quarto|tre quarti|quindici|trenta|quarantacinque))?';
    const m = text.match(new RegExp('\\balle?\\s+(\\d{1,2})(?:[:.](\\d{2}))?' + suffisso, 'i'))
      || text.match(/\bat\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i);
    if (!m) return null;
    let hour = parseInt(m[1], 10);
    let minute = m[2] ? parseInt(m[2], 10) : 0;
    // m[3] significa cose diverse a seconda di QUALE dei due pattern ha
    // fatto match (sono alternative dello stesso `||`, mai entrambe
    // insieme): "pm"/"am" nel ramo inglese, "mezza"/"un quarto"/... nel
    // ramo italiano — mai confondibili fra loro, i valori non si sovrappongono.
    const parolaItaliana = m[3] ? this._MINUTI_PARLATI[m[3].toLowerCase()] : undefined;
    if (parolaItaliana !== undefined) minute = parolaItaliana;
    if (m[3] === 'pm' && hour < 12) hour += 12;
    if (hour < 0 || hour > 23) return null;
    return { hour, minute, matchedText: m[0] };
  },

  _parseClause(text) {
    const lower = text.toLowerCase();
    const time = this._extractTime(text);
    // Rimuove l'espressione oraria dal testo PRIMA di cercare importi,
    // altrimenti "alle 15" verrebbe letto come importo di 15.
    const textNoTime = time ? text.replace(time.matchedText, '') : text;
    const lowerNoTime = textNoTime.toLowerCase();

    const isAppointment = ['appuntamento', 'appointment', 'meeting', 'visita', 'incontro', 'riunione', 'call', 'chiamata', 'conferenza', 'colloquio'].some(w => lower.includes(w));
    const isReminder = isAppointment || ['calendario', 'sveglia', 'alarm', 'evento', 'promemoria', 'ricorda', 'calendar', 'remind', 'reminder', 'schedule'].some(w => lower.includes(w));

    if (isReminder) {
      let date = new Date();
      if (lower.includes('dopodomani') || lower.includes('day after tomorrow')) date.setDate(date.getDate() + 2);
      else if (lower.includes('domani') || lower.includes('tomorrow')) date.setDate(date.getDate() + 1);
      else {
        const weekdayMatch = this._extractWeekday(lower);
        if (weekdayMatch !== null) date = this._nextWeekday(date, weekdayMatch);
      }
      if (time) date.setHours(time.hour, time.minute, 0, 0);

      // Rimuove parole di comando + articoli/preposizioni/verbi di servizio
      // + giorni della settimana, così "ho un appuntamento dal dentista
      // giovedì" → "Dentista" invece del residuo "Ho dal dentista giovedì".
      let cleanDesc = textNoTime.replace(/\b(ricorda(mi)?|promemoria|sveglia|alarm|remind|reminder|schedule|calendar|calendario|fissa|appuntamento|appointment|meeting|ho|hai|un|una|uno|il|lo|la|di|da|dal|dalla|dallo|con|per|alle|alla|al|delle|della|prossimo|prossima|next|me|to|the|of|my|call|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|domani|dopodomani|oggi|stasera|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b/gi, '').trim();
      cleanDesc = cleanDesc.replace(/\b\d+([.,]\d{1,2})?\s*(euro|euros|dollaro|dollari|dollar|dollars|usd|eur|e|cent|centesimi|cents)?\b/gi, '');
      Object.keys(FUZZY_AMOUNTS).forEach(w => {
        const reg = new RegExp('\\b' + w + '\\b', 'gi');
        cleanDesc = cleanDesc.replace(reg, '');
      });
      cleanDesc = cleanDesc.replace(/[^a-zA-Z0-9\sàèéìòùÀÈÉÌÒÙ]/g, '').replace(/\s+/g, ' ').trim();
      if (cleanDesc.length > 0) cleanDesc = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);

      return {
        intent: isAppointment ? 'appointment' : 'reminder',
        description: cleanDesc || (isAppointment ? 'Appuntamento' : 'Scadenza Schedulata'),
        date: date.toISOString(),
        hasTime: !!time,
        amount: 0,
      };
    }

    // ── INTENTO DIVISIONE (split) ── "dividi[la] [40] [di cena] con Marco e Luca".
    // Va DOPO reminder (così "ricordami di dividere con Marco" resta un promemoria)
    // e PRIMA del path transazione (che pretende un importo: una divisione può
    // NON averlo — "dividila con Marco" eredita dalla spesa precedente).
    const SPLIT_RE = /\b(dividi(?:amo|la|lo|le|li)?|dividere|spartisci|spartire|split)\b/i;
    if (SPLIT_RE.test(lower)) {
      const amt = this.extractAmount(lowerNoTime) || 0;
      const people = this._extractPeople(textNoTime);
      // Descrizione = ciò che sta tra il verbo e i nomi, senza importo/connettivi.
      let d = textNoTime
        .replace(SPLIT_RE, ' ')
        .replace(/\bcon\b.*$/i, ' ')      // taglia da "con <nomi>" in poi
        .replace(/\bwith\b.*$/i, ' ')
        .replace(/\b\d+([.,]\d{1,2})?\s*(euro|euros|eur|€|dollaro|dollari|dollar|dollars|usd)?\b/gi, ' ')
        .replace(/\b(di|del|della|dello|dei|degli|delle|la|lo|il|per|a|da)\b/gi, ' ')
        .replace(/[^a-zA-Z0-9\sàèéìòùÀÈÉÌÒÙ]/g, '')
        .replace(/\s+/g, ' ').trim();
      if (d.length > 0) d = d.charAt(0).toUpperCase() + d.slice(1);
      return { intent: 'split', amount: amt, description: d, people };
    }

    let amount = this.extractAmount(lowerNoTime);
    // ANTI-ATTRITO PREDITTIVO: una voce con un VERBO di spesa/entrata ma senza
    // cifra ("ho preso il caffè") prima veniva persa in silenzio. Ora la teniamo
    // marcata `amountMissing`: il chiamante prova a STIMARE l'importo dalla tua
    // storia (memoria importi) e te lo mostra come stima da confermare — mai un
    // numero inventato. Senza né importo né verbo è rumore → si scarta.
    const TX_VERB = /\b(comprat[oa]|pagat[oa]|spes[oa]|pres[oa]|acquistat[oa]|investit[oa]|ricevut[oa]|guadagnat[oa]|mess[oa]|incassat[oa]|accantonat[oa]|risparmiat[oa]|spent|paid|bought|got|received|invested)\b/i;
    const amountMissing = !amount;
    if (!amount && !TX_VERB.test(lower)) return null;
    amount = amount || 0;

    let type = 'uscita';
    if (['stipendio', 'entrata', 'guadagnato', 'salary', 'earned', 'income', 'received', 'got paid', 'paid me', 'payment received', 'i earned', 'accredito', 'accreditati'].some(w => lower.includes(w))) type = 'entrata';
    // "messo da parte" spesso NON è contiguo ("ho messo 100 euro da parte"):
    // si riconosce anche il pattern "messo/metto ... da parte" e il solo
    // "da parte"/"accanton" come segnale di risparmio.
    else if (['etf', 'investito', 'crypto', 'invest', 'invested', 'stocks', 'risparmio', 'risparmiato', 'accantonato', 'accantonare', 'saving', 'savings', 'saved', 'set aside', 'put aside'].some(w => lower.includes(w))
             || /\bda parte\b/.test(lower) || /\bmess[oa]\b.*\bparte\b/.test(lower)) type = 'invest';

    let desc = textNoTime;
    desc = desc.replace(/\b\d+([.,]\d{1,2})?\s*(euro|euros|dollaro|dollari|dollar|dollars|usd|eur|e|cent|centesimi|cents)?\b/gi, '');
    desc = desc.replace(/\b\d+\s*(euro|euros|dollaro|dollari|dollar|dollars|usd|eur|e)\s*(e|and)?\s*\d{1,2}\b/gi, '');

    Object.keys(FUZZY_AMOUNTS).forEach(w => {
      const reg = new RegExp('\\b' + w + '\\b', 'gi');
      desc = desc.replace(reg, '');
    });

    const stripWords = [
      // Bug reale trovato testando con frasi lunghe e naturali (10 frasi
      // composte in sequenza): "ho" da solo non veniva mai rimosso (solo la
      // frase fissa "ho comprato"), e articoli/preposizioni articolate
      // italiane (lo, nel, sul...) non erano previsti — risultato:
      // "ho ricevuto lo stipendio di 1500 euro" diventava "Ho lo" invece di
      // una descrizione vuota o sensata, bypassando il fallback sotto
      // (che scatta solo su stringa vuota, non su residui insensati).
      'ho comprato', 'comprato', 'comprata', 'preso', 'presa', 'pagato', 'pagata', 'speso', 'spesa', 'acquistato', 'acquistata',
      'bought', 'spent', 'paid', 'purchased', 'got', 'for', 'a', 'an', 'at', 'per', 'in', 'su', 'da', 'di', 'con', 'ho',
      'investito', 'messo', 'invested', 'put', 'into', 'on', 'stipendio', 'salary', 'entrata', 'income', 'guadagnato', 'earned',
      'ricevuto', 'received', 'extra',
      // BUG REALE trovato testando in inglese (2026-08-17): "I received my
      // salary of 2000 euros" diventava "My of" — "salary"/"received" erano
      // già nella lista, ma non i piccoli connettivi inglesi ("my", "of",
      // "the") che restano dopo aver tolto il resto. Stesso principio degli
      // articoli italiani sopra, applicato all'inglese.
      'my', 'of', 'the',
      // articoli italiani
      'lo', 'la', 'il', 'i', 'gli', 'le', 'un', 'una', 'uno',
      // preposizioni articolate italiane (contrazione preposizione+articolo,
      // non intercettate dallo strip delle preposizioni semplici sopra)
      'nel', 'nella', 'nello', 'negli', 'nelle', 'sul', 'sulla', 'sullo', 'sui', 'sugli', 'sulle',
      'dal', 'dalla', 'dallo', 'dai', 'dagli', 'dalle', 'col', 'coi',
      'del', 'della', 'dello', 'dei', 'degli', 'delle', 'al', 'allo', 'alla', 'ai', 'agli', 'alle'
    ];

    stripWords.forEach(w => {
      const reg = new RegExp('\\b' + w + '\\b', 'gi');
      desc = desc.replace(reg, '');
    });

    desc = desc.replace(/[^a-zA-Z0-9\sàèéìòùÀÈÉÌÒÙ]/g, '').replace(/\s+/g, ' ').trim();
    // Un connettivo isolato a fine descrizione ("Magliette e") è sempre un
    // residuo del taglio fra due clausole (es. "ho comprato magliette e ho
    // speso…", assorbito da _resolveAmountlessPurchase sopra), mai una
    // parola voluta — a differenza di un "e" in MEZZO alla descrizione
    // ("pane e latte"), che resta intatto perché fa parte del significato.
    desc = desc.replace(/\s+(e|and)$/i, '').trim();
    if (desc.length > 0) {
      desc = desc.charAt(0).toUpperCase() + desc.slice(1);
    }

    // AUTO-APPRENDIMENTO DEL PARLATO (src/voice/voice-learning.js): se
    // QUESTO utente ha già corretto ≥2 volte questa stessa parola/frase
    // mal trascritta (es. il microfono capisce sempre "Magleitte" invece di
    // "Magliette" per il SUO modo di parlare), la correzione si applica da
    // sola — mai al primo caso isolato, sempre dopo conferme ripetute.
    // Applicata PRIMA della categoria: una descrizione corretta guida anche
    // un indovinare migliore della categoria.
    try {
      const corretta = suggestVoiceCorrection(VaultDAO?.state?.voiceLearning, desc);
      if (corretta) desc = corretta;
    } catch (_) { /* apprendimento opzionale: mai bloccante */ }

    // Bug reale corretto: NeuralNexus è addestrato su TUTTE le categorie senza
    // vincoli, quindi entrate/investimenti a volte finivano classificati con
    // categorie di spesa (es. "ho investito in etf" -> categoria "spesa").
    // Per entrata/invest il set di categorie valide è ristretto e noto,
    // quindi si sceglie con keyword invece di fidarsi ciecamente della rete.
    let catId;
    if (type === 'entrata') {
      catId = 'stipendio'; // unica categoria di entrata prevista dall'app
    } else if (type === 'invest') {
      if (['bitcoin', 'crypto', 'ethereum', 'btc'].some(w => lower.includes(w))) catId = 'crypto';
      else if (['risparmio', 'risparmiato', 'accantonato', 'saving', 'savings', 'saved', 'set aside', 'put aside'].some(w => lower.includes(w)) || /\bda parte\b/.test(lower) || /\bmess[oa]\b.*\bparte\b/.test(lower)) catId = 'risparmio';
      else catId = 'etf';
    } else {
      catId = NeuralNexus.predict(desc, amount).cat;
    }
    // Rete di sicurezza oltre allo strip esplicito sopra: se resta comunque
    // un residuo troppo corto (es. 1-2 lettere di una parola tagliata a
    // metà) per essere una descrizione leggibile, meglio il fallback
    // esplicito che mostrarlo all'utente così com'è.
    const descIsMeaningful = desc.length >= 3;
    return {
      intent: 'transaction',
      amount,
      type,
      category: catId,
      description: descIsMeaningful ? desc : (type === 'entrata' ? "Entrata Vocale" : type === 'invest' ? "Investimento Vocale" : "Spesa Vocale"),
      ...(amountMissing ? { amountMissing: true } : {}),
      // Serve a _resolveAmountlessPurchase sotto: distingue "non aveva
      // niente da dire" da "una descrizione vera che è solo corta".
      descGeneric: !descIsMeaningful,
    };
  },

  // Nomi delle persone di una divisione: quelli dopo "con"/"with". "e"/"and" e
  // le preposizioni non sono nomi; "Io" c'è sempre (tu sei nel gruppo). Ogni
  // nome è capitalizzato per la UI. Robusto a "con Marco e Luca" / "with Marco".
  _extractPeople(text) {
    const people = ['Io'];
    const m = text.match(/\b(?:con|with)\s+(.+)$/i);
    if (m) {
      const stop = new Set(['e', 'ed', 'and', 'di', 'del', 'della', 'per', 'a', 'da', 'il', 'lo', 'la', 'euro', 'eur']);
      m[1].split(/[\s,]+/).forEach(tok => {
        const t = tok.replace(/[^a-zA-Zàèéìòùé]/g, '');
        if (!t) return;
        const tl = t.toLowerCase();
        if (stop.has(tl) || tl === 'io' || tl === 'me') return;
        if (/\d/.test(tok)) return;
        const cap = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
        if (!people.includes(cap)) people.push(cap);
      });
    }
    return people;
  },

  _extractWeekday(lower) {
    const days = { lunedì:1, lunedi:1, martedì:2, martedi:2, mercoledì:3, mercoledi:3, giovedì:4, giovedi:4,
                   venerdì:5, venerdi:5, sabato:6, domenica:0,
                   monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6, sunday:0 };
    for (const [name, idx] of Object.entries(days)) if (lower.includes(name)) return idx;
    return null;
  },
  _nextWeekday(from, targetDay) {
    const d = new Date(from);
    const diff = (targetDay - d.getDay() + 7) % 7 || 7; // sempre il prossimo, mai oggi stesso
    d.setDate(d.getDate() + diff);
    return d;
  },

  extractAmount(text) {
    const match = text.match(/\b(\d+([.,]\d{1,2})?)\b/);
    if (match) {
      const value = parseFloat(match[1].replace(',', '.'));
      // BUG REALE segnalato dal vivo (2026-08-16): "113 euro e 39" detto a
      // voce veniva letto come 113, i centesimi spariti in silenzio. Il
      // motivo: questa regex trova il numero intero e si ferma SUBITO,
      // prima ancora di arrivare al ramo sotto che sapeva gestire "e 39" —
      // quel ramo non veniva mai raggiunto. Si applica SOLO se il numero
      // trovato non aveva già una virgola/punto (match[2] assente): con
      // "113,39 euro" i centesimi ci sono già, e non vanno cercati due volte.
      if (!match[2]) {
        const resto = text.slice(match.index + match[1].length);
        const centesimi = resto.match(/^\s*(?:euro|eur|€)?\s*e\s+(\d{1,2})\b/i);
        if (centesimi) return value + parseFloat(centesimi[1]) / 100;
      }
      return value;
    }

    const phraseMatch = text.match(/\b(\d+)\s*(euro|euros|dollaro|dollari|dollar|dollars|usd|eur|e)\s*(e|and)?\s*(\d{1,2})\b/i);
    if (phraseMatch) {
      const whole = parseFloat(phraseMatch[1]);
      const cents = parseFloat(phraseMatch[4]) / 100;
      return whole + cents;
    }

    const words = text.split(/\s+/);
    let sum = 0;
    words.forEach(word => {
      const cleaned = word.replace(/[.,]/g, '');
      if (FUZZY_AMOUNTS[cleaned] !== undefined) {
        sum += FUZZY_AMOUNTS[cleaned];
      }
    });
    return sum > 0 ? sum : null;
  }
};


export { VoiceCore, FUZZY_AMOUNTS, VoiceParser, linguaVoceAttiva };
