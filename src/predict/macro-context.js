// ============================================================
// MACRO CONTEXT — il ponte tra i dati esterni (senza chiave) e l'intelligenza
// ============================================================
// Il problema che risolve, detto senza indulgenza: `alpha/sources.js` aveva
// ZERO consumatori in tutto il progetto — un registro di fonti verificate
// che nessuna funzione chiamava mai. Aggiungere fonti non serve a niente se
// restano isolate dal ragionamento. Questo file è il primo ponte reale.
//
// Usa SOLO le fonti macro senza chiave (BCE, BIS — verificate CORS-aperte
// dal vivo il 2026-08-05): zero attrito, funziona per ogni utente dal primo
// giorno, non solo per chi si registra a un servizio esterno per una chiave.
//
// Cosa fa: prende una serie macro reale (es. il tasso di riferimento) e la
// usa per dare un nome a una "causa comune non osservata" che
// causal-diagnostics.js aveva già individuato ma non poteva spiegare. Prima:
// "qualcosa che non misuriamo guida insieme ristoranti e supermercato".
// Dopo, se il tasso BCE spiega davvero il pattern: "probabilmente è il tasso
// di riferimento, non un legame diretto tra le due spese". Nessun'altra app
// di finanza personale collega la propria spesa al contesto macro reale.
//
// Funzioni pure sulla parte di analisi (testabili senza rete); un solo
// adattatore di rete che usa `fetchVerified` già esistente in sources.js.
'use strict';

import { partialCorrelationTest } from './causal-discovery.js';

const WEEK_MS = 7 * 86_400_000;

// Riallinea una serie macro (spesso mensile o irregolare) alla stessa griglia
// settimanale usata da buildCategorySeries. Nessuna interpolazione inventata:
// si porta avanti l'ultimo valore noto (un tasso di riferimento resta quello
// finché non cambia — è così che funziona davvero, non un'approssimazione di
// comodo). Settimane precedenti al primo dato noto restano null, dichiarate.
export function alignMacroToWeeks(macroSeries, { weeks, referenceDate = new Date() } = {}) {
  const points = (macroSeries || [])
    .filter((p) => Number.isFinite(p?.close) && /^\d{4}-\d{2}-\d{2}$/.test(p?.date))
    .map((p) => ({ t: Date.parse(p.date + 'T00:00:00Z'), close: p.close }))
    .sort((a, b) => a.t - b.t);
  if (!points.length || !Number.isFinite(weeks)) return { values: [], copertura: 0 };

  const monday = new Date(referenceDate);
  const day = monday.getDay();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1) - day);
  const start = monday.getTime() - weeks * WEEK_MS;

  const values = new Array(weeks).fill(null);
  let idx = 0;
  let ultimo = null;
  for (let w = 0; w < weeks; w++) {
    // BUG REALE trovato dal test: confrontare con l'INIZIO della settimana
    // (start + w*WEEK) escludeva sempre un punto capitato dentro quella
    // stessa settimana — un valore datato mercoledì non "esisteva ancora"
    // secondo il lunedì, quindi non veniva mai riportato avanti. Il
    // confronto giusto è con la FINE della settimana: un valore noto in
    // un giorno qualsiasi della settimana vale per quella settimana.
    const fineSettimana = start + (w + 1) * WEEK_MS;
    while (idx < points.length && points[idx].t < fineSettimana) { ultimo = points[idx].close; idx++; }
    values[w] = ultimo;
  }
  const copertura = values.filter((v) => v !== null).length / weeks;
  return { values, copertura: +copertura.toFixed(2) };
}

