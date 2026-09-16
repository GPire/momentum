// ============================================================
// TARIFFE DIARIA PASTI — per Paese, dati puri (mai un calcolo qui)
// ============================================================
// La formula (ore, giorni pieni/ridotti, riduzioni per pasti offerti) vive
// in trip-period.js, che dichiara esplicitamente di non contenere nessuna
// tariffa ("la tariffa la fornisce chi chiama"). Qui SOLO i numeri, con
// fonte e data — stesso principio già in uso per tax.js/tax-ch.js/tax-es.js
// (fisco separato per Paese, mai una formula indovinata).
'use strict';

// Verpflegungsmehraufwand, Germania, trasferte domestiche 2026 — invariate
// dal 2020, verificate 2026-09-14: fonte primaria BMF (glossario ufficiale,
// bundesfinanzministerium.de/Content/DE/Glossareintraege/V/
// verpflegungsmehraufwendungen.html) per la struttura a soglie orarie;
// cifre esatte triangolate su più fonti professionali indipendenti e
// concordanti (il PDF del 5/12/2025 con la tabella non è leggibile via
// fetch automatico, solo la pagina di annuncio). 14€ per assenza fra 8 e 24
// ore, o per il giorno di arrivo/partenza di una trasferta con pernotto
// (indipendentemente dalle ore effettive quel giorno); 28€ per ogni giorno
// intero (24h) di assenza. Riduzione per pasto offerto: 20% colazione, 40%
// pranzo, 40% cena, sempre sulla quota PIENA — già calcolata da
// trip-period.js via RIDUZIONE_PASTO, non ripetuta qui.
export const TARIFFE_GERMANIA_2026 = Object.freeze({ piena: 28, ridotta: 14 });
