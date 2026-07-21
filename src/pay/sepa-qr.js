// ============================================================
// SEPA TRANSFER — bonifico pronto da eseguire TU, 100% on-device (v10)
// ============================================================
// La risposta onesta a "muovere soldi davvero senza server/aggregatori": Momentum
// NON tocca la banca. Prepara il bonifico gia' compilato in due modi che l'utente
// esegue nella SUA app bancaria (dove e' gia' loggato e si autentica con la SCA):
//  1) payload EPC069-12 (lo standard del "QR di bonifico SEPA" che moltissime app
//     bancarie europee sanno leggere) → un tocco, il bonifico si apre precompilato;
//  2) fallback testuale copiabile (beneficiario/IBAN/importo/causale) dove il QR
//     non e' supportato.
// Nessun server, nessun intermediario, privacy on-device intatta; i soldi si
// muovono davvero ma li confermi SEMPRE tu in banca. Funzioni pure, nessun DOM.
// Onesta' (regola #1): validiamo l'IBAN con il checksum reale (mod-97), non a
// occhio; mai un bonifico con dati che la banca scarterebbe.
'use strict';

// IBAN: validazione con checksum ISO 7064 mod-97 (quella vera, non una regex).
export function isValidIBAN(iban) {
  const s = String(iban || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  // sposta le prime 4 cifre in coda, converti lettere in numeri (A=10..Z=35)
  const rearranged = s.slice(4) + s.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch >= 'A' && ch <= 'Z' ? (ch.charCodeAt(0) - 55).toString() : ch;
    for (const digit of code) remainder = (remainder * 10 + (+digit)) % 97;
  }
  return remainder === 1;
}

export function normalizeIBAN(iban) {
  return String(iban || '').replace(/\s+/g, '').toUpperCase();
}

// Importo SEPA: 0,01–999.999.999,99, formato "EUR12.34" (punto decimale, 2 cifre).
function formatSepaAmount(amount) {
  const n = Math.round((+amount + Number.EPSILON) * 100) / 100;
  if (!(n >= 0.01 && n <= 999999999.99)) return null;
  return 'EUR' + n.toFixed(2);
}

const clip = (s, max) => String(s || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);

// Costruisce il payload EPC069-12 (SCT = SEPA Credit Transfer). Ritorna
// { ok, payload, bytes, errors }. version '002' consente il BIC vuoto (SEPA).
// L'ordine dei campi e la loro lunghezza sono quelli dello standard: un payload
// fuori specifica non verrebbe letto dalle app bancarie.
export function buildEpcPayload({ name, iban, amount, remittance = '', bic = '', purpose = '', version = '002' } = {}) {
  const errors = [];
  const nm = clip(name, 70);
  const ib = normalizeIBAN(iban);
  if (!nm) errors.push('manca il nome del beneficiario');
  if (!isValidIBAN(ib)) errors.push('IBAN non valido (cifra di controllo errata o formato)');
  let amt = '';
  if (amount != null && amount !== '') {
    amt = formatSepaAmount(amount);
    if (!amt) errors.push('importo fuori dai limiti SEPA (0,01–999.999.999,99)');
  }
  const bicClean = clip(bic, 11).toUpperCase();
  if (version === '001' && !bicClean) errors.push('la versione 001 richiede il BIC (usa 002 per ometterlo)');

  // Campi nell'ordine EPC: ServiceTag, Version, CharSet(1=UTF-8), Id(SCT), BIC,
  // Name, IBAN, Amount, Purpose(4), Remittance strutturata, Remittance libera.
  const fields = [
    'BCD',
    version === '001' ? '001' : '002',
    '1',
    'SCT',
    bicClean,
    nm,
    ib,
    amt,
    clip(purpose, 4),
    '',                       // remittance strutturata (non usata)
    clip(remittance, 140),    // remittance libera (causale)
  ];
  // rimuovi solo i campi di coda vuoti (lo standard lo consente), mai quelli interni
  while (fields.length > 7 && fields[fields.length - 1] === '') fields.pop();
  const payload = fields.join('\n');
  const bytes = new TextEncoder().encode(payload).length;
  if (bytes > 331) errors.push('dati troppo lunghi per un QR SEPA (max 331 byte): accorcia nome/causale');

  return { ok: errors.length === 0, payload, bytes, errors, amountFormatted: amt || null };
}

// Fallback testuale copiabile dove il QR non e' supportato: chiaro e completo,
// cosi' l'utente compila il bonifico a mano in 10 secondi.
export function sepaFallbackText({ name, iban, amount, remittance = '' } = {}) {
  const eur = amount != null && amount !== '' ? `${(Math.round(+amount * 100) / 100).toFixed(2).replace('.', ',')} €` : '—';
  return [
    `Beneficiario: ${clip(name, 70) || '—'}`,
    `IBAN: ${normalizeIBAN(iban) || '—'}`,
    `Importo: ${eur}`,
    ...(remittance ? [`Causale: ${clip(remittance, 140)}`] : []),
  ].join('\n');
}
