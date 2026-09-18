// ============================================================
// TARIFFE RIMBORSO CHILOMETRICO — per Paese, dati puri (mai un calcolo qui)
// ============================================================
// Stesso principio di trip-perdiem-rates.js: la formula (distanza × tariffa)
// vive in trip-mileage.js, qui SOLO i numeri con fonte e data. Gap reale
// trovato il 2026-09-18: Momentum non aveva NESSUNA voce per l'uso
// dell'auto propria in trasferta — una delle spese più comuni per chi
// viaggia per lavoro, e Concur/Expensify la calcolano in automatico da anni.
'use strict';

// Germania — Kilometerpauschale per trasferte di lavoro, Bundesreisekostengesetz
// §5. Verificato su più fonti professionali indipendenti concordanti
// 2026-09-18: 0,30€/km per l'auto, INVARIATO dal 2025 (fonte primaria BRKG
// non raggiunta via fetch automatico, come già capitato per la diaria —
// stessa disciplina: numero triangolato, non da un'unica fonte). Copre
// benzina, usura, tassa di circolazione, assicurazione; parcheggi/pedaggi
// restano voci separate con giustificativo (non qui).
export const TARIFFA_KM_GERMANIA_2026 = Object.freeze({ unita: 'km', tariffa: 0.30 });

// USA — IRS standard mileage rate, uso business. Verificato su fonte
// PRIMARIA (irs.gov/newsroom, comunicato ufficiale, fetch diretto
// 2026-09-18): 72,5¢/miglio, valido dal 1° gennaio 2026, NESSUN
// cambiamento a metà anno (alcune fonti secondarie riportavano un salto a
// 76¢ dal 1° luglio — verificato e SCARTATO: il comunicato IRS stesso non
// lo conferma, e l'IRS storicamente fissa una tariffa annuale unica).
export const TARIFFA_KM_USA_2026 = Object.freeze({ unita: 'mi', tariffa: 0.725 });

// Regno Unito — HMRC Approved Mileage Allowance Payments (AMAP), anno
// fiscale 2026/27 (dal 6 aprile 2026). Verificato su fonte PRIMARIA
// (gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027, fetch
// diretto 2026-09-18): 55p/miglio per le prime 10.000 miglia di lavoro
// nell'anno fiscale, poi 25p/miglio — la tariffa più alta in oltre 13 anni
// (prima era 45p). LIMITE DICHIARATO: qui è applicata SOLO la tariffa da
// 55p — la soglia delle 10.000 miglia/anno fiscale richiederebbe
// accumulare i km di OGNI trasferta della stessa persona nell'intero anno
// fiscale britannico, cosa che Momentum non traccia oggi (le trasferte
// sono indipendenti). Un utente che supera davvero 10.000 miglia/anno in
// auto propria per lavoro riceverebbe qui una stima leggermente più alta
// del dovuto sul chilometraggio eccedente — dichiarato in automatico
// nell'interfaccia, mai nascosto.
export const TARIFFA_KM_UK_2026 = Object.freeze({ unita: 'mi', tariffa: 0.55 });

// Italia: deliberatamente NON coperta. Il rimborso chilometrico italiano
// (tabelle ACI) non è una tariffa fissa per Paese come Germania/USA/UK: varia
// per modello e cilindrata dell'auto specifica, con tabelle ACI aggiornate
// ogni anno — richiederebbe un database di migliaia di modelli auto, un
// cantiere a parte, non un numero singolo da dichiarare qui onestamente.

export const TARIFFA_KM_PER_PAESE = Object.freeze({
  DE: TARIFFA_KM_GERMANIA_2026,
  US: TARIFFA_KM_USA_2026,
  UK: TARIFFA_KM_UK_2026,
});
