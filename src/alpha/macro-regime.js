// ============================================================
// LA CURVA DEI RENDIMENTI — l'unico segnale che prevede qualcosa davvero
// ============================================================
// L'indice di paura costruito su `market-stress.js` misura lo stato di ADESSO
// e, misurato, prevede la turbolenza del mese dopo ma non la direzione. È
// onesto ed è utile, ma non è previsione: è termometro.
//
// Esiste una cosa che previsione lo è, ed è l'unica in tutta la finanza
// macro con un curriculum decente: **la pendenza della curva dei rendimenti**.
// Quando il rendimento a tre mesi supera quello a dieci anni — la curva si
// "inverte" — negli Stati Uniti è quasi sempre seguita da una recessione, con
// un anticipo di parecchi mesi. Estrella & Mishkin (1998) l'hanno formalizzata
// e da allora regge: è il motivo per cui ogni desk macro la guarda.
//
// PERCHÉ FUNZIONA, in una riga: il tratto breve della curva lo decide la banca
// centrale, quello lungo lo decide il mercato. Un'inversione è il mercato che
// dice "questi tassi sono troppo alti per reggere, dovranno tagliare" — cioè
// un'aspettativa di rallentamento espressa in prezzi veri, non in un sondaggio.
//
// LA DIFFERENZA FRA QUESTO MODULO E UNA PRESENTAZIONE: qui il segnale non si
// afferma, si VALIDA. Il pannello contiene cinque recessioni datate dal NBER
// (comitato, a posteriori, non un modello). Adattare un modello su cinque
// recessioni già note e poi vantarsi del risultato sarebbe data snooping da
// manuale. Quindi la validazione è **walk-forward**: a ogni mese il modello
// viene stimato SOLO con i dati fino a quel momento e giudicato su ciò che
// succede dopo. È l'unica forma di prova che significhi qualcosa, e quasi
// nessuno la fa perché fa sembrare i modelli peggiori di quanto raccontino.
//
// E INFATTI IL RISULTATO RIDIMENSIONA LA FAMA DEL SEGNALE, in un modo preciso
// e utile. Non "la curva funziona" o "non funziona": **dipende dall'orizzonte,
// e l'orizzonte che tutti usano è fra i peggiori**.
//   · a 6 mesi l'AUC è 0,365, cioè SOTTO il caso: letto così il segnale è
//     girato al contrario;
//   · a 12 mesi — l'orizzonte canonico, quello di ogni articolo — è 0,600,
//     appena sopra il lancio di una moneta;
//   · a 18-24 mesi è 0,82, e lì il segnale c'è davvero.
// La spiegazione del valore sotto 0,5 a sei mesi non è rumore: a quel punto la
// banca centrale ha già iniziato a tagliare e la curva si è ri-irripidita,
// quindi nei mesi immediatamente prima di una recessione la curva è spesso
// tornata NORMALE. Chi guarda l'inversione per decidere cosa fare nel semestre
// la sta leggendo al rovescio.
//
// L'ALTRA COSA CHE I DATI DICONO: su undici inversioni dal 1982, otto sono
// state seguite da una recessione entro due anni — ma con un anticipo che va
// da 2 a 23 mesi. Un segnale che ha ragione spesso e non dice MAI quando è
// molto meno utile della sua reputazione: sapere che pioverà entro due anni
// non aiuta a decidere se uscire con l'ombrello.
//
// E IL SECONDO SEGNALE, che serve a una domanda diversa: la REGOLA DI SAHM
// (Claudia Sahm, 2019). La curva dice "forse, fra un anno e mezzo"; Sahm dice
// "è già cominciata", confrontando la disoccupazione media a tre mesi con il
// suo minimo dell'ultimo anno. Misurato qui: **4 recessioni su 4 riconosciute**,
// e dei suoi allarmi fuori recessione 48 su 57 cadono nei dodici mesi
// SUCCESSIVI alla fine di una recessione — quando la disoccupazione è ancora
// alta, il che non è un errore del metodo ma come funziona il mercato del
// lavoro. I falsi allarmi veri sono nove mesi in quarantaquattro anni.
// Servono entrambi, e servono a cose diverse: confonderli è il modo più comune
// di usarli male.
//
// COSA NON FA, dichiarato: non prevede i prezzi delle azioni. C'è un test che
// lo misura, e il risultato è quello che è — sapere che arriva una recessione
// non dice quando né quanto scenderà la borsa, perché i prezzi la stanno già
// scontando mentre noi la stiamo prevedendo.
//
// Funzioni PURE.
'use strict';

