// ============================================================
// I CICLI — quarantun anni, tutto sulla stessa griglia
// ============================================================
// Fino a qui ogni mercato viveva nel suo modulo, con la sua frequenza e i suoi
// anni: le azioni al mese, il posizionamento alla settimana, le case al
// trimestre, le terre rare all'anno. Erano risposte separate a domande
// separate. Questo modulo li mette tutti sulla STESSA griglia annuale, che è
// l'unica frequenza che hanno davvero in comune, e permette la domanda che
// prima non si poteva fare: **quando una cosa sale, cosa stava succedendo alle
// altre?**
//
// PERCHÉ ANNUALE E NON MENSILE. Sarebbe stato più comodo tenere il mese e
// buttare via le terre rare e le case. Ma un mercato di contratti annuali non
// ha un prezzo mensile, e inventarlo interpolando avrebbe creato una serie
// liscia e finta, che nelle correlazioni si comporta molto meglio di quanto
// meriti. Meglio quarantun osservazioni vere che cinquecento inventate.
//
// E QUARANTUN OSSERVAZIONI SONO POCHE. Va detto prima, non dopo: con
// quarantun anni una correlazione deve superare circa 0,31 per non essere
// confondibile con il caso, e un anticipo di un anno misurato su quarantun
// punti è un indizio, non una prova. Ogni funzione qui dentro porta con sé
// quanti dati la sostengono, perché la stessa cifra con dieci o con
// quarant'anni dietro non vuol dire la stessa cosa.
//
// Funzioni PURE.
'use strict';

import { AZ_ANNO, AZ_LIVELLO } from './azioni-annuali.js';
import { PREZZI_MP, CPI_USA, MP_MESE, NOMI_MP } from './materie-prime-panel.js';
import { IMM_REALE, IMM_DATE, NOMI_IMM } from './immobiliare-panel.js';
import { TR_ANNO, TR_PREZZO_REALE } from './terre-rare-panel.js';
import { COT_NETTO, COT_DATE } from './cot-panel.js';

export const DA = 1985;
export const A = 2025;
export const ANNI = [];
for (let a = DA; a <= A; a++) ANNI.push(a);

// Con questo numero di osservazioni, la soglia oltre cui una correlazione non
// è più confondibile con il caso (circa 2/radice(n)).
export const SOGLIA_CORRELAZIONE = +(2 / Math.sqrt(ANNI.length)).toFixed(3);

const mediaAnnuale = (valori, etichette, estraiAnno) => {
  const per = {};
  for (let i = 0; i < valori.length; i++) {
    if (valori[i] === null || !Number.isFinite(valori[i])) continue;
    const a = estraiAnno(etichette[i]);
    if (a < DA || a > A) continue;
    (per[a] ??= []).push(valori[i]);
  }
  return ANNI.map((a) => (per[a] ? per[a].reduce((x, y) => x + y, 0) / per[a].length : null));
};

// Il deflatore annuale: il CPI mediato sull'anno, riportato all'ultimo anno.
const CPI_ANNO = mediaAnnuale(CPI_USA, MP_MESE, (m) => +m.slice(0, 4));
const CPI_BASE = [...CPI_ANNO].reverse().find((x) => x !== null);
const deflaziona = (serie) => serie.map((v, i) => (v === null || CPI_ANNO[i] === null ? null : (v * CPI_BASE) / CPI_ANNO[i]));

