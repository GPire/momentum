// ============================================================
// DATA FRESHNESS — l'app che sa (e dice) quanto sono vecchi i suoi dati
// ============================================================
// Il problema che risolve: se passano mesi senza una nuova versione di
// Momentum, oggi le aliquote fiscali, il tracciato XML e i parametri storici
// di mercato restano fermi a quando sono stati generati — SENZA che nessuno,
// utente o codice, se ne accorga. Un numero vecchio mostrato come fresco è
// peggio di nessun numero: dà sicurezza falsa.
//
// L'infrastruttura di fiducia esiste già (core/update-locator.js: manifest
// firmati ECDSA, posizioni a epoche, propagazione via mesh con
// `peerManifests`; predict/tax-rules.js e invoice/fatturapa-format.js hanno
// già `fetchXUpdate`/`validateXPayload`). Quello che manca è l'AUTONOMIA:
// decidere DA SOLI quando controllare, e dichiarare l'età di ogni fonte
// invece di fingere che sia sempre aggiornata.
//
// Tre pezzi:
//  1. `assessFreshness` — per ogni fonte dichiarata, quanti giorni sono
//     passati e se è ancora nel suo periodo di validità dichiarato. Mai un
//     giudizio sulla fonte in sé (quello lo fa il chiamante): solo l'età.
//  2. `scheduleChecks` — quali fonti controllare ORA, in che ordine, con un
//     budget di richieste per non sprecare rete/batteria. La priorità non è
//     "chi è più vecchia": è "chi COSTA di più se resta vecchia" — una
//     scadenza fiscale vicina alza la priorità delle regole fiscali, non del
//     prezzo del Bitcoin.
//  3. `nextBackoff` — se una fonte non risponde, quanto aspettare prima di
//     riprovare (esponenziale, con tetto): niente martellamento su una fonte
//     irraggiungibile.
//
// Funzioni PURE, nessuna rete, nessun DOM, tempo iniettabile.
'use strict';

const DAY_MS = 86_400_000;

// Un giorno prima della scadenza dichiarata l'urgenza è già massima: un
// "fresh:false" scoperto il giorno stesso non lascia margine per rimediare.
const MARGINE_URGENZA_GIORNI = 14;

// ── 1. Età di ogni fonte ──
// `sources`: [{ id, label, generatedAt, maxAgeDays, priority? }]
// `priority` (0..1, default 0.5): quanto costa avere QUESTA fonte vecchia,
// dichiarato dal chiamante — le regole fiscali vicino a una scadenza contano
// più del prezzo di un asset che l'utente guarda per curiosità.
export function assessFreshness(sources = [], now = Date.now()) {
  return sources.map((s) => {
    const generatedAt = new Date(s.generatedAt).getTime();
    if (!Number.isFinite(generatedAt)) {
      return { id: s.id, label: s.label, ageDays: null, stale: null, messaggio: `${s.label}: data di generazione sconosciuta.` };
    }
    const ageDays = Math.floor((now - generatedAt) / DAY_MS);
    const maxAge = Number.isFinite(s.maxAgeDays) ? s.maxAgeDays : 90;
    const stale = ageDays > maxAge;
    const moltoVecchio = ageDays > maxAge * 2;
    return {
      id: s.id,
      label: s.label,
      ageDays,
      maxAgeDays: maxAge,
      stale,
      // Forma invariante apposta: "fermo/ferma/fermi/ferme" dipenderebbe dal
      // genere e numero dell'etichetta (che qui è un testo libero passato
      // dal chiamante) — un aggettivo concordato a caso è un errore di
      // lingua vero, trovato dai test. "Ultimo aggiornamento: N giorni fa"
      // funziona qualunque sia il nome della fonte.
      messaggio: stale
        ? `${s.label} non si aggiorna da ${ageDays} giorni${moltoVecchio ? ' (parecchio oltre il normale)' : ''}.`
        : `${s.label}: ultimo aggiornamento ${ageDays} ${ageDays === 1 ? 'giorno' : 'giorni'} fa.`,
    };
  });
}

