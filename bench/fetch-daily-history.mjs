// Scarica QUARANT'ANNI di prezzi GIORNALIERI reali da Yahoo Finance e genera
// src/alpha/daily-long.js — "npm run bench:daily-long".
//
// PERCHE' SERVE, e non e' un capriccio di completezza. Tre misure indipendenti
// costruite in questo progetto (previsione condizionata, guardiano causale,
// rapporto di assorbimento) sono arrivate tutte alla stessa conclusione: il
// collo di bottiglia non sono gli algoritmi, e' la LUNGHEZZA dei dati. Con
// 1253 giorni (5 anni) le osservazioni davvero indipendenti a 63 giorni sono
// CINQUE, e con cinque prove non si dimostra niente per quanto grande sia
// l'effetto. Con 10.500 giorni diventano oltre 160.
//
// E c'e' una ragione ancora piu' importante della statistica: cinque anni non
// contengono il 2008. Un archivio che non ha mai visto una crisi profonda non
// puo' dire se cio' che vede oggi sia normale o raro — e' cieco proprio sul
// caso che conta.
//
// COME, e i limiti che ne derivano. `range=max` fa aggregare Yahoo a MENSILE
// (verificato: 168 punti invece di 10.488), quindi si usa period1/period2
// espliciti con interval=1d. Ogni serie parte quando ESISTE davvero: l'indice
// S&P dal 1985, il VIX dal 1990, i metalli dal 2000, Bitcoin dal 2014. Non si
// riempie nulla all'indietro — un dato inventato prima della nascita di uno
// strumento sarebbe la peggior forma di sguardo al futuro.
//
// Gira in Node a tempo di sviluppo, MAI a runtime: l'app resta on-device.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DA = '1985-01-01';

// Chiave interna -> { simbolo Yahoo, nome leggibile }. Scelte per coprire
// direzioni DIVERSE (azioni, tassi, valuta, metalli, energia, cripto): serie
// che si muovono insieme aggiungono peso e non informazione, ed e' proprio
// cio' che il numero efficace di fonti misura.
const SERIE = {
  azioniUsa: { simbolo: '^GSPC', nome: 'Azioni USA (S&P 500)' },
  tecnologia: { simbolo: '^IXIC', nome: 'Tecnologia (Nasdaq)' },
  piccoleAziende: { simbolo: '^RUT', nome: 'Piccole aziende USA (Russell 2000)' },
  tasso10a: { simbolo: '^TNX', nome: 'Rendimento decennale USA' },
  dollaro: { simbolo: 'DX-Y.NYB', nome: 'Dollaro (indice)' },
  paura: { simbolo: '^VIX', nome: 'Indice della paura (VIX)' },
  oro: { simbolo: 'GC=F', nome: 'Oro' },
  argento: { simbolo: 'SI=F', nome: 'Argento' },
  rame: { simbolo: 'HG=F', nome: 'Rame' },
  petrolio: { simbolo: 'CL=F', nome: 'Petrolio' },
  bitcoin: { simbolo: 'BTC-USD', nome: 'Bitcoin' },
};

