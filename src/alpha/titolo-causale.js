// ============================================================
// QUANTO DI QUESTO TITOLO È DAVVERO QUESTO TITOLO
// ============================================================
// `macro-causality.js` ha puntato il motore causale sui grandi aggregati e ha
// trovato la cosa piu' utile che si potesse trovare: quasi nessuna delle
// relazioni che si danno per scontate regge a un controllo serio. Ma resta
// scoperto proprio il momento in cui una persona ne avrebbe piu' bisogno —
// **quando cerca un titolo o una cripto e guarda il suo grafico**.
//
// LA DOMANDA CHE NESSUNA APP FA, e che cambia tutto:
//   *"Di questo +40%, quanto e' merito di questa azienda e quanto e' solo il
//     mercato che e' salito e se l'e' portata dietro?"*
// Chi guarda un grafico che sale crede di aver scelto bene. Molto spesso ha
// comprato il mercato con un'etichetta sopra: se l'indice ha fatto +35% e il
// titolo +40%, la scelta ha aggiunto cinque punti, non quaranta. E' aritmetica
// scomponibile, non un'opinione, e non viene mostrata da nessuna parte perche'
// ridimensiona esattamente la sensazione che tiene le persone sulla
// piattaforma.
//
// I TRE CONTROLLI, gli stessi tre inganni gia' misurati sulla macro, qui
// applicati al singolo strumento:
//
// 1. LIVELLI CONTRO VARIAZIONI (la regressione spuria, Granger & Newbold 1974).
//    Due prezzi che salgono nel tempo sembrano legatissimi anche se non
//    c'entrano niente. Qui si calcola la correlazione in ENTRAMBI i modi e si
//    mostra di quanto si sgonfia: e' la misura diretta di quanto ingannerebbe
//    guardare i grafici sovrapposti, che e' come guardano tutti.
//
// 2. QUANTO E' MERCATO E QUANTO E' SUO. La quota di variabilita' spiegata
//    dall'indice, e cio' che resta. La parte che resta e' l'unica su cui la
//    scelta di quel titolo ha inciso davvero.
//
// 3. ANTICIPA O SEGUE? Si guarda la correlazione anche a distanza di un mese
//    nei due versi. **E qui va detto subito il limite**: trovare che un titolo
//    "anticipa" l'indice su pochi anni di dati e' quasi sempre rumore, e con
//    molti ritardi provati qualcosa esce sempre. Il numero di confronti viene
//    dichiarato, e senza un margine netto la risposta e' "nessun anticipo
//    distinguibile" — che e' quasi sempre quella giusta.
//
// NON e' una valutazione del titolo e non e' un consiglio: e' la scomposizione
// di un numero che l'utente sta gia' guardando. Funzioni PURE.
'use strict';

import { linea } from './grafici.js';

// Sotto questo numero di osservazioni comuni non si scompone niente: una
// regressione su dodici punti produce numeri, non conoscenza.
export const MIN_OSSERVAZIONI = 24;

const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;