// Come alignMacroToWeeks ma su griglia MENSILE — serve per spiegare la parte
// "propria" di un titolo (src/alpha/titolo-causale.js:scomponi, residui
// mensili) col contesto macro, invece che la spesa personale settimanale.
// `meseFinale` è il mese più recente della griglia (formato 'YYYY-MM'),
// `mesi` quanti mesi indietro copre la griglia — stesso principio "porta
// avanti l'ultimo valore noto", stessa onestà: mesi prima del primo dato
// noto restano null, mai un'interpolazione inventata.
export function alignMacroToMonths(macroSeries, { mesi, meseFinale } = {}) {
  const points = (macroSeries || [])
    .filter((p) => Number.isFinite(p?.close) && /^\d{4}-\d{2}$/.test(String(p?.date).slice(0, 7)))
    .map((p) => ({ ym: String(p.date).slice(0, 7), close: p.close }))
    .sort((a, b) => a.ym.localeCompare(b.ym));
  if (!points.length || !Number.isFinite(mesi) || !/^\d{4}-\d{2}$/.test(meseFinale || '')) return { values: [], copertura: 0 };

  const [annoFin, meseFin] = meseFinale.split('-').map(Number);
  const ymAt = (offset) => { // offset 0 = meseFinale, offset -1 = mese prima, ecc.
    const totale = (annoFin * 12 + (meseFin - 1)) + offset;
    const a = Math.floor(totale / 12), m = (totale % 12) + 1;
    return `${a}-${String(m).padStart(2, '0')}`;
  };

  const values = new Array(mesi).fill(null);
  let idx = 0, ultimo = null;
  for (let w = 0; w < mesi; w++) {
    const ymCorrente = ymAt(w - (mesi - 1)); // dal più vecchio al più recente
    while (idx < points.length && points[idx].ym <= ymCorrente) { ultimo = points[idx].close; idx++; }
    values[w] = ultimo;
  }
  const copertura = values.filter((v) => v !== null).length / mesi;
  return { values, copertura: +copertura.toFixed(2) };
}

// Dato un residuo (già calcolato da detectLatentConfounders, MAI ricalcolato
// qui) e la serie macro riallineata, verifica se il macro spiega davvero il
// pattern. Solo le settimane con un valore macro noto entrano nel test —
// mai un buco riempito a caso.
//
// Testa SIA il livello sia la variazione settimana-su-settimana del macro.
// Scoperta empirica (non ovvia, trovata da un test che falliva): quando
// PCMCI ha già selezionato il passato di ciascuna serie come genitore, gran
// parte del LIVELLO macro condiviso viene assorbita in quel condizionamento
// — ciò che resta nel residuo è spesso lo shock dello STESSO periodo, che
// correla con la variazione del macro, non con il suo livello. Ignorare la
// variazione avrebbe fatto perdere esattamente il caso più realistico: un
// cambiamento di tasso inatteso che sposta più spese nello stesso momento.
export function correlaConMacro(residuo, macroAllineato) {
  const test = (serie) => {
    const coppie = [];
    const n = Math.min(residuo.length, serie.length);
    for (let i = 0; i < n; i++) if (serie[i] !== null) coppie.push([residuo[i], serie[i]]);
    if (coppie.length < 8) return null;
    return partialCorrelationTest(coppie.map((c) => c[0]), coppie.map((c) => c[1]), []);
  };
  const suLivello = test(macroAllineato);
  const variazione = macroAllineato.map((v, i) => (i === 0 || v === null || macroAllineato[i - 1] === null ? null : v - macroAllineato[i - 1]));
  const suVariazione = test(variazione);
  // Si tiene il più forte dei due, dichiarando quale ha vinto — serve alla UI
  // per dire "il livello del tasso" oppure "un cambiamento nel tasso".
  if (suLivello && (!suVariazione || Math.abs(suLivello.r) >= Math.abs(suVariazione.r))) return { ...suLivello, forma: 'livello' };
  if (suVariazione) return { ...suVariazione, forma: 'variazione' };
  return null;
}

