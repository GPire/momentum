// ============================================================
// NESSUNA FONTE È INDISPENSABILE — il registro con la ricaduta
// ============================================================
// Fino a qui ogni dato veniva da UNA fonte: FRED per la macro, Yahoo per i
// prezzi. Funziona finché funziona, ed è la cosa che un investitore serio
// contesta per prima, giustamente: **un prodotto che smette di esistere se un
// sito cambia idea non è un prodotto, è una scommessa.**
//
// E il rischio non è teorico. Dalla ricerca fatta oggi:
//  · Yahoo Finance NON HA un'API ufficiale dal 2017 — sono endpoint interni, e
//    i termini vietano l'accesso automatizzato senza autorizzazione. Per uso
//    personale il rischio pratico è basso; per un prodotto commerciale
//    distribuito è un rischio contrattuale vero;
//  · le serie ICE su FRED sono già state tagliate a 796 osservazioni per
//    licenza, e le serie oro LBMA sono state proprio RIMOSSE (404 verificato);
//  · i termini dell'API World Bank sembrano vietare l'uso commerciale, mentre
//    gli stessi dataset sono CC BY 4.0. Area grigia dichiarata, non risolta.
//
// LA RISPOSTA non è trovare la fonte perfetta — non esiste — ma **non
// dipendere da nessuna**. Ogni grandezza qui ha una CATENA di fonti: si prova
// la prima, se non risponde si passa alla seconda, e si dichiara sempre quale
// ha risposto. Un dato senza la sua provenienza non è un dato, è una voce.
//
// LE TRE COSE CHE QUESTO REGISTRO RENDE POSSIBILI:
//  1. sopravvivere alla morte di una fonte senza toccare il resto del codice;
//  2. sapere in ogni momento SU COSA si sta rispondendo (fonte + licenza), che
//     è ciò che serve sia a un utente diffidente sia a una due diligence;
//  3. preferire le fonti con licenza pulita a quelle comode. La BCE ha i
//     termini più chiari di tutte (riuso commerciale esplicito) e per questo
//     viene PRIMA di Yahoo dove copre lo stesso dato, anche se Yahoo sarebbe
//     più semplice.
//
// Funzioni PURE: `fetchImpl` iniettabile, nessun test tocca la rete.
'use strict';

// Le licenze contano quanto i dati: una fonte comoda che non si può
// ridistribuire è una fonte che va tolta dal prodotto il giorno prima del
// lancio, cioè nel momento peggiore.
export const LICENZE = {
  bce: { nome: 'BCE', commerciale: true, nota: 'riuso commerciale esplicito, basta citare la fonte', pulita: true },
  fred: { nome: 'FRED / Federal Reserve', commerciale: true, nota: 'dati di enti federali USA, in gran parte pubblico dominio; le serie di terzi (ICE, LBMA) seguono la licenza del fornitore', pulita: true },
  eurostat: { nome: 'Eurostat', commerciale: true, nota: 'CC BY 4.0, con eccezioni per dati non originati da Eurostat', pulita: true },
  cftc: { nome: 'CFTC', commerciale: true, nota: 'ente federale USA, pubblico dominio', pulita: true },
  frankfurter: { nome: 'Frankfurter', commerciale: true, nota: 'ridistribuisce i cambi di riferimento BCE, gia\' liberi', pulita: true },
  worldbank: { nome: 'World Bank', commerciale: null, nota: 'AREA GRIGIA: i dataset sono CC BY 4.0 ma i termini dell\'API sembrano vietare l\'uso commerciale. Da chiarire prima di dipenderne in un prodotto a pagamento', pulita: false },
  yahoo: { nome: 'Yahoo Finance', commerciale: false, nota: 'RISCHIO: nessuna API ufficiale dal 2017, i termini vietano l\'accesso automatizzato. Usabile per sviluppo, da non rendere indispensabile', pulita: false },
};