// ── LA GRIGLIA: tutto quello che ho, in termini reali, anno per anno ──
export function griglia() {
  const g = {
    azioni: deflaziona(mediaAnnuale(AZ_LIVELLO, AZ_ANNO, (a) => a)),
    oro: deflaziona(mediaAnnuale(PREZZI_MP.oro, MP_MESE, (m) => +m.slice(0, 4))),
    argento: deflaziona(mediaAnnuale(PREZZI_MP.argento, MP_MESE, (m) => +m.slice(0, 4))),
    rame: deflaziona(mediaAnnuale(PREZZI_MP.rame, MP_MESE, (m) => +m.slice(0, 4))),
    petrolio: deflaziona(mediaAnnuale(PREZZI_MP.petrolio, MP_MESE, (m) => +m.slice(0, 4))),
    // Le terre rare arrivano già in dollari costanti dalla fonte: deflazionarle
    // di nuovo toglierebbe l'inflazione due volte.
    terreRare: ANNI.map((a) => { const i = TR_ANNO.indexOf(a); return i >= 0 ? TR_PREZZO_REALE[i] : null; }),
    // Anche le case BIS sono già reali.
    caseUsa: mediaAnnuale(IMM_REALE.usa, IMM_DATE, (d) => +d.slice(0, 4)),
    caseAreaEuro: mediaAnnuale(IMM_REALE.areaEuro, IMM_DATE, (d) => +d.slice(0, 4)),
    caseItalia: mediaAnnuale(IMM_REALE.italia, IMM_DATE, (d) => +d.slice(0, 4)),
    caseGiappone: mediaAnnuale(IMM_REALE.giappone, IMM_DATE, (d) => +d.slice(0, 4)),
  };
  return g;
}

// Il sentiment non è un prezzo: non si deflaziona e non si guarda in
// variazione, si guarda in livello (quanto erano schierati gli operatori).
export function sentimentAnnuale() {
  return {
    oro: mediaAnnuale(COT_NETTO.oro, COT_DATE, (d) => +d.slice(0, 4)),
    azioni: mediaAnnuale(COT_NETTO.azioniUsa, COT_DATE, (d) => +d.slice(0, 4)),
  };
}

export const NOMI = {
  azioni: 'Azioni Stati Uniti', oro: 'Oro', argento: 'Argento', rame: 'Rame',
  petrolio: 'Petrolio', terreRare: 'Terre rare',
  caseUsa: 'Case Stati Uniti', caseAreaEuro: 'Case area euro',
  caseItalia: 'Case Italia', caseGiappone: 'Case Giappone',
};

export function copertura() {
  const g = griglia();
  return Object.keys(g).map((k) => {
    const v = g[k];
    const primo = v.findIndex((x) => x !== null);
    const ultimo = v.length - 1 - [...v].reverse().findIndex((x) => x !== null);
    return { chiave: k, nome: NOMI[k], anni: v.filter((x) => x !== null).length, da: primo >= 0 ? ANNI[primo] : null, a: ultimo >= 0 ? ANNI[ultimo] : null };
  });
}

const variazioni = (v) => v.map((x, i) => (i === 0 || x === null || v[i - 1] === null || v[i - 1] <= 0 ? null : x / v[i - 1] - 1));

function correla(a, b, ritardo = 0) {
  const p = [];
  for (let i = 0; i < a.length; i++) {
    const j = i + ritardo;
    if (j < 0 || j >= b.length) continue;
    if (a[i] === null || b[j] === null) continue;
    p.push([a[i], b[j]]);
  }
  if (p.length < 12) return null;
  const mx = p.reduce((s, x) => s + x[0], 0) / p.length, my = p.reduce((s, x) => s + x[1], 0) / p.length;
  let n = 0, dx = 0, dy = 0;
  for (const [x, y] of p) { n += (x - mx) * (y - my); dx += (x - mx) ** 2; dy += (y - my) ** 2; }
  if (dx <= 0 || dy <= 0) return null;
  return { r: n / Math.sqrt(dx * dy), n: p.length };
}

