// ============================================================
// COMPRENSIONE SEMANTICA DELLE DOMANDE DI MERCATO
// ============================================================
// IL PROBLEMA, detto senza girarci intorno. `intentoMercato` e' una cascata di
// confronti a parole chiave: lunga, leggibile, e con un limite strutturale che
// nessuna aggiunta di parole risolve — riconosce le FORMULAZIONI previste da
// chi ha scritto il codice, non i SIGNIFICATI. Chi chiede "quanto e' rischioso
// entrare adesso" invece di "quanto posso perdere" riceve un "non lo so
// ancora" su una domanda che l'app sa benissimo. Aggiungere la centesima
// stringa non e' intelligenza: e' rimandare.
//
// LA SOLUZIONE, con il pezzo che nel progetto esiste gia'. `semantic-embed.js`
// trasforma una frase in un vettore di SIGNIFICATO, e `qa-canonical-bank.js`
// lo usa gia' cosi' per le finanze personali — ma il suo banco non contiene
// nemmeno un intento di mercato. Qui si fa per la borsa quello che li' e' gia'
// fatto per le spese: un insieme curato di formulazioni di riferimento, e la
// domanda nuova viene capita per vicinanza di senso.
//
// COME SI COMPONGONO I DUE, e perche' in quest'ordine:
//   1) prima le parole chiave — sincrone, senza modello, funzionano offline e
//      anche per chi non ha attivato la comprensione semantica (che e' opt-in
//      e scarica ~197MB). Restano la strada principale, non un ripiego.
//   2) il confronto semantico interviene SOLO quando le parole chiave non
//      hanno riconosciuto niente. Cosi' puo' soltanto AGGIUNGERE comprensione:
//      non e' in grado di cambiare una risposta che gia' funzionava, e questo
//      rende l'aggiunta non regressiva per costruzione.
//
// ── LA REGOLA DI SICUREZZA, che qui vale piu' dell'accuratezza ──
// Capire di piu' e' pericoloso in un punto preciso: "cosa devo comprare?" DEVE
// continuare a ricevere un rifiuto motivato. Se il confronto semantico
// avvicinasse "su quale settore mi conviene puntare i soldi?" a una domanda a
// cui l'app risponde, avremmo trasformato una comprensione migliore in un
// consiglio finanziario — cioe' esattamente cio' che il progetto non fa, e in
// diversi Paesi un'attivita' riservata.
// Quindi i RIFIUTI sono nel banco come intenti di prima classe, e hanno una
// soglia PIU' BASSA di tutti gli altri: e' piu' facile far scattare un
// rifiuto che una risposta. L'asimmetria e' voluta e va detta — un rifiuto di
// troppo costa all'utente una riformulazione, una risposta di troppo costa un
// consiglio che non dovevamo dare.
'use strict';

// Piu' alta della soglia usata per le correzioni imparate (0,62 in
// qa-learning.js): li' c'e' la conferma esplicita dell'utente a fare da rete,
// qui no. Meglio un onesto "non ho capito" che la risposta sbagliata.
export const SOGLIA_MERCATO = 0.72;
// Piu' bassa apposta: vedi la regola di sicurezza sopra.
export const SOGLIA_RIFIUTO = 0.62;

