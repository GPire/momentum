// Errori che arrivano all'utente: il messaggio italiano resta (log, test), il
// codice e i parametri permettono all'interfaccia di mostrarli nella lingua
// scelta (chiave `err_<codice>` in src/i18n/ui-strings.js).
'use strict';

export function codedError(code, params, message) {
  const e = new Error(message);
  e.code = code;
  e.params = params || [];
  return e;
}
