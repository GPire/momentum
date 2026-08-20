// ============================================================
// DIECI ANNI DI CONTI, NON DODICI MESI
// ============================================================
// IL LIMITE CHE QUESTO MODULO CHIUDE, ed era scritto nero su bianco in
// `fondamentali.js` fin dal primo giorno: "sono i numeri degli ultimi dodici
// mesi, una foto di oggi. Buffett chiede dieci anni di conti buoni, e la
// storia dei bilanci qui non c'e'."
//
// Era vero, e sembrava incolmabile: le fonti commerciali vendono la storia dei
// bilanci a pagamento, e Momentum non ha chiavi ne' server. La soluzione era
// altrove — la SEC pubblica GRATIS i documenti che le aziende quotate negli
// Stati Uniti sono obbligate per legge a depositare. Non un aggregatore: la
// fonte primaria. Scaricati a tempo di sviluppo (`npm run bench:sec`), sono
// nell'app: offline, senza chiavi.
//
// ── E CAMBIA LA DOMANDA CHE SI PUO' FARE ──
// Con dodici mesi si puo' solo chiedere "il ROE e' alto?". Con diciannove anni
// si chiede quello che Buffett chiede davvero: **e' alto DA TANTO, e senza
// buchi?** Un'azienda con ROE al 25% per quindici anni e una che l'ha avuto
// alto l'anno scorso danno lo stesso numero nella foto, e sono due cose
// completamente diverse.
//
// ── LE TRE MISURE, e perche' queste ──
// 1. QUANTI ANNI sopra la soglia, su quanti disponibili. Non la media: la
//    media di dieci anni buoni e uno disastroso resta buona, e nasconde
//    proprio l'anno che conta.
// 2. LA COSTANZA: quanto oscilla. Due aziende con la stessa media ma una
//    stabile e una a zig-zag non sono la stessa scommessa, e la seconda
//    dipende molto piu' dalla fortuna del ciclo.
// 3. LA DIREZIONE: sta migliorando o peggiorando? Confronto fra la prima e la
//    seconda meta' del periodo — grezzo, ma difficile da fraintendere.
//
// Nessun consiglio, mai. Funzioni PURE.
'use strict';

import { FONDAMENTALI_STORICI, SEC_SCARICATO_IL, anniCoperti } from './fondamentali-storici.js';

// Le soglie sono le stesse di fondamentali.js: un criterio che cambia numero
// a seconda di dove lo si guarda non e' un criterio.
export const SOGLIE = { roe: 0.15, margine: 0.10, roa: 0.07 };
// Sotto questo numero di esercizi non si parla di "storia": si parla di pochi
// anni, ed e' un'altra cosa.
export const MIN_ANNI = 5;

const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;

export function disponibile(ticker) {
  return !!FONDAMENTALI_STORICI[String(ticker || '').toUpperCase()];
}

export function qualitaNelTempo(ticker, { misura = 'roe' } = {}) {
  const t = String(ticker || '').toUpperCase();
  const dati = FONDAMENTALI_STORICI[t];
  const soglia = SOGLIE[misura];
  if (!dati || !soglia) {
    return { disponibile: false, motivo: `Non ho i bilanci depositati per ${t || 'questa azienda'}. La SEC copre le societa' quotate negli Stati Uniti: per un'azienda europea qui non c'e' niente, e non e' un dato mancante — e' un'autorita' diversa.` };
  }

  const serie = dati.anni.filter((x) => Number.isFinite(x[misura]));
  // Gli esercizi in cui la misura NON e' calcolabile: per il ROE sono quelli
  // col patrimonio netto quasi azzerato dai riacquisti, dove il rapporto non
  // ha significato. Vanno DICHIARATI, altrimenti "7 su 7" sembra una storia
  // completa quando meta' e' stata scartata.
  const esclusi = dati.anni.length - serie.length;
  if (serie.length < MIN_ANNI) {
    return { disponibile: false, motivo: `Per ${dati.nome} ho solo ${serie.length} esercizi con questo dato: troppo pochi per parlare di costanza nel tempo.` };
  }

  const valori = serie.map((x) => x[misura]);
  const sopra = serie.filter((x) => x[misura] >= soglia);
  const m = media(valori);
  const sd = Math.sqrt(valori.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, valori.length - 1));

  const meta = Math.floor(valori.length / 2);
  const prima = media(valori.slice(0, meta));
  const seconda = media(valori.slice(-meta));

  return {
    disponibile: true,
    ticker: t, nome: dati.nome, misura,
    anni: serie.length, da: serie[0].anno, a: serie[serie.length - 1].anno,
    esercizioEsclusi: esclusi,
    soglia,
    anniSopra: sopra.length,
    quotaSopra: +(100 * sopra.length / serie.length).toFixed(0),
    // Il criterio di Buffett letto alla lettera: non "in media alto" ma
    // "alto quasi sempre".
    sempreSopra: sopra.length === serie.length,
    media: +m.toFixed(4),
    peggiorAnno: { anno: serie[valori.indexOf(Math.min(...valori))].anno, valore: +Math.min(...valori).toFixed(4) },
    oscillazione: +sd.toFixed(4),
    direzione: +(seconda - prima).toFixed(4),
    fonte: `bilanci depositati alla SEC, aggiornati al ${SEC_SCARICATO_IL}`,
  };
}

