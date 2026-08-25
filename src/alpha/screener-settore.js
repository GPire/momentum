// ============================================================
// SCREENER DI SETTORE — cosa il pannello SEC su scala rende possibile
// ============================================================
// panel-settoriale.js (Cantiere D, PIANO_TASK_2026-08-21.md) è dati GENERATI
// a tempo di sviluppo (bench/fetch-panel-sec.mjs) — 600 aziende pubblicate
// per intero, percentili di settore calcolate su 1.500. Questo file è la
// logica scritta a mano che li rende UTILI: "in che percentile del suo
// settore sta questo titolo" (BANCO_INVESTITORE/BANCO_BANKER, Cantiere F) e
// "chi somiglia a questa azienda sui conti" (BANCO_BANKER).
//
// ONESTÀ SUI LIMITI: il pannello ha SOLO grandezze contabili (ricavi, utile,
// patrimonio, attivo — quindi margine/ROE/ROA). Non ha prezzo di mercato, e
// quindi non ha P/E, P/B, FCF yield: `factors.js.valueScore()` chiede anche
// quelli, e qui restano assenti (percentileRank li tratta come "neutro",
// mai come zero — è il comportamento già scritto in factors.js, non
// aggirato). Chi vuole un valueScore completo deve ancora unire un prezzo
// da un'altra fonte (asset-overview.js).
'use strict';

import { AZIENDE_PANEL, percentileSettore } from './panel-settoriale.js';
import { beneishMScore, piotroskiFScore } from './quality-scores.js';
import { percentileRank } from './factors.js';

const gruppoSic = (sic) => (sic ? String(sic).padStart(4, '0').slice(0, 2) : null);

// Per i messaggi "di quale azienda?" in mercato-qa.js — quante aziende del
// pannello hanno davvero un ticker e un settore noto, senza dover esporre
// AZIENDE_PANEL per intero a chi chiama solo per contare.
export function numeroAziendeConSettore() {
  return AZIENDE_PANEL.filter((a) => a.ticker).length;
}

function aziendaPerTicker(ticker) {
  if (!ticker) return null;
  const t = String(ticker).toUpperCase();
  return AZIENDE_PANEL.find((a) => a.ticker === t) || null;
}

// Trova un'azienda del pannello dentro una domanda in linguaggio naturale
// (mercato-qa.js): cerca il TICKER come parola intera o il primo termine
// del nome ("Apple Inc." → "apple"). Stesso schema già usato per il pannello
// storico a 82 aziende (fondamentali-storici.js dentro mercato-qa.js) — qui
// sull'universo più ampio (600 aziende pubblicate per intero, Cantiere D).
// `null` onesto se nessuna azienda del pannello compare nel testo — mai un
// primo risultato a caso.
// Tutte le aziende del pannello nominate nel testo, nell'ordine in cui
// compaiono — serve a 'confronto-titoli' (mercato-qa.js), che ha bisogno di
// DUE aziende dalla stessa domanda ("Apple o Microsoft, quale ha reso di
// più?"), non di una sola. `trovaAziendaInTesto` (sotto) resta la versione
// a un solo risultato usata da tutti gli altri intenti — stessa logica di
// riconoscimento, non duplicata.
export function trovaAziendeInTesto(domanda, { limite = 2 } = {}) {
  const norm = (s) => String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  const qn = norm(domanda);
  const trovate = [];
  for (const a of AZIENDE_PANEL) {
    if (!a.ticker) continue;
    // BUG REALE trovato dal vivo (2026-08-24, non nei test — ce n'era uno
    // apposta e ha preso proprio questo): "un campanello d'allarme" veniva
    // letta come il ticker "D" (Dominion Energy) — l'apostrofo non è un
    // carattere di parola per \b, quindi "d'allarme" isola una "d" a
    // confine di parola come se fosse un ticker scritto da solo. Molti
    // ticker reali sono 1-2 lettere (D, F, T, C...) e coincidono con
    // preposizioni/articoli in ogni lingua romanza — qui SOTTO le 3 lettere
    // si rifiuta il match invece di rischiare di parlare dell'azienda
    // sbagliata senza che nessuno se ne accorga. Limite dichiarato: un
    // ticker a 1-2 lettere non si riconosce da solo nel testo, serve il
    // nome per esteso.
    const nomeBreve = norm(a.nome).split(/[ ,.]/)[0];
    const trovata = (a.ticker.length >= 3 && new RegExp(`\\b${norm(a.ticker)}\\b`).test(qn))
      // SECONDO bug reale trovato dal vivo, stesso giro: `qn.includes(nomeBreve)`
      // (senza confine di parola) faceva scattare "Quest Diagnostics" su
      // "QUESTi accrual sono..." — "quest" è un prefisso di "questi", non
      // l'azienda. Stesso errore già corretto altrove nel progetto
      // (titoloParlaDi, src/alpha/news.js: "Confine di PAROLA, non
      // sottostringa" — APPLYing conteneva "apple" allo stesso modo).
      || (nomeBreve.length >= 4 && new RegExp(`\\b${nomeBreve}\\b`).test(qn));
    if (trovata) {
      trovate.push(a);
      if (trovate.length >= limite) break;
    }
  }
  return trovate;
}

