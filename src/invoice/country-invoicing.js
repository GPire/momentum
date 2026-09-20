// ============================================================
// COUNTRY INVOICING — profili di calcolo e documento
// ============================================================
// Il profilo italiano prepara i calcoli e il documento, non la trasmissione
// o la conservazione fiscale. Aggiungere un profilo non implementa gli obblighi
// di un nuovo Paese: servono regole, tracciati e verifiche dedicati.
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
      'Copia di cortesia: non attesta la trasmissione o l\'esito dello SdI.',
      'Quando obbligatoria, l\'emissione elettronica richiede l\'invio allo SdI e la verifica dell\'esito.',
    ],
  },
  // Profilo generico: IVA configurabile, requisiti nazionali non verificati.
  // eInvoiceMandatory=false non certifica l'assenza di obblighi nel Paese.
  // BUG REALE corretto: locale='en' ma il testo era in italiano — un cliente
  // fuori Italia riceveva un disclaimer che non poteva leggere. Ora il testo
  // segue davvero la lingua dichiarata.
  DEFAULT: {
    name: 'Internazionale', currency: 'EUR', locale: 'en', invoiceWord: 'Invoice',
    vatDefault: 0.0, defaultRitenuta: 0.0, defaultCassa: 0.0, bollo: false,
    eInvoiceMandatory: false,
    disclaimerLines: [
      'Prepared document: country-specific invoicing requirements are not verified.',
      'Check your country\'s tax obligations with your accountant.',
    ],
  },
};

export function invoiceCountry(code) {
  const key = String(code || '').trim().toUpperCase();
  return Object.hasOwn(COUNTRIES, key) ? COUNTRIES[key] : COUNTRIES.DEFAULT;
}

// Elenco dei Paesi selezionabili (per la UI). L'Italia prima; il resto usa il
// profilo internazionale finché non viene mappato specificamente.
export function selectableCountries() {
  return [
    { code: 'IT', name: COUNTRIES.IT.name, mapped: true },
    { code: 'DEFAULT', name: COUNTRIES.DEFAULT.name + ' (altri Paesi)', mapped: false },
  ];
}