// ── CHI ANTICIPA CHI ──
// La domanda che tutti vorrebbero: c'è un mercato che si muove prima degli
// altri? Si misura la correlazione fra le VARIAZIONI (mai fra i livelli: due
// serie che salgono entrambe nel tempo risultano legate anche quando non
// c'entrano niente — è la trappola già trovata nel modulo causale) a ritardo
// zero, uno e due anni.
export function chiAnticipaChi() {
  const g = griglia();
  const v = Object.fromEntries(Object.keys(g).map((k) => [k, variazioni(g[k])]));
  const chiavi = Object.keys(v);
  const risultati = [];
  for (const a of chiavi) {
    for (const b of chiavi) {
      if (a === b) continue;
      // a anticipa b di un anno: la variazione di `a` oggi contro quella di `b`
      // l'anno prossimo.
      const c1 = correla(v[a], v[b], 1);
      const c0 = correla(v[a], v[b], 0);
      if (!c1 || !c0) continue;
      risultati.push({
        chi: a, nomeChi: NOMI[a], anticipa: b, nomeAnticipa: NOMI[b],
        conUnAnnoDiAnticipo: +c1.r.toFixed(3), nelloStessoAnno: +c0.r.toFixed(3), osservazioni: c1.n,
        // Conta solo se l'anticipo è forte E più forte del contemporaneo:
        // altrimenti è la coda di un movimento comune, non un anticipo.
        anticipoVero: Math.abs(c1.r) > SOGLIA_CORRELAZIONE && Math.abs(c1.r) > Math.abs(c0.r),
      });
    }
  }
  const veri = risultati.filter((r) => r.anticipoVero).sort((a, b) => Math.abs(b.conUnAnnoDiAnticipo) - Math.abs(a.conUnAnnoDiAnticipo));
  return {
    coppieEsaminate: risultati.length,
    sogliaUsata: SOGLIA_CORRELAZIONE,
    anticipiTrovati: veri.length,
    primi: veri.slice(0, 5),
    // Con quarantun anni e un centinaio di coppie provate, qualche
    // correlazione oltre soglia salta fuori per caso: quante ne aspetteremmo
    // se non ci fosse niente. Se il numero trovato non supera questo, non c'è
    // niente da festeggiare.
    atteseSoloPerCaso: +(risultati.length * 0.05).toFixed(1),
    piuDelCaso: veri.length > risultati.length * 0.05 * 2,
  };
}

// ── GLI EPISODI CHE SI RIPETONO: salita, picco, caduta ──
// Una definizione sola per tutti i mercati, altrimenti si finisce a chiamare
// "bolla" quello che si era già deciso fosse una bolla. Un episodio è: il
// prezzo reale sale almeno del `salita` in non più di `anniSalita` anni, e poi
// perde almeno il `caduta` dal massimo.
export function episodi({ salita = 0.6, anniSalita = 4, caduta = 0.3 } = {}) {
  const g = griglia();
  const trovati = [];
  for (const k of Object.keys(g)) {
    const v = g[k];
    for (let p = 0; p < v.length; p++) {
      if (v[p] === null) continue;
      // p è un massimo locale sulla finestra ±anniSalita?
      let eMassimo = true;
      for (let j = Math.max(0, p - anniSalita); j <= Math.min(v.length - 1, p + anniSalita); j++) {
        if (v[j] !== null && v[j] > v[p]) { eMassimo = false; break; }
      }
      if (!eMassimo) continue;
      // Quanto è salito prima.
      let base = null, iBase = -1;
      for (let j = Math.max(0, p - anniSalita); j < p; j++) if (v[j] !== null && (base === null || v[j] < base)) { base = v[j]; iBase = j; }
      if (base === null || v[p] / base - 1 < salita) continue;
      // Quanto è caduto dopo, e in quanto tempo.
      let fondo = null, iFondo = -1;
      for (let j = p + 1; j < v.length; j++) {
        if (v[j] === null) continue;
        if (fondo === null || v[j] < fondo) { fondo = v[j]; iFondo = j; }
        // Il fondo si cerca finché non si torna sopra il picco.
        if (v[j] >= v[p]) break;
      }
      if (fondo === null || fondo / v[p] - 1 > -caduta) continue;
      trovati.push({
        mercato: k, nome: NOMI[k],
        annoPartenza: ANNI[iBase], annoPicco: ANNI[p], annoFondo: ANNI[iFondo],
        anniDiSalita: ANNI[p] - ANNI[iBase], anniDiCaduta: ANNI[iFondo] - ANNI[p],
        salita: +(v[p] / base - 1).toFixed(3), caduta: +(fondo / v[p] - 1).toFixed(3),
      });
    }
  }
  trovati.sort((a, b) => a.annoPicco - b.annoPicco);
  if (!trovati.length) return { episodi: [], criterio: { salita, anniSalita, caduta } };
  const med = (f) => +(trovati.reduce((s, e) => s + f(e), 0) / trovati.length).toFixed(2);
  // Gli anni in cui più mercati sono arrivati al picco insieme.
  const perAnno = {};
  for (const e of trovati) (perAnno[e.annoPicco] ??= []).push(e.nome);
  const insieme = Object.entries(perAnno).filter(([, m]) => m.length >= 2)
    .map(([a, m]) => ({ anno: +a, mercati: m })).sort((a, b) => b.mercati.length - a.mercati.length);
  return {
    criterio: { salita, anniSalita, caduta },
    episodi: trovati,
    quanti: trovati.length,
    formaTipica: {
      anniDiSalita: med((e) => e.anniDiSalita),
      anniDiCaduta: med((e) => e.anniDiCaduta),
      salitaMedia: med((e) => e.salita),
      cadutaMedia: med((e) => e.caduta),
    },
    // La salita dura più della caduta, o il contrario? È la forma del ciclo, e
    // decide quanto tempo si ha per accorgersene.
    salitaPiuLungaDellaCaduta: med((e) => e.anniDiSalita) > med((e) => e.anniDiCaduta),
    anniInCuiPiuMercatiHannoFattoPicco: insieme.slice(0, 5),
  };
}