// Le tre famiglie di domande a cui non si risponde, gia' motivate in
// `DOMANDE_SENZA_RISPOSTA` (mercato-qa.js). Qui stanno le loro parafrasi: le
// stesse domande poste come le pone davvero una persona.
export const ESEMPI_RIFIUTO = {
  'cosa-comprare': [
    'cosa devo comprare',
    'su quale settore mi conviene puntare i soldi',
    'in quale azienda mi consigli di investire adesso',
    'secondo te dove dovrei mettere i miei risparmi',
    'quale titolo vale la pena prendere in questo momento',
    // AGGIUNTE dopo la prova dal vivo: sono le formulazioni che gli utenti
    // usano davvero e che non venivano riconosciute. Le prime due erano gia'
    // nell'elenco a parole chiave in forma diversa — qui servono perche' la
    // somiglianza le agganci anche quando la frase e' costruita altrimenti.
    'dimmi tu dove investire adesso',
    'secondo te su quale azienda dovrei puntare i risparmi',
    'dove conviene mettere i soldi oggi',
    'what should I buy right now',
    'which stock should I invest in',
    'where should I put my money',
    // Le richieste di consiglio INDIRETTE: non nominano mai un titolo o un
    // settore, quindi nessuna parola chiave le puo' prendere per costruzione.
    // Sono il caso in cui serve davvero il modello di embedding.
    'secondo te come dovrei impiegare i miei risparmi',
    'che strumento finanziario mi consiglieresti',
    'tu cosa faresti con questi soldi',
    'che scelta faresti al posto mio sui mercati',
    'what would you do with this money',
    // Le altre lingue nel banco semantico, per la stessa ragione per cui sono
    // nelle parole chiave: un rifiuto che vale solo in italiano protegge solo
    // gli utenti italiani.
    'where should I invest my money right now',
    'which stock should I buy today',
    'en que deberia invertir mi dinero',
    'que acciones me recomiendas comprar',
    'ou devrais-je investir mon argent',
    'wo soll ich mein geld investieren',
    'onde devo investir o meu dinheiro',
  ],
  'dove-va': [
    'dove andra il mercato',
    'secondo te la borsa salira o scendera',
    'quanto scendera il mercato nei prossimi mesi',
    'dimmi se e il momento di entrare o di aspettare',
    'will the market go up or down',
    'va a subir o bajar la bolsa',
    'le marche va monter ou descendre',
    'wird der markt steigen oder fallen',
  ],
  'mossa-banca-centrale': [
    'cosa fara la fed alla prossima riunione',
    'la banca centrale taglier i tassi',
    'secondo te alzeranno ancora i tassi',
    'will the fed cut rates next meeting',
  ],
};

// Gli intenti a cui l'app SA rispondere, con le formulazioni vere. Le chiavi
// sono esattamente quelle che `intentoMercato` restituisce: il banco non
// introduce intenti nuovi, insegna solo a raggiungere quelli che esistono.
export const ESEMPI_MERCATO = {
  'perdita-massima': [
    'quanto posso perdere nel caso peggiore',
    'quanto e rischioso entrare adesso',
    'qual e la perdita piu grande che potrei subire',
    'how much could I lose in the worst case',
  ],
  regime: [
    'come sta il mercato in questo momento',
    'che clima si respira sui mercati adesso',
    'quanto sono tesi i mercati oggi',
    'how are the markets doing right now',
  ],
  recessione: [
    'ci sara una recessione',
    'quanto e probabile un rallentamento economico',
    'la curva dei rendimenti sta segnalando qualcosa',
    'is a recession coming',
  ],
  rifugi: [
    'cosa ha protetto davvero nei momenti brutti',
    'quali investimenti hanno retto durante i crolli',
    'dove si sono riparati i soldi nelle crisi passate',
    'what actually protected during market crashes',
  ],
  oro: [
    'loro protegge davvero',
    'ha senso tenere oro come riparo',
    'loro e un vero bene rifugio',
    'is gold really a safe haven',
  ],
  evento: [
    'cosa e successo nel 2008',
    'raccontami cosa ando storto in quel periodo',
    'perche il mercato e crollato allora',
    'what happened during that crash',
  ],
  'durata-orso': [
    'quanto tempo ci vuole per recuperare dopo un crollo',
    'quanto durano di solito i periodi negativi',
    'how long does it take to recover after a crash',
  ],
  previsione: [
    'che probabilita ci sono nei prossimi dodici mesi',
    'cosa e successo storicamente in situazioni come questa',
    'cosa dice la storia partendo da dove siamo adesso',
    'what happened historically in situations like this one',
  ],
  sentiment: [
    'da che parte sono schierati gli operatori',
    'come sono posizionati i grandi investitori adesso',
    'sono tutti dalla stessa parte del mercato',
    'how are traders positioned right now',
  ],
  limiti: [
    'cosa non sai fare',
    'quanto mi posso fidare di quello che dici',
    'dove sbagli piu spesso',
    'what are your limitations',
  ],
  immobiliare: [
    'come va il mercato della casa',
    'conviene guardare al mattone',
    'how is the housing market doing',
  ],
  'materie-prime': [
    'come vanno i metalli e le materie prime',
    'come si sta muovendo il petrolio',
    'how are commodities doing',
  ],
};

