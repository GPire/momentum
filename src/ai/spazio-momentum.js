// ============================================================
// LO SPAZIO DI MOMENTUM — lo strato che rende nostro un modello aperto
// ============================================================
// IL PROBLEMA, MISURATO IERI E NON SUPPOSTO. Con multilingual-e5-small acceso,
// su questo dominio la somiglianza fra due frasi QUALUNQUE vale 0,90-0,96:
//     "quanto posso spendere oggi"  vs "cosa devo comprare"   0,9421
//     "dimmi tu dove investire"     vs "cosa devo comprare"   0,9254
//     "come si cuoce la carbonara"  vs "cosa devo comprare"   0,9174
// Una domanda legittima somiglia al rifiuto piu' di una richiesta di consiglio
// vera, e una ricetta di cucina se la gioca. Non e' un difetto del nostro
// codice: e' una proprieta' nota degli spazi di embedding, l'ANISOTROPIA. I
// vettori non riempiono lo spazio in tutte le direzioni — si addensano dentro
// un cono stretto, e dentro un cono stretto tutto sembra vicino a tutto.
//
// LA CORREZIONE ESISTE, ED E' ARITMETICA. Mu e Viswanath (ICLR 2018,
// "All-but-the-Top") mostrano che quasi tutta la somiglianza spuria vive in
// POCHE direzioni dominanti, comuni a ogni frase: la media generale e i primi
// assi principali. Togliendole, cio' che resta e' la parte che DISTINGUE una
// frase dall'altra. Non serve riaddestrare niente: serve sottrarre.
//
// ── PERCHE' QUESTO E' LO STRATO PROPRIETARIO DI MOMENTUM ──
// Il modello base e' aperto e uguale per chiunque lo scarichi: nessuno allena
// un embedding da zero, nemmeno chi dice di avere un "modello proprietario".
// Ma la correzione qui NON e' universale: si calcola sul BANCO DI DOMANDE DI
// MOMENTUM — le formulazioni curate del progetto, e sul dispositivo anche le
// correzioni che quell'utente ha confermato. Due installazioni finiscono con
// due spazi diversi, tarati su cosa quella persona chiede davvero.
// E' questo il senso onesto di "modello nostro": non i pesi, che sono di
// tutti, ma la geometria in cui li leggiamo, che e' costruita sui nostri dati
// e non lascia il dispositivo.
//
// Il costo: una passata sui vettori del banco, poche moltiplicazioni. Gira
// anche su un telefono modesto, e si ricalcola quando il banco cambia.
// Funzioni PURE.
'use strict';

// ── QUANTE DIREZIONI TOGLIERE: misurato, non copiato dal paper ──
// Mu e Viswanath suggeriscono circa d/100 (per 384 dimensioni: 3-4). Provato
// in provetta su vettori con lo stesso difetto misurato sul modello vero, il
// risultato SMENTISCE quella regola su questo dominio:
//     nessuna correzione   distacco 0,0067
//     sola centratura      distacco 1,4686   (219 volte tanto)
//     togliendo 1 asse     distacco 1,9231   (287 volte tanto)
//     togliendo 2 assi     distacco -0,2313  (ROTTO: segno invertito)
//     togliendo 3 assi     distacco -0,2756  (ROTTO)
// La ragione e' che dopo la CENTRATURA le direzioni dominanti non sono piu'
// rumore condiviso: sono proprio cio' che distingue un gruppo dall'altro.
// Toglierne troppe cancella il segnale invece dell'artefatto. Il numero
// giusto dipende da quanti gruppi distinti contiene il banco, quindi va
// scelto misurando — vedi `scegliDirezioni`.
export const DIREZIONI_DA_TOGLIERE = 1;
export const MAX_DIREZIONI_DA_PROVARE = 4;

// ── COSA FA DAVVERO QUESTA CORREZIONE, detto con precisione ──
// Non rende il modello piu' intelligente: il distacco NORMALIZZATO resta
// invariato (1,972 prima, 1,971 dopo). L'ordinamento era gia' giusto, ed era
// gia' stato misurato dal vivo che il modello ordina bene.
// Quello che cambia e' la LEGGIBILITA' della sua uscita: da tutto schiacciato
// fra 0,90 e 0,96 — dove nessuna soglia significa niente e infatti l'app
// rifiutava ogni domanda — a una scala dove le coppie estranee stanno vicino
// a zero e le imparentate vicino a uno. E' la differenza fra un segnale che
// c'e' e un segnale che si puo' USARE.

