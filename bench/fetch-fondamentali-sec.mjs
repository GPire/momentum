// Scarica DIECI ANNI di bilanci REALI dalla SEC e genera
// src/alpha/fondamentali-storici.js — "npm run bench:sec".
//
// ── PERCHE' QUESTO CAMBIA IL FRONTE INVESTIMENTI ──
// `fondamentali.js` legge i numeri di OGGI da Alpha Vantage e dichiara da
// sempre il proprio limite piu' serio: "sono i numeri degli ultimi dodici
// mesi, una foto. Buffett chiede dieci anni di conti buoni, e la storia dei
// bilanci qui non c'e'." Quel limite era vero, e non era colmabile: le fonti
// commerciali danno la storia solo a pagamento, e l'app non ha chiavi.
//
// LA SEC LA DA' GRATIS, e non e' un aggregatore: e' la fonte PRIMARIA, i
// documenti che le aziende quotate negli Stati Uniti sono obbligate per legge
// a depositare. Nessuna chiave, nessuna registrazione. Verificato dal vivo su
// Apple: patrimonio netto dal 2009 al 2025, 68 valori annuali da moduli 10-K.
//
// ── E PERCHE' NON SI PUO' FARE DAL BROWSER ──
// `data.sec.gov` non autorizza le chiamate da una pagina web (CORS), come
// Yahoo e come tutte le fonti azionarie provate. Da Node il muro non esiste.
// Quindi si scarica QUI, a tempo di sviluppo, e il risultato viaggia dentro
// l'app: offline, senza chiavi, senza server — la stessa strada gia' usata
// per i quarant'anni di prezzi giornalieri.
//
// ── ONESTA' SU COSA E' E COSA NON E' ──
// E' una FOTOGRAFIA: i bilanci fino alla data di scaricamento, dichiarata nel
// file. Non e' un flusso in tempo reale, e il progetto ha gia' `freschezza.js`
// per dire quanto e' vecchio un dato invece di far finta che sia di oggi.
// E copre solo le aziende quotate negli USA: la SEC e' l'autorita' americana,
// e per un'azienda europea qui non c'e' niente. Va detto, non aggirato.
//
// La SEC chiede un User-Agent che identifichi chi chiama e un massimo di 10
// richieste al secondo: entrambe rispettate. Sono le loro regole, e usarle
// gratis significa rispettarle.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// LA SEC PRETENDE UN CONTATTO IN FORMA DI EMAIL, e non e' una formalita':
// verificato dal vivo, lo stesso identificativo senza una email restituisce
// 403 su companyfacts. E' la loro regola per un servizio gratuito, e va
// rispettata invece di aggirata.
// Chi rigenera questo file dovrebbe metterci un proprio recapito reale: se la
// SEC deve segnalare un uso anomalo, deve poter scrivere a qualcuno.
const UA = process.env.SEC_CONTATTO || 'Momentum on-device finance research momentum-research@proton.me';
const PAUSA = 350; // sotto le 10 richieste al secondo chieste dalla SEC

// Le aziende: grandi, di settori diversi, e con almeno dieci anni di storia.
// Berkshire c'e' perche' e' l'azienda di Buffett, e JP Morgan perche'
// l'utente ha chiesto esplicitamente cosa guarda una banca d'affari.
const AZIENDE = [
  { t: 'AAPL', cik: '0000320193', nome: 'Apple' },
  { t: 'MSFT', cik: '0000789019', nome: 'Microsoft' },
  { t: 'GOOGL', cik: '0001652044', nome: 'Alphabet' },
  { t: 'AMZN', cik: '0001018724', nome: 'Amazon' },
  { t: 'NVDA', cik: '0001045810', nome: 'NVIDIA' },
  { t: 'TSLA', cik: '0001318605', nome: 'Tesla' },
  { t: 'META', cik: '0001326801', nome: 'Meta' },
  { t: 'JPM', cik: '0000019617', nome: 'JPMorgan Chase' },
  { t: 'BRK-B', cik: '0001067983', nome: 'Berkshire Hathaway' },
  { t: 'KO', cik: '0000021344', nome: 'Coca-Cola' },
  { t: 'JNJ', cik: '0000200406', nome: 'Johnson & Johnson' },
  { t: 'V', cik: '0001403161', nome: 'Visa' },
  { t: 'WMT', cik: '0000104169', nome: 'Walmart' },
  { t: 'PG', cik: '0000080424', nome: 'Procter & Gamble' },
];

