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

// ── LE AZIENDE, e i codici NON si scrivono a mano ──
// La prima versione aveva i CIK copiati dentro il file: quattordici numeri di
// dieci cifre, ognuno un'occasione di sbagliare in silenzio — un codice errato
// non da' errore, da' i bilanci di un'ALTRA azienda. E non scala: per ottanta
// aziende sarebbero ottanta numeri da verificare a mano.
// La SEC pubblica l'elenco completo (10.387 societa'): si risolve il ticker al
// volo, e se un ticker non esiste lo si dice invece di scaricare il vuoto.
//
// La scelta delle aziende: grandi, di SETTORI DIVERSI e con storia lunga.
// Il settore conta piu' della dimensione — serve a poter dire se un ROE alto
// sia raro o normale dove quell'azienda opera, e una lista di sole societa'
// tecnologiche renderebbe "normale" il 30% e "scarso" il 15% di una banca.
// Berkshire c'e' perche' e' l'azienda di Buffett; JPMorgan, Goldman e Morgan
// Stanley perche' l'utente ha chiesto cosa guarda una banca d'affari.
const TICKER = [
  // Tecnologia
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'AVGO', 'ORCL', 'CRM', 'ADBE',
  'CSCO', 'INTC', 'AMD', 'QCOM', 'TXN', 'IBM', 'NOW', 'INTU', 'AMAT', 'MU',
  // Banche e finanza
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'SCHW', 'BLK', 'SPGI', 'AXP',
  'V', 'MA', 'PYPL', 'BRK-B',
  // Salute
  'JNJ', 'UNH', 'LLY', 'PFE', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'AMGN',
  // Consumo
  'KO', 'PEP', 'PG', 'WMT', 'COST', 'MCD', 'NKE', 'SBUX', 'HD', 'TGT',
  'CL', 'KMB', 'MDLZ', 'MO',
  // Industria ed energia
  'XOM', 'CVX', 'COP', 'CAT', 'BA', 'HON', 'GE', 'LMT', 'RTX', 'UPS',
  'UNP', 'DE', 'MMM', 'EMR',
  // Auto, telecomunicazioni, servizi
  'TSLA', 'F', 'GM', 'T', 'VZ', 'TMUS', 'DIS', 'NFLX', 'CMCSA', 'NEE',
];

async function elencoCik() {
  const res = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`elenco SEC: HTTP ${res.status}`);
  const j = await res.json();
  const perTicker = new Map();
  for (const v of Object.values(j)) {
    if (v?.ticker) perTicker.set(v.ticker.toUpperCase(), { cik: String(v.cik_str).padStart(10, '0'), nome: v.title });
  }
  return perTicker;
}

