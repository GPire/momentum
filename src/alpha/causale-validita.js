// ============================================================
// QUANDO UNA FRECCIA CAUSALE NON SI PUÒ TRACCIARE
// ============================================================
// `macro-causality.js` ha gia' fatto la cosa piu' importante: mostrare che sui
// livelli il motore trova cinque legami e sulle variazioni non ne sopravvive
// nessuno. Ma quel controllo e' UNO, e la letteratura sulla scoperta causale
// applicata ai mercati ne documenta altri tre che nessun software del settore
// applica — e che, applicati, invalidano gran parte di cio' che viene
// pubblicato come "relazione causale" in finanza.
//
// Questo file e' il guardiano da mettere PRIMA di qualunque freccia. Non
// scopre relazioni: decide se abbia senso cercarne, e in caso contrario dice
// perche' no. E' il pezzo che manca a tutti, e non perche' sia difficile —
// perche' fa sembrare i modelli molto meno bravi di come vengono raccontati.
//
// ── LE TRE DIFESE, e da dove vengono ──
//
// 1. IL CAMPIONE E' QUASI SEMPRE TROPPO PICCOLO, e nessuno lo dice.
//    L'algoritmo PC (e i suoi discendenti, PCMCI incluso) ha soltanto garanzie
//    ASINTOTICHE: nessun limite valido su campioni finiti, nessun intervallo di
//    confidenza sulla struttura stimata. Le valutazioni empiriche indicano che
//    per identificare in modo affidabile certe relazioni sono serviti oltre
//    1500 campioni. Su dati MENSILI significa oltre 125 anni: una soglia che
//    nessuna serie macro raggiunge. Conseguenza onesta e scomoda: sui dati
//    mensili la scoperta causale non e' "meno precisa", e' **non
//    identificabile**, e va detto invece di stimare comunque.
//    (Runge et al.; sintesi in "Granger Causality: A Review and Recent
//    Advances", arXiv:2105.02675.)
//
// 2. LA STRUTTURA CAMBIA NEL TEMPO. PCMCI assume che un legame ci sia o non ci
//    sia per TUTTO il periodo. Sui mercati e' falso: i regimi cambiano, e un
//    regime non osservato e' un confondente latente a tutti gli effetti. Se la
//    finestra attraversa una rottura, il grafo stimato descrive un sistema che
//    non e' mai esistito — e' la media di due sistemi diversi.
//    (Saggioro et al., arXiv:2007.00267; "SpaceTime", arXiv:2501.10235;
//    "On the Three Demons in Causality in Finance", arXiv:2401.05414, che
//    elenca esattamente questi ostacoli come specifici della finanza.)
//    Nota misurata da altri e coerente con il nostro archivio: le reti di
//    causalita' appaiono PIU' connesse durante le crisi (2008, 2020) — cioe'
//    proprio quando la stazionarieta' salta. La connettivita' che sembra un
//    segnale e' in buona parte un artefatto.
//
// 3. FRECCIA SINGOLA DOVE C'E' UN ANELLO. Se A precede B, B precede A, e le
//    due si muovono anche nello stesso istante, riportare "A causa B" e'
//    ingannevole: e' co-movimento, o retroazione. Sui mercati e' la norma
//    (azionario e credito, tassi lunghi e azioni). Geweke ha formalizzato la
//    separazione fra retroazione e simultaneita': qui si usa la sua logica per
//    DECLASSARE l'esito, non per raffinarlo.
//
// Le tre difese non rendono il motore causale piu' potente. Lo rendono
// onesto — che, quando la posta sono i soldi di una persona, e' di piu'.
// Funzioni PURE.
'use strict';

// Oltre 1500 osservazioni per una identificazione affidabile: la soglia
// riportata dalla letteratura empirica. Su dati mensili sono 125 anni.
export const CAMPIONI_PER_IDENTIFICARE = 1500;
export const PERMUTAZIONI = 499;

const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const varianza = (a) => { const m = media(a); return a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1); };

// ── 1. Il campione basta? ──
// `perAnno` dice quante osservazioni produce un anno di dati: 12 mensili, 252
// giornaliere. Serve a tradurre la soglia in una frase comprensibile.
export function adeguatezzaCampione(n, { perAnno = 12, relazioniCercate = 1 } = {}) {
  // Con piu' relazioni cercate contemporaneamente il problema peggiora: ogni
  // confronto in piu' e' un'altra occasione di trovare qualcosa per caso.
  const richiesti = CAMPIONI_PER_IDENTIFICARE * Math.max(1, relazioniCercate);
  const anniServiti = richiesti / perAnno;
  const anniDisponibili = n / perAnno;
  const rapporto = n / richiesti;
  return {
    osservazioni: n,
    richiesti,
    rapporto: +rapporto.toFixed(3),
    identificabile: n >= richiesti,
    messaggio: n >= richiesti
      ? `Con ${n} osservazioni il campione e' nell'ordine di grandezza che la letteratura indica come sufficiente.`
      : `Con ${n} osservazioni (circa ${anniDisponibili.toFixed(0)} anni) siamo a ${(100 * rapporto).toFixed(0)}% di quanto serve: per identificare in modo affidabile ${relazioniCercate === 1 ? 'una relazione' : `${relazioniCercate} relazioni`} servirebbero circa ${richiesti} osservazioni, cioe' ${anniServiti.toFixed(0)} anni di dati a questa frequenza. Non e' una stima meno precisa: e' una struttura non identificabile, e chiamarla in altro modo sarebbe disonesto.`,
  };
}