export function trovaAziendaInTesto(domanda) {
  return trovaAziendeInTesto(domanda, { limite: 1 })[0] || null;
}

// Le tre metriche in linguaggio semplice — segnalato esplicitamente
// dall'utente: "margine al 95° percentile" da solo non lo capiscono né un
// inesperto né un trader al volo. Ogni voce porta il NUMERO VERO (mai
// arrotondato a un giudizio) più una frase che lo rende leggibile a chi non
// sa cos'è un ROE, senza nasconderlo a chi lo sa già (resta scritto).
const SPIEGAZIONE_METRICA = {
  margine: 'margine di profitto (quanto resta di ogni euro di vendite, dopo i costi)',
  roe: 'ROE — return on equity (quanto rende il capitale messo dagli azionisti)',
  roa: 'ROA — return on assets (quanto rende ogni euro di beni che l\'azienda possiede)',
};

// Testo in linguaggio semplice per un risultato di percentileTitolo() —
// stesso principio di testoQualitaContabile/testoConfronto altrove nel
// progetto: un solo posto che genera il testo, riusato ovunque serva (chat
// E card Dashboard), mai due formattatori che rischiano di dire cose
// diverse sullo stesso dato.
export function testoPercentile(attuale) {
  if (!attuale?.disponibile) return attuale?.motivo || null;
  const voci = Object.entries(attuale.percentili).map(([chiave, percentile]) => {
    const spiegazione = SPIEGAZIONE_METRICA[chiave] || chiave;
    const valore = attuale.valori?.[chiave];
    const valoreTesto = Number.isFinite(valore) ? ` — oggi è ${(valore * 100).toFixed(1)}%` : '';
    return `${spiegazione}${valoreTesto}: meglio del ${percentile}% delle aziende del settore (${percentile}° percentile)`;
  });
  return voci.join('. ') + '.';
}

// Il percentile di UN titolo nel suo settore, sull'anno più recente
// disponibile (o quello richiesto). null onesto se il titolo non è fra le
// 600 pubblicate per intero, o se il gruppo-settore-anno non ha abbastanza
// aziende per un percentile (mai un numero inventato sotto soglia).
export function percentileTitolo(ticker, { anno = null } = {}) {
  const az = aziendaPerTicker(ticker);
  if (!az) return { disponibile: false, motivo: `"${ticker}" non è fra le aziende con settore noto in questo pannello.` };
  const riga = anno ? az.anni.find((a) => a.anno === anno) : az.anni.at(-1);
  if (!riga) return { disponibile: false, motivo: `nessun dato per ${ticker} nell'anno richiesto.` };

  const percentili = {};
  for (const misura of ['margine', 'roe', 'roa']) {
    if (riga[misura] === null) continue;
    const p = percentileSettore(az.sic, riga.anno, misura, riga[misura]);
    if (p !== null) percentili[misura] = p;
  }
  return {
    disponibile: Object.keys(percentili).length > 0,
    ticker: az.ticker, nome: az.nome, sic: az.sic, settore: az.sicDescription, anno: riga.anno,
    valori: { margine: riga.margine, roe: riga.roe, roa: riga.roa },
    percentili,
    qualita: qualitaBilancio(az, riga.anno),
    motivo: Object.keys(percentili).length === 0 ? `il settore di ${ticker} (${az.sicDescription}) non ha abbastanza aziende comparabili nel pannello per un percentile in ${riga.anno}.` : null,
  };
}