// ── I lettori, uno per formato ──
export function leggiCsvSemplice(testo, { colonnaData = 0, colonnaValore = 1, saltaIntestazione = true } = {}) {
  const righe = String(testo || '').trim().split('\n');
  const out = [];
  for (const r of righe.slice(saltaIntestazione ? 1 : 0)) {
    const c = r.split(',');
    const d = (c[colonnaData] || '').trim().replace(/^"|"$/g, '');
    const v = (c[colonnaValore] || '').trim().replace(/^"|"$/g, '');
    if (!d || v === '' || v === '.') continue;
    const n = parseFloat(v);
    if (Number.isFinite(n)) out.push({ data: d, valore: n });
  }
  return out;
}

// Il CSV della BCE ha le colonne per NOME, non per posizione: leggerle per
// indice funzionerebbe finche' la BCE non ne aggiunge una in mezzo.
export function leggiCsvBce(testo) {
  const righe = String(testo || '').trim().split('\n');
  if (righe.length < 2) return [];
  const intest = righe[0].split(',').map((x) => x.trim());
  const iData = intest.indexOf('TIME_PERIOD');
  const iVal = intest.indexOf('OBS_VALUE');
  if (iData < 0 || iVal < 0) return [];
  const out = [];
  for (const r of righe.slice(1)) {
    // Le righe BCE contengono virgolette con virgole dentro: si spezza in modo
    // grezzo ma sufficiente, perche' le due colonne che servono vengono prima.
    const c = r.split(',');
    const d = (c[iData] || '').trim(), v = parseFloat(c[iVal]);
    if (d && Number.isFinite(v)) out.push({ data: d, valore: v });
  }
  return out;
}

export function leggiJsonFrankfurter(testo) {
  try {
    const j = JSON.parse(testo);
    const out = [];
    for (const [data, coppie] of Object.entries(j?.rates || {})) {
      const v = Object.values(coppie || {})[0];
      if (Number.isFinite(v)) out.push({ data, valore: v });
    }
    return out.sort((a, b) => (a.data < b.data ? -1 : 1));
  } catch (_) { return []; }
}

export function leggiJsonYahoo(testo) {
  try {
    const r = JSON.parse(testo)?.chart?.result?.[0];
    const c = r?.indicators?.adjclose?.[0]?.adjclose || r?.indicators?.quote?.[0]?.close;
    if (!r?.timestamp || !c) return [];
    const out = [];
    for (let i = 0; i < r.timestamp.length; i++) {
      if (c[i] == null) continue;
      out.push({ data: new Date(r.timestamp[i] * 1000).toISOString().slice(0, 10), valore: c[i] });
    }
    return out;
  } catch (_) { return []; }
}