// I concetti contabili, con i nomi alternativi. Le aziende non usano tutte la
// stessa etichetta XBRL per la stessa cosa — chi legge solo il primo nome
// trova buchi che sembrano dati mancanti e sono solo nomi diversi.
const CONCETTI = {
  patrimonioNetto: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  utileNetto: ['NetIncomeLoss', 'ProfitLoss'],
  ricavi: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax'],
  attivo: ['Assets'],
  debitoLungo: ['LongTermDebtNoncurrent', 'LongTermDebt'],
};

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

async function fatti(cik) {
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`SEC: HTTP ${res.status}`);
  return res.json();
}

// ── DUE NATURE DI DATO, e confonderle produce numeri quattro volte sbagliati ──
// BUG TROVATO VERIFICANDO I NUMERI contro la realta': la prima versione dava
// "Apple 2025: ricavi 383B" — ma 383B e' l'esercizio 2023, e in altri casi
// prendeva addirittura un TRIMESTRE al posto dell'anno. Due errori sovrapposti:
//
// 1. IL CAMPO `fy` E' L'ANNO DEL DEPOSITO, non del periodo. Un bilancio del
//    2025 ripubblica i confronti del 2023 e quelle righe restano fy=2025.
//    L'anno vero e' quello di `end`.
// 2. DENTRO LO STESSO 10-K CI SONO SIA I TRIMESTRI SIA L'ANNO. Per Apple 2018
//    convivono 88B, 61B, 53B, 63B (i trimestri) e 266B (l'anno). Prendendo
//    "l'ultima riga" si finiva su un trimestre: un numero perfettamente
//    plausibile e quattro volte sbagliato.
//
// La distinzione giusta e' contabile, non tecnica:
//  · i FLUSSI (ricavi, utile) si accumulano in un periodo, e hanno `start` —
//    si tiene solo chi copre circa dodici mesi;
//  · gli STOCK (patrimonio, attivo, debito) sono fotografie a una data, non
//    hanno `start` — si tiene l'ultima dell'esercizio.
const FLUSSI = new Set(['utileNetto', 'ricavi']);

// TERZO BUG DELLA STESSA FAMIGLIA, e la soluzione era un'altra. Prima si
// teneva il PRIMO nome contabile con almeno tre anni, poi il piu' COMPLETO:
// entrambe sbagliate, perche' presuppongono che un nome solo copra tutta la
// storia. Non e' cosi'. Apple chiama i ricavi `Revenues` fino al 2017 e
// `RevenueFromContractWithCustomerExcludingAssessedTax` dopo — nessuno dei due
// copre vent'anni, e sceglierne uno lascia meta' storia a zero (con il margine
// a zero di conseguenza).
// I nomi vanno UNITI: si prendono gli anni da tutti, e dove due nomi coprono
// lo stesso esercizio vince quello depositato piu' di recente. Un cambio di
// etichetta contabile non e' un buco nei dati, e trattarlo come tale
// cancellava mezza azienda.
function perAnno(fatti, nomi, { flusso }) {
  const us = fatti?.facts?.['us-gaap'] || {};
  const perAnnoMap = new Map();
  const usati = [];

  for (const nome of nomi) {
    const unita = us[nome]?.units?.USD;
    if (!Array.isArray(unita) || !unita.length) continue;

    const buone = unita.filter((x) => {
      if (x.form !== '10-K' || !Number.isFinite(x.val) || !x.end) return false;
      if (flusso) {
        if (!x.start) return false;
        const giorni = (new Date(x.end) - new Date(x.start)) / 86400000;
        return giorni >= 340 && giorni <= 400; // un esercizio, non un trimestre
      }
      return !x.start; // uno stock non ha un periodo di accumulo
    });
    if (!buone.length) continue;
    usati.push(nome);

    for (const x of buone) {
      const anno = +String(x.end).slice(0, 4);
      const prec = perAnnoMap.get(anno);
      if (!prec || (x.filed || '') > (prec.filed || '')) perAnnoMap.set(anno, x);
    }
  }

  if (perAnnoMap.size < 3) return null;
  const anni = [...perAnnoMap.entries()].sort((a, b) => a[0] - b[0]).map(([anno, x]) => ({ anno, valore: x.val }));
  return { concetti: usati, anni };
}

