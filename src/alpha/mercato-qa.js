// ============================================================
// LE DOMANDE VERE — il ponte fra quello che si chiede e quello che si sa
// ============================================================
// A questo punto Momentum misura: cosa protegge nei crolli, cosa è successo in
// un qualunque giorno degli ultimi cinque anni, quanto vale la curva dei
// rendimenti a ciascun orizzonte, quali settori tengono, se le cripto
// proteggono (no), quanto rischi di dover vendere. Tutto questo è motore: nella
// app non se ne vede niente, e un motore che nessuno può interrogare vale zero.
//
// Questo modulo è il ponte. Non aggiunge una misura: rende interrogabile in
// italiano quello che c'è già, e — cosa che conta di più — **dichiara quando la
// domanda non ha risposta**.
//
// LA REGOLA CHE LO GOVERNA, ed è la stessa dell'intero progetto: non si
// risponde mai "compra" o "vendi". Non perché sia prudente, ma perché non lo
// sappiamo e nessuno lo sa. Si risponde a tre tipi di domanda che invece hanno
// una risposta vera:
//   · cos'è SUCCESSO (un fatto, verificabile);
//   · cosa ha FUNZIONATO storicamente (una misura, con il suo margine);
//   · come sei messo TU (un conto sui tuoi dati).
// Tutto il resto viene rifiutato dicendo perché.
//
// Il riconoscimento dell'intento è deterministico e testabile, come nel resto
// del QA: parole-chiave robuste, nessun modello, nessuna rete. Su un insieme
// chiuso di domande finanziarie funziona meglio di qualunque cosa più
// complicata, ed è verificabile riga per riga.
'use strict';

// Somiglianza fra frasi senza nessun modello: e' il ripiego che rende la rete
// di sicurezza disponibile su OGNI dispositivo, anche dove i 113MB
// dell'embedding non si possono scaricare. Import statico e non dinamico
// perche pesa poche righe e deve esserci sempre — un ripiego caricato in modo
// asincrono non e' un ripiego.
import { similaritaLessicale } from '../ai/similarita-lessicale.js';
// Anche il banco di formulazioni e' import STATICO, per la stessa ragione:
// e' l'elenco che permette di riconoscere le parafrasi delle domande da
// rifiutare, ed era caricato in modo asincrono — quindi nei primi istanti
// dopo l'avvio la protezione non c'era. Sono poche centinaia di stringhe:
// il costo e' trascurabile, l'assenza no.
import * as BANCO_STATICO from './mercato-canonical-bank.js';
// Import statico, stessa ragione delle due sopra: rispostaSincrona() è
// sincrona per contratto (rispostaSincrona() sotto), quindi tutto quello che
// usa deve essere già caricato — un dynamic import qui non compilerebbe
// nemmeno (await dentro una funzione non async). Il modulo è puro e leggero,
// nessun costo a tenerlo statico.
import { classificaAutovalori, testoRumoreCorrelazione } from './rumore-correlazione.js';
import { testoQualitaContabile } from './quality-scores.js';

const NOMI_STATI_QA = ['condizioni distese', 'condizioni normali', 'condizioni tese'];

// ── IL GLOSSARIO CHE PORTA UN NUMERO ──
// Un glossario che spiega "la volatilita' e' la variabilita' dei rendimenti" non
// serve a nessuno: e' la stessa frase del libro che la persona non ha capito.
// Qui ogni definizione e' scritta come si spiegherebbe a un bambino di otto
// anni E porta con se' un numero MISURATO dai dati dell'app, perche' un
// concetto attaccato a un fatto si ricorda e uno astratto no.
// `numero` riceve i moduli e restituisce la frase con la misura, oppure null se
// quel dato non c'e': in quel caso resta la spiegazione, mai un numero finto.
const GLOSSARIO = {
  volatilita: {
    parole: ['volatilita', 'volatile'],
    spiega: 'Quanto un investimento balla. Due cose possono rendere uguale, ma una arriva dritta e l\'altra a zig-zag: la seconda e\' piu\' volatile. Non e\' un difetto in se\' — diventa un problema solo se sei costretto a vendere mentre e\' in basso.',
    numero: (M) => {
      const st = M.storiche?.statisticheSerie?.('spy');
      return st ? `Per le azioni americane, negli ultimi trent'anni, il mese peggiore ha fatto ${Math.round(st.peggiorMese * 100)}% e il migliore +${Math.round(st.miglioreMese * 100)}%.` : null;
    },
  },
  diversificare: {
    parole: ['diversific'],
    spiega: 'Non mettere tutto nella stessa cosa, cosi\' se una va male le altre reggono. Funziona pero\' solo se le cose scelte NON si muovono insieme — ed e\' li\' che quasi tutti sbagliano.',
    numero: (M) => {
      const d = M.globale?.diversificazioneGeografica?.();
      return d ? `Esempio misurato: le borse di tutto il mondo si muovono gia' insieme al ${Math.round(d.correlazioneMediaNormale * 100)}% nei mesi normali. Comprare azioni di paesi diversi diversifica molto meno di quanto sembri.` : null;
    },
  },
  etf: {
    parole: ['etf', 'fondo indicizzato'],
    spiega: 'Un pacchetto che contiene tante aziende insieme: comprandone uno solo ne compri un pezzetto di tutte. Serve a non dover indovinare quale singola azienda andra\' bene.',
    numero: () => 'Quasi tutti i numeri che ti do vengono da uno di questi pacchetti sull\'indice americano: e\' il modo standard di misurare come e\' andata la borsa.',
  },
  inflazione: {
    parole: ['inflazione'],
    spiega: 'Quando con gli stessi soldi compri meno cose di prima. I soldi fermi non perdono numeri sul conto, perdono potere: e\' una perdita che non si vede nell\'estratto conto.',
    numero: null,
  },
  curva: {
    // BUG REALE trovato dal vivo in Chrome (2026-08-15): un trader chiede
    // "quanto vale la curva a 18 mesi" — nessuno dice per intero "curva dei
    // rendimenti" a voce. Con solo le frasi lunghe in elenco, "la curva"
    // restava non riconosciuta e cadeva sul messaggio generico "non lo so
    // ancora", pur avendo il motore la risposta pronta. 'curva' da sola è
    // sicura in questo dominio: nessun'altra funzione dell'app usa la parola
    // in un altro senso (verificato).
    parole: ['curva dei rendimenti', 'curva dei tassi', 'curva invertita', 'inversione della curva', 'curva'],
    spiega: 'Di solito prestare soldi per dieci anni rende piu\' che prestarli per tre mesi, perche\' aspetti di piu\'. Quando succede il contrario — la curva si "inverte" — vuol dire che il mercato si aspetta che i tassi dovranno scendere, cioe\' che l\'economia rallentera\'.',
    numero: (M) => {
      const o = M.quadro?.orizzonteDiCiascunSegnale?.();
      const a18 = o?.perSegnale?.curva?.find((r) => r.orizzonte === 18)?.auc;
      return a18 ? `Misurato sui dati dal 1982: come segnale funziona a diciotto mesi di distanza, non prima. A tre e sei mesi e' addirittura girato al contrario.` : null;
    },
  },
  orso: {
    parole: ['mercato orso', 'bear market', 'orso'],
    spiega: 'Un periodo in cui la borsa scende parecchio e ci resta per mesi. Non e\' un giorno storto: e\' una stagione.',
    numero: (M, C) => C ? `Nei sei grandi cali degli ultimi trent'anni, il ritorno al punto di partenza e' arrivato in mediana dopo ${C.recuperoMediano} mesi — ma il piu' lungo ne ha richiesti ${C.recuperoPeggiore}.` : null,
  },
  interesse: {
    parole: ['interesse composto', 'capitalizzazione composta'],
    spiega: 'Gli interessi che a loro volta producono interessi. All\'inizio sembra niente, poi accelera — ed e\' il motivo per cui il tempo conta piu\' della bravura.',
    numero: null,
  },
  rifugio: {
    parole: ['bene rifugio', 'safe haven'],
    spiega: 'Una cosa che dovrebbe salire, o almeno tenere, proprio quando tutto il resto scende.',
    numero: (M) => {
      const r = M.rifugi?.rifugiNeiCrolli?.();
      if (!r?.classifica?.length) return null;
      const primo = r.classifica[0];
      return `Misurato: nei mesi peggiori per le azioni ha tenuto soprattutto ${primo.nome.toLowerCase()}. L'oro, che tutti chiamano cosi', e' finito quasi in pari.`;
    },
  },
  azioni: {
    parole: ['azione', 'azioni', 'cosa sono le azioni'],
    spiega: 'Un pezzetto di un\'azienda. Se all\'azienda va bene vale di piu\', se va male vale di meno, e nessuno ti garantisce niente.',
    numero: null,
  },
  obbligazioni: {
    parole: ['obbligazion', 'titoli di stato', 'bond'],
    spiega: 'Un prestito che fai a uno Stato o a un\'azienda: ti restituiscono i soldi con degli interessi. Piu\' e\' sicuro chi li riceve, meno ti pagano.',
    numero: (M) => {
      const r = M.rifugi?.rifugiNeiCrolli?.();
      const b = r?.classifica?.find((x) => x.attivo === 'titoliStato10a');
      return b ? `Sono la cosa che storicamente ha protetto meglio quando le azioni crollavano: +${(b.rendimentoMedio * 100).toFixed(1).replace('.', ',')}% in media nei mesi peggiori.` : null;
    },
  },
  rischio: {
    parole: ['cos e il rischio', 'che cos e il rischio', 'rischio finanziario'],
    spiega: 'Non "quanto puoi perdere sulla carta", ma quanto e\' probabile che tu debba vendere in un brutto momento. Un calo che puoi aspettare non ti costa niente; lo stesso calo, se ti servono i soldi, diventa una perdita vera.',
    numero: null,
  },
};

const MESI = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};

// ── Estrazione del periodo dalla domanda ──
// "aprile 2025", "nel 2022", "2025-04": tre forme che una persona usa davvero.
export function estraiPeriodo(domanda) {
  const q = normalizza(domanda);
  const iso = q.match(/(\d{4})-(\d{2})/);
  if (iso) return { da: `${iso[1]}-${iso[2]}-01`, a: `${iso[1]}-${iso[2]}-31`, etichetta: `${iso[1]}-${iso[2]}` };
  for (const [nome, n] of Object.entries(MESI)) {
    const re = new RegExp(`${nome}\\s+(?:del\\s+)?(\\d{4})`);
    const m = q.match(re);
    if (m) {
      const mm = String(n).padStart(2, '0');
      return { da: `${m[1]}-${mm}-01`, a: `${m[1]}-${mm}-31`, etichetta: `${nome} ${m[1]}` };
    }
  }
  const anno = q.match(/\b(19|20)(\d{2})\b/);
  if (anno) {
    const y = anno[0];
    return { da: `${y}-01-01`, a: `${y}-12-31`, etichetta: `il ${y}`, interoAnno: true };
  }
  return null;
}