// ── IL REGISTRO: ogni grandezza, la sua catena di fonti ──
// L'ordine è deliberato: prima le fonti con licenza pulita, poi le comode.
// Cambiare l'ordine è una decisione, non un dettaglio.
export const REGISTRO = {
  tassoDecennaleUsa: {
    etichetta: 'rendimento decennale Stati Uniti',
    catena: [
      { fonte: 'fred', url: () => 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10', leggi: leggiCsvSemplice },
      { fonte: 'fred', url: () => 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=IRLTLT01USM156N', leggi: leggiCsvSemplice, nota: 'serie OCSE mensile: meno fine, stessa grandezza' },
    ],
  },
  tassoDecennaleAreaEuro: {
    etichetta: 'rendimento decennale area euro',
    catena: [
      { fonte: 'bce', url: () => 'https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y?format=csvdata&lastNObservations=400', leggi: leggiCsvBce },
      { fonte: 'fred', url: () => 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=IRLTLT01EZM156N', leggi: leggiCsvSemplice },
    ],
  },
  condizioniFinanziarie: {
    etichetta: 'condizioni finanziarie',
    catena: [
      { fonte: 'fred', url: () => 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=NFCI', leggi: leggiCsvSemplice },
      { fonte: 'fred', url: () => 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=STLFSI4', leggi: leggiCsvSemplice, nota: 'indice di stress della Fed di St. Louis: misura diversa, stesso scopo' },
    ],
  },
  cambioEuroDollaro: {
    etichetta: 'cambio euro-dollaro',
    catena: [
      { fonte: 'frankfurter', url: (da) => `https://api.frankfurter.dev/v1/${da || '2020-01-01'}..?from=EUR&to=USD`, leggi: leggiJsonFrankfurter, cors: true },
      { fonte: 'bce', url: () => 'https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?format=csvdata&lastNObservations=400', leggi: leggiCsvBce },
    ],
  },
  posizionamento: {
    etichetta: 'posizionamento degli operatori (COT)',
    catena: [
      { fonte: 'cftc', url: () => 'https://publicreporting.cftc.gov/resource/6dca-aqww.csv?$limit=500&$order=report_date_as_yyyy_mm_dd%20DESC', leggi: (t) => leggiCsvSemplice(t, { colonnaData: 2, colonnaValore: 7 }) },
    ],
  },
  // ── Materie prime e casa ──
  // Il pannello storico viene dal Pink Sheet della Banca Mondiale (66 anni,
  // ma un XLSX che si scarica a mano una volta). Per l'aggiornamento serve
  // qualcosa di leggibile a runtime, e sono le serie FMI ridistribuite da
  // FRED: partono dal 1992 invece che dal 1960, ma arrivano piu' avanti.
  // Storia lunga da una fonte, freschezza da un'altra: e' esattamente il
  // motivo per cui questo registro esiste.
  oro: {
    etichetta: 'oro',
    catena: [
      { fonte: 'fred', url: () => 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=IQ12260', leggi: leggiCsvSemplice, nota: 'indice del prezzo dell\'oro dal 1984' },
      { fonte: 'worldbank', url: () => 'https://thedocs.worldbank.org/en/doc/18675f1d1639c7a34d463f59263ba0a2-0050012025/related/CMO-Historical-Data-Monthly.xlsx', leggi: () => [], nota: 'Pink Sheet: 66 anni ma in XLSX, non leggibile a runtime — e\' la fonte del pannello storico, non dell\'aggiornamento' },
    ],
  },
  petrolio: {
    etichetta: 'petrolio (Brent)',
    catena: [
      { fonte: 'fred', url: () => 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=POILBREUSDM', leggi: leggiCsvSemplice },
      { fonte: 'fred', url: () => 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU', leggi: leggiCsvSemplice, nota: 'stessa grandezza, giornaliera' },
    ],
  },
  metalliIndustriali: {
    etichetta: 'metalli industriali',
    catena: [
      { fonte: 'fred', url: () => 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=PCOPPUSDM', leggi: leggiCsvSemplice, nota: 'rame: il metallo che segue il ciclo economico piu\' da vicino' },
      { fonte: 'fred', url: () => 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=PIORECRUSDM', leggi: leggiCsvSemplice, nota: 'minerale di ferro' },
    ],
  },
  indiceMateriePrime: {
    etichetta: 'indice generale delle materie prime',
    catena: [
      { fonte: 'fred', url: () => 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=PALLFNFINDEXM', leggi: leggiCsvSemplice, nota: 'indice FMI di tutte le materie prime' },
    ],
  },
  immobiliareUsa: {
    etichetta: 'prezzi delle case Stati Uniti',
    catena: [
      { fonte: 'fred', url: () => 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=CSUSHPINSA', leggi: leggiCsvSemplice, nota: 'Case-Shiller, mensile dal 1987' },
      { fonte: 'fred', url: () => 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=QUSR628BIS', leggi: leggiCsvSemplice, nota: 'BIS, trimestrale ma gia\' al netto dell\'inflazione' },
    ],
  },
  immobiliareMondo: {
    etichetta: 'prezzi delle case nel mondo',
    catena: [
      { fonte: 'fred', url: (paese) => `https://fred.stlouisfed.org/graph/fredgraph.csv?id=Q${paese || 'XM'}R628BIS`, leggi: leggiCsvSemplice, nota: 'BIS: stessa forma di serie per 28 Paesi, basta cambiare il codice del Paese' },
    ],
  },

  azioniUsa: {
    etichetta: 'azioni Stati Uniti',
    catena: [
      { fonte: 'yahoo', url: () => 'https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=5y&interval=1d', leggi: leggiJsonYahoo, avviso: 'unica fonte per i prezzi: se Yahoo chiude, questo dato non ha ricaduta' },
    ],
  },
};

// ── La presa del dato, con ricaduta ──
export async function prendi(chiave, { fetchImpl, da = null, timeoutMs = 10000 } = {}) {
  const voce = REGISTRO[chiave];
  if (!voce) return { riuscito: false, motivo: `grandezza sconosciuta: "${chiave}"`, tentativi: [] };
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) return { riuscito: false, motivo: 'nessun modo di scaricare in questo ambiente', tentativi: [] };

  const tentativi = [];
  for (const passo of voce.catena) {
    try {
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
      const res = await f(passo.url(da), ctrl ? { signal: ctrl.signal } : undefined);
      if (timer) clearTimeout(timer);
      if (!res?.ok) { tentativi.push({ fonte: passo.fonte, esito: `risposta ${res?.status ?? '?'}` }); continue; }
      const punti = passo.leggi(await res.text());
      if (!punti.length) { tentativi.push({ fonte: passo.fonte, esito: 'nessuna osservazione utile' }); continue; }
      tentativi.push({ fonte: passo.fonte, esito: 'ok', punti: punti.length });
      return {
        riuscito: true, chiave, etichetta: voce.etichetta,
        punti, ultimo: punti[punti.length - 1],
        // La provenienza viaggia SEMPRE col dato: un numero senza la sua fonte
        // non e' un dato, e' una voce.
        fonte: passo.fonte, licenza: LICENZE[passo.fonte],
        ricaduta: tentativi.length > 1,
        nota: passo.nota || null,
        tentativi,
      };
    } catch (e) {
      tentativi.push({ fonte: passo.fonte, esito: String(e?.name === 'AbortError' ? 'tempo scaduto' : e?.message || e).slice(0, 60) });
    }
  }
  return { riuscito: false, chiave, motivo: 'nessuna fonte della catena ha risposto', tentativi };
}

// ── La diagnosi del rischio-fonte, che è quello che guarda chi investe ──
export function rischioFonti() {
  const righe = Object.entries(REGISTRO).map(([chiave, v]) => {
    const fonti = [...new Set(v.catena.map((p) => p.fonte))];
    const licenzeSporche = fonti.filter((f) => LICENZE[f] && !LICENZE[f].pulita);
    return {
      chiave, etichetta: v.etichetta,
      fonti, alternative: v.catena.length - 1,
      // Un solo passo nella catena = un punto singolo di rottura.
      puntoUnico: v.catena.length < 2,
      licenzeDaChiarire: licenzeSporche.map((f) => ({ fonte: f, nota: LICENZE[f].nota })),
      avviso: v.catena.find((p) => p.avviso)?.avviso || null,
    };
  });
  const critiche = righe.filter((r) => r.puntoUnico);
  const legali = righe.filter((r) => r.licenzeDaChiarire.length);
  return {
    grandezze: righe,
    puntiUnici: critiche.map((r) => r.etichetta),
    daChiarireLegalmente: [...new Set(legali.flatMap((r) => r.licenzeDaChiarire.map((l) => l.fonte)))],
    // Il numero sintetico: quante grandezze reggerebbero la morte della loro
    // fonte principale.
    coperturaConRicaduta: +((righe.length - critiche.length) / righe.length).toFixed(2),
    verdetto: critiche.length === 0
      ? 'ogni grandezza ha almeno una fonte di ricaduta'
      : `${critiche.length} grandezze su ${righe.length} dipendono da una fonte sola: ${critiche.map((r) => r.etichetta).join(', ')}`,
  };
}

export function fontiText(esito) {
  if (!esito?.riuscito) return esito?.motivo || null;
  const l = esito.licenza;
  const rc = esito.ricaduta ? ' (la fonte principale non rispondeva, ho usato la seconda)' : '';
  return `${esito.etichetta}: ${esito.punti.length} osservazioni fino al ${esito.ultimo.data}, da ${l?.nome || esito.fonte}${rc}.`;
}