// Il percentile di margine/ROE/ROA per OGNI anno disponibile (fino a ~19
// anni reali su alcune aziende, media 16,9 sul pannello) — il grafico
// (Lightweight Charts, main.js) mostra il TREND, non solo lo scatto
// dell'anno più recente che dà percentileTitolo(). Formato {time, value}
// già pronto per una serie Lightweight Charts (time = 'YYYY-01-01', dato
// annuale). Un anno senza abbastanza aziende comparabili per quella misura
// viene saltato, mai un punto inventato per non lasciare un buco nel grafico.
export function serieStoricaPercentili(ticker) {
  const az = aziendaPerTicker(ticker);
  if (!az) return { disponibile: false, motivo: `"${ticker}" non è fra le aziende con settore noto in questo pannello.` };
  const serie = { margine: [], roe: [], roa: [] };
  for (const riga of az.anni) {
    for (const misura of ['margine', 'roe', 'roa']) {
      if (riga[misura] === null || riga[misura] === undefined) continue;
      const p = percentileSettore(az.sic, riga.anno, misura, riga[misura]);
      if (p !== null) serie[misura].push({ time: `${riga.anno}-01-01`, value: p });
    }
  }
  const haDati = serie.margine.length > 1 || serie.roe.length > 1 || serie.roa.length > 1; // un solo punto non è un "trend"
  return {
    disponibile: haDati, ticker: az.ticker, nome: az.nome, settore: az.sicDescription, serie,
    motivo: haDati ? null : `non ci sono abbastanza anni con percentile calcolabile per ${ticker} da mostrare un andamento.`,
  };
}

const NOME_BREVE_METRICA = { margine: 'margine', roe: 'ROE', roa: 'ROA' };

// Testo dei "momenti di picco" (richiesto esplicitamente) — separato dal
// grafico apposta: un'etichetta per metrica sopra un grafico alto 160px
// diventava un pasticcio illeggibile quando i picchi cadono in anni vicini
// (caso reale, NVIDIA — trovato verificando dal vivo). Qui lo spazio non è
// un problema: dice ESATTAMENTE quando è stato il momento migliore di
// sempre per ciascuna metrica, e se coincide con oggi lo dichiara.
export function testoPicchi(r) {
  if (!r?.disponibile) return null;
  const righe = [];
  for (const [chiave, punti] of Object.entries(r.serie)) {
    if (punti.length < 2) continue;
    const picco = punti.reduce((m, p) => (p.value > m.value ? p : m), punti[0]);
    const ultimo = punti[punti.length - 1];
    const oraStesso = picco.time === ultimo.time;
    righe.push(`${NOME_BREVE_METRICA[chiave] || chiave}: il migliore di sempre fu il ${picco.time.slice(0, 4)} (${picco.value.toFixed(0)}° percentile)${oraStesso ? ' — è ORA, il valore di oggi è il record storico' : ''}.`);
  }
  return righe.length ? righe.join(' ') : null;
}

// Punto d'ingresso diretto per ticker (mercato-qa.js, intento
// 'qualita-contabile'): stessi due punteggi già dentro percentileTitolo(),
// ma qui isolati — chi chiede "il punteggio di manipolazione contabile"
// vuole SOLO questo, non anche i percentili di margine/ROE che c'entrano
// con un'altra domanda.
export function qualitaContabile(ticker, { anno = null } = {}) {
  const az = aziendaPerTicker(ticker);
  if (!az) return { disponibile: false, motivo: `"${ticker}" non è fra le aziende con settore noto in questo pannello.` };
  const riga = anno ? az.anni.find((a) => a.anno === anno) : az.anni.at(-1);
  if (!riga) return { disponibile: false, motivo: `nessun dato per ${ticker} nell'anno richiesto.` };
  const q = qualitaBilancio(az, riga.anno);
  return { ticker: az.ticker, nome: az.nome, settore: az.sicDescription, anno: riga.anno, ...q };
}

