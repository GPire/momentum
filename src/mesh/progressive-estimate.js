// ============================================================
// LA RISPOSTA C'È GIÀ — stima progressiva per il calcolo condiviso
// ============================================================
// `compute-market.js` sa dividere un Monte Carlo fra più dispositivi e
// `compute-reliability.js` sa prevedere chi non consegnerà. Resta il difetto
// strutturale di TUTTI i calcoli distribuiti senza server, che nessuna delle
// due cose risolve: **il risultato è tutto-o-niente**. Cento unità partono,
// novantatré tornano, e non c'è una risposta — c'è un calcolo incompleto.
// Con dispositivi che entrano ed escono di continuo (è la normalità di una
// rete di telefoni, non l'eccezione) questo significa che il caso peggiore è
// anche il caso comune.
//
// IL RIBALTAMENTO: un Monte Carlo non è un compito da completare, è un
// CAMPIONE da cui stimare. Ogni unità che torna è un campione in più, e la
// risposta esiste dalla prima: cambia solo quanto è larga. Un'unità persa non
// rompe niente, allarga di poco l'intervallo. Il tutto-o-niente sparisce non
// perché abbiamo reso la rete affidabile — non si può — ma perché il
// risultato ha smesso di pretenderlo.
//
// E c'è il secondo guadagno, opposto e più grande: quasi sempre **la risposta
// è già decisa molto prima della fine**. Se dopo 1.200 percorsi su 10.000 la
// strategia A batte B con un margine che nessun campione residuo può ribaltare,
// gli altri 8.800 non aggiungono una decisione: aggiungono cifre decimali a un
// verdetto già preso, consumando la batteria di persone che ce l'hanno
// prestata. Fermarsi lì non è approssimare, è smettere di sprecare.
//
// PERCHÉ SI PUÒ FARE QUI E QUASI DA NESSUN'ALTRA PARTE: il settore mostra al
// cliente "il tuo patrimonio fra 10 anni: 184.320 €". È un numero falso nella
// forma prima ancora che nel merito — è la media di una simulazione, e senza
// l'incertezza accanto è una precisione che non esiste. Qui l'incertezza è già
// il meccanismo, quindi mostrarla non costa niente e non si può dimenticare.
//
// PERCHÉ LE UNITÀ MANCANTI NON FALSANO LA STIMA (e non è un dettaglio):
// il valore di un'unità dipende solo dal suo SEME, non dal dispositivo che la
// calcola (compute-market.js lo impone: unità deterministiche, è la proprietà
// su cui si regge anche la verifica anti-menzogna). Quindi *quali* unità
// mancano è deciso da chi si è disconnesso, che è indipendente dal valore che
// quell'unità avrebbe prodotto: mancano a caso rispetto a ciò che si misura, e
// la media dei presenti resta corretta. Se un giorno le unità diventassero
// eterogenee per costruzione (scenari diversi invece di semi diversi) questa
// garanzia cadrebbe: per questo `addUnit` rifiuta le unità dichiarate
// eterogenee invece di lasciare che la statistica menta in silenzio.
//
// Funzioni PURE. Accumulo con l'algoritmo di Welford: numericamente stabile e
// incrementale, che è esattamente la forma del problema (i risultati arrivano
// alla spicciolata, non tutti insieme).
'use strict';

// Sotto questo numero di unità la stima esiste ma non si dichiara affidabile:
// con pochissimi campioni l'errore standard è esso stesso rumore.
export const MIN_CAMPIONI = 8;
// z per il 95%: il livello che si può anche mostrare a un utente senza doverlo
// spiegare. Chi vuole il 99% lo passa esplicitamente.
export const Z_95 = 1.959964;

export function initEstimate({ etichetta = null, totaleUnitaPreviste = null } = {}) {
  return { n: 0, media: 0, m2: 0, min: null, max: null, etichetta, totaleUnitaPreviste, unita: [] };
}

