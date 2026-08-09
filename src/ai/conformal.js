// ============================================================
// "NON LO SO" CON UNA GARANZIA SOPRA — predizione conforme
// ============================================================
// Ogni modello di Momentum produce un numero: la categoria di una spesa, il
// saldo fra tre mesi, l'IVA da versare, il rendimento di una strategia. Tutti
// questi numeri hanno una cosa in comune, ed è il difetto più diffuso del
// settore: **sono presentati come se fossero certi**. "Il tuo patrimonio fra
// 10 anni: 184.320 €" è falso nella forma prima ancora che nel merito.
//
// La risposta abituale è mostrare la "confidenza" del modello — ma la
// confidenza di un modello è un'opinione del modello su sé stesso, e i modelli
// piccoli sono notoriamente troppo sicuri di sé. Dire "87% di probabilità che
// sia Ristorante" non promette niente a nessuno: non esiste alcuna garanzia
// che, sulle cento volte in cui il modello dice 87%, ne azzecchi 87.
//
// LA PREDIZIONE CONFORME dà l'unica cosa che conta davvero: **una garanzia di
// copertura dimostrata, valida per QUALUNQUE modello sottostante e senza
// assumere niente sulla distribuzione dei dati**. Se si chiede il 90%, allora
// nel 90% dei casi la risposta vera è dentro ciò che viene mostrato. Non è
// un'opinione del modello: è una proprietà matematica di come si sceglie la
// soglia, e regge anche se il modello sotto è mediocre.
//
// COME, in una riga: si tiene da parte un insieme di CALIBRAZIONE (casi di cui
// si conosce la risposta vera), si misura quanto il modello è stato "scomodo"
// su ciascuno, si prende il quantile giusto di quegli scarti, e lo si usa come
// soglia per i casi nuovi. Tutto qui — nessun riaddestramento, nessuna
// assunzione, costo quasi nullo (un ordinamento).
//
// COSA CAMBIA PER CHI USA MOMENTUM, che è il motivo per cui vale la pena:
//  - Le spese: invece di sbagliare in silenzio, l'app può dire "è Bar oppure
//    Ristorante" quando davvero non sa distinguere, e chiedere solo lì. Le
//    domande all'utente crollano perché si fanno solo dove servono.
//  - La cassa e il fisco: un intervallo onesto invece di un numero finto.
//  - Gli investimenti: la stessa disciplina già usata per lo Sharpe
//    deflazionato, estesa a ogni previsione.
//
// IL LIMITE, dichiarato perché è serio: la garanzia vale se il futuro somiglia
// al passato (scambiabilità). Un trasloco, un lavoro nuovo, un mercato che
// cambia regime la rompono. Per questo c'è anche la versione ADATTIVA (Gibbs &
// Candès, 2021): osserva quante volte ha sbagliato di recente e stringe o
// allarga da sola. Non ripristina la garanzia teorica, ma la insegue — ed è
// molto meglio che accorgersene sei mesi dopo.
//
// Riferimenti: Vovk-Gammerman-Shafer (2005) per la conforme split; Gibbs &
// Candès (2021) per l'inferenza conforme adattiva.
// Funzioni PURE.
'use strict';

// Sotto questo numero di esempi di calibrazione la garanzia NON è ottenibile,
// e il codice lo dice invece di fingerla: con n esempi il livello massimo
// garantibile è n/(n+1), quindi per il 90% servono almeno 9 esempi, per il 95%
// almeno 19. È aritmetica, non prudenza.
export function minCalibrationFor(alpha) { return Math.ceil(1 / alpha) - 1; }

// Il quantile conforme: NON il quantile campionario, ma quello corretto per il
// campione finito — ⌈(n+1)(1-α)⌉/n. È la correzione che rende la garanzia
// dimostrata invece che approssimata, e dimenticarla è l'errore più comune
// nelle implementazioni fatte in casa.
export function conformalQuantile(scores = [], alpha = 0.1) {
  const s = scores.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const n = s.length;
  if (!n) return { q: Infinity, n: 0, garantito: false, motivo: 'nessun esempio di calibrazione' };
  const k = Math.ceil((n + 1) * (1 - alpha));
  if (k > n) {
    // Caso onesto e importante: il livello chiesto è irraggiungibile con
    // questi esempi. Si restituisce l'infinito, che a valle significa
    // "l'insieme contiene tutto" o "l'intervallo è illimitato" — cioè
    // l'ammissione di non sapere, che è la risposta corretta.
    return { q: Infinity, n, garantito: false, motivo: `con ${n} esempi non si può garantire il ${Math.round((1 - alpha) * 100)}%: ne servono almeno ${minCalibrationFor(alpha)}` };
  }
  return { q: s[k - 1], n, garantito: true, motivo: null };
}