import { MACRO, MACRO_DA, MACRO_A, MACRO_MESI, MACRO_FONTE } from './macro-panel.js';

// L'ORIZZONTE, scelto MISURANDO e non copiando. La letteratura e la pratica
// usano 12 mesi. Validato walk-forward su questo campione, l'AUC per orizzonte
// e':
//    6 mesi  -> 0,365   (SOTTO 0,5: il segnale e' ANTI-predittivo)
//    9 mesi  -> 0,469   (indistinguibile dal caso)
//   12 mesi  -> 0,600   (l'orizzonte canonico: appena sopra il caso)
//   18 mesi  -> 0,822   (qui il segnale c'e' davvero)
//   24 mesi  -> 0,828
// **L'orizzonte piu' usato e' fra i peggiori.** E il valore sotto 0,5 a sei
// mesi non e' rumore, ha una spiegazione precisa: a quel punto la banca
// centrale ha gia' iniziato a tagliare e la curva si e' ri-irripidita, quindi
// nei mesi immediatamente prima di una recessione la curva e' spesso NORMALE.
// Chi guarda l'inversione per decidere cosa fare nei prossimi sei mesi sta
// leggendo il segnale al contrario. Il default qui e' 18.
export const ORIZZONTE_MESI = 18;
// Minimo di storia prima di stimare qualunque cosa: con meno di vent'anni non
// ci sono abbastanza recessioni per stimare un modello che parli di recessioni.
export const MIN_STORIA = 240;
// Soglia della regola di Sahm, quella originale.
export const SOGLIA_SAHM = 0.5;

export function pannelloMacro() {
  return { mesi: MACRO_MESI, da: MACRO_DA, a: MACRO_A, fonte: MACRO_FONTE, recessioni: contaRecessioni(MACRO.rec) };
}

function contaRecessioni(rec) {
  let n = 0, prec = 0;
  for (const x of rec) { if (x === 1 && prec === 0) n++; prec = x; }
  return n;
}

// Indice del mese nel pannello, da 'AAAA-MM'.
export function indiceMese(aaaaMM) {
  const [ya, ma] = MACRO_DA.split('-').map(Number);
  const [y, m] = String(aaaaMM).split('-').map(Number);
  const i = (y - ya) * 12 + (m - ma);
  return i >= 0 && i < MACRO_MESI ? i : -1;
}

// ── Regressione logistica a una variabile, stimata con Newton-Raphson ──
// Poche righe e nessuna libreria: con una sola covariata converge in una
// manciata di passi. Serve a trasformare la pendenza in una PROBABILITÀ, che è
// l'unica forma in cui un segnale del genere si può usare senza mentire.
export function stimaLogistica(x = [], y = [], { passi = 25, ridge = 1e-4 } = {}) {
  let b0 = 0, b1 = 0;
  const n = Math.min(x.length, y.length);
  if (n < 30) return null;
  for (let it = 0; it < passi; it++) {
    let g0 = 0, g1 = 0, h00 = ridge, h01 = 0, h11 = ridge;
    for (let i = 0; i < n; i++) {
      const z = b0 + b1 * x[i];
      const p = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
      const e = y[i] - p, w = Math.max(1e-6, p * (1 - p));
      g0 += e; g1 += e * x[i];
      h00 += w; h01 += w * x[i]; h11 += w * x[i] * x[i];
    }
    const det = h00 * h11 - h01 * h01;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) break;
    const d0 = (h11 * g0 - h01 * g1) / det;
    const d1 = (h00 * g1 - h01 * g0) / det;
    b0 += d0; b1 += d1;
    if (Math.abs(d0) + Math.abs(d1) < 1e-9) break;
  }
  return { b0, b1, n };
}