// Arricchisce i sospetti di detectLatentConfounders: per ogni coppia, se
// ENTRAMBI i residui correlano col macro, il sospetto diventa un'ipotesi con
// un nome. Se solo uno correla, o nessuno, resta "non sappiamo" — mai
// un'attribuzione a metà spacciata per spiegazione.
export function explainConfoundersWithMacro(latentResult, macroAllineato, {
  label = 'il tasso di riferimento', alpha = 0.05, copertureMinima = 0.5,
} = {}) {
  if (!macroAllineato || macroAllineato.copertura < copertureMinima) {
    return {
      ...latentResult,
      sospetti: (latentResult.sospetti || []).map((s) => ({ ...s, spiegatoDaMacro: null })),
      macroDisponibile: false,
    };
  }
  const sospetti = (latentResult.sospetti || []).map((s) => {
    const [a, b] = s.tra;
    const ra = latentResult.residui?.[a];
    const rb = latentResult.residui?.[b];
    if (!ra || !rb) return { ...s, spiegatoDaMacro: null };
    const ca = correlaConMacro(ra, macroAllineato.values);
    const cb = correlaConMacro(rb, macroAllineato.values);
    const entrambiSignificativi = ca?.p !== null && ca.p < alpha && cb?.p !== null && cb.p < alpha;
    if (!entrambiSignificativi) return { ...s, spiegatoDaMacro: null };
    const conVariazione = ca.forma === 'variazione' || cb.forma === 'variazione';
    return {
      ...s,
      spiegatoDaMacro: label,
      nota: conVariazione
        ? `${s.tra[0]} e ${s.tra[1]} si muovono insieme probabilmente perché ${label} è cambiato in quel periodo, non per un legame diretto tra le due spese.`
        : `${s.tra[0]} e ${s.tra[1]} si muovono insieme probabilmente per ${label}, non per un legame diretto tra le due spese.`,
    };
  });
  return { ...latentResult, sospetti, macroDisponibile: true };
}

// Come explainConfoundersWithMacro, ma per UN SOLO residuo — nato per
// titolo-causale.js: quanto di ciò che sembra "specifico di questo titolo"
// (il residuo dopo aver tolto il settore, src/alpha/titolo-causale.js:
// scomponi) è in realtà il contesto macro (tassi, disoccupazione), non il
// titolo. Stessa disciplina: mai un'attribuzione a metà, "non spiegato" è
// una risposta onesta quanto "spiegato".
export function spiegaResiduoConMacro(residuo, macroAllineato, { label = 'il tasso di riferimento', alpha = 0.05, coperturaMinima = 0.5 } = {}) {
  if (!macroAllineato || macroAllineato.copertura < coperturaMinima || !Array.isArray(residuo) || !residuo.length) {
    return { disponibile: false, spiegato: false };
  }
  const c = correlaConMacro(residuo, macroAllineato.values);
  if (!c || c.p === null || c.p >= alpha) return { disponibile: true, spiegato: false };
  return { disponibile: true, spiegato: true, r: +c.r.toFixed(3), p: c.p, forma: c.forma, label };
}

// ── Adattatore di rete (non puro): usa fetchVerified già esistente, SOLO
// fonti keyless (BIS, ECB) — zero attrito, funziona senza che l'utente debba
// procurarsi nessuna chiave. `sourceId`/`symbol` scelgono quale serie.
// Default VERIFICATO dal vivo (2026-08-05): tasso di rifinanziamento
// principale BCE, serie CORRENTE (aggiornata quotidianamente, non cessata
// come la prima scelta — il tasso di policy di Banca d'Italia, dismesso dal
// 1999 quando l'Italia è entrata nell'euro: scoperto provando, non a
// tavolino). Zero chiave richiesta.
export async function fetchMacroSeries({ sourceId = 'ecb', symbol = 'FM/D.U2.EUR.4F.KR.MRR_FR.LEV', fetchImpl, cache } = {}) {
  const { fetchVerified, trainingEligible, SOURCE_REGISTRY } = await import('../alpha/sources.js');
  const sources = SOURCE_REGISTRY.filter((s) => s.id === sourceId);
  if (!sources.length) return { series: [], verified: 'fonte-sconosciuta' };
  const r = await fetchVerified({ symbol, kind: sources[0].kind, fetchImpl, cache, sources });
  // asOf/source/kind aggiunti (additivo, non tocca i campi esistenti): senza
  // questi il risultato non può viaggiare sulla mesh via knowledge-relay.js,
  // che ne ha bisogno per decidere provenienza e freschezza — prima si
  // fermavano qui e la staffetta dei dati macro non poteva esistere.
  return {
    series: r.prices || [], verified: r.verified, note: r.note, affidabile: trainingEligible(r),
    asOf: r.asOf, source: r.source, symbol, kind: sources[0].kind,
  };
}