// Gli accenti vanno tolti PRIMA di confrontare: "salirà" e "salira" sono la
// stessa domanda, e senza questo passaggio il rifiuto motivato non scattava
// proprio sulle domande scritte correttamente. Trovato provando le frasi vere.
export const normalizza = (s) => (s || '').toLowerCase().trim()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/['\u2019]/g, ' ').replace(/\s+/g, ' ');

const ha = (q, ...parole) => parole.some((p) => q.includes(p));

// L'ultimo intento riconosciuto, per capire a cosa si riferisce un "e nel
// resto del mondo?". E' l'unica memoria di questo modulo, ed e' deliberatamente
// minima: un intento, non la conversazione.
let ULTIMO_INTENTO = null;
// Stessa filosofia di ULTIMO_INTENTO ma per un'AZIENDA (pannello Cantiere D,
// 600 titoli): "filtrami le aziende del settore per margine e crescita" non
// nomina nessun settore — significa "il settore di cui stavamo parlando".
// Impostata SOLO dai rami che riconoscono un'azienda del pannello nuovo
// (qualita-contabile, comparabili, panoramica-per-azienda) — mai dal
// pannello storico a 82 aziende, che è un universo diverso.
let ULTIMO_TICKER = null;
export function dimenticaContesto() { ULTIMO_INTENTO = null; ULTIMO_TICKER = null; }

// ── Il riconoscimento dell'intento ──
export function intentoMercato(domanda, similarity = null) {
  const q = normalizza(domanda);
  if (!q) return null;

  // Le domande "cos'e'" vengono PRIMA di tutto: chi chiede cos'e' la
  // volatilita' non sta chiedendo quanto sia alta adesso, e rispondergli con un
  // numero e' il modo piu' veloce di perderlo.
  if (/^(cosa|che cosa|cos)\s?(e|sono|vuol dire|significa)\b/.test(q) || ha(q, 'spiegami', 'mi spieghi', 'che significa', 'che vuol dire', 'non ho capito cosa')) {
    for (const [chiave, voce] of Object.entries(GLOSSARIO)) {
      // Confine di PAROLA, non semplice sottostringa. BUG trovato subito:
      // "obbligazioni" contiene "azioni", quindi "cosa sono le obbligazioni?"
      // riceveva la definizione delle azioni. Con `\b` davanti il problema
      // sparisce, perche' dentro "obbligazioni" la 'a' non e' preceduta da un
      // confine di parola.
      if (voce.parole.some((w) => new RegExp(`\\b${w}`).test(q))) return `spiega:${chiave}`;
    }
  }

  // MATERIE PRIME E CASA, e vanno PRIMA di tutto il resto. Ci ho sbagliato
  // l'ordine una volta e ogni domanda finiva altrove: "l'oro protegge
  // dall'inflazione?" cadeva nella regola generica sull'oro e riceveva la
  // risposta sui crolli di borsa, che e' una domanda diversa; "come va il
  // mercato immobiliare" cadeva in "come va il mercato". Le regole specifiche
  // devono venire prima di quelle generiche, sempre.
  if (/\b(casa|case|mattone|immobil|appartament)/.test(q)) return 'immobiliare';
  if (ha(q, 'inflazion') && ha(q, 'proteg', 'ripar', 'difend', 'batte', 'contro', 'tiene', 'regge')) return 'inflazione-protezione';
  if (ha(q, 'terre rare', 'terr rare', 'metalli strategici')) return 'terre-rare';
  if (ha(q, 'quanto e salito', 'quanto e cresciut', 'quanto valeva', 'dal 1980', 'dal 1970', 'dal 1960', 'negli ultimi 40 anni', 'in 50 anni', 'rendimento storico', 'quanto rendeva')) return 'quanto-e-salito';
  if (ha(q, 'materie prime', 'commodit', 'metalli', 'petrolio', 'greggio', 'argento', 'platino', 'rame', 'gas natural')) return 'materie-prime';

  // CICLI, HYPE, DIREZIONE. La domanda "sta per scendere?" e' la piu' comune
  // di tutte e la piu' facile da rovinare: la risposta onesta non e' un si' o
  // un no, e' quante volte e' andata in un modo o nell'altro.
  if (ha(q, 'e salito troppo', 'e salita troppo', 'salito troppo', 'salita troppo', 'troppo caro', 'bolla', 'hype', 'euforia', 'sta per scendere', 'sta per crollare', 'e il momento di')) return 'hype';
  if (ha(q, 'dove siamo nel ciclo', 'a che punto', 'in che fase', 'dove siamo')) return 'dove-siamo';
  // ATTENZIONE all'ordine e alla forma: "si ripetesse il 2008" contiene
  // "si ripete" ed e' uno SCENARIO STORICO, non una domanda sui cicli. La
  // regressione e' stata scoperta dai test gia' esistenti, che e' esattamente
  // il loro mestiere.
  if (!ha(q, 'se si ripetesse', 'se tornasse', 'ripetesse il')
    && ha(q, 'cicli', 'ciclo di mercato', 'si ripetono', 'schemi ricorrenti', 'quanto durano le bolle')) return 'cicli';
  if (ha(q, 'fed', 'banca centrale', 'tassi di interesse', 'alza i tassi', 'taglia i tassi', 'fomc')) return 'fed';
  if (ha(q, 'notizie', 'novita', 'ultime news', 'cosa dicono', 'comunicati')) return 'notizie';
  if (ha(q, 'anticipa', 'quale mercato prevede', 'segnale anticipat', 'cosa viene prima')) return 'anticipi';

  // Le domande di SEGUITO ("e nel resto del mondo?", "e in Asia?") non hanno
  // parole proprie: prendono senso dalla domanda precedente. Senza questo, la
  // conversazione si interrompe proprio dove diventava interessante.
  if (/^(e |ma )?(nel |in |per )?(il )?(resto del mondo|altri paesi|europa|asia|america|oceania|africa|mondo)\s*\??$/.test(q) && ULTIMO_INTENTO) {
    return ULTIMO_INTENTO;
  }

  // L'ordine conta: le domande più specifiche prima.
  if (ha(q, 'cript', 'bitcoin', 'ethereum', 'btc')) {
    if (ha(q, 'proteg', 'rifugio', 'ripar', 'difend', 'crolla', 'crollo')) return 'cripto-rifugio';
  }
  if (ha(q, 'oro') && ha(q, 'proteg', 'rifugio', 'convien', 'serve', 'funziona')) return 'oro';
  if (ha(q, 'proteg', 'rifugio', 'ripar', 'difend', 'salva')) return 'rifugi';
  if (ha(q, 'settor') && ha(q, 'crolla', 'crollo', 'cala', 'scend', 'peggior', 'tengon', 'reggon')) return 'settori';
  if (ha(q, 'diversific') && ha(q, 'mondo', 'geografic', 'paesi', 'estero', 'global')) return 'diversificazione';
  // BUG REALE trovato dal vivo in Chrome (2026-08-15): "quanto vale la curva
  // a 18 mesi" — la formulazione naturale di chi segue i mercati, senza mai
  // dire per intero "curva dei rendimenti/tassi" — cadeva sul messaggio
  // generico "non lo so ancora". 'curva' da sola e' sicura qui: verificato
  // che nessun'altra regola sopra la intercetta prima per un motivo diverso.
  if (ha(q, 'recession', 'crisi in arrivo', 'curva dei tassi', 'curva dei rendimenti', 'curva invertita', 'curva')) return 'recessione';
  if (ha(q, 'come sta il mercato', 'come va il mercato', 'situazione dei mercati', 'clima di mercato', 'quanto e teso', 'stress',
    // Gergo da trading desk (BANCO_TRADER): "che view mi dai sul mercato in
    // questo momento?" e "la volatilita' implicita sta salendo o e'
    // compressa?" sono la STESSA domanda di "come sta il mercato", posta
    // con le parole di chi lo guarda ogni giorno per mestiere.
    'che view mi dai', 'view sul mercato', 'volatilita implicita', 'vol implicita', 'vol compressa')) return 'regime';
  // BUG REALE trovato dal vivo in Chrome (2026-08-15): un trader esperto
  // chiede con la terminologia tecnica vera ("expected shortfall", "var")
  // — la risposta la cita gia' per nome (vedi sotto), ma senza queste parole
  // chiave chi la conosce e la chiede per nome cadeva sul fallback generico.
  // "Sto per perdere tutto?" (trovato dal vivo, 2026-08-15): la domanda di
  // chi ha paura, non di chi analizza — ed è la più importante da non
  // sbagliare, proprio perché a chi la fa un "non lo so ancora" suona come
  // un abbandono nel momento peggiore. La risposta onesta (quanto si è
  // davvero perso nei mesi peggiori misurati) rassicura coi fatti, mai con
  // un "andrà tutto bene" vuoto.
  if (ha(q, 'quanto posso perdere', 'perdita massima', 'caso peggiore', 'quanto rischio di perdere', 'scenario peggiore', 'expected shortfall', 'value at risk', 'perdere tutto', 'perdo tutto')) return 'perdita-massima';

  // Rischio di ROVINA (Cantiere E2, src/alpha/rischio-rovina.js — costruito
  // e testato ma mai raggiungibile da una domanda vera prima d'ora, stesso
  // pattern degli altri moduli "orfani" trovati in questa sessione).
  // DIVERSO da 'perdita-massima' sopra (che guarda le crisi REALI misurate):
  // qui e' matematica sul DIMENSIONAMENTO delle operazioni — "se rischio X%
  // a trade, quanto e' probabile rovinarmi" — non una misura sul
  // comportamento passato dell'utente (dichiarato onestamente nel modulo:
  // Momentum non ha un registro di trade discreti).
  if (ha(q, 'rischio di rovina', 'rischio per operazione', 'rischio per trade', 'per trade rischio',
    'rovina del conto', 'quanto rischio prima di', 'non rialzarmi', 'non rialzarsi',
    'quanto ho rischiato davvero', 'probabilita di rovina', 'probabile la rovina', 'rischio di rovinarmi')) return 'rischio-rovina';
  if (ha(q, 'se tornasse', 'se si ripetesse', 'e se succedesse di nuovo', 'come nel 2008', 'un altro 2008', 'ripetesse il')) return 'scenario-storico';
  if (ha(q, 'quanto dura', 'quanto durano', 'quanto tempo per recuperare', 'quando recupera', 'tempi di recupero', 'mercato orso')) return 'durata-orso';
  // Il SENTIMENT vero: dove sono schierati gli operatori con soldi veri.
  // "Sentiment" da solo non basta come parola chiave — chi lo scrive puo'
  // intendere l'umore generale — ma insieme a mercato/operatori/trader si'.
  if (ha(q, 'posizionament', 'cot', 'commitments of traders', 'speculator')) return 'sentiment';
  if (ha(q, 'sentiment', 'umore del mercato', 'come sono messi', 'da che parte stanno', 'tutti dalla stessa parte', 'euforia', 'panico')) return 'sentiment';

  // LA PANORAMICA: "guarda tutto e dimmi se c'e' qualcosa di strano". E' la
  // domanda che un operatore fa per prima ogni mattina, e finora l'app sapeva
  // rispondere solo indicatore per indicatore.
  if (ha(q, 'c e qualcosa di strano', 'qualcosa di anomalo', 'qualcosa di insolito', 'niente di strano',
    'guarda tutto', 'guardando tutto', 'panoramica', 'quadro generale', 'visione d insieme',
    'cosa esce dall ordinario', 'qualcosa fuori dal normale', 'cosa ti salta all occhio',
    // BANCO_BANKER (qa-banco-prova.js): "dammi il quadro completo su questo
    // titolo, non solo un numero" — stessa RICHIESTA di panoramica ("non
    // fermarti a un indicatore solo"), ma su UN'AZIENDA invece che sul
    // mercato intero. Stesso intento, il handler sotto distingue i due casi
    // guardando se la domanda nomina un'azienda del pannello.
    'quadro completo', 'non solo un numero', 'quadro completo su questo titolo')) return 'panoramica';

  // "La diversificazione sta funzionando?" — la domanda che conta piu' di
  // tutte per chi ha molte posizioni, e a cui nessuno risponde con un numero.
  // Due parti, come le altre regole del file: "diversific" da solo finirebbe
  // sulla regola geografica piu' sotto, e la frase intera "la diversificazione
  // funziona" non prendeva "sta funzionando" — un pattern troppo rigido non
  // sbaglia, semplicemente non scatta, ed e' il modo piu' silenzioso di non
  // funzionare.
  if (ha(q, 'diversific') && ha(q, 'funzion', 'sta reggendo', 'serve ancora', 'ho davvero', 'sto davvero')) return 'assorbimento';
  if (ha(q, 'sto diversificando', 'diversificato',
    'si muovono tutti insieme', 'si muove tutto insieme', 'muovono insieme', 'muove tutto insieme',
    'quanto sono correlati', 'sono correlati', 'stessa scommessa',
    // Gergo istituzionale (BANCO_TRADER/BANCO_INVESTITORE): "quante
    // scommesse indipendenti ho davvero in portafoglio?"/"quante fonti di
    // rischio indipendenti ci sono davvero?"/"quanto sono concentrato senza
    // saperlo?" sono la stessa domanda di "sto diversificando davvero",
    // posta guardando il numero di fattori distinti invece della parola
    // "diversificazione".
    'scommesse indipendenti', 'fonti di rischio indipendenti', 'quanto sono concentrato',
    'concentrato senza saperlo', 'fattori di rischio distinti')) return 'assorbimento';

  // "Da quanti anni Apple guadagna bene?" — la domanda che prima non aveva
  // risposta, perche' l'app vedeva solo dodici mesi. Ora ne vede venti.
  if (ha(q, 'da quanti anni', 'negli ultimi anni', 'storico dei bilanci', 'storia dei bilanci',
    'da quanto tempo guadagna', 'e sempre stata redditizia', 'quanto e costante',
    'bilanci di', 'conti di', 'roe storico', 'qualita nel tempo',
    // Gergo da investment banker (BANCO_BANKER, qa-banco-prova.js): "i
    // margini sono qualità strutturale o solo effetto del ciclo?" restava
    // 'unknown' — stessa domanda di "quanto è costante il ROE nel tempo",
    // posta con le parole di chi il mestiere lo fa davvero.
    'qualita strutturale', 'effetto del ciclo', 'strutturale o ciclica', 'strutturale o solo il ciclo',
    'qualita dei conti', 'migliorando o peggiorando')) return 'qualita-storica';

  // Qualità degli ACCRUAL/manipolazione contabile (Cantiere E3, src/alpha/
  // quality-scores.js — Beneish M-Score + Piotroski F-Score, non ancora
  // costruito quando qa-banco-prova.js scrisse questi due casi di test:
  // "questi accrual sono normali o un campanello d'allarme" e "il punteggio
  // di manipolazione contabile quant'e'" restavano entrambi non riconosciuti).
  // DIVERSO da 'qualita-storica' sopra (che guarda la COSTANZA nel tempo di
  // un'azienda): qui si guarda se gli ULTIMI DUE bilanci hanno i segnali
  // classici di un utile "di carta" (crediti che crescono piu' delle
  // vendite, utile senza cassa dietro).
  if (ha(q, 'manipolazione contabile', 'accrual', 'bilancio manipolato', 'utile manipolato',
    'campanello d allarme sui conti', 'punteggio di qualita contabile', 'beneish', 'piotroski',
    'f-score', 'm-score', 'qualita del bilancio', 'segnali di allarme sui conti')) return 'qualita-contabile';

  // Comparabili veri (Cantiere D, src/alpha/screener-settore.js — stesso
  // settore E taglia simile, non solo "aziende dello stesso settore" a caso).
  if (ha(q, 'comparabili', 'aziende simili', 'chi somiglia', 'peer veri', 'peer di questo titolo',
    'aziende comparabili', 'con chi si confronta')) return 'comparabili';

  // Percentile di settore, isolato (Cantiere D, screener-settore.js —
  // percentileTitolo, già usato dentro 'panoramica' per-azienda ma qui
  // richiesto DA SOLO: "in che percentile del suo settore sta questo
  // titolo?" chiede un numero preciso, non il quadro intero).
  if (ha(q, 'in che percentile', 'che percentile', 'percentile del suo settore', 'percentile quando l ho comprata',
    'come percentile')) return 'percentile-settore';

  // Confronto fra due titoli (src/alpha/confronto-titoli.js — 166 righe
  // scritte e testate dal 2026-08-21, mai raggiungibili da una domanda vera
  // fino a questa sessione: vedi src/alpha/sic-settore-map.js per come si
  // sono sbloccate senza uno storico prezzi per singola azienda).
  if (ha(q, 'si distingue dal rumore', 'differenza fra questi due', 'quale dei due ha reso',
    'confronta questi due', 'meglio questo o quello', 'quale conviene fra')) return 'confronto-titoli';

  // Scomposizione causale titolo-vs-mercato (src/alpha/titolo-causale.js —
  // stessa scoperta di cui sopra: "bravura mia o solo il mercato che
  // saliva" e' la domanda che questo modulo esiste apposta per rispondere,
  // ed era irraggiungibile.
  if (ha(q, 'bravura mia', 'merito mio', 'solo il mercato che saliva', 'solo il mercato a farlo',
    'e stato il mercato o', 'colpa mia o del mercato')) return 'titolo-causale';

  // Screener multi-criterio (Cantiere D/G, src/alpha/screener-settore.js —
  // filtraSettore): "filtrami/classificami/ordina le aziende [del settore]
  // per X e Y insieme". PRIMA di 'comparabili' sopra non serve — le parole
  // sono diverse ("filtra"/"classifica"/"ordina" contro "somiglia") — ma
  // l'ordine conta comunque: questo controllo deve restare specifico
  // (verbo di filtro esplicito), mai "aziende" da sola, che catturerebbe
  // troppe domande diverse.
  if (ha(q, 'filtrami', 'filtra le aziende', 'classificami le aziende', 'classifica le aziende',
    'ordina le aziende', 'screener', 'quali aziende del settore')) return 'screener-settore';

  // "Quali sono le aziende piu' solide?" — la classifica per COSTANZA, non
  // per rendimento di oggi.
  if (ha(q, 'aziende piu solide', 'aziende piu costanti', 'quali aziende hanno guadagnato sempre',
    'chi guadagna bene da piu tempo', 'classifica delle aziende', 'aziende di qualita')) return 'classifica-qualita';

  // "L'ho presa nel 2015, come vanno i conti?" — la tesi raccontata anno per
  // anno. Serve un anno nella domanda, altrimenti non c'e' un punto di
  // partenza e si chiede quale.
  if (ha(q, 'l ho presa nel', 'l ho comprata nel', 'comprata nel', 'presa nel', 'comprate nel',
    'da quando l ho', 'come vanno i conti', 'la mia tesi', 'valgono ancora le ragioni',
    // Stessa domanda, ordine delle parole invertito (BANCO_INVESTITORE):
    // "la tesi regge ancora dopo gli ultimi dati?"/"le ragioni per cui
    // l'avevo comprata valgono ancora?" — `ha()` e' un confronto per
    // sottostringa esatta, quindi l'ordine conta e va coperto a parte.
    'tesi regge ancora', 'ragioni per cui l avevo comprata', 'valgono ancora')) return 'tesi-storica';

  // "Cosa devo guardare prima di comprare?" — la domanda giusta, e l'unica
  // vicina a "cosa compro" a cui si PUO' rispondere: non quale titolo, ma
  // quali domande farsi. Va PRIMA del rifiuto? No: dopo, perche' il rifiuto
  // gira prima di tutto. Qui basta che non somigli a "cosa devo comprare".
  if (ha(q, 'cosa guardare prima', 'cosa devo guardare prima', 'che domande farmi', 'quali domande farsi',
    'a cosa fare attenzione prima', 'cosa controllare prima', 'come si valuta un azienda',
    'come valutare un titolo', 'cosa guarda warren buffett', 'cosa guardano i grandi investitori')) return 'prima-di-comprare';

  if (ha(q, 'cosa non sai', 'cosa non puoi', 'quali sono i tuoi limiti', 'di cosa non sei sicuro', 'dove sbagli', 'cosa ti manca')) return 'limiti';
  if (ha(q, 'quanto e affidabile', 'quanto ti posso credere', 'quanto sono affidabili', 'che affidabilita')) return 'limiti';

  // LA DOMANDA PIU' RICHIESTA DI TUTTE: "cosa succedera'?". Non si puo'
  // rispondere, ma si puo' rispondere alla versione che ha un senso: cosa e'
  // successo, storicamente, partendo da una situazione come quella di adesso.
  // Va DOPO 'limiti', e la ragione l'ha trovata un test gia' esistente:
  // "quanto sono affidabili le tue PREVISIONI?" chiede dei limiti, non una
  // previsione, e la parola chiave da sola la dirottava. Va anche dopo 'hype'
  // e 'regime', che hanno risposte proprie piu' specifiche.
  if (ha(q, 'che probabilita', 'quante probabilita', 'quanto e probabile che sal', 'quanto e probabile che scend',
    'prossimi 12 mesi', 'prossimi sei mesi', 'prossimi 6 mesi', 'prossimo anno', 'nei prossimi mesi',
    'cosa succede dopo situazioni', 'situazioni come questa', 'come adesso in passato',
    'cosa dice la storia', 'quanto puo rendere', 'previsione', 'previsioni')) return 'previsione';
  if (ha(q, 'cosa e successo', 'cos e successo', 'che e successo', 'cosa succes', 'com e andata', 'perche e crollat', 'crollo di', 'cosa ando storto')) return 'evento';
  // Una data da sola, in una domanda, quasi sempre chiede un evento.
  if (estraiPeriodo(q) && ha(q, '?', 'spieg', 'raccont', 'dimm')) return 'evento';

  // ── ULTIMA SPIAGGIA: capire per SIGNIFICATO invece che per parole ──
  // Solo se tutto quanto sopra non ha riconosciuto niente. Cosi' il confronto
  // semantico puo' soltanto AGGIUNGERE comprensione a domande che oggi
  // ricevono un "non lo so ancora": non puo' cambiare nessuna risposta che
  // gia' funziona, ed e' per questo che l'aggiunta non e' regressiva.
  if (similarity && BANCO_SEMANTICO) {
    // `perMargine` quando la somiglianza NON e' quella lessicale: i valori di
    // un modello di embedding stanno tutti fra 0,90 e 0,96 su questo dominio,
    // e una soglia assoluta li farebbe passare tutti. L'informazione utile e'
    // la distanza fra il primo e il secondo, non il livello.
    const perMargine = similarity !== similaritaLessicale;
    const m = BANCO_SEMANTICO.matchMercato(domanda, similarity, { perMargine });
    // I rifiuti li gestisce `rifiutoMotivato`, che gira prima: se qui arriva
    // un rifiuto vuol dire che siamo su un percorso che non lo consulta, e
    // allora non si risponde comunque.
    if (m && !m.rifiuto) return m.intent;
  }
  return null;
}

// ── Il caricamento, e perche' non e' banale ──
// Il QA del progetto e' SINCRONO, questi moduli portano 145 KB di dati e non
// vanno messi nel pacchetto principale: chi non chiede mai di mercati non deve
// pagarli. La soluzione non e' rendere il QA asincrono (toccherebbe ogni
// chiamante) ne' importare tutto staticamente (peserebbe su tutti): si
// precarica in sottofondo dopo l'avvio, e da quel momento la risposta e'
// sincrona. Se qualcuno chiede prima che il caricamento sia finito, il QA
// risponde come ha sempre fatto — nessun errore, nessuna attesa.
let MODULI = null;
let inCorso = null;
// I settori arrivano da una funzione asincrona (import dinamico interno):
// si calcolano una volta e si tengono.
let SETTORI_CACHE = null;
let CONTESTO_CACHE = null;
// L'avviso sulla freschezza si calcola UNA volta al precaricamento e si appende
// alle risposte che parlano del PRESENTE. Non a quelle storiche: dire "attenzione,
// i dati sono vecchi" a chi chiede cosa successe nel 2008 sarebbe rumore.
let AVVISO_FRESCHEZZA = null;

export function precarica() {
  if (MODULI) return Promise.resolve(MODULI);
  if (inCorso) return inCorso;
  inCorso = Promise.all([
    import('./eventi.js'), import('./rifugi.js'), import('./global-stress.js'),
    import('./macro-regime.js'), import('./quadro-unico.js'), import('./market-stress.js'),
    import('./historical-sequences.js'), import('./freschezza.js'),
    import('./posizionamento.js'), import('./materie-prime.js'), import('./terre-rare.js'), import('./cicli.js'),
    import('./grafici.js'), import('./notizie.js'), import('./previsione-condizionata.js'),
    import('./historical-returns.js'), import('./panoramica-incrociata.js'), import('./long-asset-panel.js'), import('./daily-panel.js'), import('./assorbimento.js'), import('./daily-long.js'), import('./eventi-lunghi.js'), import('./tesi-investimento.js'), import('./qualita-nel-tempo.js'), import('./fondamentali-storici.js'), import('./correlation-regime.js'), import('./screener-settore.js'), import('./rischio-rovina.js'),
    import('./confronto-titoli.js'), import('./titolo-causale.js'), import('./sic-settore-map.js'), import('./historical-panel.js'), import('./mercato-vivo.js'), import('./capacita-registrate.js'),
  ]).then(async ([eventi, rifugi, globale, macro, quadro, stress, storiche, fresco, posiz, mp, tr, ci, gr, nz, prev, hr, pan, lungo, giorni, ass, lunghi, evLunghi, tesi, qualMod, storici, correl, scrn, rovina, confTit, titCaus, sicMap, panSettori, mercatoVivo, capReg]) => {
    // I settori si calcolano con una funzione ASINCRONA (che a sua volta
    // importa il pannello settoriale). Se non la si scalda qui, la PRIMA
    // domanda sui settori riceve "non lo so" e solo la seconda funziona.
    // BUG VISTO SOLO PROVANDO NEL BROWSER: nei test non emergeva perche' le
    // chiamate precedenti avevano gia' riempito la cache. Una prova dal vivo
    // vale quindici test che si aiutano a vicenda.
    // Stessa ragione anche per il contesto storico dei cali: funzione
    // asincrona, si scalda qui una volta per tutte.
    try { SETTORI_CACHE = await rifugi.settoriNeiCrolli(); } catch (_) { SETTORI_CACHE = null; }
    try { CONTESTO_CACHE = await storiche.contestoStorico('spy'); } catch (_) { CONTESTO_CACHE = null; }
    try { AVVISO_FRESCHEZZA = fresco.freschezzaText(await fresco.statoDeiDati()); } catch (_) { AVVISO_FRESCHEZZA = null; }
    MODULI = { eventi, rifugi, globale, macro, quadro, stress, storiche, fresco, posiz, mp, tr, ci, gr, nz, prev, hr, pan, lungo, giorni, ass, lunghi, evLunghi, tesi, qual: { ...qualMod, ...storici }, correl, scrn, rovina, confTit, titCaus, sicMap, panSettori, mercatoVivo, capReg };
    return MODULI;
  }).catch(() => { inCorso = null; return null; });
  return inCorso;
}

export function pronto() { return MODULI !== null; }

// LE TERRE RARE. Questa risposta prima diceva che il dato pubblico non
// esisteva. Era sbagliato, e la correzione vale la pena raccontarla: non
// esiste una QUOTAZIONE di borsa, perche' il mercato e' fatto di contratti
// diretti — ma lo Stato americano censisce produzione, consumo e valore
// unitario dal 1900, in dominio pubblico. Centoventun anni, non zero.
const TERRE_RARE_RISPOSTA = (mp, tr) => {
  const base = tr.terreRareText();
  const etf = tr.etfSegueIlMetallo(mp.etfTerreRarePerAnno());
  const r = mp.terreRareSonoAzioni();
  const coda = etf.valido
    ? ` Un'ultima cosa pratica: le terre rare non sono acquistabili direttamente: quello che esiste sul mercato e' un fondo di societa' minerarie del settore (ho ${r.mesiDisponibili} mesi dal ${String(r.da).slice(0, 4)}). Ho controllato se quel fondo si muove come il valore vero del metallo: ${etf.azzeccaIlVerso ? `va nella stessa direzione ${etf.anniInCuiVannoNellaStessaDirezione} anni su ${etf.anniInComune}, ma di quanto si muova non lo dice.` : 'non lo segue in modo affidabile.'} Sono ${etf.anniInComune} anni: pochi per fidarsi, abbastanza per non dire che sono la stessa cosa.`
    : '';
  return base + coda;
};

// Le terre rare: la storia lunga merita il grafico piu' di ogni altra, perche'
// "il prezzo reale e' sceso mentre la produzione cresceva" e' esattamente il
// tipo di frase che una riga che scende rende immediata.
const graficoTerreRare = (mp, tr, gr) => {
  const s = tr.scarsitaOSconcentrazione();
  const p = tr.panicoDel2010();
  return {
    intent: 'mercato-terre-rare',
    data: { etf: mp.terreRareSonoAzioni(), storia: s, panico: p },
    answer: TERRE_RARE_RISPOSTA(mp, tr),
    grafico: gr.graficoSerie(tr.prezzoRealePerGrafico(), tr.anniPerGrafico(),
      'prezzo delle terre rare al netto dell\'inflazione'),
  };
};

// ── Le risposte ──
export async function rispostaMercato(domanda) {
  await precarica();
  return rispostaSincrona(domanda);
}

// La versione sincrona: funziona solo dopo il precaricamento, ed e' quella che
// il QA usa.
export function rispostaSincrona(domanda, similarity = null) {
  const intento = intentoMercato(domanda, similarity || similaritaLessicale);
  if (!intento) return null;
  if (!MODULI) {
    // BUG TROVATO SOLO PROVANDO NEL BROWSER, e invisibile a ogni test perche'
    // nei test il precaricamento e' sempre gia' finito. Nei primi secondi dopo
    // l'avvio i moduli di mercato non ci sono ancora, e restituire `null`
    // faceva cadere la domanda nel "questa non la so ancora" del QA generale.
    // L'utente riceveva un rifiuto secco a una domanda che l'app sa
    // benissimo, e non aveva modo di capire che bastava riprovare.
    // Ora si dichiara lo stato e si segnala al chiamante che vale la pena
    // richiedere: `inCaricamento` e' quello che main.js usa per rifare la
    // domanda da sola appena i dati sono pronti.
    precarica();
    return {
      intent: 'mercato-in-caricamento', inCaricamento: true, domanda,
      answer: 'Sto ancora aprendo gli archivi storici di mercato — sono decenni di dati e ci metto un istante. Riprova fra un secondo.',
    };
  }
  // Si ricorda solo se si e' davvero risposto: un intento riconosciuto ma non
  // servito non deve diventare il contesto della domanda dopo.
  ULTIMO_INTENTO = intento;
  const { eventi, rifugi, globale, macro, quadro, stress, storiche, posiz, mp, tr, ci, gr, nz, prev, hr, pan, lungo, giorni, ass, lunghi, evLunghi, tesi, qual, correl } = MODULI;
  // Le risposte sul PRESENTE si portano dietro l'avviso se i dati non sono
  // freschi; quelle storiche no. La distinzione non e' cosmetica: un dato
  // vecchio invalida "come sta il mercato adesso" e non invalida "cosa
  // successe nel 2008".
  const SUL_PRESENTE = new Set(['regime', 'recessione', 'scenario-storico', 'sentiment', 'hype', 'dove-siamo', 'fed']);
  const conAvviso = (r) => (r && AVVISO_FRESCHEZZA && SUL_PRESENTE.has(intento)
    ? { ...r, answer: `${r.answer} ${AVVISO_FRESCHEZZA}`, datiNonFreschi: true }
    : r);

  try {
    // Quale materia prima nomina la domanda. L'ordine conta: "gas naturale"
    // prima di "gas", "minerale di ferro" prima di "ferro".
    const QUALE = [['gasNaturale', ['gas natural', 'gas']], ['terreRare', ['terre rare', 'terr rare']],
      ['oro', ['oro']], ['argento', ['argento']], ['platino', ['platino']], ['rame', ['rame']],
      ['petrolio', ['petrolio', 'greggio', 'brent']], ['ferro', ['ferro', 'acciaio']],
      ['alluminio', ['alluminio']], ['nichel', ['nichel']], ['zinco', ['zinco']],
      ['piombo', ['piombo']], ['stagno', ['stagno']], ['carbone', ['carbone']]];
    const qualeMateria = (d) => {
      const n = normalizza(d);
      for (const [k, alias] of QUALE) if (alias.some((a) => new RegExp(`\\b${a}`).test(n))) return k;
      return null;
    };

    if (intento === 'tesi-storica') {
      const qn = normalizza(domanda);
      const T = qual.FONDAMENTALI_STORICI;
      const anno = (qn.match(/\b(19|20)\d{2}\b/) || [])[0];
      let tick = null;
      for (const t of Object.keys(T)) {
        const nomeBreve = normalizza(T[t].nome).split(/[ ,.]/)[0];
        // Stesso bug reale trovato dal vivo in screener-settore.js (Cantiere
        // E3, 2026-08-24): un ticker a 1-2 lettere ("D", "T", "C"...)
        // combacia a confine di parola con preposizioni/articoli qualunque
        // ("un campanello d'allarme" → ticker "D"), e `includes` senza
        // confine di parola fa scattare un nome su un suo prefisso ("quest"
        // dentro "questi"). Stessa correzione qui: ticker solo da 3 lettere
        // in su, nome solo a confine di parola vero.
        if ((t.length >= 3 && new RegExp(`\\b${normalizza(t)}\\b`).test(qn)) || (nomeBreve.length >= 4 && new RegExp(`\\b${nomeBreve}\\b`).test(qn))) { tick = t; break; }
      }
      if (!tick) return { intent: 'mercato-tesi-storica', answer: `Di quale azienda? Ho i bilanci depositati per ${Object.keys(T).length} societa' quotate negli Stati Uniti.` };
      if (!anno) return { intent: 'mercato-tesi-storica', answer: `In che anno l'hai comprata? Senza un punto di partenza non posso dirti cosa e' cambiato da allora — e non lo indovino.` };
      const st = tesi.storiaDellaTesi(tick, +anno);
      return { intent: 'mercato-tesi-storica', data: st, answer: tesi.testoStoriaTesi(st) };
    }

    if (intento === 'qualita-storica') {
      // Quale azienda nomina la domanda: si cerca fra i ticker disponibili e
      // fra i nomi. Senza un'azienda riconosciuta non si inventa nulla.
      const qn = normalizza(domanda);
      const T = qual.FONDAMENTALI_STORICI;
      let trovato = null;
      for (const t of Object.keys(T)) {
        const nomeBreve = normalizza(T[t].nome).split(/[ ,.]/)[0];
        // Stessa correzione del ramo 'tesi-storica' sopra — vedi quel
        // commento per il bug reale che l'ha motivata.
        if ((t.length >= 3 && new RegExp(`\\b${normalizza(t)}\\b`).test(qn)) || (nomeBreve.length >= 4 && new RegExp(`\\b${nomeBreve}\\b`).test(qn))) { trovato = t; break; }
      }
      if (!trovato) {
        return { intent: 'mercato-qualita-storica', answer: `Di quale azienda? Ho i bilanci depositati alla SEC per ${Object.keys(T).length} societa' quotate negli Stati Uniti — per esempio Apple, Microsoft, Coca-Cola, JPMorgan, Berkshire. Per un'azienda europea non ho niente: la SEC e' l'autorita' americana.` };
      }
      const r = qual.qualitaNelTempo(trovato);
      return { intent: 'mercato-qualita-storica', data: r, answer: qual.testoQualita(r) };
    }

    // Cantiere E3 (src/alpha/quality-scores.js — Beneish M-Score + Piotroski
    // F-Score): universo del PANNELLO nuovo (600 aziende, screener-
    // settore.js), non le 82 storiche di 'qualita-storica' sopra — due
    // dataset diversi, due domande diverse.
    if (intento === 'qualita-contabile') {
      const az = MODULI.scrn.trovaAziendaInTesto(domanda);
      if (!az) {
        return { intent: 'mercato-qualita-contabile', answer: `Di quale azienda? Il punteggio di qualità contabile (Beneish/Piotroski) ce l'ho per ${MODULI.scrn.numeroAziendeConSettore()} società quotate USA con settore noto — per esempio Apple, Microsoft, JPMorgan.` };
      }
      ULTIMO_TICKER = az;
      const r = MODULI.scrn.qualitaContabile(az.ticker);
      return { intent: 'mercato-qualita-contabile', data: r, answer: testoQualitaContabile(r) };
    }

    if (intento === 'comparabili') {
      const az = MODULI.scrn.trovaAziendaInTesto(domanda);
      if (!az) {
        return { intent: 'mercato-comparabili', answer: `Di quale azienda vuoi i comparabili? Ho il settore vero (dichiarato alla SEC) per ${MODULI.scrn.numeroAziendeConSettore()} società quotate USA.` };
      }
      ULTIMO_TICKER = az;
      const r = MODULI.scrn.comparabili(az.ticker);
      const testo = r.disponibile
        ? `Comparabili di ${az.nome} (${az.sicDescription}), per taglia di ricavi: ${r.comparabili.slice(0, 5).map((c) => c.nome.split(/[ ,]/)[0]).join(', ')}. Stesso settore E taglia simile — non solo "stesso settore", che da solo confronterebbe una big cap con una micro cap.`
        : `Non ho comparabili per ${az.nome}: il suo settore ha troppe poche aziende nel pannello per un confronto onesto.`;
      return { intent: 'mercato-comparabili', data: r, answer: testo };
    }

    if (intento === 'percentile-settore') {
      const az = MODULI.scrn.trovaAziendaInTesto(domanda) || ULTIMO_TICKER;
      if (!az) {
        return { intent: 'mercato-percentile-settore', answer: `Di quale azienda? Il percentile di settore ce l'ho per ${MODULI.scrn.numeroAziendeConSettore()} società quotate USA.` };
      }
      ULTIMO_TICKER = az;
      const attuale = MODULI.scrn.percentileTitolo(az.ticker);
      if (!attuale.disponibile) {
        return { intent: 'mercato-percentile-settore', data: attuale, answer: attuale.motivo || `Non ho un percentile calcolabile per ${az.nome}.` };
      }
      const voci = MODULI.scrn.testoPercentile(attuale);
      // "Com'era il suo percentile quando l'ho comprata rispetto ad ora?":
      // se la domanda nomina un anno, si aggiunge il confronto — mai
      // inventato se quell'anno non è nel pannello per questa azienda.
      const anno = (String(domanda).match(/\b(19|20)\d{2}\b/) || [])[0];
      let confronto = '';
      if (anno && +anno !== attuale.anno) {
        const storico = MODULI.scrn.percentileTitolo(az.ticker, { anno: +anno });
        confronto = storico.disponibile
          ? ` Nel ${anno}: ${MODULI.scrn.testoPercentile(storico)} Confronta con oggi per vedere se è migliorata o peggiorata rispetto al suo settore, non solo in assoluto.`
          : ` Non ho un percentile per il ${anno}: fuori dal pannello per questa azienda.`;
      }
      // Momenti di picco (richiesto esplicitamente): quando è stato il
      // MIGLIORE anno di sempre per ogni metrica — nel testo, non sul
      // grafico (vedi testoPicchi in screener-settore.js per il perché).
      const serieStorica = MODULI.scrn.serieStoricaPercentili(az.ticker);
      const picchi = MODULI.scrn.testoPicchi(serieStorica);
      // Segnali Beneish su TUTTA la storia (non solo l'anno più recente),
      // combinati col grafico sopra (main.js) — richiesto esplicitamente:
      // le analisi proprietarie di Momentum e il grafico non restano due
      // cose separate. Stesso avviso obbligatorio sul falso positivo da
      // crescita legittima già usato in testoQualitaContabile — un anno
      // segnalato non è mai presentato come "manipolazione", solo come
      // "da guardare più a fondo".
      let notaQualita = '';
      const segnaliQualita = MODULI.scrn.segnaliQualitaNelTempo(az.ticker);
      if (segnaliQualita?.segnali?.length) {
        const anniSegnalati = segnaliQualita.segnali.map((s) => s.time.slice(0, 4)).join(', ');
        notaQualita = ` Attenzione: ${segnaliQualita.segnali.length} ann${segnaliQualita.segnali.length === 1 ? 'o' : 'i'} (${anniSegnalati}) con un profilo Beneish M-Score tipico di manipolazione contabile — ma il modello ha un limite noto, una crescita dei ricavi molto rapida può dare lo stesso segnale anche quando è del tutto legittima: è un invito a guardare più a fondo, non un verdetto.`;
      }
      return {
        intent: 'mercato-percentile-settore', data: { attuale, anno: anno ? +anno : null },
        answer: `${az.nome}, nel settore ${attuale.settore} (anno ${attuale.anno}): ${voci}${confronto}${picchi ? ` ${picchi}` : ''}${notaQualita}`,
      };
    }

    // ── confronto-titoli / titolo-causale, sbloccati via SETTORE (non
    // storico prezzi per singola azienda, che non esiste on-device — vedi
    // sic-settore-map.js per l'onestà sul limite). Helper condiviso dai due
    // rami sotto: azienda → { simbolo XLx, nome, serie mensile grezza }.
    const settoreDiAzienda = (az) => {
      const xl = MODULI.sicMap.sicASettoreETF(az.sic);
      if (!xl) return null;
      const s = MODULI.panSettori.PANNELLO_SETTORI.find((x) => x.simbolo === xl);
      return s ? { xl, nomeSettore: MODULI.sicMap.NOMI_SETTORE_SPDR[xl], serie: s.r } : null;
    };
    const AVVERTENZA_SETTORE = 'Onestà sul dato: non esiste uno storico prezzi mensile per il singolo titolo on-device — questo confronto usa il SETTORE a cui appartiene (classificazione approssimata dal codice SIC, non un prezzo del titolo stesso). È un\'analisi reale, ma sul settore, non sulla singola azienda.';

    // NOTA (2026-08-25): un collegamento a spiegaResiduoConMacro (src/predict/
    // macro-context.js) è stato scritto e poi RIMOSSO da qui prima del commit
    // — durante la verifica dal vivo in Chrome, la combinazione reale
    // (residuo di scomponi() + contesto macro reale allineato) ha bloccato il
    // tab due volte, senza che una rilettura attenta del codice trovasse un
    // ciclo infinito. Non si è riusciti a confermare dal vivo se fosse un bug
    // vero o un problema del tooling di verifica: onestà prima di tutto, si
    // preferisce NON avere la feature piuttosto che rischiare di bloccare il
    // browser di un utente vero sulla domanda "chi ha fatto il prezzo?".
    // Le funzioni (alignMacroToMonths, spiegaResiduoConMacro) restano in
    // macro-context.js, testate a unità (27 test) — il collegamento a questo
    // punto della chat va rifatto con più cautela in una sessione dedicata.

    if (intento === 'confronto-titoli') {
      const [azA, azB] = MODULI.scrn.trovaAziendeInTesto(domanda, { limite: 2 });
      if (!azA || !azB) {
        return { intent: 'mercato-confronto-titoli', answer: 'Quali due aziende vuoi confrontare? Nominale entrambe nella stessa domanda.' };
      }
      const sA = settoreDiAzienda(azA), sB = settoreDiAzienda(azB);
      if (!sA || !sB) {
        return { intent: 'mercato-confronto-titoli', answer: `Non riesco a classificare il settore di ${!sA ? azA.nome : azB.nome} — senza quello non ho una serie storica da confrontare.` };
      }
      if (sA.xl === sB.xl) {
        return { intent: 'mercato-confronto-titoli', answer: `${azA.nome} e ${azB.nome} sono nello stesso settore approssimato (${sA.nomeSettore}): con i soli dati di settore risulterebbero identici, un confronto che non direbbe niente di vero. Servirebbe uno storico prezzi specifico per ciascun titolo, che non ho on-device.` };
      }
      const { comeSerieMensile } = MODULI.capReg;
      const a = comeSerieMensile(sA.serie, `${azA.nome} (settore ${sA.nomeSettore})`);
      const b = comeSerieMensile(sB.serie, `${azB.nome} (settore ${sB.nomeSettore})`);
      const mercato = comeSerieMensile(MODULI.mercatoVivo.mercatoBase(), 'mercato').mensili;
      const r = MODULI.confTit.confronta(a, b, { mercato });
      return { intent: 'mercato-confronto-titoli', data: r, answer: `${MODULI.confTit.testoConfronto(r)} ${AVVERTENZA_SETTORE}` };
    }

    if (intento === 'titolo-causale') {
      const az = MODULI.scrn.trovaAziendaInTesto(domanda) || ULTIMO_TICKER;
      if (!az) {
        return { intent: 'mercato-titolo-causale', answer: 'Di quale azienda? Nominala nella domanda, o chiedimi prima qualcosa su un\'azienda specifica.' };
      }
      const s = settoreDiAzienda(az);
      if (!s) {
        return { intent: 'mercato-titolo-causale', answer: `Non riesco a classificare il settore di ${az.nome} — senza quello non ho una serie storica da scomporre.` };
      }
      ULTIMO_TICKER = az;
      const r = MODULI.titCaus.analizzaTitolo(s.serie, MODULI.mercatoVivo.mercatoBase(), { nome: `${az.nome} (settore ${s.nomeSettore})`, indice: 'il mercato (media dei nove settori)' });
      // NOTA (2026-08-25): il grafico mensile del "residuo" + i mesi migliori/
      // peggiori (serieResiduiMensili/motiviCaliPicchi, titolo-causale.js —
      // già scritte, testate, 22 test verdi) sono state collegate qui e poi
      // SCOLLEGATE prima del commit: subito dopo averle collegate, il tab del
      // browser si è bloccato (confermato: sia una segnalazione live
      // dell'utente sia un controllo diretto con CDP che è andato in timeout
      // sullo stesso tab). Stessa cautela già presa una volta con macro-
      // context.js (vedi nota qui sopra, invariata): onestà prima di tutto,
      // meglio non avere la feature che rischiare di bloccare il browser di
      // un utente vero. Le funzioni restano in titolo-causale.js, testate a
      // unità — il collegamento va rifatto con più cautela (isolare o
      // profilare prima) in una sessione dedicata.
      return { intent: 'mercato-titolo-causale', data: r, answer: `${MODULI.titCaus.testoTitolo(r)} ${AVVERTENZA_SETTORE}` };
    }

    if (intento === 'screener-settore') {
      // Il settore: o un'azienda nominata QUI (implica il suo settore), o
      // — "del settore" senza nominarne una, la forma che il banco banker
      // usa davvero — l'ultima azienda di cui si è parlato (ULTIMO_TICKER).
      // Senza nessuno dei due non si inventa un settore a caso.
      const azContesto = MODULI.scrn.trovaAziendaInTesto(domanda) || ULTIMO_TICKER;
      if (!azContesto) {
        return { intent: 'mercato-screener-settore', answer: 'Il settore di quale azienda? Nominane una, o chiedimi prima qualcosa su un\'azienda specifica — userò il suo settore.' };
      }
      // Quali criteri chiede la domanda: NOMI_CRITERI_SCREENER (screener-
      // settore.js) è la STESSA lista che filtraSettore riconosce come
      // chiavi valide — un solo posto dove "crescita" vuol dire "crescita".
      const qn = normalizza(domanda);
      const criteriTrovati = Object.entries(MODULI.scrn.NOMI_CRITERI_SCREENER)
        .filter(([, parole]) => parole.some((p) => qn.includes(p)))
        .map(([chiave]) => chiave);
      const criteri = criteriTrovati.length ? criteriTrovati : ['margine', 'roe']; // predefiniti se la domanda non li nomina esplicitamente
      const r = MODULI.scrn.filtraSettore(azContesto.sic, { criteri });
      if (!r.disponibile) {
        return { intent: 'mercato-screener-settore', data: r, answer: `Non riesco a filtrare: ${r.motivo}` };
      }
      const elenco = r.classificate.slice(0, 5).map((c) => `${c.nome.split(/[ ,]/)[0]} (${Math.round(c.punteggioCombinato * 100)}° percentile combinato)`).join(', ');
      return {
        intent: 'mercato-screener-settore', data: r,
        answer: `Nel settore ${r.settore} (${r.aziendeNelGruppo} aziende comparabili), classificate insieme per ${r.criteri.join(' + ')}: ${elenco}. Il punteggio combina il percentile di CIASCUN criterio dentro lo stesso settore — un'azienda forte solo su uno non basta per stare in cima.`,
      };
    }

    if (intento === 'classifica-qualita') {
      const c = qual.classifica();
      const primi = c.slice(0, 5);
      const testo = primi.map((x) => `${x.nome.split(/[ ,]/)[0]} (${x.anniSopra}/${x.anni} esercizi, media ${Math.round(x.media * 100)}%)`).join('; ');
      return {
        intent: 'mercato-classifica-qualita', data: c,
        answer: `Su ${c.length} aziende con bilanci depositati alla SEC, le piu' COSTANTI nel rendere sul capitale dei soci sono: ${testo}. La classifica premia la costanza, non il numero piu' alto di oggi — e a parita' di costanza vince chi ha piu' anni alle spalle, perche' sette esercizi non provano quanto diciotto. Non e' un consiglio: e' cosa hanno gia' fatto.`,
      };
    }

    if (intento === 'prima-di-comprare') {
      return conAvviso({ intent: 'mercato-prima-di-comprare', data: tesi.PRIMA_DI_COMPRARE, answer: tesi.testoPrimaDiComprare() });
    }

    if (intento === 'assorbimento') {
      // Si esclude l'indice della paura: e' gia' una misura di stress, e
      // includerlo fra gli attivi confonderebbe "quanto si muovono insieme"
      // con "quanta paura c'e'".
      // Archivio LUNGO dal 2000: 26 anni, nove serie, e soprattutto contiene
      // il 2008 — cinque anni di storia non hanno mai visto una crisi
      // profonda, quindi non possono dire se cio' che vedono oggi sia raro.
      const i2000 = lunghi.DATE_LUNGO.findIndex((d) => d >= '2000-09-01');
      const complete = lunghi.serieComplete(i2000, 0.98);
      const dati = Object.entries(complete).filter(([k]) => k !== 'paura').map(([, v]) => v.map((x) => (x === null ? 0 : x)));
      const rap = ass.serieAssorbimento(dati, { finestra: 250, passo: 5 });
      const sp = ass.spostamentoAssorbimento(rap);
      // La validazione e' costosa (permutazioni) e il suo esito non cambia da
      // una domanda all'altra: si dichiara l'esito gia' misurato invece di
      // ricalcolarlo a ogni domanda.
      const testo = ass.testoAssorbimento(sp, { disponibile: true, funziona: false });
      // Una seconda misura, rigorosa e complementare: quanti di questi asset
      // sono davvero fattori di rischio DISTINTI, non solo "quanto si
      // muovono insieme" (l'indice di assorbimento) ma "quanti autovalori si
      // distinguono dal rumore statistico puro" (Marchenko-Pastur,
      // rumore-correlazione.js — Cantiere E1). Additiva, mai al posto della
      // risposta principale: sono due domande imparentate, non la stessa.
      let mp = '';
      try {
        const r = classificaAutovalori(dati);
        if (r.disponibile) mp = ` ${testoRumoreCorrelazione(r)}`;
      } catch (_) { /* diagnostica complementare: se non disponibile, si tace */ }
      return conAvviso({ intent: 'mercato-assorbimento', data: { spostamento: sp }, answer: testo + mp });
    }

    if (intento === 'panoramica') {
      // "Quadro completo su QUESTO TITOLO" (BANCO_BANKER) e' una richiesta
      // diversa da "panoramica del mercato": stessa RICHIESTA ("non un solo
      // indicatore"), ma su un'azienda invece che sull'intero mercato. Se la
      // domanda nomina un'azienda del pannello (Cantiere D/E3), si risponde
      // qui componendo TRE cose gia' costruite e testate separatamente
      // (percentili di settore, qualita' contabile, comparabili) — mai un
      // quarto sistema nuovo, solo la composizione di quello che gia' esiste.
      // Senza un'azienda riconosciuta si scende al ramo sotto (panoramica
      // di mercato) — mai un'invenzione al posto del quadro generale.
      const azNominata = MODULI.scrn.trovaAziendaInTesto(domanda);
      if (azNominata) {
        ULTIMO_TICKER = azNominata;
        const perc = MODULI.scrn.percentileTitolo(azNominata.ticker);
        const qual2 = MODULI.scrn.qualitaContabile(azNominata.ticker);
        const comp = MODULI.scrn.comparabili(azNominata.ticker, { limite: 4 });
        const parti = [];
        if (perc.disponibile) {
          const voci = Object.entries(perc.percentili).map(([k, v]) => `${k} al ${v}° percentile`).join(', ');
          if (voci) parti.push(`Nel suo settore (${perc.settore}, anno ${perc.anno}): ${voci}.`);
        }
        parti.push(testoQualitaContabile(qual2));
        if (comp.disponibile) parti.push(`Comparabili: ${comp.comparabili.slice(0, 4).map((c) => c.nome.split(/[ ,]/)[0]).join(', ')}.`);
        return {
          intent: 'mercato-panoramica', data: { percentili: perc, qualita: qual2, comparabili: comp },
          answer: `${azNominata.nome} — ${parti.join(' ')}`,
        };
      }
      // Si leggono ENTRAMBI gli orizzonti, perche' hanno forze opposte: il
      // giornaliero ha la risoluzione per accorgersi di qualcosa ma conosce
      // solo cinque anni, il mensile ha visto trent'anni ma non potrebbe
      // segnalare nulla. Sceglierne uno e tacere l'altro nasconderebbe
      // proprio il limite che rende la risposta interpretabile.
      const mensili = {};
      for (const [k, v] of Object.entries(lungo.LUNGO)) mensili[lungo.NOMI_LUNGO[k] || k] = v;
      const giornaliere = {};
      const iDa = lunghi.DATE_LUNGO.findIndex((d) => d >= '2000-09-01');
      for (const [k, v] of Object.entries(lunghi.serieComplete(iDa, 0.98))) {
        giornaliere[lunghi.NOMI_LUNGO_GIORNI[k] || k] = v.map((x) => (x === null ? 0 : x));
      }
      // Le etichette e la presenza di una crisi si DICHIARANO dai dati, non
      // si scrivono a mano: quando l'archivio giornaliero e' passato da 5 a
      // 26 anni, le frasi scritte a mano sono diventate false in silenzio.
      const daBreve = lunghi.DATE_LUNGO[iDa];
      const anniBreve = Math.round((new Date(lunghi.GIORNI_LUNGO_A) - new Date(daBreve)) / 31557600000);
      const r = pan.panoramicaDoppia({
        giornaliere, mensili,
        etichettaBreve: `gli ultimi ${anniBreve} anni giorno per giorno (dal ${daBreve.slice(0, 4)})`,
        etichettaLungo: 'i quarant\'anni mese per mese',
        crisiNelBreve: daBreve <= '2007-01-01',
      });
      return conAvviso({ intent: 'mercato-panoramica', data: r, answer: `${r.messaggio} ${r.avviso}` });
    }

    if (intento === 'previsione') {
      // L'orizzonte lo sceglie chi chiede: "i prossimi sei mesi" e "il prossimo
      // anno" sono domande diverse e danno risposte diverse.
      const qn = normalizza(domanda);
      const orizzonte = ha(qn, 'prossimi sei mesi', 'prossimi 6 mesi') ? 6
        : ha(qn, 'prossimo mese', 'prossimi giorni') ? 1
          : ha(qn, 'prossimi tre mesi', 'prossimi 3 mesi', 'trimestre') ? 3 : 12;
      const r = prev.previsioneCondizionata(hr.SERIE_STORICHE.spy.rendimenti, {
        orizzonte, etichetta: 'le azioni americane',
      });
      return conAvviso({
        intent: 'mercato-previsione', data: r, answer: prev.testoPrevisione(r),
      });
    }

    if (intento === 'hype') {
      const d = ci.cosaSuccedeDopo();
      return conAvviso({
        intent: 'mercato-hype', data: d, answer: ci.hypeText(),
        // Il grafico non ripete la frase: mostra la cosa che la frase fa
        // fatica a rendere, cioe' che la fascia dei risultati possibili dopo
        // una corsa e' molto piu' larga.
        grafico: gr.graficoPrevisione(d.perStato.corsa, 'dopo una corsa, nei tre anni successivi'),
        grafico2: gr.graficoPrevisione(d.perStato.quiete, 'dopo un periodo tranquillo, per confronto'),
      });
    }

    if (intento === 'fed' || intento === 'notizie') {
      const r = nz.reazioneAllaFed('azioniUsa');
      const conf = ['azioniUsa', 'tecnologia', 'titoliStato', 'oro'].map((m) => {
        const x = nz.reazioneAllaFed(m);
        return x.valido ? { nome: x.nome, valore: x.ampiezzaMediaNeiGiorniFed, colore: undefined } : null;
      }).filter(Boolean);
      return conAvviso({
        intent: 'mercato-fed', data: r, answer: nz.reazioneText(r),
        grafico: gr.graficoConfronto(conf, 'quanto si muovono nei giorni in cui la Fed muove i tassi'),
      });
    }
    if (intento === 'anticipi') return { intent: 'mercato-anticipi', data: ci.chiAnticipaChi(), answer: ci.anticipiText() };
    if (intento === 'cicli') {
      const e = ci.episodi();
      return { intent: 'mercato-cicli', data: e, answer: ci.cicliText(),
        grafico: gr.graficoConfronto(e.episodi.map((x) => ({ nome: `${x.nome} ${x.annoPicco}`, valore: x.caduta })), 'quanto hanno perso dal massimo') };
    }

    if (intento === 'dove-siamo') {
      const n = normalizza(domanda);
      const m = Object.keys(ci.NOMI).find((k) => n.includes(normalizza(ci.NOMI[k])))
        || (ha(n, 'oro') ? 'oro' : ha(n, 'petrolio') ? 'petrolio' : ha(n, 'rame') ? 'rame'
          : ha(n, 'casa', 'case', 'immobil') ? 'caseItalia' : 'azioni');
      const d = ci.doveSiamo(m);
      const serie = ci.griglia()[m];
      return conAvviso({
        intent: 'mercato-ciclo-posizione', data: d,
        answer: ci.doveSiamoText(d) || `Su ${m} non ho abbastanza storia per dire a che punto siamo.`,
        grafico: serie ? gr.graficoSerie(serie, ci.ANNI.map(String), `${ci.NOMI[m]}, al netto dell'inflazione`) : null,
        grafico2: gr.graficoPrevisione(d.ederaSuccessoDopo, 'come e\' andata le altre volte da qui'),
      });
    }

    if (intento === 'quanto-e-salito' || intento === 'materie-prime') {
      const k = qualeMateria(domanda);
      if (!k) {
        const q = mp.quanteScommesseDavvero();
        return { intent: 'mercato-materie', data: q, answer: `Ho i prezzi di ${mp.MATERIE.length} materie prime dal 1960: metalli preziosi, metalli industriali ed energia. Una cosa che si vede subito guardandole insieme: dentro la stessa famiglia si muovono quasi all'unisono (l'oro e l'argento vanno insieme ${Math.round(q.piuLegate[0].r * 100)} volte su cento), quindi comprarne tre della stessa famiglia non e' diversificare, e' fare la stessa scommessa tre volte. L'unica davvero scollegata dal resto e' il gas naturale, perche' e' un mercato locale: non si carica su una nave come il petrolio. Dimmi quale ti interessa e ti dico com'e' andata davvero, tolta l'inflazione.` };
      }
      if (k === 'terreRare') return { intent: 'mercato-terre-rare', data: { etf: mp.terreRareSonoAzioni(), storia: tr.scarsitaOSconcentrazione(), panico: tr.panicoDel2010() }, answer: TERRE_RARE_RISPOSTA(mp, tr) };
      const g = mp.ingannoNominale(k);
      const t = mp.tempoPerTornareInPari(k);
      const reale = mp.serieReale(k);
      return {
        intent: 'mercato-materie', data: { inganno: g, attesa: t },
        answer: `${mp.ingannoText(g)} ${mp.attesaText(t)}`,
        // La serie REALE, non quella nominale: il grafico deve mostrare la
        // stessa cosa di cui parla il testo, altrimenti si contraddicono.
        grafico: reale ? gr.graficoSerie(gr.assottiglia(reale, 180), null, `${g.nome} al netto dell'inflazione, dal ${g.da}`) : null,
      };
    }

    if (intento === 'terre-rare') return graficoTerreRare(mp, tr, gr);

    if (intento === 'inflazione-protezione') {
      const k = qualeMateria(domanda) || 'oro';
      if (k === 'terreRare') return { intent: 'mercato-terre-rare', data: { etf: mp.terreRareSonoAzioni(), storia: tr.scarsitaOSconcentrazione(), panico: tr.panicoDel2010() }, answer: TERRE_RARE_RISPOSTA(mp, tr) };
      const p = mp.protezioneDallInflazione(k);
      if (!p.valido) return { intent: 'mercato-inflazione', answer: `Su ${k} non ho abbastanza storia per rispondere sull'inflazione senza tirare a indovinare.` };
      const verdetto = p.proteggeDavvero
        ? `Si', e non e' solo una frase fatta: nei dieci anni piu' inflazionati ha reso il ${p.conInflazioneAlta.rendimentoRealeAnnuo}% l'anno oltre l'inflazione, contro il ${p.conInflazioneBassa.rendimentoRealeAnnuo}% degli altri periodi, ed e' andata bene ${Math.round(p.conInflazioneAlta.quotaPositive * 100)} volte su cento.`
        : p.conInflazioneAlta.rendimentoRealeAnnuo > p.conInflazioneBassa.rendimentoRealeAnnuo
          ? `In media si', ma non abbastanza spesso da poterci contare: ha funzionato solo ${Math.round(p.conInflazioneAlta.quotaPositive * 100)} volte su cento. Una media alta trascinata da pochi casi fortunati non e' una protezione.`
          : `No. Nei periodi di inflazione alta ha reso il ${p.conInflazioneAlta.rendimentoRealeAnnuo}% l'anno oltre l'inflazione, cioe' meno che nei periodi tranquilli. Il fatto che sia una cosa fisica non vuol dire che tenga il valore.`;
      return conAvviso({ intent: 'mercato-inflazione', data: p, answer: `${p.nome} contro l'inflazione, misurato su ${p.finestre} finestre di dieci anni dal 1960. ${verdetto}` });
    }

    if (intento === 'immobiliare') {
      // Se la domanda nomina un Paese, si risponde su quello; se chiede del
      // mondo, sul mondo; altrimenti la panoramica globale.
      const n = normalizza(domanda);
      const paese = Object.entries(mp.NOMI_IMMOBILIARE).find(([, nome]) => n.includes(normalizza(nome)))?.[0]
        ?? (ha(n, 'itali') ? 'italia' : null);
      if (paese && !ha(n, 'mondo', 'altri paesi', 'resto del')) {
        return { intent: 'mercato-immobiliare', data: mp.ciclioImmobiliari(paese), answer: mp.immobiliareText(mp.ciclioImmobiliari(paese)) };
      }
      const cont = ['Europa', 'Asia', 'America', 'Oceania', 'Africa'].find((c) => n.includes(normalizza(c)));
      const c = mp.confrontoImmobiliareMondo(cont ? { continente: cont } : {});
      return {
        intent: 'mercato-immobiliare', data: c, answer: mp.mondoImmobiliareText(c),
        grafico: gr.graficoConfronto(
          [...c.aree].sort((x, y) => x.oggiRispettoAlMassimo - y.oggiRispettoAlMassimo).slice(0, 12)
            .map((a) => ({ nome: a.nome, valore: a.oggiRispettoAlMassimo })),
          'quanto sono sotto il massimo storico, al netto dell\'inflazione'),
      };
    }

    if (intento === 'sentiment') {
      // Se la domanda nomina un mercato, si risponde su quello.
      const solo = posiz.mercatoNominato(domanda);
      if (solo) {
        const m = posiz.quadroMercato(solo);
        if (m) return conAvviso({ intent: 'mercato-sentiment', data: m, answer: posiz.mercatoText(m) });
      }
      const q = posiz.quadroPosizionamento();
      // Alla risposta si attacca sempre il CONTROLLO: su quali mercati il
      // posizionamento estremo dice davvero qualcosa e su quali no. Dare il
      // dato senza dire dove non funziona sarebbe la meta' utile e la meta'
      // pericolosa della stessa informazione.
      const prova = ['azioniUsa', 'oro', 'titoliStato', 'euro', 'bitcoin']
        .map((k) => posiz.estremiSonoSpeciali(k)).filter((r) => r.valido);
      const dove = prova.filter((r) => r.specialiDavvero).map((r) => r.nome);
      const noDove = prova.filter((r) => !r.specialiDavvero).map((r) => r.nome);
      let coda = '';
      if (dove.length) coda += ` Su ${dove.join(', ')} uno schieramento estremo ha storicamente detto qualcosa in più del semplice rientro verso la media.`;
      if (noDove.length) coda += ` Su ${noDove.join(' e ')} invece no: lì gli estremi rientrano esattamente come farebbe qualsiasi serie che oscilla, quindi non ci leggerei un segnale.`;
      return conAvviso({
        intent: 'mercato-sentiment', data: { quadro: q, controllo: prova },
        answer: posiz.posizionamentoText(q) + coda,
        // Il grafico mostra dove sta OGGI ogni mercato sulla scala 0-100: e'
        // la cosa che il testo fatica a rendere, cinque numeri in fila.
        grafico: gr.graficoConfronto(q.mercati.map((m) => ({ nome: m.nome, valore: (m.indice - 50) / 100 })),
          'quanto sono schierati gli operatori, mercato per mercato'),
      });
    }

    if (intento === 'evento') {
      const p = estraiPeriodo(domanda);
      if (!p) return { intent: 'mercato-evento', answer: 'Di quale periodo parli? Dimmi un mese e un anno, per esempio "aprile 2025".' };
      const { finestra, finestraText } = eventi;
      const f = finestra(p.da, p.a);
      if (!f.trovato) {
        // Il pannello a cinque anni non arriva: si prova l'ARCHIVIO LUNGO
        // (dal 1985). Prima qui si rispondeva "il mio archivio dettagliato
        // parte dal 2021" — una frase vera quando fu scritta e diventata
        // FALSA quando i dati sono stati estesi. L'app aveva i dati e diceva
        // di non averli, e nessun test poteva accorgersene.
        const fl = evLunghi.finestraLunga(p.da, p.a);
        if (fl.trovato) {
          return { intent: 'mercato-evento', data: fl, answer: evLunghi.finestraLungaText(fl, p.etichetta) };
        }
        // "Su" + etichetta produce "Su il 2008": la preposizione articolata
        // non si costruisce concatenando (terzo caso in questa sessione).
        return { intent: 'mercato-evento', answer: `Non ho i dati giorno per giorno per ${p.etichetta}: il mio archivio dettagliato parte dal ${evLunghi.PRIMO_GIORNO}. Posso dirti come è andato il mese nel complesso, ma non cosa è successo nei singoli giorni.` };
      }
      return { intent: 'mercato-evento', data: f, answer: finestraText(f) };
    }

    if (intento === 'cripto-rifugio') {
      const { criptoNeiCrolli } = eventi;
      const c = criptoNeiCrolli();
      const btc = c.cripto.find((x) => x.classe === 'bitcoin');
      const pct = (x) => (Math.abs(x) * 100).toFixed(1).replace('.', ',');
      return {
        intent: 'mercato-cripto', data: c,
        answer: `No. Nei ${c.giorniConsiderati} giorni peggiori per le azioni — quando la borsa ha perso in media il ${pct(c.azioniInQueiGiorni)}% in un giorno — il bitcoin ha perso il ${pct(btc.medio)}%, cioè di più. È stato positivo solo ${Math.round(btc.quotaPositiva * 100)} volte su 100. Nei momenti di paura le cripto non riparano: amplificano.`,
      };
    }

    if (intento === 'oro') {
      const { rifugiNeiCrolli } = rifugi;
      const r = rifugiNeiCrolli();
      const oro = r.classifica.find((x) => x.attivo === 'oro');
      const migliore = r.classifica[0];
      const pct = (x) => (Math.abs(x) * 100).toFixed(2).replace('.', ',');
      return {
        intent: 'mercato-oro', data: r,
        answer: `Meno di quanto si dica. Nei mesi peggiori per le azioni (in media −${pct(r.azioniInQueiMesi)}% in un mese) l'oro è finito quasi in pari, ${oro.rendimentoMedio >= 0 ? '+' : '−'}${pct(oro.rendimentoMedio)}%, ed è stato positivo solo ${Math.round(oro.quotaPositiva * 100)} volte su 100: una monetina. Quello che ha protetto di più è stato ${migliore.nome.toLowerCase()}, +${pct(migliore.rendimentoMedio)}%.`,
      };
    }

    if (intento === 'rifugi') {
      const { rifugiNeiCrolli, rifugiText } = rifugi;
      const r = rifugiNeiCrolli();
      return { intent: 'mercato-rifugi', data: r, answer: rifugiText(r) };
    }

    if (intento === 'settori') {
      const { settoriNeiCrolli, settoriText } = rifugi;
      const s = SETTORI_CACHE;
      if (!s) { settoriNeiCrolli().then((x) => { SETTORI_CACHE = x; }); return null; }
      return { intent: 'mercato-settori', data: s, answer: settoriText(s) };
    }

    if (intento === 'diversificazione') {
      const { diversificazioneGeografica, portafoglioGlobaleVsUsa, globaleText } = globale;
      const d = diversificazioneGeografica(), p = portafoglioGlobaleVsUsa();
      return { intent: 'mercato-diversificazione', data: { d, p }, answer: globaleText(d, p) };
    }

    if (intento === 'recessione') {
      const { quadroMacro, quadroText } = macro;
      const q = quadroMacro();
      return conAvviso({ intent: 'mercato-recessione', data: q, answer: quadroText(q) });
    }

    if (intento === 'regime') {
      const { statoOggi } = quadro;
      const { stressText, stressIndex } = stress;
      const s = statoOggi();
      const testo = stressText(stressIndex());
      const extra = s.concordi
        ? ' I tre segnali che guardo dicono la stessa cosa.'
        : ' I segnali che guardo non concordano fra loro: qualcosa è teso, qualcos\'altro no.';
      // Una lente indipendente e complementare: non "quanto" sono tesi i
      // mercati (i tre voti sopra) ma se il MODO in cui i settori si muovono
      // insieme è cambiato di recente in modo statisticamente anomalo
      // (distanza di Frobenius fra matrici di correlazione a finestra
      // scorrevole — correlation-regime.js). Aggiunta al testo, mai fusa nel
      // voto `s.concordi`: sono due domande diverse, e mescolarle in un solo
      // numero avrebbe richiesto ritarare una soglia già testata sulle crisi
      // note invece di limitarsi ad affiancarla.
      let strutturale = '';
      try {
        const rs = correl.rilevaCambiRegime();
        if (rs.disponibile && rs.cambi.length) {
          const ultimo = rs.cambi[rs.cambi.length - 1];
          const recente = rs.serie.length && ultimo.mese === rs.serie[rs.serie.length - 1].mese;
          if (recente) strutturale = ' In più: negli ultimi mesi il modo in cui i settori si muovono insieme è cambiato in modo statisticamente anomalo rispetto alla sua storia recente.';
        }
      } catch (_) { /* segnale complementare: se non disponibile, si tace, mai un errore */ }
      return conAvviso({ intent: 'mercato-regime', data: s, answer: (testo || '') + extra + strutturale });
    }
    if (intento.startsWith('spiega:')) {
      const voce = GLOSSARIO[intento.slice(7)];
      if (!voce) return null;
      let n = null;
      try { n = voce.numero ? voce.numero(MODULI, CONTESTO_CACHE) : null; } catch (_) { n = null; }
      return { intent: 'mercato-spiegazione', data: { concetto: intento.slice(7) }, answer: n ? `${voce.spiega} ${n}` : voce.spiega };
    }

    if (intento === 'perdita-massima') {
      const { expectedShortfall, rendimentoMercato } = stress;
      const es = expectedShortfall(rendimentoMercato());
      const pct = (x) => (Math.abs(x) * 100).toFixed(1).replace('.', ',');
      return {
        intent: 'mercato-perdita-massima', data: es,
        answer: `Nel 2,5% dei mesi peggiori della storia recente si e' perso in media il ${pct(es.es)}% in un mese solo, e il mese peggiore di tutti ha fatto ${pct(es.peggiore)}%. Attenzione a una cosa: la soglia oltre la quale si entra in quel 2,5% e' il ${pct(es.var)}%, quindi guardare solo la soglia fa sottostimare la perdita di ${pct(es.quantoIlVarNonVede)} punti. E' l'errore che ha reso famoso il VaR.`,
      };
    }

    if (intento === 'rischio-rovina') {
      // Se la domanda nomina una percentuale ("rischio il 2% a trade") si
      // calcola SOLO quella. Senza un numero — il caso più comune di questa
      // domanda, "quanto POSSO rischiare prima di rovinarmi" — non si
      // inventa un rischio a caso: si mostra il confronto fra tre livelli
      // di riferimento (1/2/5%), la stessa tabella che risponde davvero
      // alla domanda "dove sta il limite".
      const pctTestuale = String(domanda || '').match(/(\d+(?:[.,]\d+)?)\s?(?:%|per\s?cento)/i);
      const livelli = pctTestuale ? [parseFloat(pctTestuale[1].replace(',', '.')) / 100] : [0.01, 0.02, 0.05];
      const risultati = livelli.map((l) => MODULI.rovina.rischioDiRovina({ rischioPerOperazione: l }));
      if (risultati.some((r) => !r.disponibile)) {
        return { intent: 'mercato-rischio-rovina', answer: risultati.find((r) => !r.disponibile)?.motivo || 'Non riesco a calcolarlo con questi numeri.' };
      }
      const testo = risultati.length === 1
        ? MODULI.rovina.rischioDiRovinaText(risultati[0])
        : `Non c'è un numero giusto in assoluto — dipende da quanto sei disposto a rischiare — ma la relazione è netta e vale la pena vederla affiancata: ${risultati.map((r) => `al ${Math.round(r.rischioPerOperazione * 100)}% a operazione, ${Math.round(r.probabilitaRovina * 100)}% di probabilità di rovina su ${r.percorsi.toLocaleString('it-IT')} percorsi simulati`).join('; ')}. Calcolato edge-neutro (tasso di vincita 50/50): con un vantaggio reale i numeri migliorano, ma qui nessuno se lo assume senza dirlo.`;
      return { intent: 'mercato-rischio-rovina', data: risultati, answer: testo };
    }

    if (intento === 'scenario-storico') {
      const { statiStorici, matriceTransizione } = rifugi;
      const st = statiStorici(), tr = matriceTransizione();
      const oggi = st.oggi;
      const versoTeso = tr.probabilita[oggi][2];
      const pct = (x) => Math.round(x * 100);
      return {
        intent: 'mercato-scenario', data: { st, tr },
        answer: `Posso simularlo, ma non prevederlo. Oggi siamo in ${NOMI_STATI_QA[oggi]}, e dalla storia degli ultimi trent'anni la probabilita' di trovarsi in condizioni tese il mese prossimo e' del ${pct(versoTeso)}%. Una cosa la storia la dice con chiarezza: i regimi non saltano. Dalle condizioni distese a quelle tese in un mese e' successo lo ${pct(tr.probabilita[0][2])}% delle volte — ci si passa sempre per il mezzo, e questo da' tempo per accorgersene.`,
      };
    }

    if (intento === 'durata-orso') {
      const { contestoText } = storiche;
      const c = CONTESTO_CACHE;
      if (!c) return null;
      const perFascia = c.perFascia.filter((r) => r.medianRecoveryMonths !== null)
        .map((r) => `${r.band}: ${r.medianRecoveryMonths} mesi`).join(', ');
      return {
        intent: 'mercato-durata', data: c,
        answer: `${contestoText(c)} E dipende molto da quanto e' profondo il calo — ${perFascia}. E' il numero che serve per sapere se puoi permetterti di aspettare.`,
      };
    }

    if (intento === 'limiti') {
      const { orizzonteDiCiascunSegnale } = quadro;
      const o = orizzonteDiCiascunSegnale();
      const cieca = o.finestraCieca.filter((h) => h > 0);
      return {
        intent: 'mercato-limiti', data: o,
        answer: `Parecchie cose, e preferisco dirle. Non so dove andra' il mercato e nessuno lo sa. Non posso dirti cosa succederebbe se la banca centrale muovesse i tassi, perche' nei dati la banca centrale si muove proprio quando l'economia peggiora e le due cose sono inseparabili. E c'e' un buco preciso: a ${cieca.join(' e ')} mesi di distanza nessuno dei segnali che uso e' affidabile — misurato, non stimato. Quello che so fare e' dirti cos'e' successo, cosa ha funzionato in passato e quanto sei esposto tu.`,
      };
    }

  } catch (e) {
    return { intent: 'mercato-errore', answer: 'Ho i dati ma non riesco a leggerli in questo momento.', errore: String(e?.message || e) };
  }
  return null;
}

// ── Le domande che NON hanno risposta, e perché ──
// Elencate apposta: rifiutare senza spiegare è una scusa. E riconoscerle serve
// a non far scattare per sbaglio uno degli intenti sopra su una domanda che
// merita un no.
export const DOMANDE_SENZA_RISPOSTA = [
  // BUG TROVATO dal banco semantico (2026-08-18): "dimmi se e' il momento di
  // entrare o di aspettare" e' una richiesta di tempismo identica a "e' il
  // momento di comprare", ma sfuggiva a questo elenco e finiva sull'intento
  // 'hype' — che risponde. La risposta era onesta, ma la domanda non doveva
  // riceverne una: chiedere QUANDO entrare e chiedere COSA comprare sono la
  // stessa domanda posta da due lati.
  // ALLARGATO dopo aver provato l'app dal vivo col motore semantico acceso
  // (2026-08-19): "dimmi tu dove investire adesso" e "su quale azienda
  // dovrei puntare i risparmi?" NON venivano rifiutate — ne' dalle parole
  // chiave ne' dalla somiglianza lessicale — e ricevevano una risposta di
  // finanza personale. "Dove investire" e' fra i modi piu' comuni di porre la
  // domanda, e non era in elenco: l'elenco descriveva come pensavamo NOI che
  // si chiedesse, non come si chiede davvero.
  { riconosce: ['cosa compro', 'cosa devo comprare', 'su cosa investo', 'quale azione', 'conviene comprare', 'devo vendere', 'e il momento di comprare', 'quando comprare',
    'e il momento di entrare', 'momento di entrare', 'entrare o aspettare', 'entro o aspetto', 'conviene entrare',
    'dove investire', 'dove investo', 'dove mettere i soldi', 'dove metto i soldi', 'dove mettere i risparmi',
    'puntare i risparmi', 'puntare i soldi', 'su cosa punto', 'su cosa puntare', 'quale azienda', 'quale titolo', 'quale settore',
    'in cosa investire', 'in cosa investo', 'cosa mi consigli', 'mi consigli di investire',
    // Le formulazioni indirette, quelle in cui la richiesta di consiglio non
    // nomina mai un'azione o un settore: "tu cosa faresti?". Le prende solo
    // chi guarda il senso, e finche' il modello non c'e' almeno queste
    // stringhe le intercettano.
    'cosa faresti', 'che faresti', 'cosa faresti tu', 'al posto mio', 'mi consiglieresti',
    'come dovrei impiegare', 'come allocare', 'come investire',
    // ── LE ALTRE LINGUE, e il buco era grave ──
    // Misurato dal vivo (2026-08-20): "where should I invest my money right
    // now?" e "en que deberia invertir?" NON venivano rifiutate e ricevevano
    // una risposta di finanza personale. La rete di rifiuto era quasi solo
    // italiana, mentre l'app risponde in sei lingue: la protezione piu'
    // importante valeva solo per un sesto degli utenti.
    'where should i invest', 'what should i buy', 'which stock', 'what stock',
    'should i buy', 'should i sell', 'what would you do', 'where to invest',
    'what do you recommend', 'which sector should',
    'en que deberia invertir', 'en que invierto', 'que deberia comprar', 'que compro',
    'donde invierto', 'donde deberia invertir', 'que acciones', 'me recomiendas',
    'ou investir', 'dois-je investir', 'devrais-je investir', 'que dois-je acheter',
    'quelle action', 'tu ferais quoi', 'que me conseilles', 'je devrais investir',
    'wo soll ich investieren', 'was soll ich kaufen', 'welche aktie',
    'onde devo investir', 'o que devo comprar',
    // ── IL GERGO PROFESSIONALE, e il buco era serio ──
    // Trovato dal banco trader/investitore/banker (Cantiere F, PIANO_TASK_2026-08-21.md,
    // 2026-08-22): sicurezza 0% su richieste di consiglio in linguaggio da
    // trading desk/investment banking. La somiglianza LESSICALE con gli esempi
    // canonici ("cosa devo comprare") e' zero perche' non condividono NESSUNA
    // parola con "dimensiona", "size", "long/short", "multiplo", "buy/sell" —
    // e' la stessa classe di buco gia' vista per le altre lingue: un elenco
    // pensato per come pensavamo NOI si chiedesse, non per come lo chiede chi
    // fa il mestiere davvero.
    'dimensiona', 'dimensionami',
    'entro long', 'entro short', 'sto fuori adesso',
    'che size mi consigli', 'size mi consigli', 'che size',
    'lascio correre', 'stoppo qui',
    'aprire corto', 'aprire un corto', 'apro corto',
    'quale numero dovrei uscire', 'su quale numero uscire', 'dovrei uscire',
    'aumentare la posizione', 'aumento la posizione',
    'consigli di mediare', 'mediare qui', 'devo mediare',
    'ha ancora upside', 'upside secondo te',
    'multiplo giusto', 'multiplo ci daresti', 'che multiplo',
    'un buy o un sell', 'buy o sell', 'e un buy o', 'e un sell o',
    'consigli di procedere', 'procedere con l operazione', 'procediamo con l operazione',
    // BUG REALE trovato dal vivo (2026-08-24, non dal banco semantico stavolta
    // — da un test scritto per tutt'altro, la divulgazione di un punteggio
    // tecnico): "Apple e' un buy secondo il suo Beneish M-Score?" NON veniva
    // rifiutata — l'elenco chiedeva SEMPRE la coppia "buy o sell" insieme,
    // mai "buy"/"sell" da soli. "È un buy?"/"is it a buy?" e' probabilmente
    // la forma PIU' comune in gergo da analista (rating "buy/hold/sell"),
    // non quella accoppiata. Vale anche in inglese: stesso principio del
    // "buco quasi solo italiano" gia' corretto sopra, non da ripetere.
    'un buy secondo', 'buy secondo te', 'e un buy', 'un buy?', 'e un sell', 'un sell?',
    // "is Apple a buy?" (il ticker/nome fra "is" e "a buy" rompe i pattern
    // sopra, che richiedono l'adiacenza) — "a buy"/"a sell" da soli, non
    // adiacenti a "is/this/it", coprono la forma piu' comune in assoluto in
    // gergo da analista USA ("is $TICKER a buy or a sell").
    'is it a buy', 'is this a buy', 'is a buy', 'a buy rating', 'buy rating', 'sell rating',
    'a buy or', 'a buy?', 'a sell?'],
    risposta: 'Non te lo dico, e non è prudenza: nessuno sa cosa farà il mercato, e chi te lo dice o sta indovinando o ti sta vendendo qualcosa. Quello che posso dirti è cosa è successo, cosa ha funzionato in passato e quanto sei esposto tu: sono tre domande a cui esiste una risposta vera.' },
  { riconosce: ['salira', 'scendera', 'dove va il mercato', 'previsione del mercato', 'cosa fara la borsa', 'quanto salira', 'quanto scendera'],
    risposta: 'La direzione non la so, e i dati dicono che non la sa nessuno: l\'indice di paura che calcolo prevede quanto il mercato ballerà, non da che parte andrà. Posso dirti quanto è probabile un rallentamento economico entro un anno e mezzo, che è una cosa diversa.' },
  { riconosce: ['taglier', 'la fed abbass', 'la fed alz', 'cosa fara la fed', 'prossima mossa della fed'],
    risposta: 'Non lo so, e c\'è una ragione tecnica per cui nemmeno i dati lo direbbero: la banca centrale taglia proprio quando l\'economia peggiora, quindi nei numeri "taglio" e "recessione" arrivano insieme e un modello ingenuo concluderebbe che i tagli causano le recessioni.' },
];

// `similarity` e' opzionale: senza, il comportamento e' identico a prima
// (parole chiave e basta, sincrono, nessun modello). Con, si aggiunge la rete
// di sicurezza semantica — e serve, perche' un elenco di stringhe non puo'
// catturare le parafrasi: "su quale settore mi conviene puntare i soldi" e'
// la stessa domanda di "cosa devo comprare" e nessuna parola chiave le unisce.
export function rifiutoMotivato(domanda, similarity = null) {
  const q = normalizza(domanda);
  for (const d of DOMANDE_SENZA_RISPOSTA) {
    if (d.riconosce.some((r) => q.includes(r))) return { intent: 'mercato-non-si-puo', answer: d.risposta };
  }
  // ── IL RIFIUTO NON SI FIDA DEGLI EMBEDDING, ed e' una misura, non un'opinione ──
  // Misurato dal vivo con multilingual-e5-small acceso (2026-08-19), su questo
  // dominio i valori sono tutti schiacciati in alto e le distanze fra "giusto"
  // e "sbagliato" spariscono:
  //     "quanto posso spendere oggi"   vs "cosa devo comprare"   0,9421
  //     "dimmi tu dove investire"      vs "cosa devo comprare"   0,9254
  //     "come si cuoce la carbonara"   vs "cosa devo comprare"   0,9174
  // Cioe' una domanda legittima somiglia al rifiuto PIU' di una richiesta di
  // consiglio vera, e una ricetta di cucina se la jjoca. Con le soglie tarate
  // su Jaccard (dove due frasi diverse valgono 0) il risultato dal vivo e'
  // stato che l'app rifiutava TUTTO, "quanto posso spendere oggi?" compreso.
  //
  // Il modello ORDINA ancora bene (il primo posto e' giusto in 3 casi su 4),
  // ma con margini di 0,003-0,027: abbastanza per suggerire un intento, non
  // per decidere se negare una risposta. Quindi il rifiuto resta sulla
  // somiglianza LESSICALE, che sul banco di prova copre gia' il 100% dei casi
  // ed e' interpretabile riga per riga. Un rifiuto e' una promessa verso
  // l'utente: non si appoggia su un segnale che non sappiamo leggere.
  if (BANCO_SEMANTICO) {
    const m = BANCO_SEMANTICO.matchMercato(domanda, similaritaLessicale);
    if (m?.rifiuto) {
      // La famiglia semantica sceglie QUALE spiegazione dare: rifiutare senza
      // spiegare e' una scusa, e spiegare la cosa sbagliata e' peggio.
      const perFamiglia = { 'cosa-comprare': 0, 'dove-va': 1, 'mossa-banca-centrale': 2 };
      const d = DOMANDE_SENZA_RISPOSTA[perFamiglia[m.intent] ?? 0];
      return { intent: 'mercato-non-si-puo', answer: d.risposta, viaSemantica: true, confidenza: m.confidenza };
    }
  }
  return null;
}

// Il banco semantico si aggancia una volta sola, in modo asincrono, e finche'
// non e' pronto tutto funziona come prima. Non si importa staticamente per non
// legare il QA a un modulo che serve solo a chi ha attivato la comprensione
// semantica (opt-in, ~197MB).
const BANCO_SEMANTICO = BANCO_STATICO;
// Resta per compatibilita' con chi la chiamava: ora non c'e' piu' niente da
// attendere, il banco e' presente dal primo istante.
export async function caricaBancoSemantico() { return BANCO_SEMANTICO; }
export function bancoSemanticoPronto() { return true; }

// Il punto d'ingresso unico: prima si guarda se la domanda è di quelle a cui
// non si deve rispondere, poi si prova a rispondere.
export async function chiediAlMercato(domanda) {
  const rifiuto = rifiutoMotivato(domanda);
  if (rifiuto) return rifiuto;
  await precarica();
  // I settori richiedono un secondo giro (la loro funzione e' asincrona):
  // qui lo si aspetta, perche' chi chiama in modo asincrono puo' permetterselo.
  if (MODULI && SETTORI_CACHE === null && intentoMercato(domanda) === 'settori') {
    SETTORI_CACHE = await MODULI.rifugi.settoriNeiCrolli();
  }
  // ── "bravura mia o solo il mercato che saliva?" su una CRIPTO ──
  // rispostaSincrona() non può fare rete (resta sincrona per chi la chiama
  // così): il ramo cripto vive SOLO qui, nell'ingresso asincrono, perché
  // richiede uno storico prezzi vero (CoinGecko, src/alpha/crypto-
  // storico.js — verificato dal vivo: il piano gratuito dà solo 365 giorni,
  // non i mesi che il resto del modulo usa per le azioni via settore). Se
  // la domanda nomina una cripto, questo ramo risponde e basta — mai
  // provare anche il percorso azionario sulla stessa domanda.
  if (intentoMercato(domanda) === 'titolo-causale') {
    const cripto = await rispostaCausaleCripto(domanda).catch(() => null);
    if (cripto) return cripto;
  }
  return rispostaSincrona(domanda);
}

// Separata da chiediAlMercato per restare testabile da sola. `null` se la
// domanda non nomina una cripto riconosciuta (si scende al ramo azionario)
// o se qualcosa fallisce (rete assente, CoinGecko non risponde) — MAI
// un'eccezione che rompe l'intero chiediAlMercato per un ramo opzionale.
export async function rispostaCausaleCripto(domanda, { fetchImpl = fetch } = {}) {
  const { trovaCriptoInTesto } = await import('./crypto-storico.js');
  const trovata = trovaCriptoInTesto(domanda);
  if (!trovata) return null;
  if (trovata.id === 'bitcoin') {
    return {
      intent: 'mercato-titolo-causale',
      answer: 'Bitcoin è di solito il riferimento con cui si confrontano le altre cripto ("il mercato cripto"), non ha senso scomporlo contro se stesso. Chiedimi di un\'altra cripto (Ethereum, Solana, ecc.) per vedere quanto si muove insieme a Bitcoin e quanto per conto sua.',
    };
  }
  const { fetchStoricoRendimentiCripto } = await import('./crypto-storico.js');
  const [btc, coin] = await Promise.all([
    fetchStoricoRendimentiCripto('bitcoin', { fetchImpl }),
    fetchStoricoRendimentiCripto(trovata.id, { fetchImpl }),
  ]);
  const { scomponi } = await import('./titolo-causale.js');
  const s = scomponi(coin.rendimenti, btc.rendimenti);
  if (!s) {
    return { intent: 'mercato-titolo-causale', answer: `Ho lo storico di ${trovata.chiave} (${coin.giorni} giorni via CoinGecko) ma non è abbastanza per separare la sua parte da quella di Bitcoin.` };
  }
  return {
    intent: 'mercato-titolo-causale', data: { scomposizione: s, giorni: coin.giorni, fonte: coin.fonte },
    // "giorni", MAI "mesi": granularità diversa dal ramo azionario (via
    // settore, 330 mesi) — dichiarare l'unità sbagliata sarebbe un'unità di
    // misura falsa, non un dettaglio stilistico.
    answer: `Di quanto ha fatto ${trovata.chiave} in questi ${s.osservazioni} giorni (storico CoinGecko, piano gratuito — limitato a un anno), il ${s.quotaMercato}% del movimento se lo spiega Bitcoin: solo il ${s.quotaSua}% è roba sua. In tutto ha reso ${s.rendimentoTotale}%, muovendosi soltanto insieme a Bitcoin avrebbe reso ${s.rendimentoDaMercato}%. Si muove ${s.beta > 1 ? 'più' : 'meno'} di Bitcoin: quando Bitcoin fa 1, lui fa ${s.beta}. È la scomposizione di un numero che stai già guardando, non un giudizio sulla cripto e non un consiglio.`,
  };
}

// Il punto d'ingresso SINCRONO per il QA: rifiuto motivato + risposta se i
// moduli sono gia' pronti.
// `similarity` opzionale: se il chiamante ha il motore semantico pronto lo
// passa, altrimenti si usa la SOMIGLIANZA LESSICALE — che non richiede
// nessun modello e gira su qualunque dispositivo.
//
// PERCHE' IL RIPIEGO LESSICALE E' PREDEFINITO E NON UN'OPZIONE. Il banco di
// prova (src/ai/qa-banco-prova.js) ha misurato che due domande su sette da
// rifiutare sfuggivano alle sole parole chiave: "su quale settore mi conviene
// puntare i soldi?" riceveva una risposta invece di un rifiuto. Cioe' la
// protezione piu' importante dell'app mancava proprio dove il modello da
// 113MB non si puo' scaricare. Rimisurato con la sola sovrapposizione di
// parole: sicurezza dal 71,4% al 100%, copertura dal 75% al 78,1%, zero
// errori gravi introdotti. Un pavimento che c'e' su ogni dispositivo vale
// piu' di un tetto che c'e' solo su alcuni.
export function chiediAlMercatoSync(domanda, similarity = null) {
  const sim = similarity || similaritaLessicale;
  return rifiutoMotivato(domanda, sim) || rispostaSincrona(domanda, sim);
}
