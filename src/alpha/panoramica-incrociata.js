// ============================================================
// GUARDARE TUTTO INSIEME — e dire quante cose si sono guardate
// ============================================================
// Momentum raccoglie gia' molto: azioni, oro, rame, petrolio, materie prime,
// titoli di Stato, dollaro, condizioni finanziarie, tassi di dodici Paesi,
// nove settori, terre rare, notizie. Ogni pannello sa leggere il proprio pezzo.
// Nessuno li guarda INSIEME — ed e' la cosa che un operatore fa per primo ogni
// mattina.
//
// ── PERCHE' NESSUNO LO FA BENE, ed e' un problema statistico, non di lavoro ──
// Guardare trenta serie e annunciare "il rame e' a un estremo storico!" e'
// quasi sempre un annuncio vuoto, e il motivo e' aritmetico: se guardi trenta
// cose, la piu' estrema delle trenta SEMBRA estrema anche quando tutte e trenta
// sono perfettamente normali. Con trenta serie indipendenti, il 5% piu' estremo
// contiene in media 1,5 serie **per puro caso**.
// Ogni "briefing di mercato" generato automaticamente fa esattamente questo:
// pesca il dato piu' vistoso fra molti e non dice mai quanti ne ha guardati.
// E' cherry-picking involontario, e con una macchina che guarda tutto in
// continuazione il problema non migliora: peggiora, perche' le occasioni di
// pescare aumentano.
//
// QUI SI FA IL CONTRARIO: si guarda tutto, si dichiara **quanto** si e'
// guardato, e si segnala solo cio' che sopravvive alla correzione per aver
// guardato tanto. Riusa `benjaminiYekutieli` (predict/causal-discovery.js),
// gia' scelto nel progetto proprio perche' NON assume indipendenza.
//
// ── LA SECONDA TRAPPOLA, piu' sottile e piu' interessante ──
// "Cinque indicatori sono anomali insieme" suona come una conferma forte. Non
// lo e' se quei cinque sono la stessa cosa vista cinque volte: petrolio, rame e
// indice delle materie prime si muovono insieme quasi sempre, e contarli come
// tre segnali indipendenti tripla una prova che e' una sola.
// Quindi si stima il **numero EFFICACE di fonti indipendenti** dagli autovalori
// della matrice di correlazione (metodo di Li e Ji, 2005: gli autovalori di una
// matrice di correlazione dicono quante direzioni davvero distinte contiene).
// Se dodici serie contengono solo quattro direzioni distinte, si dice quattro —
// e la soglia si calcola su quattro, non su dodici.
//
// Il risultato tipico sara' "niente di davvero eccezionale oggi", ed e' la
// risposta giusta quasi ogni giorno. Un sistema che trova qualcosa di
// eccezionale ogni mattina non sta osservando: sta intrattenendo.
//
// Funzioni PURE: le serie arrivano dal chiamante.
'use strict';

import { benjaminiYekutieli } from '../predict/causal-discovery.js';

export const MIN_STORIA = 36;

const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const scarto = (a) => {
  const m = media(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1));
};

// ── Quanto e' strano il valore di adesso, per QUESTA serie ──
// Percentile empirico, non uno z: i rendimenti non sono normali e uno z su
// code grasse esagera sistematicamente. Il percentile non assume nulla.
// Il valore p e' bilaterale: interessa l'estremita', in qualunque verso.
export function quantoStrano(serie = [], { finestra = 12 } = {}) {
  const x = serie.filter(Number.isFinite);
  if (x.length < MIN_STORIA) return null;
  // Il "valore di adesso" e' la media dell'ultima finestra, non l'ultimo punto:
  // un solo mese e' rumore, e segnalare ogni mese storto riempirebbe la
  // panoramica di falsi allarmi.
  const recente = media(x.slice(-finestra));
  const storia = [];
  for (let i = finestra; i <= x.length; i++) storia.push(media(x.slice(i - finestra, i)));
  if (storia.length < MIN_STORIA / 2) return null;

  const n = storia.length;
  // SIMMETRIA, e non e' un dettaglio: contando solo i valori "sotto" con un
  // confronto stretto, un massimo storico e un minimo storico ricevevano p
  // diversi (0,01 contro 0,005) pur essendo ugualmente rari. Si contano
  // entrambi i lati e si prende il piu' piccolo, con il +1 standard nei test
  // di permutazione — che evita anche un p pari a zero, che non esiste.
  const nonSuperiori = storia.filter((v) => v <= recente).length;
  const nonInferiori = storia.filter((v) => v >= recente).length;
  const p = Math.min(1, 2 * Math.min(nonSuperiori, nonInferiori) / (n + 1));
  const percentile = storia.filter((v) => v < recente).length / n;

  return {
    valoreRecente: +recente.toFixed(5),
    percentile: +(100 * percentile).toFixed(1),
    p: +p.toFixed(5),
    verso: percentile >= 0.5 ? 'alto' : 'basso',
    finestre: n,
    // IL PAVIMENTO DEL VALORE p, e va dichiarato. Un p empirico non puo'
    // scendere sotto 2/(n+1): con poca storia il valore piu' estremo possibile
    // resta comunque grande. Se questo pavimento sta sopra la soglia corretta,
    // NIENTE potrebbe essere segnalato per quanto sia estremo — e un sistema
    // che non puo' trovare nulla deve dirlo, non restare in silenzio
    // sembrando prudente.
    risoluzione: +(2 / (n + 1)).toFixed(5),
    dispersioneStorica: +scarto(storia).toFixed(5),
  };
}