// Riassunto in una frase, per una barra di stato o un pannello impostazioni.
export function freshnessSummary(assessed = []) {
  const vecchie = assessed.filter((a) => a.stale);
  if (!assessed.length) return 'Nessuna fonte dati da controllare.';
  if (!vecchie.length) return 'Tutti i dati sono aggiornati.';
  const peggiore = [...vecchie].sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0))[0];
  return vecchie.length === 1
    ? `${peggiore.label} non si aggiorna da ${peggiore.ageDays} giorni.`
    : `${vecchie.length} fonti su ${assessed.length} non si aggiornano da un po' (la più vecchia: ${peggiore.label}, ${peggiore.ageDays} giorni fa).`;
}

// ── 2. Cosa controllare ora, in che ordine ──
// Non "le più vecchie prime": le più URGENTI prime. Urgenza = età relativa al
// proprio limite × priorità dichiarata, con un bonus per chi ha una scadenza
// dichiarata (`dueInDays`) vicina — è la differenza tra ignorare che le
// regole fiscali sono ferme a luglio con l'acconto di novembre alle porte, e
// scoprirlo il giorno stesso.
export function scheduleChecks(sources = [], { now = Date.now(), budget = 3 } = {}) {
  const assessed = assessFreshness(sources, now);
  const byId = new Map(sources.map((s) => [s.id, s]));

  const scored = assessed.map((a) => {
    const s = byId.get(a.id) || {};
    const priority = Number.isFinite(s.priority) ? s.priority : 0.5;
    const relEta = a.ageDays === null ? 1 : Math.min(2, a.ageDays / Math.max(1, a.maxAgeDays));
    const urgenzaScadenza = Number.isFinite(s.dueInDays) && s.dueInDays <= MARGINE_URGENZA_GIORNI
      ? (MARGINE_URGENZA_GIORNI - s.dueInDays) / MARGINE_URGENZA_GIORNI
      : 0;
    // Il peso 3 non è arbitrario: relEta*priority arriva al massimo a 2*1=2
    // (età doppia del limite, priorità massima). Una scadenza reale vicina
    // deve poter SUPERARE anche il caso peggiore di "dati vecchi generici" —
    // trovato dai test: senza questo peso, una fonte di mercato ferma da
    // mesi (ma innocua) batteva le regole fiscali con l'acconto tra 5 giorni.
    const PESO_SCADENZA = 3;
    const score = relEta * priority + urgenzaScadenza * PESO_SCADENZA;
    return { id: a.id, label: a.label, score: +score.toFixed(3), motivo: urgenzaScadenza > 0 ? 'scadenza vicina' : (a.stale ? 'dati vecchi' : 'controllo di routine') };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(0, budget));
}

// ── 3. Attesa prima di riprovare una fonte che non risponde ──
// Esponenziale con tetto e jitter (evita che molti dispositivi riprovino
// tutti nello stesso istante, sovraccaricando la fonte proprio mentre torna
// su). `randomFn` iniettabile per test deterministici.
export function nextBackoff(tentativi, { baseMs = 60_000, maxMs = 6 * 3600_000, randomFn = Math.random } = {}) {
  const n = Math.max(1, Math.floor(tentativi));
  const base = Math.min(maxMs, baseMs * 2 ** (n - 1));
  const jitter = 0.75 + randomFn() * 0.5;
  return Math.round(base * jitter);
}

// ── Verdetto per l'utente: dati onesti anche quando tutto tace da mesi ──
// Usato dove un numero calcolato da una fonte STATICA viene mostrato (es. la
// tabella "Strategia 10 anni" da measured-assumptions.js): non impedisce di
// mostrare il numero, ma dice da quando è fermo, sempre nella stessa frase.
export function stalenessNote(generatedAt, { now = Date.now(), maxAgeDays = 90, label = 'Questi dati' } = {}) {
  const a = assessFreshness([{ id: 'x', label, generatedAt, maxAgeDays }], now)[0];
  if (a.ageDays === null) return null;
  if (!a.stale) return null;
  return a.messaggio;
}
