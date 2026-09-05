// ============================================================
// "CE LA FACCIO AD ARRIVARE ALLO STIPENDIO?"
// ============================================================
// La Cassa Unica risponde benissimo a "quanto posso spendere oggi": budget
// del ciclo meno quello che hai speso, diviso i giorni. E' una MEDIA, ed e'
// il numero giusto per decidere oggi.
//
// Ma la domanda che la gente si fa davvero, e che nessuna app di bilancio
// risponde, e' un'altra: **ce la faccio?** E a quella una media non risponde,
// perche' nessuno spende la propria media. Chi ha 200 euro per dieci giorni e
// una media di 20 al giorno sembra in pari; se pero' i suoi giorni veri sono
// fatti di tanti zeri e di qualche giorno da 80, la probabilita' di finirli
// prima e' alta — e la media non lo dice mai.
//
// ── COME SI MISURA, E PERCHE' COSI' ──
// Ricampionamento dai SUOI giorni veri (bootstrap), non una curva a campana.
// Le spese quotidiane non sono distribuite normalmente e non lo sono mai
// state: sono asimmetriche, piene di zeri e con una coda lunga a destra.
// Applicarci sopra una gaussiana produce un numero che sembra scientifico e
// sbaglia sistematicamente nella direzione ottimista — proprio dove un errore
// costa di piu'. Prendere a caso fra i giorni che la persona ha davvero
// vissuto non assume nessuna forma: qualunque sia la forma, e' gia' li'.
//
// ── E LE SPESE CHE SI SANNO GIA' ──
// Se il 28 arriva l'abbonamento e lo stipendio e' il 1°, quei soldi non sono
// disponibili, ma nel "quanto posso spendere oggi" lo sembrano. Si sottraggono
// PRIMA di simulare: sono le uniche uscite future che non vanno indovinate.
//
// ── DUE REGOLE CHE NON SI PIEGANO ──
//  1. Deterministico. Stesso input, stessa probabilita', sempre: un numero che
//     balla a ogni apertura non e' una stima, e' rumore. Generatore con seme
//     fisso, mai Math.random.
//  2. Si tace quando non si sa. Sotto un minimo di giorni osservati la
//     probabilita' non si pubblica: dire "rischio 12%" con otto giorni di
//     storia e' peggio che non dire niente, perche' viene creduto.
'use strict';

// Sotto questa soglia di giorni osservati non ci si pronuncia.
export const MIN_GIORNI_STORIA = 21;
// Traiettorie simulate. 2000 e' abbastanza per stabilizzare la seconda cifra
// decimale e resta istantaneo anche su un telefono modesto.
export const TRAIETTORIE = 2000;

