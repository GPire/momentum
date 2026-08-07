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
function correlaConMacro(residuo, macroAllineato) {
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
