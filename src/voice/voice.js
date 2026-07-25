import { monthKey } from '../core/constants.js';
import { logETL } from '../core/utils.js';
import { AudioSynth } from '../core/audio.js';
import { VaultDAO } from '../core/vault.js';
import { showToast } from '../ui/feedback.js';
import { NeuralNexus } from '../ai/neural-nexus.js';
import { segmentIntents, FUZZY_AMOUNTS } from './intent-segmenter.js';

// ==========================================
// VOICECORE™ v2 (🎙️)
// ==========================================
const VoiceCore = {
  recognition: null,
  isListening: false,
  init(container) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;
    this.recognition = new SpeechRec();
    // Bug reale segnalato dall'utente: con continuous=false il microfono
    // catturava UN SOLO comando e si fermava, ignorando tutto quello detto
    // dopo. Con continuous=true resta in ascolto e processa ogni frase
    // pronunciata via via, finché l'utente non ferma manualmente.
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'it-IT';
    
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
          u.lang = 'it-IT';
          window.speechSynthesis.speak(u);
        }
        AudioSynth.play('success');
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
          showToast(`Registrato: ${hit.description} ${hit.amount}€`, 'success');
        } else {
          AudioSynth.play('friction');
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

        const splits = results.filter(r => r.intent === 'split');
        const txs = results.filter(r => r.intent === 'transaction');

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
        } else {
          // Nessuno split: comportamento storico — la prima transazione va nel
          // form (per rifinire categoria), le altre si registrano direttamente.
          const firstTransaction = txs[0] || null;
          txs.slice(1).forEach(recordDirect);
          if (firstTransaction) {
            const descInput = container.querySelector('#tx-desc');
            if (descInput) descInput.value = firstTransaction.description;
            const typeBtn = container.querySelector(`[data-type="${firstTransaction.type}"]`);
            if (typeBtn) typeBtn.click();
            window.updateRawVal(firstTransaction.amount.toString());
            setTimeout(() => {
              const chip = container.querySelector(`[data-cat-id="${firstTransaction.category}"]`);
              if (chip) chip.click();
            }, 100);
          }
        }

        const summary = results.map(r =>
          r.intent === 'transaction' ? `${r.type} ${r.amount}€`
          : r.intent === 'split' ? `dividi ${r.amount ? r.amount + '€ ' : ''}con ${r.people.filter(p => p !== 'Io').join(', ') || '…'}`
          : `${r.intent === 'appointment' ? 'appuntamento' : 'promemoria'}: ${r.description}`).join(' + ');
        AudioSynth.play('success');
        showToast(`Riconosciuto: ${summary}`, 'success');
      } else {
        AudioSynth.play('friction');
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
    return results.length ? results : null;
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
  _extractTime(text) {
    const m = text.match(/\balle?\s+(\d{1,2})(?:[:.](\d{2}))?\b/i) || text.match(/\bat\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i);
    if (!m) return null;
    let hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
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
      let cleanDesc = textNoTime.replace(/\b(ricorda(mi)?|promemoria|sveglia|alarm|remind|reminder|schedule|calendar|calendario|fissa|appuntamento|appointment|meeting|ho|hai|un|una|uno|il|lo|la|di|da|dal|dalla|dallo|con|per|alle|alla|al|delle|della|prossimo|prossima|me|to|the|of|my|call|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|domani|dopodomani|oggi|stasera|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b/gi, '').trim();
      cleanDesc = cleanDesc.replace(/\b\d+([.,]\d{1,2})?\s*(euro|dollari|dollars|usd|eur|e|cent|centesimi)?\b/gi, '');
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
        .replace(/\b\d+([.,]\d{1,2})?\s*(euro|eur|€|dollari|usd)?\b/gi, ' ')
        .replace(/\b(di|del|della|dello|dei|degli|delle|la|lo|il|per|a|da)\b/gi, ' ')
        .replace(/[^a-zA-Z0-9\sàèéìòùÀÈÉÌÒÙ]/g, '')
        .replace(/\s+/g, ' ').trim();
      if (d.length > 0) d = d.charAt(0).toUpperCase() + d.slice(1);
      return { intent: 'split', amount: amt, description: d, people };
    }

    let amount = this.extractAmount(lowerNoTime);
    if (!amount) return null;

    let type = 'uscita';
    if (['stipendio', 'entrata', 'guadagnato', 'salary', 'earned', 'income', 'received', 'got paid', 'paid me', 'payment received', 'i earned', 'accredito', 'accreditati'].some(w => lower.includes(w))) type = 'entrata';
    // "messo da parte" spesso NON è contiguo ("ho messo 100 euro da parte"):
    // si riconosce anche il pattern "messo/metto ... da parte" e il solo
    // "da parte"/"accanton" come segnale di risparmio.
    else if (['etf', 'investito', 'crypto', 'invest', 'invested', 'stocks', 'risparmio', 'risparmiato', 'accantonato', 'accantonare', 'saving', 'savings', 'saved', 'set aside', 'put aside'].some(w => lower.includes(w))
             || /\bda parte\b/.test(lower) || /\bmess[oa]\b.*\bparte\b/.test(lower)) type = 'invest';

    let desc = textNoTime;
    desc = desc.replace(/\b\d+([.,]\d{1,2})?\s*(euro|dollari|dollars|usd|eur|e|cent|centesimi)?\b/gi, '');
    desc = desc.replace(/\b\d+\s*(euro|dollari|dollars|usd|eur|e)\s*(e|and)?\s*\d{1,2}\b/gi, '');

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
      'bought', 'spent', 'paid', 'purchased', 'got', 'for', 'a', 'an', 'per', 'in', 'su', 'da', 'di', 'con', 'ho',
      'investito', 'messo', 'invested', 'put', 'into', 'on', 'stipendio', 'salary', 'entrata', 'income', 'guadagnato', 'earned',
      'ricevuto', 'received', 'extra',
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
    if (desc.length > 0) {
      desc = desc.charAt(0).toUpperCase() + desc.slice(1);
    }

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
      return parseFloat(match[1].replace(',', '.'));
    }
    
    const phraseMatch = text.match(/\b(\d+)\s*(euro|dollari|dollars|usd|eur|e)\s*(e|and)?\s*(\d{1,2})\b/i);
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


export { VoiceCore, FUZZY_AMOUNTS, VoiceParser };