// Generatore deterministico (xorshift32): stesso seme, stessa sequenza, su
// qualunque dispositivo e qualunque motore JS.
function generatore(seme = 20260905) {
  let s = seme >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const r2 = (n) => Math.round(n * 100) / 100;

// ── Le uscite gia' note che cadranno prima del prossimo stipendio ──
// `ricorrenti` = [{ importo, giornoDelMese }]. Si contano solo quelle che
// cadono nella finestra: un abbonamento che scade DOPO lo stipendio non
// toglie niente a questo ciclo.
export function speseGiaNote(ricorrenti = [], { da, a } = {}) {
  const inizio = da instanceof Date ? da : new Date(da);
  const fine = a instanceof Date ? a : new Date(a);
  if (Number.isNaN(inizio.getTime()) || Number.isNaN(fine.getTime()) || fine <= inizio) {
    return { totale: 0, voci: [] };
  }
  const voci = [];
  // Si cammina giorno per giorno sulla finestra: e' corta (al massimo un mese
  // abbondante) e cosi' un ciclo a cavallo di due mesi funziona senza casi
  // speciali — che e' esattamente dove questi conti sbagliano di solito.
  const cursore = new Date(inizio.getFullYear(), inizio.getMonth(), inizio.getDate());
  cursore.setDate(cursore.getDate() + 1); // da domani: oggi e' gia' contato nello speso
  const ultimo = new Date(fine.getFullYear(), fine.getMonth(), fine.getDate());
  let guardia = 0;
  while (cursore <= ultimo && guardia++ < 400) {
    const giorno = cursore.getDate();
    const ultimoDelMese = new Date(cursore.getFullYear(), cursore.getMonth() + 1, 0).getDate();
    for (const rc of ricorrenti) {
      // Niente Math.abs: un importo negativo è un dato sporco da scartare,
      // non una spesa vera con il segno sbagliato da "raddrizzare".
      const importo = +rc?.importo || 0;
      const g = +rc?.giornoDelMese;
      if (!(importo > 0) || !(g >= 1)) continue;
      // Il 31 di un mese da 30 giorni cade l'ultimo giorno: la stessa regola
      // gia' usata per il giorno di stipendio, non una seconda convenzione.
      const giornoEffettivo = Math.min(g, ultimoDelMese);
      if (giornoEffettivo === giorno) voci.push({ importo, quando: new Date(cursore), nome: rc.nome || null });
    }
    cursore.setDate(cursore.getDate() + 1);
  }
  return { totale: r2(voci.reduce((s, v) => s + v.importo, 0)), voci };
}

// ── LA TENUTA ───────────────────────────────────────────────────────────
// `giorniStorici` = spesa discrezionale di ogni giorno passato, ZERI COMPRESI.
// Gli zeri sono la meta' dell'informazione: un elenco delle sole giornate in
// cui si e' speso descrive una persona che spende tutti i giorni, e non esiste.
export function tenutaCiclo({
  rimanente = 0,
  giorniRimasti = 0,
  giorniStorici = [],
  speseNoteInArrivo = 0,
  traiettorie = TRAIETTORIE,
  seme = 20260905,
} = {}) {
  const storia = (giorniStorici || []).map(Number).filter(x => Number.isFinite(x) && x >= 0);
  // Number.isFinite (non solo `|| 0`) perché Infinity è truthy: senza questo
  // controllo un `giorniRimasti: Infinity` sporco farebbe girare il ciclo
  // sotto qui all'infinito per ogni traiettoria — un blocco vero, non solo
  // un numero sbagliato.
  const gg = Number.isFinite(+giorniRimasti) ? Math.max(0, Math.round(+giorniRimasti)) : 0;
  // Stesso valore ripulito usato per il calcolo E per quello che si mostra:
  // altrimenti un input sporco (NaN, negativo, Infinity) passa il calcolo ma
  // torna intatto — e quindi non finito — nel campo restituito.
  const speseNoteSan = Math.max(0, +speseNoteInArrivo || 0);
  const rimanenteSan = Number.isFinite(+rimanente) ? Math.max(0, +rimanente) : 0;
  const disponibile = r2(rimanenteSan - speseNoteSan);

  if (gg <= 0) return { misurabile: false, motivo: 'il ciclo è finito oggi' };
  if (storia.length < MIN_GIORNI_STORIA) {
    return { misurabile: false, motivo: `servono almeno ${MIN_GIORNI_STORIA} giorni di storia (ce ne sono ${storia.length})` };
  }
  // Le spese già note da sole superano quello che resta: non serve simulare,
  // e simulare qui darebbe una probabilità del 100% mascherando la causa vera.
  if (disponibile <= 0) {
    return {
      misurabile: true, certo: true, probabilitaSecco: 1, giorniRimasti: gg,
      disponibile: 0, speseNoteInArrivo: r2(speseNoteSan),
      motivo: 'le spese già in programma superano quello che resta',
    };
  }

  const rnd = generatore(seme);
  const n = storia.length;
  // BLOCK BOOTSTRAP, non giorno-per-giorno indipendente. Un ricampionamento
  // i.i.d. (un giorno a caso, poi un altro giorno a caso scollegato dal primo)
  // è CIECO all'ordine reale: rimescolando la storia in un ordine qualunque il
  // risultato non cambierebbe, perché vede solo l'insieme dei valori, mai la
  // sequenza. Nella realtà le spese arrivano a grappoli (weekend, gita, un
  // imprevisto che dura più giorni) — esattamente il difetto già misurato e
  // corretto in cash-forecast.js ("la somma di 14 giorni oscilla molto più di
  // quanto √14 prometta"). Qui si ricampiona per BLOCCHI di giorni CONSECUTIVI
  // (bootstrap circolare): si estrae un punto di partenza a caso nella storia
  // e si prendono i giorni veri, uno dopo l'altro, per tutta la lunghezza del
  // blocco — così un vero grappolo di spesa resta un grappolo anche nella
  // simulazione, invece di essere spalmato via dal ricampionamento.
  const LUNGHEZZA_BLOCCO = Math.max(1, Math.min(3, n));
  let secchi = 0;
  let sommaGiorniTenuti = 0;
  const finali = [];
  for (let t = 0; t < traiettorie; t++) {
    let cassa = disponibile;
    let tenuti = gg;
    let g = 0;
    while (g < gg && cassa >= 0) {
      const s = Math.floor(rnd() * n) % n;
      const passo = Math.min(LUNGHEZZA_BLOCCO, gg - g);
      for (let k = 0; k < passo && cassa >= 0; k++) {
        cassa -= storia[(s + k) % n];
        if (cassa < 0) { tenuti = g; break; }
        g++;
      }
    }
    if (cassa < 0) secchi++;
    sommaGiorniTenuti += tenuti;
    finali.push(cassa);
  }
  finali.sort((a, b) => a - b);
  const percentile = (p) => finali[Math.min(finali.length - 1, Math.max(0, Math.floor(p * finali.length)))];

  const probabilita = secchi / traiettorie;
  return {
    misurabile: true,
    certo: false,
    // Probabilità di restare a secco prima del prossimo stipendio.
    probabilitaSecco: +probabilita.toFixed(3),
    // Quanti giorni regge, nello scenario tipico e in quello brutto.
    giorniTenutiMedia: +(sommaGiorniTenuti / traiettorie).toFixed(1),
    giorniRimasti: gg,
    disponibile,
    speseNoteInArrivo: r2(speseNoteSan),
    // Con quanto si arriva allo stipendio: mediana e scenario sfortunato.
    saldoMediano: r2(percentile(0.5)),
    saldoScenarioBrutto: r2(percentile(0.1)),
    // Quanto si dovrebbe stare sotto al giorno per farcela quasi sempre.
    tettoGiornalieroSicuro: r2(disponibile / gg),
    giorniOsservati: storia.length,
  };
}

// Le tre fasce. Sono soglie di COMUNICAZIONE, non di matematica: sotto il 10%
// non vale la pena allarmare nessuno, sopra il 40% non dirlo sarebbe omissione.
export function fasciaTenuta(r) {
  if (!r || !r.misurabile) return null;
  const p = r.probabilitaSecco;
  if (p >= 0.4) return 'rischio';
  if (p >= 0.15) return 'attenzione';
  return 'tranquillo';
}

// Il testo. Mai una percentuale nuda: una probabilità da sola non dice cosa
// fare, e "rischio 38%" viene letto come "andrà male" o "andrà bene" a seconda
// dell'umore. Sempre accompagnata dal numero su cui si può agire.
export function testoTenuta(r) {
  if (!r || !r.misurabile) return null;
  if (r.certo) return 'Quello che resta non copre le spese che hai già in programma prima dello stipendio.';
  const pct = Math.round(r.probabilitaSecco * 100);
  const fascia = fasciaTenuta(r);
  if (fascia === 'tranquillo') {
    return `Ai tuoi ritmi arrivi allo stipendio senza problemi: dovrebbero avanzarti circa ${r.saldoMediano.toFixed(0)}€.`;
  }
  if (fascia === 'attenzione') {
    return `Ai tuoi ritmi ce la fai, ma stretto: ${pct} volte su 100 finiresti prima. Stando sotto ${r.tettoGiornalieroSicuro.toFixed(0)}€ al giorno arrivi tranquillo.`;
  }
  return `Ai tuoi ritmi rischi di restare a secco prima dello stipendio (${pct} volte su 100). Sotto ${r.tettoGiornalieroSicuro.toFixed(0)}€ al giorno ce la fai.`;
}
