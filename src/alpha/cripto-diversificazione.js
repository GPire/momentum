// ============================================================
// CINQUE CRIPTO NON SONO CINQUE SCOMMESSE
// ============================================================
// IL PROBLEMA VERO DI CHI HA PIU' CRIPTO, e non e' quello che si racconta nei
// forum. Chi possiede bitcoin, ethereum, solana, cardano e qualcos'altro crede
// di avere cinque posizioni diverse: le ha scelte in momenti diversi, per
// ragioni diverse, e sullo schermo sono cinque righe.
// Nei giorni che contano sono UNA. E quando scende, scende tutto insieme.
//
// Questo modulo lo misura invece di ripeterlo, e lo fa con dati VERI e LIVE:
// CoinGecko risponde dal browser senza chiave (verificato — e' l'unica
// famiglia di fonti finanziarie che lo fa: Yahoo, Stooq, FRED e la SEC
// bloccano tutte le chiamate da una pagina web). Quello che per le azioni
// richiede uno scaricamento a tempo di sviluppo, per le cripto si puo' fare
// in diretta.
//
// ── LE DUE MISURE, entrambe gia' costruite altrove ──
// 1. QUANTE SCOMMESSE DAVVERO: il numero efficace di direzioni indipendenti
//    dagli autovalori della matrice di correlazione (Li e Ji, gia' in
//    panoramica-incrociata.js). Se dieci monete contengono due direzioni, chi
//    ne ha dieci ha due scommesse.
// 2. QUANTO SI MUOVONO COME UNA COSA SOLA: il rapporto di assorbimento
//    (assorbimento.js). Sulle azioni misurava se la diversificazione stesse
//    funzionando; qui misura se sia mai esistita.
//
// ── ONESTA' SUI LIMITI, dichiarati nel referto ──
// · CoinGecko gratuito da 365 giorni per moneta: un anno, non un ciclo. Le
//   cripto hanno cicli pluriennali, e un anno puo' esserne una fase sola.
// · Le monete stabili (tether, usdc) vanno ESCLUSE: sono ancorate al dollaro
//   per costruzione, e tenerle dentro farebbe sembrare il paniere molto piu'
//   diversificato di quanto sia. E' il modo piu' facile di ingannarsi qui.
// · Correlazione non e' causa, e un anno di correlazione alta non garantisce
//   che resti alta.
//
// Funzioni PURE per il calcolo; la rete solo in `scaricaStorie`.
'use strict';

import { matriceCorrelazione, numeroEfficaceDiFonti } from './panoramica-incrociata.js';
import { rapportoAssorbimento } from './assorbimento.js';

// Ancorate al dollaro per costruzione: dentro il conto renderebbero il
// paniere finto-diversificato.
export const STABILI = new Set(['tether', 'usd-coin', 'dai', 'first-digital-usd', 'ethena-usde', 'usds', 'binance-usd', 'trueusd']);
export const MIN_MONETE = 3;
export const GIORNI = 365;

export async function elencoTop(quante = 12, { fetchImpl = fetch, valuta = 'eur' } = {}) {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${valuta}&order=market_cap_desc&per_page=${quante + 8}&page=1`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`CoinGecko mercati: HTTP ${res.status}`);
  const j = await res.json();
  return (Array.isArray(j) ? j : [])
    .filter((x) => x?.id && !STABILI.has(x.id))
    .slice(0, quante)
    .map((x) => ({ id: x.id, simbolo: String(x.symbol || '').toUpperCase(), nome: x.name, capitalizzazione: x.market_cap }));
}

// I rendimenti giornalieri di una moneta. `null` invece di un errore quando
// una moneta non risponde: una lista di dieci non deve fallire per una.
export async function storiaMoneta(id, { fetchImpl = fetch, valuta = 'eur', giorni = GIORNI } = {}) {
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=${valuta}&days=${giorni}&interval=daily`;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    const j = await res.json();
    const p = (j?.prices || []).map((x) => x[1]).filter((x) => Number.isFinite(x) && x > 0);
    if (p.length < 60) return null;
    const r = [];
    for (let i = 1; i < p.length; i++) r.push(p[i] / p[i - 1] - 1);
    return r;
  } catch (_) { return null; }
}

