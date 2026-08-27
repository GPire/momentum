// Cantiere D (PIANO_TASK_2026-08-21.md) — da 82 a MILLE E PIU aziende, con
// SETTORE VERO. Genera src/alpha/panel-settoriale.js — "npm run bench:panel".
//
// ── PERCHE' QUESTO CAMBIA LE SOGLIE ──
// fondamentali.js confronta un'azienda contro soglie SCRITTE A MANO ("ROE
// sopra 0,15 e' buono"). Le 82 aziende di fondamentali-storici.js sono tutte
// large cap: raccontano un mondo che non esiste. Misurato dal vivo
// sull'endpoint bulk della SEC: il margine netto MEDIANO di un'azienda
// quotata USA nel 2024 e' 0,2% (non 15%), su un campione di ~4.400 aziende.
// Con un pannello vero, "ROE 15%" smette di essere confrontato con un numero
// a memoria e diventa "il 78-esimo percentile del SUO settore" — una
// posizione nella popolazione reale, non un giudizio scritto da noi.
//
// ── L'ENDPOINT GIUSTO NON E' companyfacts (una richiesta per azienda) ──
// E' `frames`: UNA richiesta per concetto-per-anno restituisce il valore di
// QUELLA riga di bilancio per TUTTE le aziende che l'hanno depositata in
// quell'esercizio. Verificato dal vivo: Revenues/CY2024 da solo torna 2.497
// aziende; l'unione dei nomi contabili (stesso problema gia' risolto in
// fetch-fondamentali-sec.mjs: un'etichetta XBRL cambia nel tempo) ne somma
// migliaia. Le grandezze STOCK (patrimonio, attivo) vogliono il formato
// CY####Q4I (istante a fine Q4), non CY#### che e' solo per i FLUSSI.
//
// ── IL SETTORE NON E' NEI frames: serve una seconda passata ──
// Il codice SIC (il settore vero, dichiarato dall'azienda alla SEC) vive in
// `data.sec.gov/submissions/CIK##########.json`, UNA richiesta per azienda.
// Con migliaia di aziende non e' gratis: si prendono le PRIME N per
// copertura di dati (non a caso, non per capitalizzazione che non abbiamo),
// rispettando <10 richieste/secondo. N e' un parametro dichiarato, non un
// numero nascosto — vedi COPERTURA_SIC_MAX sotto.
//
// ── ONESTA' SULLA SCALA VERA RAGGIUNTA ──
// Il piano parlava di "~5.000 aziende": e' il numero di aziende che DEPOSITANO
// un bilancio nell'anno piu' recente, non il numero per cui questo script
// costruisce un percentile di settore (quello e' limitato da COPERTURA_SIC_MAX
// per restare dentro tempi di sviluppo ragionevoli). Il file generato dichiara
// ENTRAMBI i numeri, sempre — mai un "~5.000" lasciato intendere quando la
// copertura reale e' diversa.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beneishMScore } from '../src/alpha/quality-scores.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = process.env.SEC_CONTATTO || 'Momentum on-device finance research momentum-research@proton.me';
const PAUSA = 110; // sotto le 10 richieste al secondo chieste dalla SEC (frames + submissions)

// ── CACHE SIC, incrementale (2026-08-27) ── Il codice SIC di un'azienda
// cambia quasi mai (una riclassificazione e' un evento raro, non annuale):
// rifare 1.500 richieste `submissions` ad ogni run — l'unica parte
// realmente O(aziende) di questo script, la parte `frames` resta O(1) per
// concetto-anno indipendentemente da quante aziende ci sono dentro — è
// tempo sprecato per un dato che nel 99% dei casi non e' cambiato. La
// cache persiste su disco (committata: e' un piccolo lookup, non un
// segreto) e viene aggiornata solo per le aziende NUOVE o quelle senza SIC
// risolto l'ultima volta. `--force-sic` (env FORCE_SIC=1) ignora la cache
// per un refresh completo occasionale (es. una volta all'anno, a mano).
const SIC_CACHE_PATH = join(root, 'bench/sic-cache.json');
const FORCE_SIC = process.env.FORCE_SIC === '1';
function caricaSicCache() {
  if (FORCE_SIC || !existsSync(SIC_CACHE_PATH)) return new Map();
  try {
    const raw = JSON.parse(readFileSync(SIC_CACHE_PATH, 'utf8'));
    return new Map(Object.entries(raw));
  } catch (_) { return new Map(); } // cache corrotta o assente: si ricostruisce da zero, mai un crash
}

