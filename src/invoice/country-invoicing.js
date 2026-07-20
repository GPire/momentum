// ============================================================
// COUNTRY INVOICING — architettura pronta per ogni mercato (v10)
// ============================================================
// L'Italia è l'implementazione COMPLETA e corretta; la struttura è pronta per
// l'espansione: aggiungere un Paese = aggiungere una entry qui (IVA di default,
// obbligo e-fattura, valuta, disclaimer, parole), senza rifare la logica.
// Onestà (regola #1): i valori sono reali e dichiarati; per i Paesi non ancora
// mappati si usa un profilo INTERNAZIONALE prudente (IVA configurabile, nessuna
// ritenuta/cassa assunta) — mai numeri inventati specifici di un Paese.
// Funzioni pure, nessun DOM.
'use strict';

// Profilo per Paese (ISO 3166-1 alpha-2). eInvoiceMandatory = la fattura fiscale
// ufficiale è solo elettronica (come l'Italia con lo SdI) → il PDF è copia di
// cortesia. defaultRitenuta/Cassa/Bollo: usi tipici del Paese (0 = non applicati
// di default).
export const COUNTRIES = {
  IT: {
    name: 'Italia', currency: 'EUR', locale: 'it-IT', invoiceWord: 'Fattura',
    vatDefault: 0.22, defaultRitenuta: 0.20, defaultCassa: 0.04, bollo: true,
    eInvoiceMandatory: true,
    disclaimerLines: [
      'Documento fattura con calcoli corretti: valido per la contabilita\' del cliente.',
      'In Italia la fattura fiscale va emessa via SdI (elettronica): qui e\' una copia di cortesia.',
    ],
  },
  // Profilo INTERNAZIONALE di default (Paesi non ancora mappati): il PDF è una
  // fattura-documento valida dove non c'è obbligo di e-fattura; IVA configurabile.
  DEFAULT: {
    name: 'Internazionale', currency: 'EUR', locale: 'en', invoiceWord: 'Fattura / Invoice',
    vatDefault: 0.0, defaultRitenuta: 0.0, defaultCassa: 0.0, bollo: false,
    eInvoiceMandatory: false,
    disclaimerLines: [
      'Documento fattura con calcoli corretti, valido come fattura dove non e\' obbligatoria la fattura elettronica.',
      'Verifica gli obblighi fiscali del tuo Paese col commercialista.',
    ],
  },
};

export function invoiceCountry(code) {
  return COUNTRIES[String(code || '').toUpperCase()] || COUNTRIES.DEFAULT;
}

// Elenco dei Paesi selezionabili (per la UI). L'Italia prima; il resto usa il
// profilo internazionale finché non viene mappato specificamente.
export function selectableCountries() {
  return [
    { code: 'IT', name: COUNTRIES.IT.name, mapped: true },
    { code: 'DEFAULT', name: COUNTRIES.DEFAULT.name + ' (altri Paesi)', mapped: false },
  ];
}