// Confronta con OGNI esempio e restituisce il migliore. `similarity` ha la
// stessa firma sincrona usata altrove: (a,b) -> 0..1, con gli embedding gia'
// in cache (il lavoro pesante lo fa `semantic-embed.js` prima, non qui).
function migliore(question, similarity, banco) {
  let best = null, bestScore = 0, secondo = 0;
  for (const [intent, esempi] of Object.entries(banco)) {
    for (const esempio of esempi) {
      const score = similarity(question, esempio);
      if (score > bestScore) { secondo = bestScore; bestScore = score; best = intent; }
      else if (score > secondo) { secondo = score; }
    }
  }
  return { intent: best, punteggio: bestScore, margine: bestScore - secondo };
}

// ── DUE REGOLE DI DECISIONE, perche' due somiglianze non sono la stessa cosa ──
// Misurato dal vivo (2026-08-19): la somiglianza LESSICALE parte da zero fra
// frasi diverse, quindi una soglia assoluta la descrive bene. Quella di un
// modello di EMBEDDING no: su questo dominio multilingual-e5-small produce
// 0,90-0,96 per QUALUNQUE coppia — anche fra una ricetta di cucina e una
// domanda di borsa — e con una soglia a 0,72 passerebbe tutto.
// Il modello pero' ORDINA ancora correttamente: l'informazione non e' nel
// livello, e' nel MARGINE fra il primo e il secondo. Misurati: 0,027 e 0,026
// quando il riconoscimento e' giusto e netto, 0,0012-0,0028 quando e' un
// sostanziale pareggio (e li' infatti sbagliava).
// Da qui la soglia scelta: MARGINE_MINIMO = 0,015, cioe' a meta' fra i due
// gruppi misurati. Non e' un numero elegante, e' dove passa la separazione.
export const MARGINE_MINIMO = 0.015;

// Il punto d'ingresso. Restituisce null quando non capisce — che e' una
// risposta legittima e va preferita a una risposta inventata.
// `perMargine`: true quando la somiglianza viene da un modello di embedding,
// i cui valori assoluti non sono confrontabili con una soglia fissa (vedi
// MARGINE_MINIMO). Predefinito false = comportamento storico, adatto alla
// somiglianza lessicale.
export function matchMercato(question, similarity, { perMargine = false } = {}) {
  if (!similarity || !question) return null;

  // I RIFIUTI PER PRIMI, e con la soglia piu' bassa: se una domanda somiglia
  // sia a "cosa compro" sia a qualcosa di rispondibile, vince il rifiuto.
  // NOTA: chi chiama per decidere un rifiuto deve passare la somiglianza
  // LESSICALE, non quella di un modello — vedi la misura in mercato-qa.js.
  const rifiuto = migliore(question, similarity, ESEMPI_RIFIUTO);
  const rifiutoPassa = perMargine
    ? (rifiuto.margine >= MARGINE_MINIMO)
    : (rifiuto.punteggio >= SOGLIA_RIFIUTO);
  if (rifiuto.intent && rifiutoPassa) {
    return { intent: rifiuto.intent, confidenza: +rifiuto.punteggio.toFixed(3), margine: +rifiuto.margine.toFixed(4), rifiuto: true };
  }

  const m = migliore(question, similarity, ESEMPI_MERCATO);
  if (!m.intent) return null;
  const passa = perMargine ? (m.margine >= MARGINE_MINIMO) : (m.punteggio >= SOGLIA_MERCATO);
  if (!passa) return null;
  return { intent: m.intent, confidenza: +m.punteggio.toFixed(3), margine: +m.margine.toFixed(4), rifiuto: false };
}
