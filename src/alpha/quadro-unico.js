// ============================================================
// UNA DECISIONE, NON TRE NUMERI
// ============================================================
// A questo punto Momentum misura tre cose che nessun'altra app misura insieme:
// il regime macro (curva dei rendimenti, credito, disoccupazione), lo stress
// del mercato azionario, e il rischio che la TUA cassa ti costringa a vendere.
// Messe una accanto all'altra restano tre numeri, e tre numeri non sono una
// decisione: sono tre modi di preoccuparsi.
//
// IL PROBLEMA VERO DEL SETTORE non è la mancanza di indicatori — ce ne sono
// migliaia — è che nessuno dice **a che distanza ciascuno funziona**. Un
// segnale letto all'orizzonte sbagliato non è inutile: è dannoso, perché è
// spesso girato al contrario. Misurato qui, walk-forward, sugli stessi dati:
//
//                    adesso   3 mesi   6 mesi   18 mesi
//   spread credito    0,970    0,808    0,619     0,303
//   curva rendimenti  0,727    0,293    0,365     0,822
//
// I due segnali più citati della macroeconomia sono **complementari nel
// tempo**: il credito sa quasi tutto di adesso e niente del futuro; la curva
// non sa niente di adesso e parecchio di fra un anno e mezzo. E a **6 e 12
// mesi non funziona nessuno dei due** (0,619 e 0,136 il credito; 0,365 e 0,600
// la curva) — c'è una finestra cieca proprio nell'orizzonte su cui la maggior
// parte delle decisioni viene presa, e dichiararla vale più che riempirla con
// un numero inventato.
//
// COSA SI FA CON QUESTO. La decisione non è mai "compra" o "vendi": non lo
// sappiamo, nessuno lo sa, e dirlo sarebbe l'unica cosa davvero irresponsabile
// che questo codice potrebbe fare. La decisione è **quanto devi poter
// aspettare** — cioè quanta liquidità ti serve per non essere costretto a
// vendere nel momento peggiore. È l'unica leva che una persona controlla
// davvero, ed è l'unica domanda a cui i tre segnali insieme sanno rispondere.
//
// E IL PEZZO CHE LI FA PARLARE: gli scenari non si generano più da tutta la
// storia con uguale probabilità, ma **preferendo i mesi che assomigliavano a
// oggi** (bootstrap condizionato al regime). Così lo stato del mercato non è
// una decorazione accanto al numero: entra nel numero.
//
// Funzioni PURE.
'use strict';

import { MACRO, MACRO_MESI } from './macro-panel.js';
import { probabilitaRecessione, regolaSahm } from './macro-regime.js';
import { stressIndex } from './market-stress.js';
import { forcedSaleRisk, bufferNeeded } from './forced-sale-risk.js';
import { ampiezzaCondizionamento, statisticheSerie } from './historical-sequences.js';

// Le due colonne della tabella qui sopra, non riscritte a mano: si ricalcolano.
export const ORIZZONTI_PROVATI = [0, 3, 6, 12, 18];

const sig = (z) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

function logistica1(x, y) {
  let b0 = 0, b1 = 0;
  for (let it = 0; it < 30; it++) {
    let g0 = 0, g1 = 0, h00 = 1e-4, h01 = 0, h11 = 1e-4;
    for (let i = 0; i < x.length; i++) {
      const p = sig(b0 + b1 * x[i]), e = y[i] - p, w = Math.max(1e-6, p * (1 - p));
      g0 += e; g1 += e * x[i]; h00 += w; h01 += w * x[i]; h11 += w * x[i] * x[i];
    }
    const det = h00 * h11 - h01 * h01;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) break;
    b0 += (h11 * g0 - h01 * g1) / det;
    b1 += (h00 * g1 - h01 * g0) / det;
  }
  return [b0, b1];
}

