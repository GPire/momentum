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
    parole: ['curva dei rendimenti', 'curva dei tassi', 'curva invertita', 'inversione della curva'],
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
export function dimenticaContesto() { ULTIMO_INTENTO = null; }

// ── Il riconoscimento dell'intento ──
export function intentoMercato(domanda) {
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
  if (ha(q, 'recession', 'crisi in arrivo', 'curva dei tassi', 'curva dei rendimenti', 'curva invertita')) return 'recessione';
  if (ha(q, 'come sta il mercato', 'come va il mercato', 'situazione dei mercati', 'clima di mercato', 'quanto e teso', 'stress')) return 'regime';
  if (ha(q, 'quanto posso perdere', 'perdita massima', 'caso peggiore', 'quanto rischio di perdere', 'scenario peggiore')) return 'perdita-massima';
  if (ha(q, 'se tornasse', 'se si ripetesse', 'e se succedesse di nuovo', 'come nel 2008', 'un altro 2008', 'ripetesse il')) return 'scenario-storico';
  if (ha(q, 'quanto dura', 'quanto durano', 'quanto tempo per recuperare', 'quando recupera', 'tempi di recupero', 'mercato orso')) return 'durata-orso';
  // Il SENTIMENT vero: dove sono schierati gli operatori con soldi veri.
  // "Sentiment" da solo non basta come parola chiave — chi lo scrive puo'
  // intendere l'umore generale — ma insieme a mercato/operatori/trader si'.
  if (ha(q, 'posizionament', 'cot', 'commitments of traders', 'speculator')) return 'sentiment';
  if (ha(q, 'sentiment', 'umore del mercato', 'come sono messi', 'da che parte stanno', 'tutti dalla stessa parte', 'euforia', 'panico')) return 'sentiment';

  if (ha(q, 'cosa non sai', 'cosa non puoi', 'quali sono i tuoi limiti', 'di cosa non sei sicuro', 'dove sbagli', 'cosa ti manca')) return 'limiti';
  if (ha(q, 'quanto e affidabile', 'quanto ti posso credere', 'quanto sono affidabili', 'che affidabilita')) return 'limiti';
  if (ha(q, 'cosa e successo', 'cos e successo', 'che e successo', 'cosa succes', 'com e andata', 'perche e crollat', 'crollo di', 'cosa ando storto')) return 'evento';
  // Una data da sola, in una domanda, quasi sempre chiede un evento.
  if (estraiPeriodo(q) && ha(q, '?', 'spieg', 'raccont', 'dimm')) return 'evento';
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
    import('./grafici.js'), import('./notizie.js'),
  ]).then(async ([eventi, rifugi, globale, macro, quadro, stress, storiche, fresco, posiz, mp, tr, ci, gr, nz]) => {
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
    MODULI = { eventi, rifugi, globale, macro, quadro, stress, storiche, fresco, posiz, mp, tr, ci, gr, nz };
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
export function rispostaSincrona(domanda) {
  const intento = intentoMercato(domanda);
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
  const { eventi, rifugi, globale, macro, quadro, stress, storiche, posiz, mp, tr, ci, gr, nz } = MODULI;
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
        return { intent: 'mercato-evento', answer: `Su ${p.etichetta} non ho i dati giorno per giorno: il mio archivio dettagliato parte dal 2021. Posso dirti come è andato il mese nel complesso, ma non cosa è successo nei singoli giorni.` };
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
      return conAvviso({ intent: 'mercato-regime', data: s, answer: (testo || '') + extra });
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
        intent: 'mercato-perdita', data: es,
        answer: `Nel 2,5% dei mesi peggiori della storia recente si e' perso in media il ${pct(es.es)}% in un mese solo, e il mese peggiore di tutti ha fatto ${pct(es.peggiore)}%. Attenzione a una cosa: la soglia oltre la quale si entra in quel 2,5% e' il ${pct(es.var)}%, quindi guardare solo la soglia fa sottostimare la perdita di ${pct(es.quantoIlVarNonVede)} punti. E' l'errore che ha reso famoso il VaR.`,
      };
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
  { riconosce: ['cosa compro', 'cosa devo comprare', 'su cosa investo', 'quale azione', 'conviene comprare', 'devo vendere', 'e il momento di comprare', 'quando comprare'],
    risposta: 'Non te lo dico, e non è prudenza: nessuno sa cosa farà il mercato, e chi te lo dice o sta indovinando o ti sta vendendo qualcosa. Quello che posso dirti è cosa è successo, cosa ha funzionato in passato e quanto sei esposto tu: sono tre domande a cui esiste una risposta vera.' },
  { riconosce: ['salira', 'scendera', 'dove va il mercato', 'previsione del mercato', 'cosa fara la borsa', 'quanto salira', 'quanto scendera'],
    risposta: 'La direzione non la so, e i dati dicono che non la sa nessuno: l\'indice di paura che calcolo prevede quanto il mercato ballerà, non da che parte andrà. Posso dirti quanto è probabile un rallentamento economico entro un anno e mezzo, che è una cosa diversa.' },
  { riconosce: ['taglier', 'la fed abbass', 'la fed alz', 'cosa fara la fed', 'prossima mossa della fed'],
    risposta: 'Non lo so, e c\'è una ragione tecnica per cui nemmeno i dati lo direbbero: la banca centrale taglia proprio quando l\'economia peggiora, quindi nei numeri "taglio" e "recessione" arrivano insieme e un modello ingenuo concluderebbe che i tagli causano le recessioni.' },
];

export function rifiutoMotivato(domanda) {
  const q = normalizza(domanda);
  for (const d of DOMANDE_SENZA_RISPOSTA) {
    if (d.riconosce.some((r) => q.includes(r))) return { intent: 'mercato-non-si-puo', answer: d.risposta };
  }
  return null;
}

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
  return rispostaSincrona(domanda);
}

// Il punto d'ingresso SINCRONO per il QA: rifiuto motivato + risposta se i
// moduli sono gia' pronti.
export function chiediAlMercatoSync(domanda) {
  return rifiutoMotivato(domanda) || rispostaSincrona(domanda);
}