// ── Beneish M-Score + Piotroski F-Score (Cantiere E3, src/alpha/quality-
// scores.js) — richiedono l'anno richiesto E quello precedente nello STESSO
// pannello (`az.anni` è già ordinato per anno da bench/fetch-panel-sec.mjs).
// `null` onesto se manca l'anno precedente o i campi extra (un'azienda può
// essere nel pannello base senza tutti gli 8 concetti di qualità — vedi
// bench/fetch-panel-sec.mjs) — mai un punteggio a metà.
function qualitaBilancio(az, anno) {
  const idx = az.anni.findIndex((a) => a.anno === anno);
  if (idx < 1) return { disponibile: false, motivo: 'serve anche l\'anno precedente nello stesso pannello, non disponibile per questo titolo.' };
  const t = az.anni[idx], t1 = az.anni[idx - 1];
  if (t1.anno !== t.anno - 1) return { disponibile: false, motivo: `${t.anno} e ${t1.anno} non sono anni consecutivi nel pannello: un salto rende il confronto anno-su-anno non valido.` };
  const beneish = beneishMScore(t, t1, { sic: az.sic });
  const piotroski = piotroskiFScore(t, t1, { sic: az.sic });
  return { disponibile: beneish.valido || piotroski.valido, beneish, piotroski };
}