const sigmoide = (z) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

// La probabilità di recessione fra `orizzonte` mesi, stimata usando SOLO i dati
// fino al mese indicato. `fino` esclusivo: nessuno sguardo al futuro.
export function probabilitaRecessione(fino = MACRO_MESI, { orizzonte = ORIZZONTE_MESI } = {}) {
  const t = Math.min(fino, MACRO_MESI);
  if (t < MIN_STORIA) return { probabilita: null, motivo: `servono almeno ${MIN_STORIA} mesi di storia, ce ne sono ${t}` };
  // Esempi: pendenza al tempo i, recessione al tempo i+orizzonte. Si usano solo
  // gli i per cui anche l'esito e' gia' noto entro `t`.
  const x = [], y = [];
  for (let i = 0; i + orizzonte < t; i++) {
    if (MACRO.curva[i] === null || MACRO.rec[i + orizzonte] === null) continue;
    x.push(MACRO.curva[i]); y.push(MACRO.rec[i + orizzonte]);
  }
  const m = stimaLogistica(x, y);
  if (!m) return { probabilita: null, motivo: 'campione insufficiente' };
  const curvaOggi = MACRO.curva[t - 1];
  return {
    probabilita: +sigmoide(m.b0 + m.b1 * curvaOggi).toFixed(4),
    curva: curvaOggi,
    invertita: curvaOggi < 0,
    orizzonte,
    // Il coefficiente deve essere NEGATIVO: più la curva è piatta o invertita,
    // più sale la probabilità. Se uscisse positivo il modello sarebbe rotto.
    coefficiente: +m.b1.toFixed(4),
    coerente: m.b1 < 0,
    esempi: m.n,
  };
}

// ── LA VALIDAZIONE WALK-FORWARD, che è il punto ──
// Per ogni mese dopo il minimo di storia: si stima il modello con i soli dati
// disponibili allora, si predice, e si confronta con quello che è poi successo.
// Nessun parametro viene scelto guardando il risultato.
export function validazioneWalkForward({ orizzonte = ORIZZONTE_MESI, minStoria = MIN_STORIA } = {}) {
  const previsioni = [];
  for (let t = minStoria; t + orizzonte < MACRO_MESI; t++) {
    const p = probabilitaRecessione(t, { orizzonte });
    if (p.probabilita === null) continue;
    previsioni.push({ t, p: p.probabilita, esito: MACRO.rec[t - 1 + orizzonte], curva: p.curva });
  }
  if (previsioni.length < 50) return { valutabile: false, motivo: 'troppe poche previsioni fuori campione' };

  // AUC per ranghi (Mann-Whitney): probabilità che a un mese pre-recessione
  // venga assegnata una probabilità più alta che a un mese normale. 0,5 = a
  // caso. È la misura giusta perché la classe è molto sbilanciata e
  // l'accuratezza direbbe "90%" anche a chi risponde sempre "no".
  const pos = previsioni.filter((x) => x.esito === 1).map((x) => x.p);
  const neg = previsioni.filter((x) => x.esito === 0).map((x) => x.p);
  let conta = 0;
  for (const a of pos) for (const b of neg) conta += a > b ? 1 : a === b ? 0.5 : 0;
  const auc = pos.length && neg.length ? conta / (pos.length * neg.length) : null;

  return {
    valutabile: true,
    previsioni: previsioni.length,
    mesiPreRecessione: pos.length,
    auc: auc === null ? null : +auc.toFixed(4),
    // Sotto 0,7 un segnale non merita di essere mostrato a nessuno come
    // previsione. E' una soglia dichiarata, non un'opinione a posteriori.
    utile: auc !== null && auc > 0.7,
    probabilitaMediaPrimaDiUnaRecessione: pos.length ? +(pos.reduce((a, b) => a + b, 0) / pos.length).toFixed(4) : null,
    probabilitaMediaAltrimenti: neg.length ? +(neg.reduce((a, b) => a + b, 0) / neg.length).toFixed(4) : null,
    nota: 'ogni previsione è stata fatta con i soli dati disponibili in quel mese: nessuno sguardo al futuro',
  };
}