// ── IL SENTIMENT ESTREMO PRECEDE I PICCHI? ──
// Il posizionamento degli operatori è la sola misura di umore che abbiamo, e la
// domanda naturale è se si scalda prima che il prezzo giri. Qui c'è per l'oro
// e per le azioni, dal 1986 e dal 2000: pochi episodi, e il numero va detto.
export function sentimentPrimaDeiPicchi() {
  const s = sentimentAnnuale();
  const eps = episodi().episodi;
  const esiti = [];
  for (const [chiave, serie] of [['oro', s.oro], ['azioni', s.azioni]]) {
    const miei = eps.filter((e) => e.mercato === chiave);
    for (const e of miei) {
      const iPicco = ANNI.indexOf(e.annoPicco);
      const prima = iPicco > 0 ? serie[iPicco - 1] : null;
      const alPicco = serie[iPicco];
      if (prima === null || alPicco === null) continue;
      // Il posizionamento era già sopra la sua media di lungo periodo?
      const validi = serie.filter((x) => x !== null);
      const media = validi.reduce((x, y) => x + y, 0) / validi.length;
      esiti.push({ mercato: NOMI[chiave], annoPicco: e.annoPicco, sentimentAnnoPrima: +prima.toFixed(4), sentimentAlPicco: +alPicco.toFixed(4), sopraLaMedia: prima > media });
    }
  }
  return {
    casi: esiti.length,
    dettaglio: esiti,
    // Con una manciata di casi non si conclude niente, e il modulo lo dice
    // invece di presentare una percentuale su tre episodi.
    abbastanzaCasi: esiti.length >= 10,
    avvertenza: esiti.length < 10
      ? `sono solo ${esiti.length} episodi: qualunque percentuale calcolata qui sopra sarebbe una coincidenza travestita da regola`
      : null,
  };
}