(async () => {
  const out = {};
  for (const a of AZIENDE) {
    try {
      const f = await fatti(a.cik);
      const voci = {};
      for (const [chiave, nomi] of Object.entries(CONCETTI)) {
        const v = perAnno(f, nomi, { flusso: FLUSSI.has(chiave) });
        if (v) voci[chiave] = v;
      }
      const anni = voci.patrimonioNetto?.anni?.length || 0;
      out[a.t] = { nome: a.nome, cik: a.cik, voci };
      console.log(`${a.t.padEnd(6)} ${a.nome.padEnd(20)} ${anni} esercizi  [${Object.keys(voci).join(', ')}]`);
    } catch (e) {
      console.log(`${a.t.padEnd(6)} FALLITO: ${e.message}`);
    }
    await attendi(PAUSA);
  }

  // ── I RAPPORTI, calcolati QUI e non a runtime ──
  // ROE, margine e ROA per ogni esercizio: sono divisioni, ma farle a monte
  // significa che l'app riceve numeri gia' verificabili invece di doverli
  // ricostruire — e soprattutto che un anno con un denominatore mancante
  // resta ASSENTE invece di diventare uno zero.
  const serie = {};
  for (const [t, d] of Object.entries(out)) {
    const idx = (chiave) => new Map((d.voci[chiave]?.anni || []).map((x) => [x.anno, x.valore]));
    const pn = idx('patrimonioNetto'), un = idx('utileNetto'), rv = idx('ricavi'), at = idx('attivo');
    const anni = [...pn.keys()].filter((y) => un.has(y)).sort((a, b) => a - b);
    serie[t] = {
      nome: d.nome,
      anni: anni.map((y) => ({
        anno: y,
        roe: pn.get(y) > 0 ? +(un.get(y) / pn.get(y)).toFixed(4) : null,
        margine: rv.get(y) > 0 ? +(un.get(y) / rv.get(y)).toFixed(4) : null,
        roa: at.get(y) > 0 ? +(un.get(y) / at.get(y)).toFixed(4) : null,
        utileNetto: un.get(y),
        ricavi: rv.get(y) ?? null,
        patrimonioNetto: pn.get(y),
      })),
    };
  }

  const contenuto = `// GENERATO da bench/fetch-fondamentali-sec.mjs — non modificare a mano.
// Bilanci REALI depositati alla SEC (moduli 10-K), fonte PRIMARIA e non un
// aggregatore. Nessuna chiave, nessuna registrazione.
//
// PERCHE' ESISTE: fondamentali.js dichiarava da sempre il proprio limite piu'
// serio — "sono i numeri degli ultimi dodici mesi; Buffett chiede dieci anni
// di conti buoni, e la storia dei bilanci qui non c'e'". Adesso c'e'.
//
// ONESTA': e' una FOTOGRAFIA aggiornata al giorno dello scaricamento, non un
// flusso in tempo reale. E copre solo le aziende quotate negli Stati Uniti:
// la SEC e' l'autorita' americana, e per un'azienda europea qui non c'e'
// niente. Va detto, non aggirato.
'use strict';

export const SEC_SCARICATO_IL = '${new Date().toISOString().slice(0, 10)}';
export const SEC_FONTE = 'SEC EDGAR — companyfacts XBRL, moduli 10-K';

export const FONDAMENTALI_STORICI = ${JSON.stringify(serie, null, 1)};

export const TICKER_DISPONIBILI = Object.keys(FONDAMENTALI_STORICI);

// Gli anni davvero coperti per un'azienda: serve a non promettere "dieci anni"
// quando ce ne sono quattro.
export function anniCoperti(ticker) {
  const a = FONDAMENTALI_STORICI[ticker]?.anni || [];
  return a.length ? { da: a[0].anno, a: a[a.length - 1].anno, quanti: a.length } : null;
}
`;

  const dest = join(root, 'src/alpha/fondamentali-storici.js');
  writeFileSync(dest, contenuto);
  console.log(`\\nScritto ${dest} (${Math.round(Buffer.byteLength(contenuto) / 1024)} KB, ${Object.keys(serie).length} aziende)`);
})();
