// ============================================================
// ISO 4217 — elenco canonico delle valute, condiviso da import e display
// ============================================================
// Prima di questo file la lista dei codici riconosciuti viveva SOLO dentro
// pdf-parser.js (23 valute, quasi tutte europee/nordamericane) — un
// utente in Nigeria, Indonesia, Kenya o Vietnam avrebbe visto le proprie
// transazioni scartate all'import esattamente come succedeva prima del
// fix per sterline/yen/franchi (stesso bug, stessa causa: un codice non in
// lista). Qui la lista è ~150 valute attive nel mondo — non un'invenzione,
// è lo standard ISO 4217 in uso corrente. Un SOLO punto di verità: import
// (pdf-parser.js, cosa riconoscere) e display (constants.js, come
// formattarlo) leggono da qui, mai due elenchi che possono divergere.
'use strict';

export const VALUTE_ISO4217 = new Set([
  // Europa
  'EUR', 'GBP', 'CHF', 'NOK', 'SEK', 'DKK', 'ISK', 'PLN', 'CZK', 'HUF',
  'RON', 'BGN', 'HRK', 'RSD', 'MKD', 'ALL', 'BAM', 'MDL', 'UAH', 'BYN',
  'RUB', 'GEL', 'AZN', 'AMD', 'TRY',
  // Nord America
  'USD', 'CAD', 'MXN',
  // America Centrale e Caraibi
  'GTQ', 'BZD', 'HNL', 'NIO', 'CRC', 'PAB', 'CUP', 'DOP', 'HTG', 'JMD',
  'TTD', 'BBD', 'BSD', 'KYD', 'XCD', 'AWG', 'ANG',
  // Sud America
  'BRL', 'ARS', 'CLP', 'COP', 'PEN', 'BOB', 'PYG', 'UYU', 'VES', 'GYD', 'SRD',
  // Asia orientale
  'JPY', 'CNY', 'KRW', 'KPW', 'HKD', 'TWD', 'MOP', 'MNT',
  // Sud-est asiatico
  'IDR', 'MYR', 'SGD', 'THB', 'VND', 'PHP', 'MMK', 'KHR', 'LAK', 'BND',
  // Asia meridionale
  'INR', 'PKR', 'BDT', 'LKR', 'NPR', 'BTN', 'MVR', 'AFN',
  // Asia centrale
  'KZT', 'UZS', 'KGS', 'TJS', 'TMT',
  // Medio Oriente
  'ILS', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'LBP', 'SYP',
  'IQD', 'IRR', 'YER',
  // Oceania
  'AUD', 'NZD', 'FJD', 'PGK', 'SBD', 'TOP', 'VUV', 'WST', 'XPF',
  // Africa settentrionale
  'EGP', 'LYD', 'TND', 'DZD', 'MAD',
  // Africa occidentale
  'NGN', 'GHS', 'XOF', 'GMD', 'GNF', 'SLE', 'LRD', 'CVE', 'MRU',
  // Africa centrale
  'XAF', 'CDF', 'AOA', 'STN',
  // Africa orientale
  'KES', 'TZS', 'UGX', 'RWF', 'BIF', 'ETB', 'ERN', 'DJF', 'SOS', 'SSP', 'SDG',
  // Africa australe
  'ZAR', 'ZMW', 'ZWL', 'MWK', 'MZN', 'BWP', 'NAD', 'LSL', 'SZL', 'MGA', 'MUR', 'SCR', 'KMF',
]);

// Simboli Unicode REALMENTE assegnati (nessuno inventato) a più di una
// valuta: dove il simbolo non basta a distinguere ("$" per USD/CAD/AUD/...,
// "¥" per JPY/CNY) si sceglie il default più diffuso, dichiarato — un
// codice ISO esplicito nel testo ha SEMPRE precedenza (vedi detectCurrency
// in pdf-parser.js) e risolve l'ambiguità quando presente.
//
// "R$" (real brasiliano) va PRIMA di "$" nell'ordine delle chiavi: è un
// simbolo di DUE caratteri che CONTIENE "$" come sottostringa — un testo
// come "R$ 50,00" (verificato: è la notazione reale del Nubank, vedi
// notification-parser.js) altrimenti veniva riconosciuto come "$" da solo,
// cioè USD invece di BRL. BUG REALE trovato aggiungendo il pattern PIX.
export const SIMBOLO_VALUTA = {
  'R$': 'BRL',
  '€': 'EUR', '$': 'USD', '£': 'GBP', '¥': 'JPY', '₹': 'INR', '₩': 'KRW',
  '₪': 'ILS', '₽': 'RUB', '₺': 'TRY', '₫': 'VND', '₴': 'UAH', '₦': 'NGN',
  '₱': 'PHP', '₡': 'CRC', '₲': 'PYG', '₮': 'MNT', '₭': 'LAK', '฿': 'THB',
  '₸': 'KZT', '₾': 'GEL', '₼': 'AZN', '₵': 'GHS',
};

// Suggerimento di locale per la formattazione (Intl.NumberFormat) — solo
// per le valute dove la convenzione locale conta davvero (decimali,
// separatore delle migliaia, posizione del simbolo). Per qualunque valuta
// NON in questa tabella il chiamante ricade su `undefined` (locale di
// sistema): Intl.NumberFormat formatta comunque in modo corretto per quel
// codice, solo con una convenzione meno "su misura" — mai un crash, mai
// una cifra sbagliata, solo uno stile di virgole/punti meno rifinito.
export const LOCALE_PER_VALUTA = {
  EUR: 'it-IT', USD: 'en-US', GBP: 'en-GB', JPY: 'ja-JP', CHF: 'de-CH',
  CAD: 'en-CA', AUD: 'en-AU', CNY: 'zh-CN', SEK: 'sv-SE', NOK: 'nb-NO',
  DKK: 'da-DK', PLN: 'pl-PL', CZK: 'cs-CZ', HUF: 'hu-HU', MXN: 'es-MX',
  BRL: 'pt-BR', INR: 'en-IN', KRW: 'ko-KR', SGD: 'en-SG', HKD: 'en-HK',
  NZD: 'en-NZ', ZAR: 'en-ZA', TRY: 'tr-TR', RUB: 'ru-RU', IDR: 'id-ID',
  THB: 'th-TH', VND: 'vi-VN', PHP: 'en-PH', MYR: 'ms-MY', AED: 'ar-AE',
  SAR: 'ar-SA', ILS: 'he-IL', EGP: 'ar-EG', NGN: 'en-NG', KES: 'en-KE',
  PKR: 'en-PK', BDT: 'bn-BD', UAH: 'uk-UA', ARS: 'es-AR', CLP: 'es-CL',
  COP: 'es-CO', PEN: 'es-PE',
};
