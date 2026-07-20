// ============================================================
// TAX RULES — regole fiscali VERSIONATE e per ANNO D'IMPOSTA (v10)
// ============================================================
// Risposta onesta a "l'app deve ricevere aggiornamenti su regole/ATECO e
// aggiornarsi", nel rispetto del 100% on-device (nessun server): le regole
// sono DATI versionati per anno. Un commercialista applica le regole dell'anno
// pertinente (il tetto forfettario era 65.000€ fino al 2022, 85.000€ dal 2023;
// le aliquote cambiano con la legge di bilancio). Quando la legge cambia, si
// aggiorna QUESTO file → si propaga con l'aggiornamento dell'app, e l'app
// applica AUTOMATICAMENTE le regole dell'anno giusto a ogni calcolo.
// Onestà (regola #1): valori reali e datati, mai inventati; aggiornabili.
'use strict';

// Versione del set di regole — cambia a ogni aggiornamento normativo.
export const TAX_RULES_VERSION = '2026-07';

// Regole per anno d'imposta. Si aggiunge una entry SOLO quando i valori
// cambiano davvero; per gli anni intermedi vale l'ultima entry <= anno.
export const TAX_RULES = {
  2019: { forfettarioCeiling: 65000, impostaStd: 0.15, impostaStartup: 0.05, startupAnni: 5, inpsGestioneSeparata: 0.2607 },
  2023: { forfettarioCeiling: 85000, impostaStd: 0.15, impostaStartup: 0.05, startupAnni: 5, inpsGestioneSeparata: 0.2607 },
};

// Ritorna le regole applicabili a un anno: l'ultima entry con anno <= richiesto.
// Così un anno futuro senza entry dedicata eredita l'ultima nota (comportamento
// prudente e prevedibile), e appena esce la nuova legge basta aggiungere l'anno.
export function rulesForYear(year = new Date().getFullYear()) {
  const anni = Object.keys(TAX_RULES).map(Number).sort((a, b) => a - b);
  let applicabile = anni[0];
  for (const y of anni) if (y <= year) applicabile = y;
  return { year: applicabile, requestedYear: year, ...TAX_RULES[applicabile] };
}
