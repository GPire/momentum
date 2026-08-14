// ============================================================
// IL PANNELLO NON DEVE MORIRE IL GIORNO IN CUI E' STATO GENERATO
// ============================================================
// IL PROBLEMA, sollevato guardando il codice e non in astratto. Il pannello
// storico dei nove settori (historical-panel.js) e' uno SCATTO: 331 mesi che
// finiscono a 2026-07, generati una volta e mai piu' toccati. Funziona
// benissimo oggi. Fra un mese i versamenti di agosto non hanno un mercato con
// cui essere confrontati; fra tre anni il divario di comportamento verrebbe
// calcolato su un mondo di tre anni fa, e l'utente non avrebbe modo di
// accorgersene. E' il difetto peggiore possibile in un'app di dati: non
// sbagliare rumorosamente, ma invecchiare in silenzio dando l'aria di
// funzionare.
//
// PERCHE' NON SI RIGENERA E BASTA. I nove ETF settoriali richiederebbero una
// fonte a pagamento o con chiave per ognuno, e nove chiamate a ogni avvio
// sarebbero un peso che nessuno paga volentieri in batteria e rete. Inoltre
// riscrivere il pannello incorporato significherebbe perdere la verificabilita'
// del dato di partenza, che e' cio' che rende credibile tutto il resto.
//
// LA SOLUZIONE, che segue lo schema gia' usato altrove nel progetto
// (freschezza.js, applicaCoda): lo scatto incorporato resta INTATTO come base
// verificata, e i mesi successivi si aggiungono in CODA da una fonte pubblica
// e senza chiave. Se la rete non c'e', si resta sulla base e lo si dichiara.
//
// L'APPROSSIMAZIONE VA DETTA, ed e' l'unico punto delicato. La base misura il
// "mercato" come media equipesata di nove settori; la coda usa l'indice S&P 500
// da FRED, che e' pesato per capitalizzazione. Non sono la stessa cosa: su
// pochi mesi la differenza e' piccola, ma non e' zero, e far finta che lo sia
// sarebbe esattamente il genere di scorciatoia che questo progetto non fa.
// Ogni risultato che usa la coda porta con se' quanti mesi vengono da li'.
//
// PERCHE' FRED E SENZA CHIAVE: e' l'unica fonte azionaria verificata
// raggiungibile dal browser senza chiave personale e senza proxy (Stooq
// risulta bloccato da CORS, Alpha Vantage richiede la chiave dell'utente).
// Meglio una fonte sola dichiarata che tre promesse che non rispondono.
//
// Funzioni PURE (fetch e tempo iniettabili).
'use strict';

import { PANNELLO_SETTORI, MESI_PANNELLO, DATE_PANNELLO } from './historical-panel.js';
import { leggiCsvFred } from './freschezza.js';

export const BASE_DA = DATE_PANNELLO[0];
export const BASE_A = DATE_PANNELLO[1];
export const FONTE_CODA = 'S&P 500 (FRED, serie SP500) — indice pesato per capitalizzazione';

// Oltre questa eta' in mesi il pannello si dichiara vecchio: tre mesi e' la
// soglia oltre la quale "il mercato di adesso" non e' piu' una descrizione
// onesta di quello che si sta mostrando.
export const MESI_TOLLERATI = 3;

const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;

// Il mercato della BASE incorporata: media equipesata dei nove settori.
export function mercatoBase() {
  const n = PANNELLO_SETTORI[0].r.length;
  const out = new Array(n);
  for (let t = 0; t < n; t++) out[t] = media(PANNELLO_SETTORI.map((s) => s.r[t]));
  return out;
}

// 'YYYY-MM' -> numero di mesi dall'inizio dell'era, per fare aritmetica sui
// mesi senza passare da Date (che introdurrebbe fusi orari dove non servono).
function mesiAssoluti(chiave) {
  const m = /^(\d{4})-(\d{2})/.exec(String(chiave || ''));
  return m ? Number(m[1]) * 12 + (Number(m[2]) - 1) : null;
}
function daMesiAssoluti(n) {
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
}

// ── Dai prezzi giornalieri ai rendimenti mensili ──
// Si tiene l'ULTIMA osservazione di ogni mese (chiusura del mese) e si
// calcolano le variazioni fra mesi consecutivi. Un mese ancora in corso viene
// scartato: mostrarlo come chiuso sarebbe un dato falso, e sarebbe proprio
// quello piu' visibile.
export function rendimentiMensiliDaGiornalieri(punti = [], { meseCorrente = null } = {}) {
  const ultimoDelMese = new Map();
  for (const p of punti) {
    const chiave = String(p.data || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(chiave)) continue;
    if (!Number.isFinite(p.valore)) continue;
    ultimoDelMese.set(chiave, p.valore); // i punti arrivano ordinati: l'ultimo vince
  }
  const mesi = [...ultimoDelMese.keys()].sort();
  const out = [];
  for (let i = 1; i < mesi.length; i++) {
    if (meseCorrente && mesi[i] >= meseCorrente) continue; // mese non chiuso: si scarta
    const prec = ultimoDelMese.get(mesi[i - 1]), cur = ultimoDelMese.get(mesi[i]);
    if (!(prec > 0)) continue;
    out.push({ mese: mesi[i], rendimento: +(cur / prec - 1).toFixed(6) });
  }
  return out;
}