// ── IL REFERTO ──
// `serie`: { simbolo: [rendimenti] } — arriva dal chiamante, cosi' la parte
// che calcola resta pura e testabile senza rete.
// ── SCARICARE PIU' MONETE SENZA FARSI CHIUDERE LA PORTA ──
// CoinGecko gratuito limita le richieste, e con otto monete di fila ne
// arrivano quattro: verificato dal vivo. Un modulo che chiedesse tutto in
// parallelo otterrebbe meta' dei dati e non se ne accorgerebbe — costruendo
// una correlazione su un paniere diverso da quello che l'utente crede.
// Quindi: una alla volta, con pausa, un tentativo di recupero, e soprattutto
// il CONTO di quante ne sono davvero arrivate, che finisce nel referto.
export async function scaricaStorie(monete = [], { fetchImpl = fetch, pausaMs = 2500, tentativi = 2, valuta = 'eur' } = {}) {
  const serie = {}; const mancate = [];
  for (const m of monete) {
    let ok = null;
    for (let t = 0; t < tentativi && !ok; t++) {
      if (t > 0) await new Promise((r) => setTimeout(r, pausaMs * 2));
      ok = await storiaMoneta(m.id, { fetchImpl, valuta });
    }
    if (ok) serie[m.simbolo] = ok; else mancate.push(m.simbolo);
    await new Promise((r) => setTimeout(r, pausaMs));
  }
  return { serie, mancate, chieste: monete.length };
}

export function quanteScommesse(serie = {}, { mancate = [] } = {}) {
  const nomi = Object.keys(serie).filter((k) => Array.isArray(serie[k]) && serie[k].length >= 60);
  if (nomi.length < MIN_MONETE) {
    return { disponibile: false, motivo: `Servono almeno ${MIN_MONETE} monete con storia sufficiente: qui ce ne sono ${nomi.length}.` };
  }
  const lung = Math.min(...nomi.map((k) => serie[k].length));
  const dati = nomi.map((k) => serie[k].slice(-lung));

  const M = matriceCorrelazione(dati);
  const efficaci = numeroEfficaceDiFonti(M);
  const ass = rapportoAssorbimento(dati);

  // La correlazione MEDIA fra coppie diverse: e' il numero che una persona
  // capisce senza sapere cosa sia un autovalore.
  let somma = 0, coppie = 0;
  let minC = 1, maxC = -1, piuLegate = null;
  for (let i = 0; i < M.length; i++) {
    for (let j = i + 1; j < M.length; j++) {
      somma += M[i][j]; coppie++;
      if (M[i][j] > maxC) { maxC = M[i][j]; piuLegate = [nomi[i], nomi[j]]; }
      if (M[i][j] < minC) minC = M[i][j];
    }
  }
  const mediaCorr = coppie ? somma / coppie : 0;

  return {
    disponibile: true,
    monete: nomi.length,
    giorni: lung,
    scommesseVere: efficaci,
    correlazioneMedia: +mediaCorr.toFixed(3),
    correlazioneMinima: +minC.toFixed(3),
    piuLegate: piuLegate ? { a: piuLegate[0], b: piuLegate[1], correlazione: +maxC.toFixed(3) } : null,
    assorbimento: ass ? ass.valore : null,
    // Quanto della "diversificazione" e' illusoria: se dieci monete valgono
    // due scommesse, otto righe dello schermo non stanno diversificando.
    illusione: +(nomi.length - efficaci).toFixed(2),
    nomi,
    // Le monete che NON sono arrivate: senza dichiararle, il referto
    // parlerebbe di un paniere diverso da quello che l'utente ha in mente.
    mancate,
  };
}

export function testoScommesse(r) {
  if (!r?.disponibile) return r?.motivo || null;
  const righe = [];

  righe.push(`Hai guardato ${r.monete} cripto su ${r.giorni} giorni: contengono ${r.scommesseVere} direzioni davvero diverse.`);
  righe.push(r.illusione >= 2
    ? `Cioe' ${r.monete} righe sullo schermo valgono ${r.scommesseVere} scommesse: le altre ${r.illusione.toFixed(0)} non stanno diversificando niente, stanno ripetendo.`
    : `Qui la diversificazione e' quasi reale: raro nelle cripto, e vale la pena chiedersi se dipenda dal periodo scelto.`);

  righe.push(`Si muovono insieme in media al ${Math.round(r.correlazioneMedia * 100)}%${r.piuLegate ? `, e le due piu' legate sono ${r.piuLegate.a} e ${r.piuLegate.b} al ${Math.round(r.piuLegate.correlazione * 100)}%` : ''}.`);
  if (r.assorbimento !== null) {
    righe.push(`Il ${Math.round(r.assorbimento * 100)}% di tutto il loro movimento e' una direzione comune sola.`);
  }

  righe.push(`E' un anno di dati, non un ciclo: le cripto si muovono su cicli pluriennali, e dodici mesi possono esserne una fase sola.`);
  righe.push('Le monete ancorate al dollaro sono escluse: tenerle dentro farebbe sembrare il paniere molto piu\' vario di quanto sia.');
  if (r.mancate?.length) {
    righe.push(`Non ho ottenuto i dati di ${r.mancate.join(', ')}: la fonte gratuita limita le richieste, e questo conto e' fatto senza di loro.`);
  }
  righe.push('Non e\' un consiglio: e\' quante scommesse hai davvero rispetto a quante credi.');
  return righe.join(' ');
}