// ── Quante fonti DAVVERO diverse ci sono ──
// Autovalori della matrice di correlazione con il metodo di Jacobi (matrice
// simmetrica, poche decine di righe: e' esatto e basta ampiamente).
export function autovaloriSimmetrica(M, { iterazioni = 100, tolleranza = 1e-10 } = {}) {
  const n = M.length;
  const A = M.map((r) => r.slice());
  for (let iter = 0; iter < iterazioni; iter++) {
    // Il fuori-diagonale piu' grande.
    let p = 0, q = 1, massimo = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(A[i][j]) > massimo) { massimo = Math.abs(A[i][j]); p = i; q = j; }
      }
    }
    if (massimo < tolleranza) break;
    const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
    const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const c = 1 / Math.sqrt(t * t + 1), s = t * c;
    for (let k = 0; k < n; k++) {
      const akp = A[k][p], akq = A[k][q];
      A[k][p] = c * akp - s * akq;
      A[k][q] = s * akp + c * akq;
    }
    for (let k = 0; k < n; k++) {
      const apk = A[p][k], aqk = A[q][k];
      A[p][k] = c * apk - s * aqk;
      A[q][k] = s * apk + c * aqk;
    }
  }
  return A.map((r, i) => r[i]).sort((a, b) => b - a);
}

// Metodo di Li e Ji (2005): ogni autovalore contribuisce con la sua parte
// intera (se >= 1) piu' la sua parte frazionaria. Un blocco di serie
// perfettamente correlate contribuisce 1, non quante sono.
export function numeroEfficaceDiFonti(matriceCorrelazione) {
  const n = matriceCorrelazione.length;
  if (n < 2) return n;
  const lambda = autovaloriSimmetrica(matriceCorrelazione).map((v) => Math.max(0, v));
  let meff = 0;
  for (const l of lambda) meff += (l >= 1 ? 1 : 0) + (l - Math.floor(l));
  return Math.max(1, Math.min(n, +meff.toFixed(2)));
}

export function matriceCorrelazione(serie = []) {
  const n = serie.length;
  const lung = Math.min(...serie.map((s) => s.length));
  const tagliate = serie.map((s) => s.slice(-lung));
  const M = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const a = tagliate[i], b = tagliate[j];
      const ma = media(a), mb = media(b);
      let sab = 0, saa = 0, sbb = 0;
      for (let k = 0; k < lung; k++) {
        sab += (a[k] - ma) * (b[k] - mb);
        saa += (a[k] - ma) ** 2;
        sbb += (b[k] - mb) ** 2;
      }
      const den = Math.sqrt(saa * sbb);
      const r = den > 0 ? sab / den : 0;
      M[i][j] = i === j ? 1 : r;
      M[j][i] = M[i][j];
    }
  }
  return M;
}