// Aggiunge il risultato di UN'unità di lavoro. Un'unità è quasi sempre un
// LOTTO di percorsi (un dispositivo ne simula cento, non uno), e allora
// restituisce i tre numeri che bastano a ricostruire tutto senza spedire i
// centomila valori: quanti percorsi, la loro media, la loro dispersione (m2 =
// somma degli scarti al quadrato). Per un campione singolo basta `valore`.
//
// ERRORE STATISTICO REALE, trovato dal test dell'innesto e non a tavolino: la
// prima versione accettava (media, peso) e trattava la media di cento percorsi
// come cento campioni tutti uguali a quella media. La dispersione DENTRO
// l'unità spariva, e l'errore standard usciva **dieci volte più piccolo del
// vero** — cioè un intervallo dieci volte troppo stretto, il tipo di bugia più
// pericoloso perché sembra precisione. Ora i lotti si fondono con la formula
// di Chan (esatta e numericamente stabile), e la forma (media, peso) senza
// dispersione non è più accettata: si dichiara `m2`, oppure si mandano i
// valori uno per uno.
export function addUnit(state, { valore = null, n: nUnita = null, media: mediaUnita = null, m2: m2Unita = null, indice = null, eterogenea = false } = {}) {
  const s = state || initEstimate();
  if (eterogenea) {
    throw new Error('unità eterogenea: la stima progressiva vale solo su unità che campionano la STESSA distribuzione (semi diversi, non scenari diversi)');
  }

  let nb, mb, m2b;
  if (valore !== null && valore !== undefined) {
    nb = 1; mb = +valore; m2b = 0;
  } else {
    nb = Math.round(+nUnita);
    mb = +mediaUnita;
    m2b = m2Unita === null || m2Unita === undefined ? null : +m2Unita;
    if (!Number.isFinite(nb) || nb < 1) return s;
    if (nb === 1) m2b = 0; // un solo campione non ha dispersione interna
    if (!(Number.isFinite(m2b) && m2b >= 0)) {
      throw new Error('lotto senza dispersione: servono anche gli scarti (m2), altrimenti l\'intervallo esce più stretto del vero');
    }
  }
  if (!Number.isFinite(mb)) return s;

  // Fusione di due insiemi di campioni (Chan, Golub, LeVeque 1979).
  const na = s.n, n = na + nb;
  const delta = mb - s.media;
  const media = na === 0 ? mb : s.media + (delta * nb) / n;
  const m2 = s.m2 + m2b + (delta * delta * na * nb) / n;
  return {
    ...s, n, media, m2,
    min: s.min === null ? mb : Math.min(s.min, mb),
    max: s.max === null ? mb : Math.max(s.max, mb),
    unita: indice === null ? s.unita : [...s.unita, indice],
  };
}

// La stima ADESSO, con quello che è arrivato finora.
export function estimate(state, { z = Z_95 } = {}) {
  const n = state?.n || 0;
  if (n < 2) {
    return { n, media: n ? state.media : null, deviazione: null, errore: null, semiAmpiezza: null, affidabile: false, motivo: 'servono almeno due campioni' };
  }
  const varianza = state.m2 / (n - 1);
  const deviazione = Math.sqrt(Math.max(0, varianza));
  const errore = deviazione / Math.sqrt(n);
  const semiAmpiezza = z * errore;
  return {
    n, media: state.media, deviazione, errore, semiAmpiezza,
    da: state.media - semiAmpiezza,
    a: state.media + semiAmpiezza,
    // La percentuale è la forma in cui la precisione si legge davvero: 250 € di
    // incertezza su 200.000 € e su 900 € sono due mondi diversi.
    precisioneRelativa: state.media !== 0 ? Math.abs(semiAmpiezza / state.media) : null,
    affidabile: n >= MIN_CAMPIONI,
    motivo: n >= MIN_CAMPIONI ? null : `solo ${n} campioni: la stima c'è ma l'incertezza è ancora rumore`,
  };
}

// QUANTI CAMPIONI SERVONO per arrivare alla precisione chiesta. È la domanda
// che nessuna app si pone: si fissano 10.000 percorsi perché è un numero
// tondo. Qui il numero si DEDUCE dalla variabilità osservata — se il fenomeno
// è tranquillo ne bastano molti meno, se è turbolento non basterebbero
// nemmeno 10.000 e va detto invece di fingere.
export function samplesNeeded(state, { semiAmpiezzaVoluta, z = Z_95, tetto = 1e6 } = {}) {
  const e = estimate(state, { z });
  if (!e.deviazione || !(semiAmpiezzaVoluta > 0)) return { servono: null, motivo: 'ancora non so quanto varia: continuo e ricontrollo' };
  const servono = Math.ceil(((z * e.deviazione) / semiAmpiezzaVoluta) ** 2);
  return {
    servono: Math.min(servono, tetto),
    mancano: Math.max(0, Math.min(servono, tetto) - e.n),
    oltreIlTetto: servono > tetto,
    motivo: servono > tetto
      ? 'per questa precisione servirebbero più campioni di quanti abbia senso chiederne: meglio dichiarare un intervallo più largo'
      : null,
  };
}