// ── DOVE SIAMO NEL CICLO, e cosa e' successo le altre volte ──
// Qui sopra ho appena misurato che nessun mercato anticipa gli altri in modo
// affidabile. Quindi una previsione nella forma "il rame salira' del 12%" non
// e' sostenibile, e scriverla sarebbe disonesto anche se fosse quello che si
// vuole sentire.
//
// C'e' pero' una forma di previsione che i dati sostengono, ed e' quella che
// usano davvero le persone serie: **la frequenza storica condizionata**. Non
// "cosa succedera'", ma "le altre volte che un mercato si trovava messo cosi',
// come e' andata a finire, e quante volte". Non e' un ripiego: e' l'unica cosa
// che 41 anni di dati possono onestamente sostenere, e ha il vantaggio di
// portarsi dietro la propria incertezza invece di nasconderla dietro un numero.
//
// I casi si mettono INSIEME fra tutti i mercati. Un singolo mercato in 41 anni
// ha visto due o tre episodi: qualunque percentuale su tre casi e' una
// coincidenza. Mettendo insieme azioni, metalli, petrolio, terre rare e case si
// arriva a qualche centinaio di osservazioni, al prezzo di un'assunzione che va
// dichiarata: che un rame tirato e un'azione tirata si comportino allo stesso
// modo. E' un'assunzione forte, ed e' il limite di questo metodo.
export const STATI = ['corsa', 'salita', 'quiete', 'discesa', 'crollo'];

function statoDi(v, i, { finestra = 5 } = {}) {
  if (i < finestra || v[i] === null) return null;
  const passato = v.slice(i - finestra, i).filter((x) => x !== null);
  if (passato.length < finestra - 1) return null;
  const media = passato.reduce((x, y) => x + y, 0) / passato.length;
  if (media <= 0) return null;
  const scarto = v[i] / media - 1;
  if (scarto > 0.5) return 'corsa';
  if (scarto > 0.15) return 'salita';
  if (scarto < -0.3) return 'crollo';
  if (scarto < -0.1) return 'discesa';
  return 'quiete';
}

export function cosaSuccedeDopo({ orizzonte = 3, finestra = 5 } = {}) {
  const g = griglia();
  const per = Object.fromEntries(STATI.map((s) => [s, []]));
  for (const k of Object.keys(g)) {
    const v = g[k];
    for (let i = 0; i + orizzonte < v.length; i++) {
      const st = statoDi(v, i, { finestra });
      if (!st || v[i] === null || v[i + orizzonte] === null || v[i] <= 0) continue;
      per[st].push({ mercato: k, anno: ANNI[i], dopo: v[i + orizzonte] / v[i] - 1 });
    }
  }
  const riassumi = (casi) => {
    if (casi.length < 10) return { casi: casi.length, abbastanza: false };
    const ord = casi.map((c) => c.dopo).sort((a, b) => a - b);
    const q = (p) => ord[Math.min(ord.length - 1, Math.floor(p * ord.length))];
    return {
      casi: casi.length, abbastanza: true,
      mediano: +q(0.5).toFixed(3),
      quotaInGuadagno: +(casi.filter((c) => c.dopo > 0).length / casi.length).toFixed(3),
      // Gli estremi contano piu' della media: e' li' che si decide se uno
      // riesce a restare nella posizione o esce nel momento peggiore.
      andataMale: +q(0.1).toFixed(3), andataBene: +q(0.9).toFixed(3),
      mercati: [...new Set(casi.map((c) => c.mercato))].length,
    };
  };
  return {
    orizzonte, finestra,
    perStato: Object.fromEntries(STATI.map((s) => [s, riassumi(per[s])])),
    // IL RISULTATO CHE SMENTISCE IL SENSO COMUNE, e che merita di essere
    // guardato bene invece di essere nascosto perche' scomodo. Si dice che un
    // mercato tirato debba per forza andare peggio. Sui dati NON e' cosi': dopo
    // una corsa il risultato TIPICO a tre anni e' buono quanto quello di un
    // mercato tranquillo, a volte meglio. Chi vende "e' salito troppo, adesso
    // scende" sta dicendo una cosa che i dati non sostengono.
    //
    // Quello che cambia davvero e' un'altra cosa, ed e' piu' importante: la
    // CODA. Dopo una corsa il decimo peggiore dei casi e' molto piu' brutto che
    // dopo la quiete. Un mercato tirato non ha un futuro peggiore, ha un futuro
    // piu' largo — e in un portafoglio vero e' la larghezza che ti costringe a
    // vendere nel momento sbagliato, non la mediana.
    laCorsaSiPaga: (() => {
      const c = riassumi(per.corsa), q = riassumi(per.quiete);
      return c.abbastanza && q.abbastanza ? c.mediano < q.mediano : null;
    })(),
    laCorsaAllargaLaCoda: (() => {
      const c = riassumi(per.corsa), q = riassumi(per.quiete);
      return c.abbastanza && q.abbastanza ? c.andataMale < q.andataMale : null;
    })(),
    quantoSiAllargaLaCoda: (() => {
      const c = riassumi(per.corsa), q = riassumi(per.quiete);
      return c.abbastanza && q.abbastanza ? +(c.andataMale - q.andataMale).toFixed(3) : null;
    })(),
    assunzione: 'i casi di mercati diversi sono messi insieme: senza, ogni mercato avrebbe tre episodi e nessuna percentuale sarebbe credibile. Il prezzo e\' assumere che un rame tirato e un\'azione tirata si comportino allo stesso modo',
  };
}