// ── La panoramica ──
// `fonti`: { nome: [serie di numeri] }. Tutte devono essere alla stessa
// frequenza (mensile) — mescolare frequenze produrrebbe correlazioni finte.
export function panoramica(fonti = {}, { finestra = 12, alpha = 0.05 } = {}) {
  const nomi = Object.keys(fonti).filter((k) => Array.isArray(fonti[k]) && fonti[k].filter(Number.isFinite).length >= MIN_STORIA);
  if (nomi.length < 2) {
    return { disponibile: false, motivo: `Servono almeno 2 fonti con ${MIN_STORIA} osservazioni: qui ce ne sono ${nomi.length}.` };
  }

  const misure = [];
  for (const nome of nomi) {
    const s = quantoStrano(fonti[nome], { finestra });
    if (s) misure.push({ nome, ...s });
  }
  if (!misure.length) return { disponibile: false, motivo: 'Nessuna fonte ha storia sufficiente per dire se il presente sia insolito.' };

  // Quante fonti DAVVERO diverse: e' il numero su cui va fatta la correzione.
  const serieAllineate = misure.map((m) => fonti[m.nome].filter(Number.isFinite));
  const M = matriceCorrelazione(serieAllineate);
  const efficaci = numeroEfficaceDiFonti(M);

  // Correzione per aver guardato tante cose. Benjamini-Yekutieli e' la scelta
  // giusta qui perche' NON assume indipendenza — e queste serie sono tutt'altro
  // che indipendenti.
  const by = benjaminiYekutieli(misure.map((m) => m.p), alpha);
  // `rejected` e' un Set di INDICI nell'array passato, non un array di
  // booleani: leggerlo come array darebbe sempre "niente di notevole", cioe'
  // un modulo che sembra funzionare e non segnala mai nulla.
  const sopravvissuti = misure
    .map((m, i) => ({ ...m, significativo: by.rejected.has(i) }))
    .sort((a, b) => a.p - b.p);

  const notevoli = sopravvissuti.filter((x) => x.significativo);
  // Quante ci si aspetta di vederne estreme per puro caso, dato quante
  // direzioni indipendenti ci sono davvero.
  const attesePerCaso = +(efficaci * alpha).toFixed(2);

  // POTEVA TROVARE QUALCOSA? La soglia piu' severa che Benjamini-Yekutieli
  // puo' applicare e' alpha/(m*c). Se il pavimento del valore p — che dipende
  // solo da quanta storia c'e' — sta sopra quella soglia, allora nessuna serie
  // potrebbe essere segnalata nemmeno se fosse a un estremo mai visto. Un
  // "niente di notevole" in quel caso non e' un'osservazione: e' un'incapacita'
  // di osservare, ed e' onesto distinguere le due cose.
  const c = Array.from({ length: misure.length }, (_, j) => 1 / (j + 1)).reduce((s, v) => s + v, 0);
  const sogliaPiuSevera = alpha / (misure.length * c);
  const risoluzionePeggiore = Math.max(...misure.map((m) => m.risoluzione));
  const cieco = risoluzionePeggiore > sogliaPiuSevera;

  return {
    disponibile: true,
    guardate: misure.length,
    fontiEfficaci: efficaci,
    attesePerCaso,
    sogliaCorretta: by.soglia,
    sogliaPiuSevera: +sogliaPiuSevera.toFixed(5),
    risoluzionePeggiore,
    cieco,
    notevoli,
    tutte: sopravvissuti,
    messaggio: cieco
      ? `Ho guardato ${misure.length} indicatori, che contengono ${efficaci} direzioni davvero distinte. Ma con la storia disponibile non potrei segnalarne nessuno nemmeno se fosse a un estremo mai visto: guardando così tante serie la soglia diventa più severa di quanto la storia permetta di misurare. Non è "niente di strano", è "non ho abbastanza storia per dirlo". Servirebbero circa ${Math.ceil(2 / sogliaPiuSevera)} osservazioni per serie.`
      : notevoli.length === 0
        ? `Ho guardato ${misure.length} indicatori (che però contengono solo ${efficaci} direzioni davvero distinte: molti si muovono insieme). Niente esce dall'ordinario una volta tenuto conto di quante cose ho guardato — ed è la risposta di quasi tutti i giorni.`
      : `Ho guardato ${misure.length} indicatori, che contengono ${efficaci} direzioni davvero distinte. Guardandone così tanti, ci si aspetta di vederne circa ${attesePerCaso} agli estremi per puro caso: ${notevoli.length} ${notevoli.length === 1 ? 'resta notevole' : 'restano notevoli'} anche tenendone conto — ${notevoli.map((n) => n.nome).join(', ')}.`,
    avvisi: [
      'Insolito non vuol dire che stia per succedere qualcosa: vuol dire solo che il valore di adesso è raro rispetto alla storia di quella serie.',
      'Gli indicatori che si muovono insieme non sono prove separate: contarli come tali triplicherebbe una prova che è una sola.',
    ],
  };
}

export function testoPanoramica(p) {
  if (!p?.disponibile) return p?.motivo || null;
  const righe = [p.messaggio];
  for (const n of p.notevoli.slice(0, 3)) {
    righe.push(`${n.nome}: negli ultimi mesi è nella fascia più ${n.verso === 'alto' ? 'alta' : 'bassa'} della sua storia (percentile ${n.percentile}).`);
  }
  righe.push(p.avvisi[0]);
  return righe.join(' ');
}