// I concetti contabili, con i nomi alternativi. Le aziende non usano tutte la
// stessa etichetta XBRL per la stessa cosa — chi legge solo il primo nome
// trova buchi che sembrano dati mancanti e sono solo nomi diversi.
const CONCETTI = {
  patrimonioNetto: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  utileNetto: ['NetIncomeLoss', 'ProfitLoss'],
  ricavi: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax'],
  attivo: ['Assets'],
  debitoLungo: ['LongTermDebtNoncurrent', 'LongTermDebt'],
  // ── Aggiunti per earnings-quality.js (Beneish M-Score + Piotroski F-Score) ──
  // Le banche/finanziarie NON hanno un bilancio "classificato" (corrente/non
  // corrente) ne' un costo del venduto: verificato dal vivo su JPMorgan, tutti
  // e tre assenti. Non e' un buco nei dati — e' che il modello di Beneish
  // (pensato per aziende con inventario/margine lordo) non si applica a una
  // banca per costruzione, ed e' cosi' che lo si scopre: dal dato assente,
  // non da una lista scritta a mano di "chi escludere".
  crediti: ['AccountsReceivableNetCurrent', 'ReceivablesNetCurrent', 'AccountsReceivableNet'],
  costoVenduto: ['CostOfGoodsAndServicesSold', 'CostOfRevenue', 'CostOfGoodsSold'],
  attivoCorrente: ['AssetsCurrent'],
  passivoCorrente: ['LiabilitiesCurrent'],
  // Beneish (1999) usa il valore NETTO (quello che compare davvero nello stato
  // patrimoniale, additivo con l'attivo corrente nell'identita' CA+PPE+altro=TA)
  // — il lordo mischierebbe una grandezza diversa nello stesso rapporto.
  immobilizzazioniNette: ['PropertyPlantAndEquipmentNet'],
  ammortamento: ['DepreciationDepletionAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'Depreciation'],
  speseSga: ['SellingGeneralAndAdministrativeExpense'],
  flussoCassaOperativo: ['NetCashProvidedByUsedInOperatingActivities'],
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
const FLUSSI = new Set(['utileNetto', 'ricavi', 'costoVenduto', 'speseSga', 'flussoCassaOperativo', 'ammortamento']);

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

// BUG REALE TROVATO: l'elenco ufficiale SEC ticker→CIK non e' statico — una
// riorganizzazione societaria puo' spostare il ticker su un CIK NUOVO (una
// holding appena creata, zero storia XBRL) mentre i bilanci VERI restano sul
// CIK vecchio. Verificato dal vivo su XOM: l'elenco oggi lo punta a
// "ExxonMobil Holdings Corp" (CIK 2115436, 0 esercizi), mentre "Exxon Mobil
// Corporation" (CIK 34088) ha 48 anni di storia reale. Un ticker con 0
// esercizi in output era gia' il sintomo — non falliva rumorosamente, dava
// silenziosamente il vuoto. L'elenco qui e' l'eccezione dichiarata, non una
// scorciatoia: si aggiunge SOLO dopo aver verificato a mano che il CIK giusto
// abbia davvero la storia che quello sbagliato non ha.
const CIK_OVERRIDE = { XOM: { cik: '0000034088', nome: 'Exxon Mobil Corporation' } };

(async () => {
  const perTicker = await elencoCik();
  const AZIENDE = [];
  const senzaCik = [];
  for (const t of TICKER) {
    const override = CIK_OVERRIDE[t.toUpperCase()];
    const v = perTicker.get(t.toUpperCase());
    if (override) AZIENDE.push({ t, cik: override.cik, nome: override.nome });
    else if (v) AZIENDE.push({ t, cik: v.cik, nome: v.nome });
    else senzaCik.push(t);
  }
  if (senzaCik.length) console.log(`Ticker non trovati nell'elenco SEC: ${senzaCik.join(', ')}\n`);
  console.log(`${AZIENDE.length} aziende da scaricare\n`);

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
    // Grezzi per earnings-quality.js (Beneish M-Score/Piotroski F-Score): NON
    // entrano in roe/margine/roa (quei tre restano esattamente come prima,
    // nessun consumatore esistente li vede cambiare). Assenti per una banca
    // per costruzione (vedi commento su CONCETTI): `null`, mai zero.
    const cr = idx('crediti'), cv = idx('costoVenduto'), acr = idx('attivoCorrente'), pcr = idx('passivoCorrente'),
      ppe = idx('immobilizzazioniNette'), amm = idx('ammortamento'), sga = idx('speseSga'),
      cfo = idx('flussoCassaOperativo'), dl = idx('debitoLungo');
    const anni = [...pn.keys()].filter((y) => un.has(y)).sort((a, b) => a - b);
    serie[t] = {
      nome: d.nome,
      anni: anni.map((y) => ({
        anno: y,
        // ── IL ROE NON SIGNIFICA NIENTE SE IL PATRIMONIO E' QUASI ZERO ──
        // Con 82 aziende invece di 14 e' saltato fuori il problema: in cima
        // alla classifica per "costanza del ROE" finivano Colgate (688%),
        // Lockheed (515%), Boeing (326%), Kimberly-Clark (315%). Non sono
        // aziende straordinarie: hanno il patrimonio netto ridotto quasi a
        // zero da anni di riacquisti e passivita' pensionistiche, e dividere
        // un utile normale per un numero minuscolo fa esplodere il rapporto.
        // Boeing ha addirittura patrimonio NEGATIVO in diversi esercizi.
        // Un rapporto con un denominatore che tende a zero non e' un rapporto
        // alto: e' un rapporto senza significato, e presentarlo come qualita'
        // avrebbe messo in cima alla lista di Buffett esattamente le aziende
        // che lui non comprerebbe.
        // La soglia: il patrimonio deve valere almeno il 5% dell'attivo. Sotto,
        // il ROE resta NULL — assente, non zero, perche' non e' "basso": e'
        // non calcolabile.
        roe: (pn.get(y) > 0 && at.get(y) > 0 && pn.get(y) / at.get(y) >= 0.05)
          ? +(un.get(y) / pn.get(y)).toFixed(4) : null,
        margine: rv.get(y) > 0 ? +(un.get(y) / rv.get(y)).toFixed(4) : null,
        roa: at.get(y) > 0 ? +(un.get(y) / at.get(y)).toFixed(4) : null,
        utileNetto: un.get(y),
        ricavi: rv.get(y) ?? null,
        patrimonioNetto: pn.get(y),
        crediti: cr.get(y) ?? null,
        costoVenduto: cv.get(y) ?? null,
        attivoCorrente: acr.get(y) ?? null,
        passivoCorrente: pcr.get(y) ?? null,
        immobilizzazioniNette: ppe.get(y) ?? null,
        ammortamento: amm.get(y) ?? null,
        speseSga: sga.get(y) ?? null,
        flussoCassaOperativo: cfo.get(y) ?? null,
        attivoTotale: at.get(y) ?? null,
        debitoLungo: dl.get(y) ?? null,
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