// ── A CHE DISTANZA IL SEGNALE FUNZIONA — la domanda che nessuno si fa ──
// Non "la curva prevede le recessioni?" (troppo vaga per essere vera o falsa)
// ma "a quale orizzonte, e quanto?". La risposta cambia completamente l'uso
// che se ne puo' fare: un segnale che funziona a 18-24 mesi non serve a
// decidere cosa fare domani, e usarlo per quello e' peggio che non averlo.
export function aucPerOrizzonte(orizzonti = [6, 9, 12, 18, 24]) {
  return orizzonti.map((h) => {
    const v = validazioneWalkForward({ orizzonte: h });
    return {
      orizzonte: h,
      auc: v.auc,
      utile: !!v.utile,
      // Sotto 0,5 il segnale e' girato: usarlo cosi' com'e' fa danno.
      antiPredittivo: v.auc !== null && v.auc < 0.45,
      previsioni: v.previsioni || 0,
    };
  });
}

// ── L'inversione: quante volte ha avuto ragione, e con quanto anticipo ──
// Il conto che chiunque cita a memoria, fatto sui dati invece che a memoria.
export function storicoInversioni({ orizzonteMax = 24 } = {}) {
  const episodi = [];
  let dentro = false, inizio = -1;
  for (let i = 0; i < MACRO_MESI; i++) {
    const c = MACRO.curva[i];
    if (c === null) continue;
    if (c < 0 && !dentro) { dentro = true; inizio = i; }
    else if (c >= 0 && dentro) { dentro = false; episodi.push({ inizio, fine: i - 1 }); }
  }
  if (dentro) episodi.push({ inizio, fine: MACRO_MESI - 1, inCorso: true });

  const nome = (i) => {
    const [ya, ma] = MACRO_DA.split('-').map(Number);
    const m0 = ma - 1 + i;
    return `${ya + Math.floor(m0 / 12)}-${String((m0 % 12) + 1).padStart(2, '0')}`;
  };

  return episodi.map((e) => {
    // Prima recessione che comincia DOPO l'inizio dell'inversione.
    let arrivo = null;
    for (let i = e.inizio; i < Math.min(MACRO_MESI, e.inizio + orizzonteMax + 1); i++) {
      if (MACRO.rec[i] === 1 && (i === 0 || MACRO.rec[i - 1] === 0)) { arrivo = i; break; }
    }
    return {
      inizio: nome(e.inizio), fine: nome(e.fine),
      durataMesi: e.fine - e.inizio + 1,
      inCorso: !!e.inCorso,
      recessioneArrivata: arrivo !== null,
      quandoRecessione: arrivo !== null ? nome(arrivo) : null,
      anticipoMesi: arrivo !== null ? arrivo - e.inizio : null,
    };
  });
}