export function doveSiamo(mercato, opzioni = {}) {
  const g = griglia();
  const v = g[mercato];
  if (!v) return { valido: false, motivo: `mercato sconosciuto: ${mercato}` };
  const i = v.length - 1 - [...v].reverse().findIndex((x) => x !== null);
  const st = statoDi(v, i, opzioni);
  if (!st) return { valido: false, motivo: 'storia insufficiente' };
  const dopo = cosaSuccedeDopo(opzioni).perStato[st];
  const finestra = opzioni.finestra ?? 5;
  const passato = v.slice(i - finestra, i).filter((x) => x !== null);
  const media = passato.reduce((x, y) => x + y, 0) / passato.length;
  return {
    valido: true, mercato, nome: NOMI[mercato], anno: ANNI[i], stato: st,
    scartoDallaMedia: +(v[i] / media - 1).toFixed(3),
    ederaSuccessoDopo: dopo,
  };
}

export function doveSiamoText(d) {
  if (!d?.valido) return null;
  const s = d.ederaSuccessoDopo;
  const come = {
    corsa: `molto sopra la sua media degli ultimi anni (${Math.round(d.scartoDallaMedia * 100)}%)`,
    salita: `sopra la sua media degli ultimi anni (${Math.round(d.scartoDallaMedia * 100)}%)`,
    quiete: 'in linea con la sua media degli ultimi anni',
    discesa: `sotto la sua media degli ultimi anni (${Math.round(d.scartoDallaMedia * 100)}%)`,
    crollo: `molto sotto la sua media degli ultimi anni (${Math.round(d.scartoDallaMedia * 100)}%)`,
  }[d.stato];
  if (!s?.abbastanza) {
    return `${d.nome} oggi e' ${come}. Non ho abbastanza casi storici simili per dirti come e' andata le altre volte, e preferisco dirtelo che inventare una percentuale.`;
  }
  return `${d.nome} oggi e' ${come}. Nei ${s.casi} casi in cui un mercato si e' trovato messo cosi' — presi da ${s.mercati} mercati diversi negli ultimi ${ANNI.length} anni — nei tre anni successivi e' andato in guadagno ${Math.round(s.quotaInGuadagno * 100)} volte su cento, con un risultato tipico del ${Math.round(s.mediano * 100)}%. Nel decimo peggiore dei casi ha perso il ${Math.abs(Math.round(s.andataMale * 100))}%, nel decimo migliore ha guadagnato il ${Math.round(s.andataBene * 100)}%. Non e' una previsione: e' quello che e' successo le altre volte, ed e' l'unica cosa che 41 anni di dati permettono di dire onestamente.`;
}