// A che distanza ciascun segnale funziona, misurato walk-forward.
export function orizzonteDiCiascunSegnale({ segnali = ['credito', 'curva'], orizzonti = ORIZZONTI_PROVATI, minStoria = 240 } = {}) {
  const risultati = {};
  for (const v of segnali) {
    risultati[v] = orizzonti.map((h) => {
      const pred = [];
      for (let t = minStoria; t + h < MACRO_MESI; t++) {
        const X = [], Y = [];
        for (let i = 0; i + h < t; i++) {
          if (MACRO[v][i] === null || MACRO.rec[i + h] === null) continue;
          X.push(MACRO[v][i]); Y.push(MACRO.rec[i + h]);
        }
        if (X.length < 60) continue;
        const [b0, b1] = logistica1(X, Y);
        pred.push({ p: sig(b0 + b1 * MACRO[v][t - 1]), y: MACRO.rec[t - 1 + h] });
      }
      const pos = pred.filter((p) => p.y === 1).map((p) => p.p);
      const neg = pred.filter((p) => p.y === 0).map((p) => p.p);
      let c = 0;
      for (const a of pos) for (const b of neg) c += a > b ? 1 : a === b ? 0.5 : 0;
      const auc = pos.length && neg.length ? c / (pos.length * neg.length) : null;
      return {
        orizzonte: h,
        auc: auc === null ? null : +auc.toFixed(4),
        affidabile: auc !== null && auc > 0.7,
        girato: auc !== null && auc < 0.45,
      };
    });
  }
  // La finestra cieca: gli orizzonti in cui NESSUN segnale è affidabile.
  const cieca = ORIZZONTI_PROVATI.filter((h) =>
    segnali.every((v) => !risultati[v].find((r) => r.orizzonte === h)?.affidabile));
  return { perSegnale: risultati, finestraCieca: cieca };
}

// ── Lo stato di ADESSO, letto con i segnali che di adesso sanno qualcosa ──
export function statoOggi() {
  const t = MACRO_MESI;
  const credito = MACRO.credito[t - 1];
  const storici = MACRO.credito.filter(Number.isFinite);
  const percentileCredito = storici.filter((x) => x <= credito).length / storici.length;
  const stress = stressIndex();
  const sahm = regolaSahm();

  // Tre voci indipendenti sullo stesso istante. Il caso interessante è quando
  // NON concordano — e succede spesso, perché guardano mercati diversi.
  const voti = [
    percentileCredito > 0.8 ? 1 : percentileCredito < 0.4 ? -1 : 0,
    stress.indice === null ? 0 : stress.indice > 0.66 ? 1 : stress.indice < 0.33 ? -1 : 0,
    sahm.scattata ? 1 : -1,
  ];
  const somma = voti.reduce((a, b) => a + b, 0);
  return {
    creditoSpread: credito,
    creditoPercentile: +percentileCredito.toFixed(3),
    stressAzionario: stress.indice,
    statoAzionario: stress.stato,
    sahm: sahm.valore,
    sahmScattata: sahm.scattata,
    stato: somma >= 2 ? 'difficile' : somma <= -2 ? 'sereno' : 'misto',
    concordi: Math.abs(somma) === 3,
    voti,
  };
}

// ── Cosa potrebbe arrivare, letto con il segnale che di futuro sa qualcosa ──
export function statoFuturo() {
  const p = probabilitaRecessione();
  return {
    probabilitaRecessione18Mesi: p.probabilita,
    curva: p.curva,
    invertita: p.invertita,
    // Onestà obbligatoria: la curva ha ragione spesso e non dice MAI quando.
    avviso: 'l\'anticipo storico va da 2 a 23 mesi: questo dice SE, non QUANDO',
  };
}