// ── CLASSIFICAZIONE: insiemi di risposte, non una risposta sola ──
// Il punteggio di non-conformità è 1 − p(vera): quanto il modello è stato
// scomodo sul caso di cui conosciamo la risposta.
export function calibrateClassifier(esempi = []) {
  const scores = [];
  for (const e of esempi) {
    const p = e?.distribuzione?.[e?.vera];
    scores.push(Number.isFinite(p) ? 1 - p : 1); // categoria mai prevista: scomodità massima
  }
  return { tipo: 'classificazione', scores };
}

// L'insieme di predizione: TUTTE le categorie abbastanza plausibili. Se ne
// resta una sola, l'app può agire da sola; se ne restano due, deve chiedere —
// ma una domanda sola e mirata, non un elenco.
export function predictSet(distribuzione = {}, calibrazione, { alpha = 0.1 } = {}) {
  const { q, n, garantito, motivo } = conformalQuantile(calibrazione?.scores, alpha);
  const voci = Object.entries(distribuzione).filter(([, p]) => Number.isFinite(p));
  const dentro = voci.filter(([, p]) => 1 - p <= q).map(([c]) => c);
  // L'INSIEME VUOTO È UNA RISPOSTA, e va lasciato vuoto.
  // Prima riempivo l'insieme con TUTTE le categorie quando nessuna passava la
  // soglia, pensando fosse il modo prudente di dire "non lo so". Misurato: la
  // copertura saliva al 98,7% invece del 90% chiesto. Non è un errore di
  // sicurezza (coprire di più non fa danno) ma è una garanzia GONFIATA — e una
  // garanzia gonfiata è esattamente ciò che questo modulo esiste per non fare.
  // Un insieme vuoto dice "nessuna delle risposte che conosco è plausibile
  // qui", che è informativo e onesto; `fuoriDominio` lo segnala e `migliore`
  // resta disponibile per la UI.
  const insieme = dentro;
  const migliore = [...voci].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return {
    insieme, migliore,
    ampiezza: insieme.length,
    // L'unico caso in cui si può agire senza chiedere.
    certo: insieme.length === 1,
    // Nessuna categoria plausibile: il caso è fuori da tutto ciò che il modello
    // ha visto. Vale la pena saperlo — è il segnale di una categoria nuova.
    fuoriDominio: dentro.length === 0 && voci.length > 0,
    copertura: 1 - alpha, garantito, nCalibrazione: n, motivo,
  };
}

// ── REGRESSIONE: intervalli onesti su cassa, fisco, rendimenti ──
export function calibrateRegressor(esempi = []) {
  const scores = [];
  for (const e of esempi) {
    const p = +e?.previsto, v = +e?.vero;
    if (Number.isFinite(p) && Number.isFinite(v)) scores.push(Math.abs(v - p));
  }
  return { tipo: 'regressione', scores };
}

export function predictInterval(previsto, calibrazione, { alpha = 0.1 } = {}) {
  const { q, n, garantito, motivo } = conformalQuantile(calibrazione?.scores, alpha);
  const p = +previsto;
  if (!Number.isFinite(p)) return { da: null, a: null, garantito: false, motivo: 'previsione non disponibile' };
  return {
    centro: p,
    da: q === Infinity ? -Infinity : p - q,
    a: q === Infinity ? Infinity : p + q,
    semiAmpiezza: q,
    illimitato: q === Infinity,
    copertura: 1 - alpha, garantito, nCalibrazione: n, motivo,
  };
}

// ── LA VERSIONE ADATTIVA: quando la vita cambia ──
// Gibbs & Candès: si tiene un α "di lavoro" che si muove da solo. Se ha
// sbagliato più del previsto, α cala (intervalli più larghi); se ha sbagliato
// meno, α sale (più stretti). Una riga per passo, e insegue il cambiamento
// invece di scoprirlo mesi dopo.
export const PASSO_ADATTIVO = 0.02;