export function correlazione(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;
  const x = a.slice(0, n), y = b.slice(0, n);
  const mx = media(x), my = media(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  const den = Math.sqrt(sxx * syy);
  return den > 0 ? sxy / den : null;
}

// Ricostruisce un livello (base 100) dai rendimenti: serve solo per MOSTRARE
// la trappola dei livelli, mai per stimare qualcosa su cui poi si conclude.
export function livelliDaRendimenti(rend = []) {
  const out = [100];
  for (const r of rend) out.push(out[out.length - 1] * (1 + (Number.isFinite(r) ? r : 0)));
  return out.slice(1);
}

// ── ALLINEARE, che e' il punto dove si sbaglia in silenzio ──
// La serie di un titolo cercato arriva giornaliera e coprendo un periodo
// qualunque; l'archivio dell'indice e' mensile e parte dal 1993. Confrontarle
// per posizione — primo con primo, secondo con secondo — produce numeri
// perfettamente formattati e completamente privi di senso, ed e' un errore che
// non si vede guardando il risultato. Si allinea per CHIAVE anno-mese, e i
// mesi che non stanno in entrambe si buttano.
export function mensiliDaSerie(serie = []) {
  const perMese = new Map();
  for (const p of serie) {
    if (!Number.isFinite(p?.price) || p.price <= 0 || !p?.date) continue;
    const k = String(p.date).slice(0, 7); // AAAA-MM
    // L'ultimo prezzo del mese: la convenzione dell'archivio dell'indice.
    perMese.set(k, p.price);
  }
  const chiavi = [...perMese.keys()].sort();
  const out = [];
  for (let i = 1; i < chiavi.length; i++) {
    const prec = perMese.get(chiavi[i - 1]), cur = perMese.get(chiavi[i]);
    out.push({ mese: chiavi[i], rendimento: cur / prec - 1 });
  }
  return out;
}

// Etichetta anno-mese per ogni rendimento dell'archivio.
//
// LO SCOSTAMENTO DI UN MESE, verificato e non supposto. Il campo `da`
// dell'archivio e' il mese del primo PREZZO; il primo RENDIMENTO e' quello del
// mese dopo (da quel prezzo al successivo). Leggerlo come "il rendimento zero
// e' del mese `da`" sposta tutta la serie di un mese, e l'errore e' invisibile
// guardando i numeri: restano plausibili, sono solo del mese sbagliato.
//
// Trovato da questo test e confermato su QUATTRO episodi indipendenti di cui
// si conosce l'esito (offset 0 contro offset 1):
//   ott 2008, Lehman     -6,96%  contro  -16,52%   (la realta': circa -16,8%)
//   mar 2020, covid     +12,70%  contro  -13,00%   (circa -12,5%)
//   apr 2020, rimbalzo   +4,76%  contro  +12,70%   (circa +12,7%)
//   giu 2022             +9,21%  contro   -8,64%   (circa -8,3%)
// Con offset 0 il crollo del covid diventa un rialzo del 12,7%: quattro volte
// su quattro la lettura corretta e' quella spostata di uno.
export const SCOSTAMENTO_ARCHIVIO = 1;

export function mesiArchivio(da, quanti, scostamento = SCOSTAMENTO_ARCHIVIO) {
  const [a0, m0] = String(da).split('-').map(Number);
  const out = [];
  for (let i = 0; i < quanti; i++) {
    const tot = (m0 - 1) + i + scostamento;
    out.push(`${a0 + Math.floor(tot / 12)}-${String((tot % 12) + 1).padStart(2, '0')}`);
  }
  return out;
}

// Restituisce le due serie ridotte ai soli mesi presenti in ENTRAMBE.
export function allinea(mensiliTitolo = [], archivio = {}) {
  const etichette = mesiArchivio(archivio.da, (archivio.rendimenti || []).length);
  const indice = new Map(etichette.map((m, i) => [m, archivio.rendimenti[i]]));
  const titolo = [], mercato = [], mesi = [];
  for (const r of mensiliTitolo) {
    if (!indice.has(r.mese)) continue;
    const v = indice.get(r.mese);
    if (!Number.isFinite(v) || !Number.isFinite(r.rendimento)) continue;
    titolo.push(r.rendimento); mercato.push(v); mesi.push(r.mese);
  }
  return { titolo, mercato, mesi };
}

// ── Quanto e' mercato, quanto e' suo ──
// Regressione del titolo sull'indice. `beta` dice di quanto si muove il titolo
// quando l'indice si muove di uno; `quotaMercato` (R quadro) dice quanta parte
// del suo ballo e' spiegata dall'indice.
export function scomponi(rendTitolo = [], rendIndice = []) {
  const n = Math.min(rendTitolo.length, rendIndice.length);
  if (n < MIN_OSSERVAZIONI) return null;
  const y = rendTitolo.slice(-n), x = rendIndice.slice(-n);
  const mx = media(x), my = media(y);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  if (sxx <= 0) return null;
  const beta = sxy / sxx;
  const alfa = my - beta * mx;

  let ssTot = 0, ssRes = 0;
  const residui = [];
  for (let i = 0; i < n; i++) {
    const atteso = alfa + beta * x[i];
    const res = y[i] - atteso;
    residui.push(res);
    ssRes += res ** 2;
    ssTot += (y[i] - my) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : null;

  // Il totale composto del periodo, e la sua scomposizione: quanto avrebbe
  // reso muovendosi SOLO col mercato, e quanto ha aggiunto (o tolto) il resto.
  const componi = (arr) => arr.reduce((c, v) => c * (1 + v), 1) - 1;
  const totale = componi(y);
  const soloMercato = componi(x.map((v) => alfa * 0 + beta * v));

  return {
    osservazioni: n,
    beta: +beta.toFixed(3),
    quotaMercato: r2 === null ? null : +(100 * r2).toFixed(1),
    quotaSua: r2 === null ? null : +(100 * (1 - r2)).toFixed(1),
    rendimentoTotale: +(100 * totale).toFixed(1),
    rendimentoDaMercato: +(100 * soloMercato).toFixed(1),
    residui,
  };
}

// ── La trappola dei livelli, misurata su QUESTO titolo ──
export function trappolaDeiLivelli(rendTitolo = [], rendIndice = []) {
  const n = Math.min(rendTitolo.length, rendIndice.length);
  if (n < MIN_OSSERVAZIONI) return null;
  const y = rendTitolo.slice(-n), x = rendIndice.slice(-n);
  const suLivelli = correlazione(livelliDaRendimenti(y), livelliDaRendimenti(x));
  const suVariazioni = correlazione(y, x);
  if (suLivelli === null || suVariazioni === null) return null;
  return {
    suLivelli: +suLivelli.toFixed(3),
    suVariazioni: +suVariazioni.toFixed(3),
    gonfiata: +(Math.abs(suLivelli) - Math.abs(suVariazioni)).toFixed(3),
    // Il caso che conta davvero: i grafici sembrano gemelli e i movimenti veri
    // non lo sono.
    ingannevole: Math.abs(suLivelli) > 0.7 && Math.abs(suVariazioni) < 0.4,
  };
}

// ── Anticipa o segue? ──
// Con pochi dati e piu' ritardi provati, "anticipa" e' quasi sempre rumore. Si
// dichiara quanti confronti sono stati fatti e si pretende un margine netto.
export function anticipaOSegue(rendTitolo = [], rendIndice = [], { maxRitardo = 2, margine = 0.1 } = {}) {
  const n = Math.min(rendTitolo.length, rendIndice.length);
  if (n < MIN_OSSERVAZIONI + maxRitardo) return null;
  const y = rendTitolo.slice(-n), x = rendIndice.slice(-n);

  const contemporanea = Math.abs(correlazione(y, x) ?? 0);
  let miglioreAnticipo = 0, miglioreRitardo = 0;
  let confronti = 1;
  for (let k = 1; k <= maxRitardo; k++) {
    // titolo prima, indice dopo -> il titolo anticipa
    miglioreAnticipo = Math.max(miglioreAnticipo, Math.abs(correlazione(y.slice(0, n - k), x.slice(k)) ?? 0));
    // indice prima, titolo dopo -> il titolo segue
    miglioreRitardo = Math.max(miglioreRitardo, Math.abs(correlazione(x.slice(0, n - k), y.slice(k)) ?? 0));
    confronti += 2;
  }

  const differenza = miglioreAnticipo - miglioreRitardo;
  const verso = Math.abs(differenza) < margine ? 'nessuno'
    : differenza > 0 ? 'anticipa' : 'segue';

  return {
    contemporanea: +contemporanea.toFixed(3),
    anticipo: +miglioreAnticipo.toFixed(3),
    ritardo: +miglioreRitardo.toFixed(3),
    verso,
    confronti,
    // La riga che impedisce di prendere sul serio un risultato debole.
    avvertenza: verso === 'nessuno'
      ? `Nessun anticipo distinguibile: su ${confronti} confronti provati, nessuno stacca gli altri abbastanza.`
      : `Attenzione: con ${confronti} confronti provati su ${n} mesi, un risultato come questo capita spesso anche per caso. Da non trattare come un segnale.`,
  };
}

// ── Il referto ──
export function analizzaTitolo(rendTitolo = [], rendIndice = [], { nome = 'questo titolo', indice = 'il mercato' } = {}) {
  const n = Math.min(rendTitolo.length, rendIndice.length);
  if (n < MIN_OSSERVAZIONI) {
    return {
      disponibile: false,
      motivo: `Servono almeno ${MIN_OSSERVAZIONI} periodi in comune con ${indice} per separare cio' che e' di ${nome} da cio' che e' del mercato: qui ce ne sono ${n}.`,
    };
  }
  const s = scomponi(rendTitolo, rendIndice);
  if (!s) return { disponibile: false, motivo: 'I dati non permettono la scomposizione (il mercato non varia abbastanza nel periodo).' };

  return {
    disponibile: true, nome, indice,
    scomposizione: s,
    livelli: trappolaDeiLivelli(rendTitolo, rendIndice),
    tempi: anticipaOSegue(rendTitolo, rendIndice),
  };
}

export function testoTitolo(r) {
  if (!r?.disponibile) return r?.motivo || null;
  const s = r.scomposizione, l = r.livelli, t = r.tempi;
  const righe = [];

  // Niente preposizione articolata costruita a mano: "spiegato da le azioni
  // americane" e' il tipo di errore che fa sembrare finto tutto il resto.
  righe.push(`Di quanto ha fatto ${r.nome} in questi ${s.osservazioni} mesi, il ${s.quotaMercato}% del movimento se lo spiega l'andamento generale (${r.indice}): solo il ${s.quotaSua}% e' roba sua.`);
  righe.push(`In tutto ha reso ${s.rendimentoTotale}%, e muovendosi soltanto insieme al mercato avrebbe reso ${s.rendimentoDaMercato}%: la differenza e' cio' che ha aggiunto la scelta di questo titolo invece dell'indice.`);
  righe.push(`Si muove ${s.beta > 1 ? 'più' : 'meno'} del mercato: quando il mercato fa 1, lui fa ${s.beta}.`);

  if (l?.ingannevole) {
    righe.push(`I due grafici sovrapposti sembrano quasi identici (${l.suLivelli}), ma sui movimenti veri la somiglianza scende a ${l.suVariazioni}: guardare le linee salire insieme inganna, ed e' l'errore piu' comune.`);
  }
  if (t) righe.push(t.avvertenza);

  righe.push('E\' la scomposizione di un numero che stai gia\' guardando, non un giudizio sul titolo e non un consiglio.');
  return righe.join(' ');
}

// ── I mesi migliori e peggiori — "cosa guarderebbe un trader" ──
// Non "quando è salito il titolo" (quello lo dice già il grafico dei
// prezzi): il RESIDUO di scomponi() è il mese per mese di ciò che NON si
// spiega col mercato — la parte "sua" del titolo, positiva o negativa.
// `mesi` sono le stesse etichette anno-mese usate per allineare l'archivio
// (mesiArchivio, sopra): mai ricalcolate qui, sempre passate da chi ha già
// fatto l'allineamento, per non rischiare un disallineamento silenzioso.
export function serieResiduiMensili(r, mesi) {
  if (!r?.disponibile || !Array.isArray(mesi)) return [];
  const residui = r.scomposizione.residui;
  const offset = mesi.length - residui.length; // scomponi() usa le ULTIME n osservazioni
  if (offset < 0) return [];
  const out = [];
  for (let i = 0; i < residui.length; i++) {
    const mese = mesi[offset + i];
    if (!mese || !Number.isFinite(residui[i])) continue;
    out.push({ time: `${mese}-01`, value: +(residui[i] * 100).toFixed(2) });
  }
  return out;
}

// I `quanti` mesi migliori e peggiori (di norma 2+2): non ogni mese, solo
// quelli che un trader segnerebbe come "qui è successo qualcosa di suo".
export function motiviCaliPicchi(punti, { quanti = 2 } = {}) {
  if (!Array.isArray(punti) || punti.length < 3) return [];
  const ordinati = [...punti].sort((a, b) => b.value - a.value);
  const picchi = ordinati.slice(0, quanti).map((p) => ({ ...p, tipo: 'picco' }));
  const cali = ordinati.slice(-quanti).map((p) => ({ ...p, tipo: 'calo' }));
  const visti = new Set();
  const uniti = [...picchi, ...cali].filter((p) => (visti.has(p.time) ? false : (visti.add(p.time), true)));
  return uniti.sort((a, b) => a.time.localeCompare(b.time));
}

export function testoMotiviCaliPicchi(eventi) {
  if (!eventi?.length) return null;
  const fmt = (p) => `${p.time.slice(0, 7)}: ${p.value > 0 ? '+' : ''}${p.value}% ${p.tipo === 'picco' ? 'sopra' : 'sotto'} quanto spiegabile dal mercato in quel mese — la parte davvero "sua"`;
  return `Mesi in cui si è mosso più del solito per conto suo (non per il mercato): ${eventi.map(fmt).join('; ')}.`;
}

// Lo stile "classico" (grafici.js:linea — SVG scritto a mano), stesso
// toggle accanto al nuovo grafico di svgStoricoPercentili in screener-
// settore.js: coerenza fra le due feature, non due modi diversi di offrire
// la stessa scelta.
export function svgResiduiMensili(punti, nomeTitolo) {
  if (!Array.isArray(punti) || punti.length < 2) return null;
  const valori = punti.map((p) => p.value);
  const etichette = punti.map((p) => p.time.slice(0, 7));
  return linea(valori, { etichette, titolo: `Quanto è "suo" ${nomeTitolo || 'il titolo'}, mese per mese`, unita: '%', larghezza: 300, altezza: 84 });
}