// ── LA DECISIONE ──
// Tre segnali, un'unica leva: quanta liquidità serve per non essere costretti a
// vendere. Gli scenari sono generati preferendo i mesi che assomigliavano a
// oggi, così lo stato del mercato entra nel numero invece di stargli accanto.
export function decisioneUnica(profilo, { obiettivo = 0.1, percorsi = 1500, seed = 4242 } = {}) {
  const oggi = statoOggi();
  const futuro = statoFuturo();
  const ampiezza = ampiezzaCondizionamento();

  // Scenari CONDIZIONATI al regime di oggi: e' il punto dell'intero modulo.
  const scenario = { ...profilo, generatore: 'storico-condizionato' };
  // Il confronto con gli scenari non condizionati e' la prova che il
  // condizionamento sta facendo qualcosa: se i due numeri coincidessero,
  // parlare di "regime" sarebbe decorazione.
  const rischioNonCondizionato = forcedSaleRisk({ ...profilo, generatore: 'storico' }, { percorsi, seed });
  const rischioGenerale = forcedSaleRisk(scenario, { percorsi, seed });
  const cuscinetto = bufferNeeded(scenario, { obiettivo, percorsi: Math.round(percorsi * 0.8), seed });

  // Il regime difficile alza l'asticella: non cambiando il modello, ma
  // chiedendo una soglia più stretta. È una scelta dichiarata, non un
  // aggiustamento nascosto dentro un coefficiente.
  const obiettivoRegime = oggi.stato === 'difficile' ? obiettivo / 2 : obiettivo;
  const cuscinettoRegime = obiettivoRegime === obiettivo
    ? cuscinetto
    : bufferNeeded(scenario, { obiettivo: obiettivoRegime, percorsi: Math.round(percorsi * 0.8), seed });

  return {
    oggi, futuro,
    rischio: rischioGenerale,
    rischioSenzaRegime: rischioNonCondizionato,
    differenzaDovutaAlRegime: +(rischioGenerale.probabilita - rischioNonCondizionato.probabilita).toFixed(4),
    cuscinetto: cuscinettoRegime,
    obiettivoUsato: obiettivoRegime,
    condizionamento: ampiezza,
    fonte: statisticheSerie('spy'),
    // L'unica azione, e non è comprare o vendere.
    azione: cuscinettoRegime.serve === 0
      ? { cosa: 'niente', perche: 'la tua cassa regge anche negli scenari brutti: non serve toccare gli investimenti' }
      : cuscinettoRegime.raggiungibile
        ? { cosa: 'tenere liquidi', quanto: cuscinettoRegime.serve, perche: 'con questa cifra da parte smetti di dipendere dal momento in cui il mercato scende' }
        : { cosa: 'ridurre l\'esposizione', perche: 'nessun cuscinetto ragionevole basterebbe: qui il problema non è la liquidità, è quanto è investito rispetto a quanto ti serve' },
  };
}

// ── Come si racconta, in tre frasi e senza mai dire cosa comprare ──
export function decisioneText(d) {
  if (!d) return null;
  const eur = (x) => Math.round(x).toLocaleString('it-IT');
  const adesso = d.oggi.stato === 'difficile'
    ? 'Il mercato è in una fase difficile su più fronti insieme.'
    : d.oggi.stato === 'sereno'
      ? 'Al momento il mercato è tranquillo su tutti i fronti che guardo.'
      : 'I segnali che guardo non concordano: qualcosa è teso, qualcos\'altro no.';

  const avanti = d.futuro.probabilitaRecessione18Mesi === null ? ''
    : ` Guardando ai prossimi diciotto mesi, condizioni come queste sono state seguite da un rallentamento circa ${Math.round(d.futuro.probabilitaRecessione18Mesi * 100)} volte su 100 — con un anticipo che però è andato da due mesi a due anni.`;

  const tuo = d.rischio.probabilita < 0.03
    ? ' Per te cambia poco: la tua cassa regge comunque.'
    : ` Per te questo conta perché oggi hai ${Math.round(d.rischio.probabilita * 100)} probabilità su 100 di dover vendere mentre i prezzi sono bassi.`;

  const fare = d.azione.cosa === 'niente' ? ' Non c\'è niente da fare.'
    : d.azione.cosa === 'tenere liquidi' ? ` Con ${eur(d.azione.quanto)} € tenuti liquidi, quel rischio scende sotto la soglia che ti sei dato.`
      : ' Qui il cuscinetto non basta: va ridotta la parte investita.';

  return adesso + avanti + tuo + fare;
}

// Il quadro tecnico completo, per chi vuole vedere i conti.
export function refertoTecnico() {
  const o = orizzonteDiCiascunSegnale();
  return {
    orizzonti: o,
    lezione: o.finestraCieca.length
      ? `Fra gli orizzonti provati, a ${o.finestraCieca.filter((h) => h > 0).join(' e ')} mesi nessun segnale è affidabile: è una finestra cieca, e va dichiarata invece di riempirla.`
      : 'ogni orizzonte provato ha almeno un segnale affidabile',
    oggi: statoOggi(),
    futuro: statoFuturo(),
  };
}