// Le aziende del pannello nello STESSO gruppo di settore (2 cifre del SIC),
// ordinate per vicinanza di ricavi (stessa taglia, prima ancora che stesso
// business — due aziende nello stesso settore ma di taglia molto diversa
// non sono comparabili quanto sembrano). Esclude il titolo stesso.
export function comparabili(ticker, { anno = null, limite = 8 } = {}) {
  const az = aziendaPerTicker(ticker);
  if (!az) return { disponibile: false, motivo: `"${ticker}" non è fra le aziende con settore noto in questo pannello.` };
  const gruppo = gruppoSic(az.sic);
  const rigaTicker = anno ? az.anni.find((a) => a.anno === anno) : az.anni.at(-1);
  const ricaviTicker = rigaTicker?.ricavi ?? 0;

  const candidati = AZIENDE_PANEL
    .filter((a) => a.ticker !== az.ticker && gruppoSic(a.sic) === gruppo)
    .map((a) => {
      const riga = anno ? a.anni.find((x) => x.anno === anno) : a.anni.at(-1);
      return riga ? { ticker: a.ticker, nome: a.nome, settore: a.sicDescription, anno: riga.anno, ricavi: riga.ricavi, margine: riga.margine, roe: riga.roe } : null;
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(Math.log((a.ricavi || 1) / (ricaviTicker || 1))) - Math.abs(Math.log((b.ricavi || 1) / (ricaviTicker || 1))))
    .slice(0, limite);

  return { disponibile: candidati.length > 0, ticker: az.ticker, settore: az.sicDescription, comparabili: candidati };
}

// Popola `peers` per factors.js.valueScore()/growthScore(): un array di
// valori REALI di aziende dello stesso settore-anno, non un intervallo
// inventato. Le chiavi che il pannello non può dare (pe, pb, fcfYield: qui
// non c'è prezzo di mercato) restano assenti — percentileRank le tratta già
// come "neutro" (0.5), mai come "cattivo" (0), quindi non falsano il punteggio.
export function peersDaPannello(sic, anno) {
  const gruppo = gruppoSic(sic);
  if (!gruppo) return {};
  const roe = [], margine = [];
  for (const a of AZIENDE_PANEL) {
    if (gruppoSic(a.sic) !== gruppo) continue;
    const riga = a.anni.find((x) => x.anno === anno);
    if (!riga) continue;
    if (riga.roe !== null) roe.push(riga.roe);
    if (riga.margine !== null) margine.push(riga.margine);
  }
  return { roe, margine };
}

// ============================================================
// SCREENER MULTI-CRITERIO (BANCO_BANKER: "filtrami le aziende del settore
// per margine e crescita insieme") — Cantiere G/D
// ============================================================
// "Insieme" è la parola che conta: un filtro che ordina PRIMA per margine e
// POI per crescita premia chi è al vertice del primo criterio anche se
// pessimo sul secondo. Qui si combina un PERCENTILE per ciascun criterio
// (dentro lo STESSO gruppo di settore — confrontare una tech con una
// petrolifera sarebbe il difetto già dichiarato per valueScore) e si media:
// un'azienda forte su entrambi batte una fortissima su uno solo. Riusa
// `percentileRank` di factors.js — stessa matematica del resto del
// progetto, non una copia.

// Crescita dei ricavi anno-su-anno (non salvata nel pannello: si calcola
// dalle due righe consecutive, stesso principio di Beneish SGI). `null`
// onesto se manca l'anno precedente o è un salto non consecutivo.
export function crescitaRicavi(az, anno) {
  const idx = az?.anni?.findIndex((a) => a.anno === anno) ?? -1;
  if (idx < 1) return null;
  const t = az.anni[idx], t1 = az.anni[idx - 1];
  if (t1.anno !== t.anno - 1 || !Number.isFinite(t.ricavi) || !Number.isFinite(t1.ricavi) || t1.ricavi === 0) return null;
  return +(t.ricavi / t1.ricavi - 1).toFixed(4);
}

const VALORE_CRITERIO = {
  margine: (riga) => riga.margine,
  roe: (riga) => riga.roe,
  roa: (riga) => riga.roa,
  crescita: (riga, az) => crescitaRicavi(az, riga.anno),
};

// Nomi in italiano semplice → chiave interna. Esportata: mercato-qa.js la
// usa per capire QUALI criteri chiede la domanda, senza duplicare qui la
// lista di parole (un solo posto dove "crescita" vuol dire "crescita").
export const NOMI_CRITERI_SCREENER = {
  margine: ['margine', 'margini', 'redditivita delle vendite'],
  roe: ['roe', 'ritorno sul capitale', 'rendimento sul capitale'],
  roa: ['roa', 'ritorno sull attivo', 'rendimento sull attivo'],
  crescita: ['crescita', 'crescono', 'in crescita', 'crescita dei ricavi'],
};

export function filtraSettore(sic, { criteri = ['margine', 'roe'], anno = null, limite = 8 } = {}) {
  const gruppo = gruppoSic(sic);
  if (!gruppo) return { disponibile: false, motivo: 'nessun settore riconosciuto per questo filtro.' };
  const criteriValidi = [...new Set(criteri)].filter((c) => VALORE_CRITERIO[c]);
  if (!criteriValidi.length) return { disponibile: false, motivo: `nessuno dei criteri richiesti (${criteri.join(', ')}) è calcolabile in questo pannello.` };

  const righe = [];
  for (const a of AZIENDE_PANEL) {
    if (gruppoSic(a.sic) !== gruppo) continue;
    const riga = anno ? a.anni.find((x) => x.anno === anno) : a.anni.at(-1);
    if (!riga) continue;
    const valori = {};
    for (const c of criteriValidi) {
      const v = VALORE_CRITERIO[c](riga, a);
      if (Number.isFinite(v)) valori[c] = v;
    }
    righe.push({ ticker: a.ticker, nome: a.nome, anno: riga.anno, valori });
  }
  // Sotto questa soglia un percentile di gruppo è rumore, stessa regola già
  // usata da bench/fetch-panel-sec.mjs (MIN_BUCKET=8) — qui un po' più
  // permissiva perché il filtro incrocia più criteri insieme, non uno.
  if (righe.length < 4) return { disponibile: false, motivo: `troppo poche aziende comparabili in questo settore (${righe.length}) per un filtro onesto.` };

  const distribuzioni = {};
  for (const c of criteriValidi) distribuzioni[c] = righe.map((r) => r.valori[c]).filter(Number.isFinite);

  const classificate = righe
    .map((r) => {
      const rank = criteriValidi.map((c) => (Number.isFinite(r.valori[c]) ? percentileRank(r.valori[c], distribuzioni[c], true) : null)).filter((x) => x !== null);
      // Un'azienda senza NESSUNO dei criteri richiesti non entra in classifica
      // (non ha senso confrontarla), ma non serve che li abbia tutti: chi ne
      // ha uno solo viene comunque valutato su quello, mai su un dato assente.
      return { ...r, criteriDisponibili: rank.length, punteggioCombinato: rank.length ? +(rank.reduce((s, x) => s + x, 0) / rank.length).toFixed(3) : null };
    })
    .filter((r) => r.punteggioCombinato !== null)
    .sort((a, b) => b.punteggioCombinato - a.punteggioCombinato)
    .slice(0, limite);

  return {
    disponibile: classificate.length > 0,
    settore: AZIENDE_PANEL.find((a) => gruppoSic(a.sic) === gruppo)?.sicDescription || null,
    criteri: criteriValidi, aziendeNelGruppo: righe.length,
    classificate,
  };
}