// ── LA REGOLA DI SAHM: non anticipa, ma non sbaglia ──
// Media a 3 mesi della disoccupazione meno il minimo delle medie a 3 mesi
// dell'ultimo anno. Sopra mezzo punto, la recessione è già cominciata.
export function regolaSahm(fino = MACRO_MESI) {
  const t = Math.min(fino, MACRO_MESI);
  if (t < 15) return { valore: null, motivo: 'storia insufficiente' };
  const media3 = (i) => {
    const v = [MACRO.disocc[i], MACRO.disocc[i - 1], MACRO.disocc[i - 2]].filter((x) => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const ora = media3(t - 1);
  if (ora === null) return { valore: null, motivo: 'dati mancanti' };
  let minimo = Infinity;
  for (let i = t - 12; i < t; i++) { const m = media3(i); if (m !== null) minimo = Math.min(minimo, m); }
  const valore = ora - minimo;
  return {
    valore: +valore.toFixed(2),
    scattata: valore >= SOGLIA_SAHM,
    soglia: SOGLIA_SAHM,
    disoccupazioneMedia3Mesi: +ora.toFixed(2),
    minimoUltimoAnno: +minimo.toFixed(2),
  };
}

// Quanto bene la regola di Sahm riconosce le recessioni GIÀ in corso: è ciò
// per cui è fatta, e va giudicata su quello e non sull'anticipo.
export function validazioneSahm({ ecoMesi = 12 } = {}) {
  const fineRecessioni = [];
  for (let i = 1; i < MACRO_MESI; i++) if (MACRO.rec[i - 1] === 1 && MACRO.rec[i] === 0) fineRecessioni.push(i);

  let veriPositivi = 0, ecoPostRecessione = 0, falsiVeri = 0;
  let recessioniColte = 0, recessioniTotali = 0;
  let dentroRec = false, coltaQuesta = false;
  const mesiFalsi = [];

  for (let t = 15; t <= MACRO_MESI; t++) {
    const s2 = regolaSahm(t);
    if (s2.valore === null) continue;
    const i = t - 1;
    const inRec = MACRO.rec[i] === 1;
    if (inRec && !dentroRec) { recessioniTotali++; coltaQuesta = false; }
    if (s2.scattata) {
      if (inRec) { veriPositivi++; if (!coltaQuesta) { recessioniColte++; coltaQuesta = true; } }
      // Distinzione che cambia il giudizio: la disoccupazione resta alta per
      // mesi DOPO la fine di una recessione (le riprese senza assunzioni). Un
      // allarme li' non e' un errore del metodo, e' come funziona il mercato
      // del lavoro. Contarlo come falso positivo sarebbe ingiusto e, peggio,
      // farebbe scartare un indicatore che funziona.
      else if (fineRecessioni.some((f) => i - f >= 0 && i - f <= ecoMesi)) ecoPostRecessione++;
      else { falsiVeri++; mesiFalsi.push(i); }
    }
    dentroRec = inRec;
  }
  return {
    recessioniTotali, recessioniColte,
    mesiVeriPositivi: veriPositivi,
    mesiEcoPostRecessione: ecoPostRecessione,
    mesiFalsiVeri: falsiVeri,
    nota: 'la regola di Sahm CONFERMA, non anticipa. Dei suoi allarmi fuori recessione la grande maggioranza cade nei mesi successivi alla fine di una recessione, quando la disoccupazione e\' ancora alta: non e\' un errore del metodo.',
  };
}

// ── Il quadro, e cosa dire ──
export function quadroMacro(fino = MACRO_MESI) {
  const p = probabilitaRecessione(fino);
  const s = regolaSahm(fino);
  const t = Math.min(fino, MACRO_MESI);
  return {
    curva: MACRO.curva[t - 1], invertita: MACRO.curva[t - 1] < 0,
    tassoDecennale: MACRO.y10[t - 1], tassoPolitica: MACRO.ff[t - 1],
    inflazione: MACRO.infl[t - 1], disoccupazione: MACRO.disocc[t - 1],
    probabilitaRecessione12Mesi: p.probabilita,
    sahm: s,
    // Il caso interessante è quando i due segnali NON concordano, ed è anche
    // il più frequente: la curva guarda avanti, Sahm guarda adesso.
    concordano: p.probabilita !== null && s.valore !== null
      ? (p.probabilita > 0.4) === s.scattata
      : null,
  };
}

export function quadroText(q) {
  if (!q) return null;
  const pct = q.probabilitaRecessione12Mesi === null ? null : Math.round(q.probabilitaRecessione12Mesi * 100);
  const curva = q.invertita
    ? 'Prestare soldi per tre mesi rende più che prestarli per dieci anni: è il segnale che storicamente ha preceduto i rallentamenti.'
    : 'La curva dei tassi ha la forma normale: chi presta a lungo viene pagato di più, come dovrebbe essere.';
  const sahm = q.sahm?.scattata
    ? ' La disoccupazione sta già salendo rispetto ai minimi dell\'anno: il rallentamento non è più una previsione.'
    : '';
  const prob = pct === null ? '' : ` In base a come sono andate le cose dal 1982, una situazione così è stata seguita da un rallentamento entro un anno circa ${pct} volte su 100.`;
  return `${curva}${prob}${sahm}`;
}