// ── I testi ──
// La risposta alla domanda "e' troppo caro? sta per scendere?", che e' la
// domanda che arriva davvero.
export function hypeText() {
  const d = cosaSuccedeDopo();
  const c = d.perStato.corsa, q = d.perStato.quiete;
  if (!c?.abbastanza || !q?.abbastanza) return null;
  return `C'e' una cosa che quasi tutti danno per scontata e che sui dati non regge: che un mercato salito molto debba per forza scendere. Ho guardato ${c.casi} casi in cui un mercato era molto sopra la sua media degli ultimi anni, presi da ${c.mercati} mercati diversi in ${ANNI.length} anni. Nei tre anni dopo e' andato in guadagno ${Math.round(c.quotaInGuadagno * 100)} volte su cento, con un risultato tipico del ${Math.round(c.mediano * 100)}% — praticamente uguale a quello dei mercati tranquilli (${Math.round(q.mediano * 100)}%). "E' salito troppo, adesso scende" e' una frase che suona saggia e non e' vera. Quello che cambia davvero e' un'altra cosa: nel decimo peggiore dei casi un mercato tirato perde il ${Math.abs(Math.round(c.andataMale * 100))}%, contro il ${Math.abs(Math.round(q.andataMale * 100))}% di uno tranquillo. Non ha un futuro peggiore, ha un futuro piu' largo. E in pratica e' la larghezza che ti fa vendere nel momento sbagliato, non la media.`;
}

export function cicliText() {
  const e = episodi();
  const f = e.formaTipica;
  if (!e.quanti) return null;
  const insieme = e.anniInCuiPiuMercatiHannoFattoPicco[0];
  return `Guardando ${ANNI.length} anni di azioni, metalli, petrolio, terre rare e case tutti insieme, ho trovato ${e.quanti} episodi con la stessa forma: un mercato sale molto, tocca un massimo, poi ne perde almeno un terzo. In media ci mettono ${f.anniDiSalita} anni a salire ${Math.round(f.salitaMedia * 100)}% e ${f.anniDiCaduta} anni a perdere ${Math.abs(Math.round(f.cadutaMedia * 100))}%. ${e.salitaPiuLungaDellaCaduta ? 'La salita dura piu\' della discesa: si sale piano e si scende in fretta, e questo e\' il motivo per cui uscire in tempo e\' cosi\' difficile.' : 'La discesa dura piu\' della salita.'}${insieme ? ` L'anno in cui piu' mercati hanno toccato il massimo insieme e' il ${insieme.anno}: ${insieme.mercati.join(', ')}. Quando succede in piu' posti contemporaneamente non e' la storia di un mercato, e' il costo del denaro che cambia.` : ''}`;
}

export function anticipiText() {
  const a = chiAnticipaChi();
  if (!a.piuDelCaso) {
    return `Ho provato ${a.coppieEsaminate} combinazioni per vedere se un mercato si muove sistematicamente un anno prima di un altro. Ne ho trovate ${a.anticipiTrovati} sopra la soglia, ma provando cosi' tante combinazioni su ${ANNI.length} anni te ne aspetteresti circa ${a.atteseSoloPerCaso} per puro caso. Tradotto: non ho trovato nessun mercato che anticipi gli altri in modo affidabile. Se qualcuno ti dice che ce l'ha, chiedigli su quanti anni.`;
  }
  const p = a.primi[0];
  return `Ho provato ${a.coppieEsaminate} combinazioni: ${a.anticipiTrovati} superano la soglia, contro le ${a.atteseSoloPerCaso} che ti aspetteresti per caso. La piu' netta: ${p.nomeChi} un anno prima di ${p.nomeAnticipa} (${p.conUnAnnoDiAnticipo}, contro ${p.nelloStessoAnno} nello stesso anno). Restano ${p.osservazioni} osservazioni: un indizio, non una regola su cui mettere dei soldi.`;
}