// ── Catena di fallback multi-fonte (2026-08-25) ──
// PROBLEMA REALE TROVATO integrando OECD/Eurostat in sources.js: nonostante
// il registro avesse 4+ fonti macro (ecb/bis/oecd/eurostat/fred), l'UNICO
// punto di consumo reale (ensureMacroContext in main.js) chiamava sempre e
// solo `fetchMacroSeries()` coi default — cioè SOLO ECB, senza fallback. Se
// ECB è irraggiungibile (rete che blocca l'endpoint, manutenzione, rate
// limit), Momentum restava senza contesto macro anche se BIS/OECD erano
// perfettamente raggiungibili. Ogni fonte ha il proprio formato di
// simbolo/dataflow (non intercambiabili: una serie BCE non è una serie
// OCSE) — si prova nell'ordine dichiarato, la prima che risponde con dati
// plausibili vince, mai un crash, sempre dichiarato chi ha risposto.
export const CATENA_MACRO_DEFAULT = [
  { sourceId: 'ecb', symbol: 'FM/D.U2.EUR.4F.KR.MRR_FR.LEV', label: 'il tasso di riferimento BCE' },
  { sourceId: 'bis', symbol: 'WS_CBPOL', label: 'il tasso di policy (BIS)' },
  // VERIFICATO dal vivo in un vero browser il 2026-08-25 (200 OK, CSV reale
  // con TIME_PERIOD/OBS_VALUE) — tasso di disoccupazione USA, copertura
  // globale non solo area euro, utile quando ECB/BIS non rispondono.
  { sourceId: 'oecd', symbol: 'OECD.SDD.TPS,DSD_LFS@DF_IALFS_UNE_M,1.0/USA..._Z.Y._T.Y_GE15..M', label: 'il tasso di disoccupazione USA (OCSE)' },
];

export async function fetchMacroSeriesConFallback(catena = CATENA_MACRO_DEFAULT, { fetchImpl, cache } = {}) {
  const tentativi = [];
  for (const passo of catena) {
    const r = await fetchMacroSeries({ sourceId: passo.sourceId, symbol: passo.symbol, fetchImpl, cache });
    tentativi.push({ sourceId: passo.sourceId, verified: r.verified, note: r.note });
    if (r.affidabile && r.series.length) return { ...r, label: passo.label, tentativi };
  }
  // Tutte le fonti hanno fallito: dichiarato, mai un dato inventato.
  return { series: [], verified: 'nessuna-fonte-raggiungibile', affidabile: false, tentativi, label: null };
}

// ── Cache di sessione condivisa (sync in lettura) ──
// mercato-qa.js:rispostaSincrona (usata dalla chat) è per design SINCRONA —
// non può aspettare una fetch di rete mentre risponde a "è stato il settore
// o NVDA?". Questa cache, popolata la prima volta che QUALCUNO la scalda
// (tipicamente main.js, alla Dashboard/grafo causale — vedi
// scaldaContestoMacroCondiviso), rende il contesto macro leggibile
// SINCRONAMENTE da lì in poi. Se non è ancora calda: si dichiara "non
// disponibile ora", mai un dato inventato per riempire il vuoto.
let _cacheCondivisaMacro = null;
export function contestoMacroSeGiaCaldo() { return _cacheCondivisaMacro; }
export async function scaldaContestoMacroCondiviso({ fetchImpl, cache } = {}) {
  if (_cacheCondivisaMacro) return _cacheCondivisaMacro;
  const r = await fetchMacroSeriesConFallback(undefined, { fetchImpl, cache });
  // asOf/verified/source portati con sé (non solo series/label): servono a
  // chi condivide questo contesto via mesh (packForRelay li richiede tutti,
  // vedi src/mesh/knowledge-relay.js) — senza, la staffetta fallirebbe in
  // silenzio per un pacchetto sempre scartato.
  if (r.affidabile && r.series.length) _cacheCondivisaMacro = { series: r.series, label: r.label, verified: r.verified, asOf: r.asOf, source: r.source };
  return _cacheCondivisaMacro;
}