// ── 2. La finestra attraversa una rottura? ──
// Si cerca il punto di divisione che massimizza la differenza fra i due
// tratti (in media e in dispersione, perche' sui mercati cambia soprattutto la
// seconda) e si valuta con una permutazione: se rimescolando l'ordine si
// ottiene spesso una divisione altrettanto netta, non c'e' rottura — c'e'
// rumore. Nessuna ipotesi sulla forma della distribuzione.
export function rotturaStrutturale(serie = [], { minTratto = 24, permutazioni = PERMUTAZIONI, rng = Math.random } = {}) {
  const x = serie.filter(Number.isFinite);
  if (x.length < minTratto * 2) return null;

  const statistica = (arr) => {
    let best = 0, dove = -1;
    for (let k = minTratto; k <= arr.length - minTratto; k++) {
      const a = arr.slice(0, k), b = arr.slice(k);
      // Distanza combinata: quanto si spostano centro e dispersione. La
      // dispersione e' normalizzata perche' su rendimenti e' li' che i regimi
      // si vedono davvero.
      const dm = Math.abs(media(a) - media(b));
      const va = varianza(a), vb = varianza(b);
      const dv = Math.abs(Math.sqrt(va) - Math.sqrt(vb));
      const scala = Math.sqrt(varianza(arr)) || 1e-9;
      const d = (dm + dv) / scala;
      if (d > best) { best = d; dove = k; }
    }
    return { best, dove };
  };

  const oss = statistica(x);
  let estremi = 0;
  for (let p = 0; p < permutazioni; p++) {
    const m = x.slice();
    for (let i = m.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [m[i], m[j]] = [m[j], m[i]]; }
    if (statistica(m).best >= oss.best) estremi++;
  }
  const pv = (estremi + 1) / (permutazioni + 1);
  return {
    puntoDiRottura: oss.dove,
    intensita: +oss.best.toFixed(3),
    p: +pv.toFixed(3),
    rotturaPresente: pv < 0.05,
    messaggio: pv < 0.05
      ? `La finestra attraversa un cambio di regime (all'osservazione ${oss.dove}): un grafo causale stimato su tutto il periodo descriverebbe la media di due sistemi diversi, cioe' un sistema che non e' mai esistito.`
      : 'Nessun cambio di regime distinguibile dentro la finestra: su questo fronte la stima non e\' invalidata.',
  };
}

// ── 3. Freccia, anello o co-movimento? ──
// Riceve le tre evidenze gia' calcolate altrove e decide come CHIAMARE il
// risultato. Non raffina niente: declassa.
export function classificaLegame({ aVersoB = false, bVersoA = false, contemporanea = 0, soglianContemporanea = 0.5 } = {}) {
  const forteOra = Math.abs(contemporanea) >= soglianContemporanea;
  if (aVersoB && bVersoA) {
    return {
      tipo: 'retroazione',
      affidabile: false,
      messaggio: 'Ciascuna delle due precede l\'altra: e\' un anello, non una freccia. In questi casi la domanda "chi causa chi" non ha una risposta unica, e sceglierne una sarebbe arbitrario.',
    };
  }
  if ((aVersoB || bVersoA) && forteOra) {
    return {
      tipo: 'co-movimento',
      affidabile: false,
      messaggio: `Si muovono forte nello stesso istante (${contemporanea.toFixed(2)}): un legame ritardato in presenza di simultaneita' cosi' marcata e' quasi sempre la stessa cosa vista due volte, non una causa. Declassato a co-movimento.`,
    };
  }
  if (aVersoB || bVersoA) {
    return {
      tipo: 'precedenza',
      affidabile: true,
      // La parola giusta e' "precede", non "causa": e' cio' che il dato dice.
      messaggio: 'Una precede l\'altra e non vale il contrario, senza forte simultaneita\': e\' una precedenza temporale — utile, e comunque non una prova di causa.',
    };
  }
  return { tipo: 'nessuno', affidabile: true, messaggio: 'Nessuna precedenza rilevata in nessuno dei due versi.' };
}

// ── Il guardiano ──
// Da chiamare PRIMA di mostrare qualunque freccia. Se anche una sola difesa
// scatta, il risultato va presentato come non affidabile.
export function valutaValidita(serie = [], { perAnno = 12, relazioniCercate = 1, legame = null, rng = Math.random, permutazioni = PERMUTAZIONI } = {}) {
  const campione = adeguatezzaCampione(serie.filter(Number.isFinite).length, { perAnno, relazioniCercate });
  const rottura = rotturaStrutturale(serie, { rng, permutazioni });
  const classe = legame ? classificaLegame(legame) : null;

  const problemi = [];
  if (!campione.identificabile) problemi.push('campione');
  if (rottura?.rotturaPresente) problemi.push('regime');
  if (classe && !classe.affidabile) problemi.push('direzione');

  return {
    campione, rottura, classe,
    problemi,
    utilizzabile: problemi.length === 0,
    // La riga che va mostrata all'utente al posto della freccia.
    messaggio: problemi.length === 0
      ? 'I controlli di validita\' non hanno trovato ostacoli: la relazione si puo\' presentare, ricordando che precedenza non significa causa.'
      : `Questa relazione non va presentata come causa. ${[
        !campione.identificabile ? campione.messaggio : null,
        rottura?.rotturaPresente ? rottura.messaggio : null,
        classe && !classe.affidabile ? classe.messaggio : null,
      ].filter(Boolean).join(' ')}`,
  };
}