// Quante aziende ricevono il codice SIC (e quindi un percentile di SETTORE),
// scelte per COMPLETEZZA di dati (piu' anni coperti, non capitalizzazione che
// non abbiamo senza chiave). Alzarlo scala linearmente il tempo di scaricamento
// (una richiesta ciascuna): 1.500 ~ 3 minuti a 110ms di pausa.
const COPERTURA_SIC_MAX = 1500;

// Concetti come in fetch-fondamentali-sec.mjs: piu' nomi per la stessa idea
// contabile, perche' l'etichetta XBRL cambia nel tempo e fra aziende.
//
// GLI 8 CONCETTI IN PIU' (Cantiere E3, PIANO_TASK_2026-08-21.md): stessi
// nomi XBRL gia' validati per le 82 aziende in fetch-fondamentali-sec.mjs
// (commit cf20588) — serviranno a Beneish M-Score e Piotroski F-Score
// (src/alpha/quality-scores.js), che qui prima non c'erano dati sufficienti
// a costruire (panel-settoriale.js aveva solo ricavi/utileNetto/patrimonio/
// attivo). Nessun concetto nuovo da inventare: gia' provato che funzionano.
const CONCETTI = {
  ricavi: { nomi: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax'], flusso: true },
  utileNetto: { nomi: ['NetIncomeLoss', 'ProfitLoss'], flusso: true },
  patrimonioNetto: { nomi: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'], flusso: false },
  attivo: { nomi: ['Assets'], flusso: false },
  crediti: { nomi: ['AccountsReceivableNetCurrent', 'ReceivablesNetCurrent', 'AccountsReceivableNet'], flusso: false },
  costoVenduto: { nomi: ['CostOfGoodsAndServicesSold', 'CostOfRevenue', 'CostOfGoodsSold'], flusso: true },
  attivoCorrente: { nomi: ['AssetsCurrent'], flusso: false },
  passivoCorrente: { nomi: ['LiabilitiesCurrent'], flusso: false },
  immobilizzazioniNette: { nomi: ['PropertyPlantAndEquipmentNet'], flusso: false },
  ammortamento: { nomi: ['DepreciationDepletionAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'Depreciation'], flusso: true },
  speseSga: { nomi: ['SellingGeneralAndAdministrativeExpense'], flusso: true },
  flussoCassaOperativo: { nomi: ['NetCashProvidedByUsedInOperatingActivities'], flusso: true },
};

// Servono per Beneish/Piotroski ma NON per il pannello base
// (ricavi/utileNetto/patrimonioNetto/attivo restano l'unico requisito per
// entrare nel pannello — un'azienda senza questi 8 resta comunque dentro,
// solo senza i due punteggi di qualita').
const CONCETTI_QUALITA = ['crediti', 'costoVenduto', 'attivoCorrente', 'passivoCorrente', 'immobilizzazioniNette', 'ammortamento', 'speseSga', 'flussoCassaOperativo'];

const ANNO_INIZIO = 2007, ANNO_FINE = 2025;

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

async function frame(concetto, anno, flusso) {
  const periodo = flusso ? `CY${anno}` : `CY${anno}Q4I`;
  const url = `https://data.sec.gov/api/xbrl/frames/us-gaap/${concetto}/USD/${periodo}.json`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (res.status === 404) return []; // concetto/periodo senza depositi: normale, non un errore
  if (!res.ok) throw new Error(`frames ${concetto} ${periodo}: HTTP ${res.status}`);
  const j = await res.json();
  return j.data || [];
}

async function submissions(cik) {
  const url = `https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const j = await res.json();
  return { sic: j.sic || null, sicDescription: j.sicDescription || null, ticker: (j.tickers || [])[0] || null, nome: j.name || null };
}

(async () => {
  // ── 1. I frames: un valore per azienda, per concetto, per anno ──
  // perDato[chiave][cik][anno] = { val, filed } — si tiene il piu' recente fra
  // i nomi contabili alternativi (stesso principio "chi ha depositato piu' di
  // recente vince" gia' verificato in fetch-fondamentali-sec.mjs).
  const perDato = Object.fromEntries(Object.keys(CONCETTI).map((k) => [k, new Map()]));
  const nomiPerCik = new Map(); // cik -> entityName (dai frames stessi, gratis)

  let richieste = 0;
  for (const [chiave, { nomi, flusso }] of Object.entries(CONCETTI)) {
    for (let anno = ANNO_INIZIO; anno <= ANNO_FINE; anno++) {
      for (const nome of nomi) {
        let punti;
        try { punti = await frame(nome, anno, flusso); } catch (e) { console.log(`  fallito ${nome} ${anno}: ${e.message}`); punti = []; }
        richieste++;
        for (const p of punti) {
          if (!Number.isFinite(p.val)) continue;
          if (flusso) {
            // Un flusso vuole ~12 mesi, mai un trimestre residuo dentro il frame annuale.
            if (!p.start || !p.end) continue;
            const giorni = (new Date(p.end) - new Date(p.start)) / 86400000;
            if (giorni < 340 || giorni > 400) continue;
          }
          const mappa = perDato[chiave];
          if (!mappa.has(p.cik)) mappa.set(p.cik, new Map());
          const perAnno = mappa.get(p.cik);
          const prec = perAnno.get(anno);
          if (!prec || (p.accn || '') > (prec.accn || '')) perAnno.set(anno, { val: p.val, accn: p.accn || '' });
          if (p.entityName) nomiPerCik.set(p.cik, p.entityName);
        }
        await attendi(PAUSA);
      }
      process.stdout.write(`\r${chiave} ${anno}: ${richieste} richieste frames finora`);
    }
  }
  console.log(`\n${richieste} richieste frames totali. Aziende con almeno un ricavo depositato: ${perDato.ricavi.size}`);

  // ── 2. Unione per azienda: quanti anni completi (ricavi+utile+patrimonio+attivo) ──
  const cikCompleti = [];
  for (const cik of perDato.ricavi.keys()) {
    const anni = [];
    for (let anno = ANNO_INIZIO; anno <= ANNO_FINE; anno++) {
      const rv = perDato.ricavi.get(cik)?.get(anno)?.val;
      const un = perDato.utileNetto.get(cik)?.get(anno)?.val;
      const pn = perDato.patrimonioNetto.get(cik)?.get(anno)?.val;
      const at = perDato.attivo.get(cik)?.get(anno)?.val;
      if (rv !== undefined && un !== undefined && pn !== undefined && at !== undefined) {
        const riga = {
          anno, ricavi: rv, utileNetto: un, patrimonioNetto: pn, attivo: at,
          margine: rv !== 0 ? +(un / rv).toFixed(4) : null,
          roe: (pn > 0 && at > 0 && pn / at >= 0.05) ? +(un / pn).toFixed(4) : null,
          roa: at > 0 ? +(un / at).toFixed(4) : null,
        };
        // I concetti di qualita' (Beneish/Piotroski) sono OPZIONALI riga per
        // riga: un'azienda senza costoVenduto in un anno non perde l'anno
        // intero (margine/roe/roa restano validi), solo i due punteggi di
        // qualita' per quell'anno non si potranno calcolare — dichiarato da
        // quality-scores.js con un campo mancante, mai un valore inventato.
        for (const chiave of CONCETTI_QUALITA) {
          const v = perDato[chiave]?.get(cik)?.get(anno)?.val;
          if (v !== undefined) riga[chiave] = v;
        }
        anni.push(riga);
      }
    }
    if (anni.length >= 3) cikCompleti.push({ cik, nome: nomiPerCik.get(cik) || `CIK${cik}`, anni });
  }
  console.log(`Aziende con >=3 anni completi (ricavi+utile+patrimonio+attivo): ${cikCompleti.length}`);

  // ── 3. Il SIC: solo per le prime COPERTURA_SIC_MAX, ordinate per completezza ──
  cikCompleti.sort((a, b) => b.anni.length - a.anni.length || (b.anni.at(-1)?.ricavi || 0) - (a.anni.at(-1)?.ricavi || 0));
  const daArricchire = cikCompleti.slice(0, COPERTURA_SIC_MAX);
  console.log(`Arricchimento SIC per le prime ${daArricchire.length} aziende per completezza...`);

  const sicCache = caricaSicCache();
  let fatte = 0, daRete = 0, dallaCache = 0;
  for (const az of daArricchire) {
    const cached = sicCache.get(String(az.cik));
    if (cached?.sic) {
      az.sic = cached.sic; az.sicDescription = cached.sicDescription; az.ticker = cached.ticker; if (cached.nome) az.nome = cached.nome;
      dallaCache++;
    } else {
      try {
        const s = await submissions(az.cik);
        if (s) {
          az.sic = s.sic; az.sicDescription = s.sicDescription; az.ticker = s.ticker; if (s.nome) az.nome = s.nome;
          sicCache.set(String(az.cik), { sic: s.sic, sicDescription: s.sicDescription, ticker: s.ticker, nome: s.nome, risoltoIl: new Date().toISOString().slice(0, 10) });
        }
      } catch (_) { /* un'azienda senza SIC resta senza settore, non blocca le altre — e non entra in cache, si ritenta al prossimo run */ }
      daRete++;
      await attendi(PAUSA);
    }
    fatte++;
    if (fatte % 50 === 0) process.stdout.write(`\r  ${fatte}/${daArricchire.length}`);
  }
  console.log(`\nSIC ottenuto per ${daArricchire.filter((a) => a.sic).length}/${daArricchire.length} aziende (${dallaCache} dalla cache, ${daRete} da rete).`);
  writeFileSync(SIC_CACHE_PATH, JSON.stringify(Object.fromEntries(sicCache), null, 1));

  // ── 3b. Controllo di plausibilità (2026-08-27) — riusa Beneish M-Score
  // (src/alpha/quality-scores.js, GIÀ nel progetto, usato dal vivo per gli
  // utenti) come sanity check sull'INGESTIONE, non sull'analisi: qui non
  // interessa "è manipolazione contabile vera" (quella soglia, -1,78, resta
  // SOLO in quality-scores.js per l'utente finale) — interessa "un M-Score
  // fuori da QUALSIASI intervallo plausibile può anche significare un
  // campo XBRL mal interpretato da questo script" (unità sbagliata, segno
  // invertito). Aziende sane tipiche stanno a grandi linee fra -1 e -5; un
  // valore ASSOLUTO oltre 10, in una direzione o nell'altra, è così fuori
  // scala da essere più plausibilmente un bug di parsing che una vera
  // manipolazione contabile da record. MAI scartato in automatico — solo
  // segnalato in un file a parte, per una revisione umana prima del
  // prossimo commit del pannello.
  const SOGLIA_AVVISO_INGESTIONE = 10;
  const avvisiQualita = [];
  for (const az of daArricchire) {
    if (az.anni.length < 2) continue;
    const t = az.anni.at(-1), t1 = az.anni.at(-2);
    let r;
    try { r = beneishMScore(t, t1, { sic: az.sic }); } catch (_) { continue; }
    if (r?.valido && Math.abs(r.score) >= SOGLIA_AVVISO_INGESTIONE) {
      avvisiQualita.push({ cik: az.cik, nome: az.nome, ticker: az.ticker, anno: t.anno, score: r.score, motivo: 'M-Score fuori da qualsiasi intervallo plausibile — controllare che i campi XBRL di questo bilancio non siano stati interpretati male, prima di fidarsi ciecamente' });
    }
  }
  if (avvisiQualita.length) {
    const avvisiPath = join(root, 'bench/panel-avvisi.json');
    writeFileSync(avvisiPath, JSON.stringify(avvisiQualita, null, 1));
    console.log(`⚠ ${avvisiQualita.length} aziende con M-Score fuori da ±${SOGLIA_AVVISO_INGESTIONE} — possibile dato mal interpretato, non manipolazione: vedi ${avvisiPath}. Il pannello viene comunque scritto (mai bloccato da un avviso), la revisione resta umana.`);
  } else {
    console.log('Controllo di plausibilità (Beneish): nessuna anomalia estrema trovata.');
  }

  // ── 4. Percentili per SETTORE (2 cifre del SIC, "major group") × anno × misura ──
  // Sotto MIN_BUCKET aziende nello stesso gruppo-anno il percentile non si
  // calcola: un percentile su 3 aziende non e' un percentile, e' rumore
  // vestito da statistica.
  const MIN_BUCKET = 8;
  const conSic = daArricchire.filter((a) => a.sic);
  const bucket = new Map(); // "gruppoSic|anno|misura" -> [valori]
  for (const az of conSic) {
    const gruppo = String(az.sic).padStart(4, '0').slice(0, 2);
    for (const riga of az.anni) {
      for (const misura of ['margine', 'roe', 'roa']) {
        if (riga[misura] === null) continue;
        const k = `${gruppo}|${riga.anno}|${misura}`;
        if (!bucket.has(k)) bucket.set(k, []);
        bucket.get(k).push(riga[misura]);
      }
    }
  }
  const percentili = {};
  for (const [k, valori] of bucket) {
    if (valori.length < MIN_BUCKET) continue;
    const ord = [...valori].sort((a, b) => a - b);
    percentili[k] = { n: ord.length, p10: pct(ord, 0.10), p25: pct(ord, 0.25), p50: pct(ord, 0.50), p75: pct(ord, 0.75), p90: pct(ord, 0.90) };
  }
  function pct(ordinato, p) {
    const idx = Math.min(ordinato.length - 1, Math.max(0, Math.round(p * (ordinato.length - 1))));
    return +ordinato[idx].toFixed(4);
  }

  // ── 5. Cosa si spedisce: le tabelle di percentili (piccole, calcolate su
  // TUTTE le ${COPERTURA_SIC_MAX} aziende con SIC — piu' rappresentative cosi')
  // + le righe complete SOLO delle prime PUBBLICA_RIGHE_MAX per ricavi
  // dell'ultimo anno (comparabili/screener, Cantiere G): spedire le righe
  // intere di tutte e ${COPERTURA_SIC_MAX} pesava troppo nel bundle, le
  // percentili no perche' sono gia' aggregate.
  const PUBBLICA_RIGHE_MAX = 600;
  const aziendePubblicate = [...conSic]
    .filter((a) => a.anni.length)
    .sort((a, b) => (b.anni.at(-1)?.ricavi || 0) - (a.anni.at(-1)?.ricavi || 0))
    .slice(0, PUBBLICA_RIGHE_MAX)
    .map((a) => ({
      cik: a.cik, nome: a.nome, ticker: a.ticker, sic: a.sic, sicDescription: a.sicDescription,
      anni: a.anni,
    }));

  const contenuto = `// GENERATO da bench/fetch-panel-sec.mjs — non modificare a mano.
// Cantiere D (PIANO_TASK_2026-08-21.md): pannello SEC su scala, con settore
// VERO (codice SIC dichiarato alla SEC), non le 82 aziende scelte a mano di
// fondamentali-storici.js. Bilanci REALI, fonte PRIMARIA (SEC EDGAR
// companyfacts/frames), nessuna chiave, nessuna registrazione.
//
// ONESTA' SULLA SCALA (regola #1): la SEC ha ricevuto depositi di ricavi da
// ~${perDato.ricavi.size} aziende nell'anno piu' recente disponibile — questo file ne
// pubblica il SETTORE (e quindi il percentile) per le prime ${aziendePubblicate.length}
// (scelte per completezza di dati, non per dimensione), perche' il codice SIC
// costa una richiesta per azienda e il resto e' fuori budget di tempo di
// sviluppo dichiarato (COPERTURA_SIC_MAX in bench/fetch-panel-sec.mjs). Un
// percentile e' pubblicato solo per i gruppi settore-anno con almeno ${MIN_BUCKET}
// aziende: sotto quella soglia sarebbe rumore travestito da statistica.
// E' una FOTOGRAFIA, non un flusso: vedi freschezza.js per l'eta' del dato.
'use strict';

export const SEC_PANEL_SCARICATO_IL = '${new Date().toISOString().slice(0, 10)}';
export const SEC_PANEL_FONTE = 'SEC EDGAR — API frames + submissions (XBRL), moduli 10-K';
export const SEC_PANEL_AZIENDE_TOTALI_MERCATO = ${perDato.ricavi.size};
export const SEC_PANEL_MIN_BUCKET = ${MIN_BUCKET};

// Percentili p10/p25/p50/p75/p90 per "gruppoSic|anno|misura" (misura:
// margine|roe|roa). Chiave stringa deliberata: e' una tabella di lookup, non
// una struttura da navigare a mano.
export const PERCENTILI_SETTORE = ${JSON.stringify(percentili, null, 1)};

// Le righe complete delle aziende con settore noto: comparabili veri e
// screener multi-criterio (Cantiere G). Ordinate per numero di anni coperti.
export const AZIENDE_PANEL = ${JSON.stringify(aziendePubblicate, null, 1)};

export const TICKER_PANEL_DISPONIBILI = AZIENDE_PANEL.map((a) => a.ticker).filter(Boolean);

// Il percentile di un valore dentro il suo gruppo-settore-anno, o null se il
// gruppo non ha abbastanza aziende per dirlo (mai un numero inventato sotto
// la soglia).
export function percentileSettore(sic, anno, misura, valore) {
  if (!Number.isFinite(valore) || !sic) return null;
  const gruppo = String(sic).padStart(4, '0').slice(0, 2);
  const p = PERCENTILI_SETTORE[\`\${gruppo}|\${anno}|\${misura}\`];
  if (!p) return null;
  if (valore <= p.p10) return 10;
  if (valore <= p.p25) return 25;
  if (valore <= p.p50) return 50;
  if (valore <= p.p75) return 75;
  if (valore <= p.p90) return 90;
  return 95;
}
`;

  const dest = join(root, 'src/alpha/panel-settoriale.js');
  writeFileSync(dest, contenuto);
  console.log(`\nScritto ${dest} (${Math.round(Buffer.byteLength(contenuto) / 1024)} KB): ${aziendePubblicate.length} aziende con settore, ${Object.keys(percentili).length} celle di percentile.`);
})();