async function scarica(simbolo) {
  const p1 = Math.floor(new Date(DA).getTime() / 1000);
  const p2 = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?period1=${p1}&period2=${p2}&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} per ${simbolo}`);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error(`nessun risultato per ${simbolo}`);
  const ts = r.timestamp || [];
  const close = r.indicators?.quote?.[0]?.close || [];
  const punti = [];
  for (let i = 0; i < ts.length; i++) {
    const c = close[i];
    if (!Number.isFinite(c) || c <= 0) continue; // buchi reali: si saltano, non si inventano
    punti.push({ data: new Date(ts[i] * 1000).toISOString().slice(0, 10), chiusura: c });
  }
  return punti;
}

// I rendimenti si calcolano fra giorni CONSECUTIVI DISPONIBILI. Se in mezzo
// mancano giorni (festivi, buchi della fonte) il rendimento copre piu' giorni:
// va bene, ma il salto va dichiarato quando e' grande, non nascosto.
function rendimenti(punti) {
  const out = [];
  let saltiLunghi = 0;
  for (let i = 1; i < punti.length; i++) {
    const giorni = (new Date(punti[i].data) - new Date(punti[i - 1].data)) / 86400000;
    if (giorni > 10) saltiLunghi++;
    out.push({ data: punti[i].data, r: punti[i].chiusura / punti[i - 1].chiusura - 1 });
  }
  return { out, saltiLunghi };
}

// CODIFICA COMPATTA. Quarant'anni per undici serie sono oltre 100.000 numeri:
// come JSON grezzo sarebbero megabyte, e un pannello che pesa megabyte non si
// carica su un telefono. Si memorizzano i rendimenti come INTERI (x 1e6,
// cioe' millesimi di punto base) separati da virgola: perdita di precisione
// trascurabile su rendimenti, dimensione ridotta di circa cinque volte.
function codifica(valori) {
  return valori.map((v) => Math.round(v * 1e6)).join(',');
}

(async () => {
  const dati = {};
  const meta = {};
  for (const [chiave, { simbolo, nome }] of Object.entries(SERIE)) {
    try {
      const punti = await scarica(simbolo);
      const { out, saltiLunghi } = rendimenti(punti);
      dati[chiave] = out;
      meta[chiave] = {
        simbolo, nome, osservazioni: out.length,
        da: out[0]?.data || null, a: out[out.length - 1]?.data || null, saltiLunghi,
      };
      console.log(`${chiave.padEnd(16)} ${String(out.length).padStart(6)} giorni  ${meta[chiave].da} -> ${meta[chiave].a}${saltiLunghi ? `  (${saltiLunghi} salti > 10 giorni)` : ''}`);
    } catch (e) {
      console.log(`${chiave.padEnd(16)} FALLITO: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  // ── L'ALLINEAMENTO SUL CALENDARIO COMUNE ──
  // Le serie hanno giorni di contrattazione diversi (Bitcoin scambia nel fine
  // settimana, i futures hanno festivi propri). Si costruisce il calendario
  // delle date presenti nella serie di riferimento (le azioni USA) e ogni
  // altra serie viene letta su QUELLE date: dove manca, resta un buco
  // dichiarato. Allineare per posizione invece che per data confronterebbe
  // giorni diversi, ed e' l'errore che non si vede guardando il risultato.
  const calendario = (dati.azioniUsa || []).map((x) => x.data);
  const perData = {};
  for (const [chiave, punti] of Object.entries(dati)) {
    perData[chiave] = new Map(punti.map((p) => [p.data, p.r]));
  }

  const allineate = {};
  for (const chiave of Object.keys(dati)) {
    const m = perData[chiave];
    allineate[chiave] = calendario.map((d) => (m.has(d) ? m.get(d) : null));
  }

  const righe = Object.entries(allineate).map(([chiave, v]) => {
    const primi = v.findIndex((x) => x !== null);
    const validi = v.filter((x) => x !== null).length;
    // Prima dell'inizio reale restano `null`: chi legge deve poter distinguere
    // "non esisteva" da "quel giorno non ha scambiato".
    return `  ${chiave}: { primoIndice: ${primi}, validi: ${validi}, dati: '${codifica(v.map((x) => (x === null ? 0 : x)))}', mancanti: '${v.map((x) => (x === null ? 1 : 0)).join('')}' },`;
  });

  const contenuto = `// GENERATO da bench/fetch-daily-history.mjs — non modificare a mano.
// Quarant'anni di prezzi GIORNALIERI reali (Yahoo Finance), allineati sul
// calendario delle azioni USA. I rendimenti sono interi x 1e6 per compattezza.
//
// PERCHE' ESISTE: con 1253 giorni (5 anni) le osservazioni indipendenti a 63
// giorni erano CINQUE, e cinque anni non contengono il 2008. Qui sono
// ${calendario.length} giorni e la crisi c'e'.
//
// ONESTA' SULLE DATE DI INIZIO: ogni serie parte quando esiste davvero, e
// prima di quel giorno il valore e' MANCANTE, non zero. Riempire all'indietro
// sarebbe la peggior forma di sguardo al futuro.
'use strict';

export const GIORNI_LUNGO_DA = '${calendario[0]}';
export const GIORNI_LUNGO_A = '${calendario[calendario.length - 1]}';
export const N_GIORNI_LUNGO = ${calendario.length};
export const FONTE_LUNGO = 'Yahoo Finance (period1/period2, interval=1d)';
export const SCARICATO_IL = '${new Date().toISOString().slice(0, 10)}';

export const META_LUNGO = ${JSON.stringify(meta, null, 2)};

export const DATE_LUNGO = '${calendario.join(',')}'.split(',');

const GREZZI = {
${righe.join('\n')}
};

// Decodifica: interi x 1e6 -> rendimenti, con i mancanti come null.
function decodifica(v) {
  const numeri = v.dati.split(',');
  const mancanti = v.mancanti;
  const out = new Array(numeri.length);
  for (let i = 0; i < numeri.length; i++) {
    out[i] = mancanti[i] === '1' ? null : +numeri[i] / 1e6;
  }
  return out;
}

export const GIORNALIERO_LUNGO = Object.fromEntries(
  Object.entries(GREZZI).map(([k, v]) => [k, decodifica(v)]),
);

export const NOMI_LUNGO_GIORNI = Object.fromEntries(
  Object.entries(META_LUNGO).map(([k, m]) => [k, m.nome]),
);

// Le serie che coprono TUTTO il periodo richiesto, con i buchi entro una
// soglia. Serve a chi deve fare analisi multivariate: mescolare una serie che
// inizia nel 2014 con una che inizia nel 1985 su una finestra del 1990
// significa lavorare su una sola serie credendo di averne due.
export function serieComplete(daIndice = 0, quoteMinima = 0.98) {
  const out = {};
  for (const [k, v] of Object.entries(GIORNALIERO_LUNGO)) {
    const pezzo = v.slice(daIndice);
    const validi = pezzo.filter((x) => x !== null).length;
    if (validi / pezzo.length >= quoteMinima) out[k] = pezzo;
  }
  return out;
}
`;

  const dest = join(root, 'src/alpha/daily-long.js');
  writeFileSync(dest, contenuto);
  const kb = Math.round(Buffer.byteLength(contenuto) / 1024);
  console.log(`\nScritto ${dest} (${kb} KB, ${calendario.length} giorni, ${Object.keys(allineate).length} serie)`);
})();