// ── Scarica SOLO i mesi mancanti ──
// Si parte dal mese successivo all'ultimo che si ha gia': mai riscaricare la
// storia intera a ogni avvio.
export function urlCoda(daMese) {
  // Un mese indietro rispetto al primo mancante: serve il prezzo di partenza
  // per calcolare la variazione del primo mese nuovo.
  const partenza = daMesiAssoluti(mesiAssoluti(daMese) - 1);
  return `https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500&cosd=${partenza}-01`;
}

export async function scaricaCoda({ daMese = BASE_A, fetchImpl, adesso = Date.now(), timeoutMs = 8000 } = {}) {
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) return { riuscito: false, motivo: 'nessun modo di fare richieste in questo ambiente' };

  const primoMancante = daMesiAssoluti(mesiAssoluti(daMese) + 1);
  const meseCorrente = new Date(adesso).toISOString().slice(0, 7);
  if (mesiAssoluti(primoMancante) >= mesiAssoluti(meseCorrente)) {
    return { riuscito: false, aggiornatoIl: adesso, punti: [], motivo: 'non c\'e\' ancora nessun mese chiuso da aggiungere' };
  }

  try {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const res = await f(urlCoda(primoMancante), controller ? { signal: controller.signal } : undefined);
    if (timer) clearTimeout(timer);
    if (!res.ok) return { riuscito: false, motivo: `FRED ha risposto ${res.status}` };
    const testo = await res.text();
    const giornalieri = leggiCsvFred(testo);
    const mensili = rendimentiMensiliDaGiornalieri(giornalieri, { meseCorrente })
      .filter((x) => mesiAssoluti(x.mese) > mesiAssoluti(daMese));
    if (!mensili.length) return { riuscito: false, aggiornatoIl: adesso, punti: [], motivo: 'nessun mese nuovo e completo alla fonte' };
    return {
      riuscito: true, aggiornatoIl: adesso,
      punti: mensili,
      ultimo: mensili[mensili.length - 1].mese,
      fonte: FONTE_CODA,
      // Dichiarato SEMPRE: la coda non e' lo stesso indicatore della base.
      approssimazione: 'i mesi aggiunti usano l\'indice S&P 500 invece della media equipesata dei nove settori',
    };
  } catch (e) {
    return { riuscito: false, motivo: e?.name === 'AbortError' ? 'la fonte non ha risposto in tempo' : (e?.message || 'errore di rete') };
  }
}

// ── IL MERCATO COMPLETO: base + coda ──
// E' la funzione che ogni motore dovrebbe usare al posto della sola base.
// Senza coda restituisce esattamente la base di prima: nessuna regressione
// per chi non ha mai avuto rete.
export function mercatoVivo(coda = null) {
  const base = mercatoBase();
  const punti = (coda?.punti || []).filter((p) => Number.isFinite(p.rendimento));
  const valori = punti.length ? base.concat(punti.map((p) => p.rendimento)) : base;
  return {
    valori,
    mesiBase: base.length,
    mesiCoda: punti.length,
    da: BASE_DA,
    a: punti.length ? punti[punti.length - 1].mese : BASE_A,
    fonteCoda: punti.length ? FONTE_CODA : null,
    approssimazione: punti.length ? coda.approssimazione : null,
  };
}

// ── Quanto e' vecchio quello che sto mostrando ──
// Il numero che mancava del tutto: nessuno controllava l'eta' di questo
// pannello, quindi sarebbe invecchiato senza che l'app lo sapesse.
export function statoMercato(coda = null, { adesso = Date.now() } = {}) {
  const m = mercatoVivo(coda);
  const meseCorrente = new Date(adesso).toISOString().slice(0, 7);
  const mesiIndietro = mesiAssoluti(meseCorrente) - mesiAssoluti(m.a);
  const vecchio = mesiIndietro > MESI_TOLLERATI;
  return {
    ...m,
    mesiIndietro,
    vecchio,
    // La frase da mostrare. `null` quando e' tutto in ordine: nessun rumore.
    avviso: vecchio
      ? `I dati di mercato si fermano a ${m.a}, cioe' ${mesiIndietro} mesi fa: quello che dico sul passato resta valido, sul presente meno.`
      : null,
    testo: m.mesiCoda > 0
      ? `${m.mesiBase} mesi verificati fino a ${BASE_A}, piu' ${m.mesiCoda} aggiornati dal vivo fino a ${m.a}.`
      : `${m.mesiBase} mesi verificati, da ${BASE_DA} a ${BASE_A}.`,
  };
}
