// ============================================================
// IL RIFIUTO STRUTTURALE — un confine che non dipende dalla lingua
// ============================================================
// Cosa risolve, con onestà sui limiti. `mercato-qa.js` difende oggi
// (DOMANDE_SENZA_RISPOSTA) con ~70 frasi scritte a mano in 6 lingue: "cosa
// devo comprare", "what should I buy", "que deberia comprar"... Funziona, ma
// ogni lingua nuova o ogni modo nuovo di formulare la stessa domanda vuole
// un'altra riga scritta a mano — ed è la superficie che questa sessione ha
// già trovato bucata due volte dal vivo (prima solo italiano, poi mancavano
// le formulazioni indirette).
//
// Qui il confine è diverso PER COSTRUZIONE, non perché sia più furbo: un
// oggetto `interrogazione` (interrogazione.js) non porta più testo libero in
// 6 lingue — porta identificativi di codice (`misura`, `operazione`) che SOLO
// il nostro codice assegna (oggi capacita-registrate.js; domani un parser
// linguaggio→interrogazione). Il problema "in quante lingue lo chiedono"
// smette di esistere a questo livello: non c'è nessuna lingua qui, ci sono
// stringhe che noi stessi abbiamo scelto.
//
// ── IL LIMITE, dichiarato e non nascosto ──
// Questo NON sostituisce `mercato-qa.js`/`qa-engine.js` oggi: quelle
// funzioni ricevono ancora TESTO LIBERO scritto da una persona, in qualunque
// lingua, e restano la difesa vera finché non esiste un parser che traduce
// quel testo in un'interrogazione tipizzata. Questo file è il secondo
// strato, quello che protegge il pianificatore anche se un domani quel
// parser (o un bug, o una capacità mal scritta) producesse per sbaglio
// un'interrogazione che chiede un consiglio — un guardiano indipendente,
// non un rimpiazzo del primo.
// Funzioni PURE.
'use strict';

// Misure che, qualunque sia l'operazione che le porta, SONO una richiesta di
// consiglio scritta con altre parole. Elenco chiuso e piccolo apposta: non è
// testo libero da indovinare, sono gli unici identificativi che il nostro
// stesso codice può assegnare — se non è qui, nessuna capacità lo produce.
export const MISURE_VIETATE = Object.freeze(new Set([
  'consiglio', 'raccomandazione', 'cosa-comprare', 'cosa-vendere',
  'direzione-prezzo', 'previsione-prezzo', 'timing-mercato', 'prossima-mossa',
]));

// Una misura di prezzo/direzione chiesta su una finestra FUTURA è la stessa
// domanda di "cosa devo comprare", solo posta come previsione invece che
// come richiesta esplicita ("salirà?" == "conviene comprare?"): stesso
// principio già scritto in mercato-qa.js per "salira'"/"scendera'".
const RE_MISURA_PREDITTIVA = /prezzo|direzione|salir|scender/i;

export function richiedeConsiglio(interrogazione) {
  if (!interrogazione) return false;
  if (MISURE_VIETATE.has(interrogazione.misura)) return true;
  if (interrogazione.finestra?.futuro && RE_MISURA_PREDITTIVA.test(interrogazione.misura)) return true;
  if (interrogazione.vincoli?.tipoRisposta === 'raccomandazione') return true;
  return false;
}

// Lo stesso principio di onestà già usato in mercato-qa.js: spiegare perché
// no, non solo dire di no.
export const MESSAGGIO_RIFIUTO =
  'Non è una domanda a cui rispondo con un consiglio o una previsione: nessuno sa cosa farà il mercato, e chi te lo dice sta indovinando o ti sta vendendo qualcosa.';
