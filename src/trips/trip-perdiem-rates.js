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

// GSA (General Services Administration), tasso CONUS standard FY2026
// (1 ottobre 2025 - 30 settembre 2026), verificato su fonte primaria
// (gsa.gov/travel/plan-book/per-diem-rates, comunicato 2025-08-15) e
// triangolato su fonti professionali indipendenti concordanti 2026-09-18:
// $178/giorno totali = $110 alloggio + $68 M&IE (Meals & Incidental
// Expenses). LIMITE DICHIARATO: questo è il tasso STANDARD, valido per la
// stragrande maggioranza delle contee USA — circa 300 "Non-Standard Areas"
// (grandi città: New York, San Francisco, Boston...) hanno un tasso più
// alto specifico per contea, NON coperto qui (richiederebbe la tabella
// completa per contea/mese, un cantiere separato). Regola "primo/ultimo
// giorno" GSA: 75% della quota piena ($68 × 0,75 = $51) — coincide per
// struttura con giorniRidotti/giorniPieni già scritti per la Germania in
// trip-period.js (stesso modello: giorno di transito ridotto, giorni
// intermedi pieni), zero modifiche alla formula servite.
export const TARIFFE_USA_2026 = Object.freeze({ piena: 68, ridotta: 51 });

// HMRC (Regno Unito), benchmark scale rates per la sussistenza —
// verificate su fonte primaria (gov.uk/hmrc-internal-manuals/
// employment-income-manual/eim30240, consultata 2026-09-18): £5 per 5-10
// ore di assenza (un pasto), £10 per 10-15 ore (due pasti), £25 per 15+ ore
// O se il viaggio prosegue oltre le 20:00 (in quel caso è ammesso anche un
// supplemento di £10 sopra la quota da £5/£10 — QUI NON CALCOLATO, limite
// dichiarato: servirebbe sapere se il rientro è avvenuto dopo le 20:00 di
// quel giorno specifico, dato che Momentum non traccia ancora esplicitamente
// per ogni singolo giorno di una trasferta multi-giorno).
//
// STRUTTURA DIVERSA da Germania/USA (non riusa {piena,ridotta}): l'HMRC
// paga per GIORNO in base alle ore di assenza QUEL giorno specifico, non
// per posizione nel viaggio (primo/ultimo/intermedio) — un viaggio di 5
// giorni con lo stesso orario di partenza/rientro ogni giorno avrebbe comunque
// bisogno delle ore EFFETTIVE di ciascun giorno, calcolate in
// oreAssenzaPerGiorno/diariaRegnoUnito (trip-period.js). Nessuna riduzione
// per pasto offerto: il benchmark rate HMRC presume un costo reale
// sostenuto, non un pasto forfettario indipendente dai pasti veri come la
// diaria tedesca — dichiarato, non implementato.
export const TARIFFE_REGNO_UNITO_2026 = Object.freeze({ cinqueOre: 5, dieciOre: 10, quindiciOre: 25 });

// Riduzione per pasto offerto, GSA: a differenza della Germania (percentuali
// fisse indipendenti dall'importo), il GSA pubblica un importo in DOLLARI
// per pasto dentro la quota M&IE di $68 — breakfast $16, lunch $19, dinner
// $28, incidentals $5 (16+19+28+5=68, verificato). Qui espresse come
// FRAZIONE della quota piena (16/68, 19/68, 28/68) per restare compatibili
// con riduzioniPerPastiOfferti (trip-period.js), che lavora per percentuale
// — mai i $16/$19/$28 applicati alla quota RIDOTTA di $51, sarebbe sbagliato
// (il GSA riduce sempre sulla quota piena, stessa regola tedesca). Le tre
// frazioni sommano a 63/68, MAI a 1: i $5 di incidentals non sono un pasto
// e restano sempre dovuti, anche se colazione/pranzo/cena sono tutti offerti.
export const RIDUZIONE_USA_2026 = Object.freeze({ colazione: 16 / 68, pranzo: 19 / 68, cena: 28 / 68 });