// SI PUÒ SMETTERE? Due modi legittimi, entrambi dichiarati:
//  - la precisione chiesta è raggiunta;
//  - le unità sono finite (nessuno può più consegnare) e la stima regge lo stesso.
export function shouldStop(state, { semiAmpiezzaVoluta = null, precisioneRelativaVoluta = null, unitaConsegnate = 0, unitaTotali = null, z = Z_95 } = {}) {
  const e = estimate(state, { z });
  if (!e.affidabile) return { basta: false, motivo: e.motivo || 'troppi pochi campioni', stima: e };

  if (semiAmpiezzaVoluta !== null && e.semiAmpiezza <= semiAmpiezzaVoluta) {
    return { basta: true, perche: 'precisione raggiunta', risparmiate: unitaTotali ? Math.max(0, unitaTotali - unitaConsegnate) : null, stima: e };
  }
  if (precisioneRelativaVoluta !== null && e.precisioneRelativa !== null && e.precisioneRelativa <= precisioneRelativaVoluta) {
    return { basta: true, perche: 'precisione raggiunta', risparmiate: unitaTotali ? Math.max(0, unitaTotali - unitaConsegnate) : null, stima: e };
  }
  if (unitaTotali !== null && unitaConsegnate >= unitaTotali) {
    return { basta: true, perche: 'non arriverà altro', risparmiate: 0, stima: e };
  }
  return { basta: false, motivo: 'la risposta non è ancora abbastanza stretta', stima: e };
}

// IL CONFRONTO FRA DUE OPZIONI — che è quasi sempre la domanda vera ("meglio
// mettere da parte o estinguere il mutuo?"), e si decide molto prima di
// conoscere con precisione i due numeri: per sapere CHI vince non serve sapere
// QUANTO. Welch, perché le due opzioni hanno quasi sempre variabilità diverse.
export function compareOptions(stateA, stateB, { z = Z_95, differenzaTrascurabile = 0 } = {}) {
  const a = estimate(stateA, { z }), b = estimate(stateB, { z });
  if (!a.affidabile || !b.affidabile) {
    return { deciso: false, motivo: 'ancora troppo presto per confrontarle', a, b };
  }
  const diff = a.media - b.media;
  const err = Math.sqrt(a.errore ** 2 + b.errore ** 2);
  const semi = z * err;
  const da = diff - semi, aX = diff + semi;
  // L'intervallo della DIFFERENZA contiene lo zero → non si sceglie. È il caso
  // che il settore risolve mostrando comunque un vincitore.
  if (da <= 0 && aX >= 0) {
    return {
      deciso: false, differenza: diff, da, a: aX,
      motivo: 'la differenza fra le due è ancora dentro il margine di errore: oggi non si può dire quale sia meglio',
      aStima: a, bStima: b,
    };
  }
  // Vince una delle due, ma la differenza potrebbe essere troppo piccola per
  // contare nella vita di chi decide: si dichiara anche questo.
  const vincitrice = diff > 0 ? 'A' : 'B';
  const irrilevante = Math.abs(diff) < differenzaTrascurabile;
  return {
    deciso: true, vincitrice, differenza: diff, da: Math.min(da, aX), a: Math.max(da, aX),
    irrilevante,
    motivo: irrilevante
      ? 'una vince, ma di così poco che nella pratica sono equivalenti'
      : null,
    aStima: a, bStima: b,
  };
}

// Cosa dire alla persona. Mai "intervallo di confidenza", mai "errore
// standard": la precisione si comunica con "fra X e Y", che è la forma in cui
// tutti la capiscono già.
export function estimateText(state, { unita = '€', z = Z_95 } = {}) {
  const e = estimate(state, { z });
  if (e.media === null) return 'Sto ancora calcolando.';
  const r = (x) => Math.round(x).toLocaleString('it-IT');
  if (!e.affidabile) return `Per ora siamo intorno a ${r(e.media)} ${unita}, ma è presto: il numero si sposterà ancora.`;
  return `Fra ${r(e.da)} e ${r(e.a)} ${unita} (più probabile: ${r(e.media)} ${unita}).`;
}

// Il risparmio, detto come lo sente chi ha prestato il telefono.
export function savingsText({ risparmiate, unitaTotali }) {
  if (!risparmiate || !unitaTotali) return null;
  const quota = Math.round((risparmiate / unitaTotali) * 100);
  if (quota < 5) return null;
  return `Risposta già chiara: ho fermato il ${quota}% del calcolo invece di far lavorare gli altri dispositivi per cifre che non cambiano la risposta.`;
}