const pct = (x) => `${(x * 100).toFixed(0)}%`;

export function testoQualita(q) {
  if (!q?.disponibile) return q?.motivo || null;
  const nome = { roe: 'rendimento sul capitale dei soci', margine: 'margine netto', roa: 'rendimento sulle attivita\'' }[q.misura];
  const righe = [];

  righe.push(q.sempreSopra
    ? `${q.nome}: il ${nome} e' stato sopra ${pct(q.soglia)} in TUTTI i ${q.anni} esercizi dal ${q.da} al ${q.a}.`
    : `${q.nome}: il ${nome} e' stato sopra ${pct(q.soglia)} in ${q.anniSopra} esercizi su ${q.anni} (${q.quotaSopra}%), dal ${q.da} al ${q.a}.`);

  righe.push(`In media ${pct(q.media)}, e l'anno peggiore e' stato il ${q.peggiorAnno.anno} con ${pct(q.peggiorAnno.valore)}.`);

  // La frase sull'oscillazione parlava di "una media alta ottenuta a zig-zag"
  // anche quando la media era NEGATIVA — per Tesla diceva "media alta" su un
  // -39%. Le due situazioni sono diverse e vanno dette diversamente.
  if (q.oscillazione > Math.abs(q.media) * 0.5) {
    righe.push(q.media >= q.soglia
      ? `Oscilla parecchio da un anno all'altro: una media alta ottenuta a zig-zag dipende molto piu' dal ciclo che dall'azienda.`
      : `Oscilla parecchio, e la media resta sotto la soglia: qui non c'e' una qualita' costante da misurare, c'e' un'azienda che in questi anni non ha ancora reso in modo stabile.`);
  } else {
    righe.push(q.media >= q.soglia
      ? `Resta abbastanza stabile di anno in anno, che e' quello che distingue un'azienda solida da una fortunata.`
      : `Resta stabile, ma stabilmente sotto la soglia.`);
  }

  if (Math.abs(q.direzione) > 0.02) {
    righe.push(q.direzione > 0
      ? `Negli ultimi anni e' migliorato rispetto ai primi (+${pct(q.direzione)}).`
      : `Negli ultimi anni e' peggiorato rispetto ai primi (${pct(q.direzione)}).`);
  }

  if (q.esercizioEsclusi > 0) {
    // Il plurale si costruisce per intero, non attaccando una lettera: la
    // prima versione produceva "calcolabilei".
    righe.push(q.esercizioEsclusi === 1
      ? `Un esercizio non e' calcolabile: il patrimonio netto era troppo vicino a zero perche' il rapporto avesse un significato.`
      : `${q.esercizioEsclusi} esercizi non sono calcolabili: il patrimonio netto era troppo vicino a zero perche' il rapporto avesse un significato.`);
  }
  righe.push(`Fonte: ${q.fonte}. Sono fatti depositati, non stime — e non sono un consiglio.`);
  return righe.join(' ');
}

// Il confronto fra piu' aziende sulla stessa misura: e' cosi' che si vede se
// un numero alto sia normale nel settore o davvero raro.
export function classifica({ misura = 'roe', minAnni = MIN_ANNI } = {}) {
  return Object.keys(FONDAMENTALI_STORICI)
    .map((t) => qualitaNelTempo(t, { misura }))
    .filter((q) => q.disponibile && q.anni >= minAnni)
    // ── A PARITA' DI QUOTA VINCE CHI HA PIU' STORIA, non chi ha la media
    // piu' alta. E' la lezione che questa sessione ha incontrato quattro
    // volte: un campione piccolo sembra impressionante.
    // Concretamente: "7 esercizi su 7" e "18 su 18" sono entrambi il 100%, ma
    // non sono la stessa prova. Ordinando per media, Colgate con sette anni
    // superava Apple con diciotto — e sette anni non dicono di piu' di
    // diciotto, dicono di meno.
    .sort((a, b) => b.quotaSopra - a.quotaSopra || b.anni - a.anni || b.media - a.media);
}