export function initAdaptive(alphaTarget = 0.1) {
  return { alphaTarget, alpha: alphaTarget, storia: [], coperti: 0, totali: 0 };
}

export function updateAdaptive(stato, coperto, { passo = PASSO_ADATTIVO } = {}) {
  const s = stato || initAdaptive();
  const errore = coperto ? 0 : 1;
  // α_{t+1} = α_t + γ(α_target − errore_osservato)
  const alpha = Math.min(0.5, Math.max(0.001, s.alpha + passo * (s.alphaTarget - errore)));
  return {
    ...s, alpha,
    coperti: s.coperti + (coperto ? 1 : 0),
    totali: s.totali + 1,
    storia: [...s.storia, coperto].slice(-200),
  };
}

// La copertura VERA, misurata. È il numero che dice se la garanzia sta
// reggendo nella realtà di questa persona — e va guardato, non assunto.
export function observedCoverage(stato, { finestra = 100 } = {}) {
  const recenti = (stato?.storia || []).slice(-finestra);
  if (!recenti.length) return { copertura: null, n: 0, inLinea: null, motivo: 'non ho ancora abbastanza casi verificati' };
  const cop = recenti.filter(Boolean).length / recenti.length;
  const atteso = 1 - (stato.alphaTarget ?? 0.1);
  // Tolleranza dall'errore standard binomiale: uno scostamento dentro il
  // rumore non è un problema, e trattarlo come tale sarebbe allarmismo.
  const se = Math.sqrt((atteso * (1 - atteso)) / recenti.length);
  return {
    copertura: +cop.toFixed(3), n: recenti.length, atteso,
    inLinea: Math.abs(cop - atteso) <= 2 * se,
    motivo: Math.abs(cop - atteso) <= 2 * se ? null
      : cop < atteso
        ? 'sto sbagliando più di quanto avevo promesso: allargo le stime'
        : 'sto andando meglio del promesso: posso stringere le stime',
  };
}

// ── Come si dice a una persona ──
// Niente "insieme di predizione conforme al 90%": si dice quello che l'app sa
// e quello che non sa, in italiano.
export function setText(risultato, { nomi = null } = {}) {
  const nome = (c) => nomi?.[c] || c;
  // L'insieme vuoto va letto PRIMA: è il caso "niente di plausibile", che ha
  // una frase sua e non va confuso con "non ho capito la domanda".
  if (risultato?.fuoriDominio) return 'Questa non somiglia a niente che abbia già visto: dimmi tu cos\'è.';
  if (!risultato?.insieme?.length) return 'Non riesco a inquadrare questa spesa.';
  if (risultato.certo) return `È ${nome(risultato.insieme[0])}.`;
  if (risultato.ampiezza === 2) return `È ${nome(risultato.insieme[0])} oppure ${nome(risultato.insieme[1])}: quale delle due?`;
  return `Potrebbe essere ${risultato.insieme.slice(0, 3).map(nome).join(', ')}… su questa non ci arrivo da solo.`;
}

export function intervalText(intervallo, { unita = '€' } = {}) {
  if (!intervallo || intervallo.da === null) return 'Non ho ancora abbastanza dati per dirlo.';
  if (intervallo.illimitato) return `La mia stima è ${Math.round(intervallo.centro).toLocaleString('it-IT')} ${unita}, ma ho visto troppo poco per dirti quanto posso sbagliare.`;
  const r = (x) => Math.round(x).toLocaleString('it-IT');
  return `Fra ${r(intervallo.da)} e ${r(intervallo.a)} ${unita}, con ${Math.round(intervallo.copertura * 100)} probabilità su 100.`;
}

// ── Il numero che dice se serve chiedere all'utente ──
// Quante volte, su cento spese, l'app dovrà davvero interrompere qualcuno. È
// la metrica anti-abbandono di tutto questo modulo: se sale, la conforme sta
// funzionando male o il modello è peggiorato, e in entrambi i casi va saputo.
export function interruptionRate(risultati = []) {
  if (!risultati.length) return { quota: null, n: 0 };
  const daChiedere = risultati.filter((r) => !r.certo).length;
  return {
    quota: +(daChiedere / risultati.length).toFixed(3),
    daChiedere, n: risultati.length,
    ampiezzaMedia: +(risultati.reduce((s, r) => s + r.ampiezza, 0) / risultati.length).toFixed(2),
  };
}