const punto = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

function normalizzaVec(v) {
  const n = Math.sqrt(punto(v, v));
  if (!(n > 0)) return v;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

// ── Le direzioni dominanti, con l'iterazione della potenza ──
// Non si costruisce la matrice di covarianza (384x384 = 147.456 numeri per un
// banco di sessanta frasi: piu' parametri che dati, e instabile). Si trova
// direttamente l'asse lungo cui i vettori variano di piu', poi lo si toglie e
// si ripete. Poche righe, nessuna dipendenza, stabile anche con pochi esempi.
function direzionePrincipale(vettori, dim, { iterazioni = 60 } = {}) {
  let v = new Float32Array(dim);
  // Partenza deterministica: un test che dipende da Math.random e' un test che
  // prima o poi fallisce da solo.
  for (let i = 0; i < dim; i++) v[i] = ((i * 2654435761) % 1000) / 1000 - 0.5;
  v = normalizzaVec(v);

  for (let it = 0; it < iterazioni; it++) {
    const nuovo = new Float32Array(dim);
    // nuovo = Σ (x·v) x  — cioe' la covarianza applicata a v, senza mai
    // costruire la covarianza.
    for (const x of vettori) {
      const c = punto(x, v);
      for (let i = 0; i < dim; i++) nuovo[i] += c * x[i];
    }
    const n = Math.sqrt(punto(nuovo, nuovo));
    if (!(n > 1e-12)) break;
    for (let i = 0; i < dim; i++) nuovo[i] /= n;
    // Convergenza: se la direzione non si muove piu', si smette.
    const spostamento = 1 - Math.abs(punto(nuovo, v));
    v = nuovo;
    if (spostamento < 1e-9) break;
  }
  return v;
}

// Calcola lo spazio corretto a partire dai vettori del banco.
export function adattaSpazio(vettori = [], { direzioni = DIREZIONI_DA_TOGLIERE } = {}) {
  const validi = vettori.filter((v) => v && v.length);
  if (validi.length < 4) return null; // con tre frasi non si stima una geometria
  const dim = validi[0].length;
  if (validi.some((v) => v.length !== dim)) return null;

  // 1. La media: e' la direzione che TUTTE le frasi condividono, ed e' la
  //    parte che rende tutto simile a tutto.
  const media = new Float32Array(dim);
  for (const v of validi) for (let i = 0; i < dim; i++) media[i] += v[i];
  for (let i = 0; i < dim; i++) media[i] /= validi.length;

  // 2. I vettori centrati, su cui si cercano le direzioni dominanti residue.
  let residui = validi.map((v) => {
    const r = new Float32Array(dim);
    for (let i = 0; i < dim; i++) r[i] = v[i] - media[i];
    return r;
  });

  const assi = [];
  const quante = Math.max(0, Math.min(direzioni, dim - 1, validi.length - 1));
  for (let k = 0; k < quante; k++) {
    const asse = direzionePrincipale(residui, dim);
    assi.push(asse);
    // Si toglie l'asse trovato e si cerca il successivo su cio' che resta.
    residui = residui.map((r) => {
      const c = punto(r, asse);
      const out = new Float32Array(dim);
      for (let i = 0; i < dim; i++) out[i] = r[i] - c * asse[i];
      return out;
    });
  }

  return { dim, media, assi, esempi: validi.length };
}

// Applica la correzione a un vettore: si centra, si tolgono le direzioni
// dominanti, si rinormalizza. Il risultato vive nello spazio di Momentum.
export function correggi(vec, spazio) {
  if (!spazio || !vec || vec.length !== spazio.dim) return vec;
  const out = new Float32Array(spazio.dim);
  for (let i = 0; i < spazio.dim; i++) out[i] = vec[i] - spazio.media[i];
  for (const asse of spazio.assi) {
    const c = punto(out, asse);
    for (let i = 0; i < spazio.dim; i++) out[i] -= c * asse[i];
  }
  return normalizzaVec(out);
}

export function coseno(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  const d = punto(a, b);
  const na = Math.sqrt(punto(a, a)), nb = Math.sqrt(punto(b, b));
  const den = na * nb;
  return den > 0 ? Math.max(-1, Math.min(1, d / den)) : 0;
}

// ── LA MISURA CHE DICE SE E' SERVITO ──
// Non basta applicare una correzione pubblicata: bisogna verificare che su
// QUESTI dati funzioni. `separazione` restituisce di quanto le coppie
// imparentate stanno sopra quelle estranee — prima e dopo. Se il numero non
// migliora, la correzione va tolta invece di essere tenuta perche' e' in un
// paper.
// ── SCEGLIERE k MISURANDO, invece di fidarsi di una costante ──
// Si prova ogni numero di direzioni da togliere e si tiene quello che separa
// meglio le coppie imparentate dalle estranee SUL BANCO DI QUESTO
// DISPOSITIVO. E' il pezzo che rende lo spazio davvero di Momentum: due
// installazioni con banchi diversi possono scegliere k diversi, ed e' giusto
// cosi' — la geometria migliore dipende da cosa quella persona chiede.
// Se nessuna correzione migliora, si restituisce null e si resta com'era:
// una correzione che non serve va tolta, non tenuta perche' e' in un paper.
export function scegliDirezioni(vettori, coppieVicine, coppieLontane, { max = MAX_DIREZIONI_DA_PROVARE } = {}) {
  const base = separazione(coppieVicine, coppieLontane, null);
  if (!base) return null;

  // ── IL CRITERIO GIUSTO E' SENZA SCALA, e il primo era sbagliato ──
  // La prima versione confrontava il DISTACCO GREZZO fra le medie. Ma la
  // correzione cambia proprio la scala — l'avevo scritto io stesso poche
  // righe sopra, che il distacco normalizzato resta invariato — quindi
  // confrontare distacchi fra spazi diversi e' confrontare grandezze diverse.
  // Dal vivo il risultato e' stato che la guardia RIFIUTAVA una correzione
  // che i numeri mostravano utile.
  // Il criterio corretto e' quello che conta davvero e non dipende dalla
  // scala: **quante coppie si confondono** alla soglia migliore. Sono gli
  // scambi veri, ed e' l'unica cosa che l'utente sente.
  // Due grandezze, in quest'ordine di importanza:
  //  · gli ERRORI alla soglia migliore — quante coppie si confondono. Senza
  //    scala, ed e' l'unica cosa che l'utente sente;
  //  · il MARGINE fra i due gruppi — quanto vuoto c'e' intorno alla soglia.
  //    A parita' di errori vince il margine piu' largo, perche' e' quello che
  //    rende la soglia robusta invece che fortunata. Ed e' esattamente cio'
  //    che la correzione fa: l'ordinamento era gia' giusto (misurato), quello
  //    che mancava era lo spazio intorno alla decisione.
  const valuta = (spazio) => {
    const cal = calibraSoglia(coppieVicine, coppieLontane, spazio);
    if (!cal) return { errori: Infinity, margine: -Infinity };
    return { errori: cal.errori, margine: cal.minVicine - cal.maxLontane, cal };
  };
  const vBase = valuta(null);
  const erroriBase = vBase.errori;
  let migliore = { direzioni: null, spazio: null, ...vBase, distacco: base.distacco, sovrapposizioni: base.sovrapposizioni };

  for (let k = 0; k <= max; k++) {
    const spazio = adattaSpazio(vettori, { direzioni: k });
    if (!spazio) continue;
    const s = separazione(coppieVicine, coppieLontane, spazio);
    if (!s) continue;
    const v = valuta(spazio);
    const meglio = v.errori < migliore.errori
      || (v.errori === migliore.errori && v.margine > migliore.margine);
    if (meglio) {
      migliore = { direzioni: k, spazio, ...v, distacco: s.distacco, sovrapposizioni: s.sovrapposizioni, misura: s };
    }
  }

  return {
    ...migliore,
    prima: base,
    erroriPrima: erroriBase,
    // Onesta': se la correzione non ha migliorato niente lo si dice, invece di
    // applicarla comunque.
    margineBase: +vBase.margine.toFixed(4),
    utile: migliore.direzioni !== null
      && (migliore.errori < erroriBase
        || (migliore.errori === erroriBase && migliore.margine > vBase.margine)),
    messaggio: migliore.direzioni === null
      ? 'Nessuna correzione migliora la separazione su questo banco: si resta sullo spazio originale.'
      : `Togliendo ${migliore.direzioni === 0 ? 'la sola direzione media' : `la media e ${migliore.direzioni} ${migliore.direzioni === 1 ? 'asse dominante' : 'assi dominanti'}`}: coppie confuse da ${erroriBase} a ${migliore.errori}, margine intorno alla soglia da ${vBase.margine.toFixed(4)} a ${migliore.margine.toFixed(4)}.`,
  };
}

// ── LA SOGLIA SI CALIBRA, NON SI FISSA ──
// Conseguenza diretta e prevista della correzione: cambiando la geometria
// cambia anche la scala, quindi una soglia scritta a mano diventa sbagliata.
// Misurato dal vivo: con lo spazio adattato la coppia imparentata
// "quanto sono disposto a spendere questo pomeriggio" / "quanto posso
// spendere oggi" scende da 0,9624 a 0,7068 — che e' SOTTO la soglia storica
// di 0,72, e infatti quella domanda ha smesso di essere riconosciuta.
// La soglia giusta e' quella che separa meglio, sul banco di QUESTO
// dispositivo, le coppie dello stesso intento da quelle di intenti diversi.
// Si sceglie provando ogni valore osservato e tenendo quello con meno errori,
// preferendo — a parita' — la soglia PIU' ALTA: un "non ho capito" costa una
// riformulazione, un intento sbagliato costa una risposta a una domanda che
// non e' stata fatta.
export function calibraSoglia(coppieVicine = [], coppieLontane = [], spazio = null) {
  const sim = (p) => {
    const [a, b] = spazio ? [correggi(p[0], spazio), correggi(p[1], spazio)] : p;
    return coseno(a, b);
  };
  const vicine = coppieVicine.map(sim), lontane = coppieLontane.map(sim);
  if (vicine.length < 2 || lontane.length < 2) return null;

  const candidate = [...new Set([...vicine, ...lontane])].sort((a, b) => a - b);
  let migliore = null;
  for (const t of candidate) {
    const persi = vicine.filter((x) => x < t).length;       // imparentate non riconosciute
    const falsi = lontane.filter((x) => x >= t).length;     // estranee scambiate
    const errori = persi + falsi;
    if (!migliore || errori < migliore.errori || (errori === migliore.errori && t > migliore.soglia)) {
      migliore = { soglia: +t.toFixed(4), persi, falsi, errori };
    }
  }
  return {
    ...migliore,
    // La scala effettiva, per capire quanto margine c'e' intorno alla soglia.
    minVicine: +Math.min(...vicine).toFixed(4),
    maxLontane: +Math.max(...lontane).toFixed(4),
    separabili: Math.min(...vicine) > Math.max(...lontane),
    // ── DOVE METTERE LA SOGLIA QUANDO I DUE GRUPPI SONO SEPARATI ──
    // La prima versione usava il PUNTO MEDIO del vuoto fra i due gruppi, ed e'
    // stata smentita dal vivo: sul banco vero il vuoto e' larghissimo (le
    // frasi di intenti diversi sono molto lontane fra loro) e il punto medio
    // e' finito a 0,1029, cioe' quasi tutto passava. La domanda "a quanto
    // ammonta tutto quello che possiedo" ha ricevuto la proiezione di fine
    // mese invece del patrimonio: un CAPIRE MALE, l'errore peggiore.
    //
    // Il motivo dell'errore: la calibrazione vede solo coppie DEL BANCO, e le
    // domande vere di un utente non somigliano a nessuna delle due famiglie —
    // cadono in mezzo, ed e' li' che una soglia a meta' le fa passare tutte.
    //
    // Il criterio corretto viene dall'asimmetria dei costi, gia' scritta in
    // qa-banco-prova.js: non capire costa una riformulazione, capire male
    // risponde con sicurezza alla domanda sbagliata. Quindi si accetta solo
    // cio' che e' vicino almeno quanto la coppia GENUINA PIU' DEBOLE del
    // banco: zero errori sul banco, e nessuna generosita' regalata a chi sta
    // in mezzo.
    // ── LA REGOLA FINALE, dalle distribuzioni MISURATE sul banco vero ──
    //   stesso intento   min 0,495  p25 0,582  mediana 0,661  max 0,928
    //   intenti diversi  min 0,354  p25 0,421  mediana 0,445  max 0,572
    // I due gruppi si sovrappongono di poco (0,495 < 0,572) ma il grosso e'
    // ben separato. Con l'asimmetria dei costi gia' stabilita — capire male
    // e' molto peggio di non capire — la soglia giusta sta APPENA SOPRA il
    // massimo degli estranei: cosi' i falsi positivi sul banco sono ZERO, al
    // prezzo di perdere le coppie genuine piu' deboli.
    // Le due regole scartate, con il motivo:
    //   · punto medio del vuoto -> 0,1029 dal vivo: passava tutto, e "a
    //     quanto ammonta quello che possiedo" riceveva la proiezione di fine
    //     mese invece del patrimonio;
    //   · minimo delle genuine -> 0,495, sotto il massimo degli estranei
    //     (0,572): ammetterebbe coppie di intenti diversi.
    // Un tetto alla mediana delle genuine impedisce che, su un banco molto
    // rumoroso, la soglia salga tanto da non riconoscere piu' niente.
    // ── DOVE METTERE LA SOGLIA: cinque tentativi, quattro smentiti dal vivo ──
    //   1) punto medio del vuoto -> 0,1029: passava tutto;
    //   2) minimo delle coppie genuine -> sotto il massimo delle estranee;
    //   3) tetto alla MEDIANA -> 0,3092, ancora permissiva;
    //   4) tetto al TERZO QUARTILE -> 0,3991: sembrava buona sulle domande di
    //      finanza personale, ma provando l'app come la userebbe un TRADER e'
    //      emersa una regressione grave — "come sta il mercato?", "quanto
    //      rischio di perdere?", "sono davvero diversificato?" ricevevano
    //      tutte "questo mese non avanza nulla: prima il budget", perche'
    //      cadevano sopra la soglia e venivano catturate dal QA personale
    //      prima che quello dei mercati potesse vederle. Il QA di borsa
    //      diventava IRRAGGIUNGIBILE.
    //   5) NESSUN TETTO: la soglia sta dove la mettono i negativi. Se questo
    //      costa qualche parafrasi non riconosciuta, si paga — un "non ho
    //      capito" costa una riformulazione, una domanda dirottata rende
    //      inutilizzabile meta' dell'app.
    // Il tetto proteggeva la copertura, ma la copertura non e' la cosa da
    // proteggere per prima. E gli esempi FUORI DOMINIO servono a poco se poi
    // un tetto impedisce alla soglia di superarli.
    sogliaSicura: +(Math.max(...lontane) + 0.01).toFixed(4),
  };
}

export function separazione(coppieVicine = [], coppieLontane = [], spazio = null) {
  const sim = (p) => {
    const [a, b] = spazio ? [correggi(p[0], spazio), correggi(p[1], spazio)] : p;
    return coseno(a, b);
  };
  const vicine = coppieVicine.map(sim);
  const lontane = coppieLontane.map(sim);
  if (!vicine.length || !lontane.length) return null;
  const m = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mv = m(vicine), ml = m(lontane);
  const tutte = [...vicine, ...lontane];
  const mt = m(tutte);
  const sd = Math.sqrt(tutte.reduce((s, v) => s + (v - mt) ** 2, 0) / Math.max(1, tutte.length - 1)) || 1e-9;
  return {
    mediaVicine: +mv.toFixed(4),
    mediaLontane: +ml.toFixed(4),
    distacco: +(mv - ml).toFixed(4),
    // Il distacco in unita' di dispersione: confrontabile fra spazi diversi,
    // che e' il punto — prima e dopo la correzione le scale cambiano.
    distaccoNormalizzato: +((mv - ml) / sd).toFixed(3),
    // Quante coppie lontane superano la vicina PIU' DEBOLE: e' il numero che
    // conta davvero, perche' e' li' che nascono gli scambi.
    sovrapposizioni: lontane.filter((x) => x >= Math.min(...vicine)).length,
    coppieLontane: lontane.length,
  };
}
