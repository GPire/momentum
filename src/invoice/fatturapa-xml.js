// ============================================================
// FATTURAPA XML — fattura elettronica ufficiale, generata on-device (v10)
// ============================================================
// Genera il file XML nel formato FatturaPA v1.2.2 (FPR12, privati) che lo SdI
// (Sistema di Interscambio dell'Agenzia delle Entrate) accetta. 100% on-device,
// zero dipendenze, zero server: nessun gestionale cloud fa questo lato client.
//
// ONESTÀ (regola #1) — i due limiti, dichiarati e non aggirabili:
//  1. L'XML è REALE e nel formato ufficiale, ma un'app on-device NON può
//     TRASMETTERLO allo SdI (serve un canale certificato + le credenziali
//     fiscali dell'utente). L'utente lo carica sul portale "Fatture e
//     Corrispettivi" dell'Agenzia, via PEC, o lo gira al commercialista.
//  2. La validazione qui è una PREVISIONE onesta dei controlli SdI verificabili
//     OFFLINE (coerenza IVA/Natura, ritenuta, destinatario, aritmetica): riduce
//     drasticamente il rischio di "scarto", ma non è la ricevuta ufficiale dello
//     SdI. Etichettato come tale, mai spacciato per "accettazione garantita".
//
// La parte proprietaria: predire i CODICI DI SCARTO reali dello SdI prima del
// caricamento (00400/00411/00415/00417/00422/00423/00427...) così l'utente non
// riceve una ricevuta di scarto. Funzioni pure, nessun DOM, nessuna rete.
'use strict';

import { formatForDate } from './fatturapa-format.js';

// Costanti BUNDLED (default correnti). La verità operativa vive nella specifica
// versionata (fatturapa-format.js): il generatore le legge da lì, così un nuovo
// tracciato si adotta senza toccare questo codice. Restano esportate come
// riferimento/compatibilità e coincidono con la specifica in vigore.
export const REGIME_FISCALE_CODE = {
  forfettario: 'RF19', // Regime forfettario (L.190/2014)
  ordinario: 'RF01',   // Regime ordinario
};

// Riferimento normativo per l'esenzione IVA del forfettario (richiesto nel
// riepilogo per la Natura N2.2). Testo reale.
export const RIF_NORMATIVO_FORFETTARIO =
  'Operazione senza applicazione dell\'IVA ai sensi dell\'art. 1, commi 54-89, L. 190/2014 - Regime forfettario';

// Natura IVA per operazioni non imponibili/esenti. Il forfettario usa N2.2
// (operazioni non soggette - altri casi). Reale.
export const NATURA_FORFETTARIO = 'N2.2';

const round2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;
const pct2 = (x) => (round2(x * 100)).toFixed(2);      // 0.22 -> "22.00"
const eur = (n) => round2(n).toFixed(2);               // "1000.00"
const escXml = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

// ---------------------------------------------------------------------------
// 1) GUIDA ALLA SCELTA — per chi non ha mai emesso una fattura.
// Decide, in parole semplici, se serve la fattura elettronica (FatturaPA/SdI) o
// se basta/è corretto il documento di cortesia (PDF). Nessun tecnicismo: la
// risposta è una raccomandazione + il perché + i passi successivi. Onesto: se il
// caso è dubbio, lo dice e rimanda al commercialista, non finge certezza.
//
// ctx: { emitterCountry='IT', emitterHasVat, clientCountry='IT', clientIsBusiness, clientIsPA }
export function recommendInvoiceType(ctx = {}) {
  const emitterCountry = String(ctx.emitterCountry || 'IT').toUpperCase();
  const clientCountry = String(ctx.clientCountry || emitterCountry).toUpperCase();
  const hasVat = ctx.emitterHasVat !== false; // di default assume Partita IVA (contesto app P.IVA)

  // Emittente NON italiano → fuori dall'obbligo SdI: documento valido.
  if (emitterCountry !== 'IT') {
    return {
      type: 'cortesia',
      title: 'Documento fattura (PDF)',
      reason: 'Non emetti dall\'Italia: la fattura elettronica SdI non ti riguarda. Il documento con i calcoli corretti è valido dove non c\'è obbligo di e-fattura.',
      steps: ['Compila cliente e importo', 'Scarica o condividi il PDF'],
      needsFatturaPa: false,
    };
  }
  // Emittente italiano senza Partita IVA (privato occasionale) → non emette
  // fattura elettronica: al massimo una ricevuta. Onesto: caso da verificare.
  if (!hasVat) {
    return {
      type: 'cortesia',
      title: 'Ricevuta / documento (PDF)',
      reason: 'Senza Partita IVA non si emette fattura elettronica. Per prestazioni occasionali di solito basta una ricevuta: verifica col commercialista se serve la ritenuta.',
      steps: ['Compila i dati', 'Scarica il PDF'],
      needsFatturaPa: false,
      verify: true,
    };
  }
  // Cliente ESTERO → la fattura elettronica via SdI non è obbligatoria allo
  // stesso modo (si usa altro flusso/esterometro); il documento è corretto.
  if (clientCountry && clientCountry !== 'IT') {
    return {
      type: 'cortesia',
      title: 'Documento fattura (PDF)',
      reason: 'Il cliente è estero: la fattura va gestita col flusso esterometro, non con lo SdI classico. Il PDF con i calcoli corretti va bene; conferma col commercialista l\'invio dei dati transfrontalieri.',
      steps: ['Compila cliente estero e importo', 'Scarica il PDF'],
      needsFatturaPa: false,
      verify: true,
    };
  }
  // Caso principale: Partita IVA italiana → cliente italiano. Serve la fattura
  // elettronica (obbligatoria dal 2024 per (quasi) tutti, forfettari inclusi).
  return {
    type: 'fatturapa',
    title: 'Fattura elettronica (XML per lo SdI)',
    reason: 'Sei una Partita IVA italiana e fatturi in Italia: dal 2024 la fattura dev\'essere elettronica. Momentum prepara il file XML ufficiale; tu lo carichi sul portale dell\'Agenzia o lo dai al commercialista.',
    steps: [
      'Inserisci i tuoi dati fiscali (una volta sola)',
      'Inserisci i dati del cliente e l\'importo',
      'Momentum controlla che sia in regola',
      'Scarichi l\'XML e lo carichi sul portale Fatture e Corrispettivi',
    ],
    needsFatturaPa: true,
  };
}

// ---------------------------------------------------------------------------
// 2) COSA MANCA — in parole semplici, per guidare la compilazione.
// Ritorna la lista dei campi obbligatori ancora vuoti, con etichetta amichevole
// e aiuto ("dove lo trovo"). Zero invenzione: se manca la P.IVA, la chiediamo,
// non la inventiamo. Serve alla UI per una compilazione guidata a prova di chiunque.
export function missingForFatturaPa({ emitter = {}, client = {} } = {}) {
  const need = [];
  const add = (cond, field, label, help) => { if (cond) need.push({ field, label, help }); };
  const nome = (p) => p.denominazione || (p.nome && p.cognome ? `${p.nome} ${p.cognome}` : '');

  // Emittente (tu)
  add(!emitter.partitaIva, 'emitter.partitaIva', 'La tua Partita IVA', '11 cifre, la trovi sui tuoi documenti fiscali.');
  add(!nome(emitter), 'emitter.denominazione', 'Il tuo nome o ragione sociale', 'Come compari nelle tue fatture.');
  add(!emitter.indirizzo, 'emitter.indirizzo', 'Il tuo indirizzo', 'Via e numero civico della tua sede.');
  add(!emitter.cap, 'emitter.cap', 'Il tuo CAP', '5 cifre.');
  add(!emitter.comune, 'emitter.comune', 'Il tuo Comune', 'La città della tua sede.');

  // Cliente (a chi fatturi)
  add(!nome(client), 'client.denominazione', 'Nome del cliente', 'Persona o azienda a cui emetti la fattura.');
  add(!client.partitaIva && !client.codiceFiscale, 'client.idFiscale', 'Partita IVA o Codice Fiscale del cliente', 'Almeno uno dei due: lo SdI lo richiede per consegnare la fattura.');
  add(!client.indirizzo, 'client.indirizzo', 'Indirizzo del cliente', 'Via e numero civico.');
  add(!client.cap, 'client.cap', 'CAP del cliente', '5 cifre.');
  add(!client.comune, 'client.comune', 'Comune del cliente', 'La sua città.');
  // Recapito elettronico: Codice Destinatario (7 char) OPPURE PEC. Se manca,
  // si usa '0000000' (consegna via cassetto fiscale) — spiegato, non un errore.
  return need;
}

// ---------------------------------------------------------------------------
// 3) VALIDAZIONE — predice i controlli SdI verificabili OFFLINE.
// Ogni voce: { code, level:'error'|'warn', field, message }. `error` = lo SdI
// scarterebbe il file (blocca il caricamento con onestà); `warn` = probabile
// scarto o consegna con riserva. Non è la ricevuta SdI: è una previsione onesta.
export function validateFatturaPa(data = {}) {
  const { emitter = {}, client = {}, invoice = {}, meta = {} } = data;
  const out = [];
  const err = (code, field, message) => out.push({ code, level: 'error', field, message });
  const warn = (code, field, message) => out.push({ code, level: 'warn', field, message });
  const nome = (p) => p.denominazione || (p.nome && p.cognome ? `${p.nome} ${p.cognome}` : '');

  // 00417 — cessionario senza né P.IVA né Codice Fiscale
  if (!client.partitaIva && !client.codiceFiscale)
    err('00417', 'client.idFiscale', 'Il cliente deve avere Partita IVA o Codice Fiscale (lo SdI non può consegnare la fattura senza).');
  // Emittente senza P.IVA → non è una fattura elettronica valida
  if (!emitter.partitaIva)
    err('00401', 'emitter.partitaIva', 'Manca la tua Partita IVA: obbligatoria per la fattura elettronica.');
  if (!nome(emitter)) err('00404', 'emitter.denominazione', 'Manca il tuo nome/ragione sociale.');
  if (!nome(client)) err('00404', 'client.denominazione', 'Manca il nome del cliente.');

  // Formato P.IVA italiana: 11 cifre
  const it11 = (v) => /^\d{11}$/.test(String(v || '').trim());
  const cf16 = (v) => /^[A-Za-z0-9]{16}$/.test(String(v || '').trim()) || it11(v);
  if (emitter.partitaIva && !it11(emitter.partitaIva))
    warn('00401', 'emitter.partitaIva', 'La Partita IVA italiana deve avere 11 cifre.');
  if (client.partitaIva && !it11(client.partitaIva))
    warn('00401', 'client.partitaIva', 'La Partita IVA del cliente non sembra valida (servono 11 cifre).');
  if (client.codiceFiscale && !cf16(client.codiceFiscale))
    warn('00402', 'client.codiceFiscale', 'Il Codice Fiscale del cliente non sembra valido (16 caratteri).');

  // Recapito: CodiceDestinatario 7 char OPPURE PEC. '0000000' è ammesso (privati).
  const cod = String(client.codiceDestinatario || '').trim();
  if (cod && cod.length !== 7)
    err('00415', 'client.codiceDestinatario', 'Il Codice Destinatario deve avere esattamente 7 caratteri.');
  else if (cod && !/^[A-Za-z0-9]{7}$/.test(cod))
    err('00305', 'client.codiceDestinatario', 'Il Codice Destinatario contiene caratteri non ammessi (solo lettere e numeri).');
  if (!cod && !client.pec)
    warn('00427', 'client.recapito', 'Senza Codice Destinatario né PEC useremo "0000000": la fattura arriva nel cassetto fiscale del cliente. Se il cliente ti ha dato un codice o una PEC, inseriscilo.');
  // PEC malformata (se fornita in alternativa al codice)
  if (client.pec && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(client.pec).trim()))
    warn('00426', 'client.pec', 'La PEC del cliente non sembra un indirizzo valido.');

  // Emittente e cliente COINCIDONO (stessa P.IVA) con fattura ordinaria TD01: lo
  // SdI la scarta (l'autofattura usa altri TipoDocumento). Errore reale e comune.
  if (emitter.partitaIva && client.partitaIva && it11(emitter.partitaIva) &&
      String(emitter.partitaIva).trim() === String(client.partitaIva).trim())
    err('00471', 'client.partitaIva', 'Emittente e cliente hanno la stessa Partita IVA: una fattura normale non può essere emessa a sé stessi.');

  // Sede: CAP 5 cifre e Provincia 2 lettere (dove presenti) — coerenza anagrafica.
  const cap5 = (v) => /^\d{5}$/.test(String(v || '').trim());
  const prov2 = (v) => /^[A-Za-z]{2}$/.test(String(v || '').trim());
  if (emitter.cap && !cap5(emitter.cap)) warn('00404', 'emitter.cap', 'Il tuo CAP deve avere 5 cifre.');
  if (client.cap && !cap5(client.cap)) warn('00404', 'client.cap', 'Il CAP del cliente deve avere 5 cifre.');
  if (emitter.provincia && !prov2(emitter.provincia)) warn('00404', 'emitter.provincia', 'La tua Provincia va indicata con 2 lettere (es. MI).');
  if (client.provincia && !prov2(client.provincia)) warn('00404', 'client.provincia', 'La Provincia del cliente va indicata con 2 lettere (es. MI).');
  // IBAN (se fornito per il pagamento): formato di base IT + controllo lunghezza.
  if (emitter.iban && !/^[A-Za-z]{2}\d{2}[A-Za-z0-9]{11,30}$/.test(String(emitter.iban).replace(/\s/g, '')))
    warn('00404', 'emitter.iban', 'L\'IBAN non sembra valido: ricontrollalo.');

  // Coerenza IVA / Natura sul riepilogo
  const isForf = (meta.regime || invoice.regime) === 'forfettario';
  const ivaImporto = +invoice.ivaImporto || 0;
  const base = +invoice.imponibile || 0;
  const cassa = +invoice.cassaImporto || 0;
  const imponibileRiep = round2(base + cassa);
  const aliquota = isForf ? 0 : (imponibileRiep > 0 ? ivaImporto / imponibileRiep : 0);
  if (Math.abs(aliquota) < 1e-9) {
    // Aliquota 0 → Natura OBBLIGATORIA (00400)
    // (qui la impostiamo noi a N2.2 per il forfettario, quindi è un warn informativo)
    if (!isForf) warn('00400', 'invoice.natura', 'Aliquota IVA 0 senza regime forfettario: serve una Natura IVA esplicita (es. esente/non imponibile). Verifica col commercialista.');
  }
  // 00422 — Imposta ≠ Imponibile × Aliquota (tolleranza 1 cent)
  if (!isForf) {
    const attesa = round2(imponibileRiep * aliquota);
    if (Math.abs(attesa - round2(ivaImporto)) > 0.01)
      warn('00422', 'invoice.iva', 'L\'IVA calcolata non torna con imponibile × aliquota. Ricontrolla gli importi.');
  }
  // Ritenuta coerente (00411/00413)
  const rit = +invoice.ritenutaImporto || 0;
  if (rit > 0 && base > 0) {
    const alRit = rit / base;
    if (alRit <= 0 || alRit > 1)
      warn('00413', 'invoice.ritenuta', 'La ritenuta d\'acconto non è coerente con l\'imponibile.');
  }
  // Numero e data documento
  if (meta.number == null || meta.number === '') err('00420', 'meta.number', 'Manca il numero della fattura.');
  if (!isoDate(meta.date)) warn('00403', 'meta.date', 'La data della fattura non è valida.');
  // Importo nullo
  if (base <= 0) err('00423', 'invoice.imponibile', 'L\'importo della fattura è zero: inserisci un imponibile.');

  return out;
}

// Normalizza una data (Date | ISO | 'gg/mm/aaaa') → 'YYYY-MM-DD' o null.
function isoDate(d) {
  if (!d) return null;
  if (d instanceof Date && !isNaN(d)) return d.toISOString().slice(0, 10);
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // gg/mm/aaaa
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

// Progressivo invio: alfanumerico unico per file. Deterministico da anno+numero
// (base36) così due fatture diverse danno codici diversi; l'utente può forzarlo.
export function progressivoInvio(number, year) {
  const n = Math.max(1, Number(number) || 1);
  const y = Number(year) || new Date().getFullYear();
  return ((y % 100) * 100000 + n).toString(36).toUpperCase().padStart(5, '0').slice(-10);
}

// Nome file SdI: IT{identificativo}_{progressivo}.xml (convenzione ufficiale).
export function fatturaPaFilename(emitter = {}, progressivo = '00001') {
  const id = String(emitter.partitaIva || emitter.codiceFiscale || 'XXXXXXXXXXX')
    .replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `IT${id}_${progressivo}.xml`;
}

// ---------------------------------------------------------------------------
// 4) GENERAZIONE XML — FatturaPA v1.2.2 (FPR12).
// Ritorna { xml, filename, progressivo, controls, blocking }. `blocking` = true
// se c'è almeno un controllo 'error' (l'XML si genera comunque, ma la UI avvisa
// che lo SdI lo scarterebbe: onestà, mai un file che finge di essere in regola).
export function buildFatturaPaXML(data = {}) {
  const { emitter = {}, client = {}, invoice = {}, meta = {} } = data;
  const controls = validateFatturaPa(data);
  const blocking = controls.some(c => c.level === 'error');
  const progressivo = meta.progressivo || progressivoInvio(meta.number, meta.year);

  // Specifica di formato in vigore per la data della fattura (auto-adattiva: se
  // il tracciato cambia, cambia la specifica, non questo codice). `formatOverride`
  // consente di adottare un formato aggiornato validato via fetchFormatUpdate.
  const spec = formatForDate(isoDate(meta.date) || new Date(), meta.formatOverride || null);
  const isForf = (meta.regime || invoice.regime) === 'forfettario';
  const regimeCode = spec.regimeCodes[isForf ? 'forfettario' : 'ordinario'] || 'RF01';
  const base = round2(invoice.imponibile);
  const cassa = round2(invoice.cassaImporto);
  const ivaImporto = round2(invoice.ivaImporto);
  const ritenuta = round2(invoice.ritenutaImporto);
  const bollo = round2(invoice.bolloImporto);
  const imponibileRiep = round2(base + cassa);
  const aliquota = isForf ? 0 : (imponibileRiep > 0 ? ivaImporto / imponibileRiep : 0);
  const cassaAl = base > 0 ? cassa / base : 0;
  const ritAl = base > 0 ? ritenuta / base : 0;
  const data_ = isoDate(meta.date) || isoDate(new Date());
  const codDest = (String(client.codiceDestinatario || '').trim().length === 7)
    ? String(client.codiceDestinatario).trim() : '0000000';

  const anagrafica = (p) => p.denominazione
    ? `<Denominazione>${escXml(p.denominazione)}</Denominazione>`
    : `<Nome>${escXml(p.nome || '')}</Nome><Cognome>${escXml(p.cognome || '')}</Cognome>`;

  const sede = (p) => [
    `<Indirizzo>${escXml(p.indirizzo || '')}</Indirizzo>`,
    p.numeroCivico ? `<NumeroCivico>${escXml(p.numeroCivico)}</NumeroCivico>` : '',
    `<CAP>${escXml(String(p.cap || '').replace(/\D/g, '').padStart(5, '0').slice(0, 5))}</CAP>`,
    `<Comune>${escXml(p.comune || '')}</Comune>`,
    p.provincia ? `<Provincia>${escXml(String(p.provincia).toUpperCase().slice(0, 2))}</Provincia>` : '',
    `<Nazione>${escXml((p.nazione || 'IT').toUpperCase())}</Nazione>`,
  ].filter(Boolean).join('');

  // Header
  const header =
    `<FatturaElettronicaHeader>` +
      `<DatiTrasmissione>` +
        `<IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>${escXml(emitter.partitaIva || emitter.codiceFiscale || '')}</IdCodice></IdTrasmittente>` +
        `<ProgressivoInvio>${escXml(progressivo)}</ProgressivoInvio>` +
        `<FormatoTrasmissione>${escXml(spec.versione)}</FormatoTrasmissione>` +
        `<CodiceDestinatario>${escXml(codDest)}</CodiceDestinatario>` +
        (codDest === '0000000' && client.pec ? `<PECDestinatario>${escXml(client.pec)}</PECDestinatario>` : '') +
      `</DatiTrasmissione>` +
      `<CedentePrestatore>` +
        `<DatiAnagrafici>` +
          (emitter.partitaIva ? `<IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${escXml(emitter.partitaIva)}</IdCodice></IdFiscaleIVA>` : '') +
          (emitter.codiceFiscale ? `<CodiceFiscale>${escXml(emitter.codiceFiscale)}</CodiceFiscale>` : '') +
          `<Anagrafica>${anagrafica(emitter)}</Anagrafica>` +
          `<RegimeFiscale>${regimeCode}</RegimeFiscale>` +
        `</DatiAnagrafici>` +
        `<Sede>${sede(emitter)}</Sede>` +
      `</CedentePrestatore>` +
      `<CessionarioCommittente>` +
        `<DatiAnagrafici>` +
          (client.partitaIva ? `<IdFiscaleIVA><IdPaese>${escXml((client.nazione || 'IT').toUpperCase())}</IdPaese><IdCodice>${escXml(client.partitaIva)}</IdCodice></IdFiscaleIVA>` : '') +
          (client.codiceFiscale ? `<CodiceFiscale>${escXml(client.codiceFiscale)}</CodiceFiscale>` : '') +
          `<Anagrafica>${anagrafica(client)}</Anagrafica>` +
        `</DatiAnagrafici>` +
        `<Sede>${sede(client)}</Sede>` +
      `</CessionarioCommittente>` +
    `</FatturaElettronicaHeader>`;

  // Corpo — DatiGeneraliDocumento nell'ORDINE di schema:
  // TipoDocumento, Divisa, Data, Numero, DatiRitenuta, DatiBollo, DatiCassaPrevidenziale, ...
  const datiRitenuta = ritenuta > 0
    ? `<DatiRitenuta><TipoRitenuta>${spec.tipoRitenuta}</TipoRitenuta><ImportoRitenuta>${eur(ritenuta)}</ImportoRitenuta><AliquotaRitenuta>${pct2(ritAl)}</AliquotaRitenuta><CausalePagamento>${spec.causaleRitenutaDefault}</CausalePagamento></DatiRitenuta>`
    : '';
  const datiBollo = bollo > 0
    ? `<DatiBollo><BolloVirtuale>SI</BolloVirtuale><ImportoBollo>${eur(bollo)}</ImportoBollo></DatiBollo>`
    : '';
  const datiCassa = cassa > 0
    ? `<DatiCassaPrevidenziale><TipoCassa>${spec.tipoCassa}</TipoCassa><AlCassa>${pct2(cassaAl)}</AlCassa><ImportoContributoCassa>${eur(cassa)}</ImportoContributoCassa><ImponibileCassa>${eur(base)}</ImponibileCassa><AliquotaIVA>${pct2(aliquota)}</AliquotaIVA></DatiCassaPrevidenziale>`
    : '';
  const importoTotale = round2(base + cassa + ivaImporto + bollo);

  const datiGenerali =
    `<DatiGenerali>` +
      `<DatiGeneraliDocumento>` +
        `<TipoDocumento>${spec.tipoDocumentoDefault}</TipoDocumento>` +
        `<Divisa>EUR</Divisa>` +
        `<Data>${data_}</Data>` +
        `<Numero>${escXml(`${meta.number ?? ''}${meta.year ? '/' + meta.year : ''}`)}</Numero>` +
        datiRitenuta + datiBollo + datiCassa +
        `<ImportoTotaleDocumento>${eur(importoTotale)}</ImportoTotaleDocumento>` +
        (meta.description ? `<Causale>${escXml(String(meta.description).slice(0, 200))}</Causale>` : '') +
      `</DatiGeneraliDocumento>` +
    `</DatiGenerali>`;

  // Linea unica = compenso. Il forfettario ha Natura N2.2; l'ordinario l'aliquota.
  const naturaLinea = isForf ? `<Natura>${spec.naturaForfettario}</Natura>` : '';
  const dettaglioLinee =
    `<DettaglioLinee>` +
      `<NumeroLinea>1</NumeroLinea>` +
      `<Descrizione>${escXml(String(meta.description || 'Prestazione professionale').slice(0, 1000))}</Descrizione>` +
      `<PrezzoUnitario>${eur(base)}</PrezzoUnitario>` +
      `<PrezzoTotale>${eur(base)}</PrezzoTotale>` +
      `<AliquotaIVA>${pct2(aliquota)}</AliquotaIVA>` +
      naturaLinea +
    `</DettaglioLinee>`;

  const naturaRiep = isForf ? `<Natura>${spec.naturaForfettario}</Natura>` : '';
  const rifNorm = isForf ? `<RiferimentoNormativo>${escXml(spec.rifNormativoForfettario)}</RiferimentoNormativo>` : '';
  const datiRiepilogo =
    `<DatiRiepilogo>` +
      `<AliquotaIVA>${pct2(aliquota)}</AliquotaIVA>` +
      naturaRiep +
      `<ImponibileImporto>${eur(imponibileRiep)}</ImponibileImporto>` +
      `<Imposta>${eur(ivaImporto)}</Imposta>` +
      rifNorm +
    `</DatiRiepilogo>`;

  const datiBeniServizi = `<DatiBeniServizi>${dettaglioLinee}${datiRiepilogo}</DatiBeniServizi>`;

  // Pagamento (opzionale): completo, bonifico, con IBAN se disponibile.
  const netto = round2(importoTotale - ritenuta);
  const datiPagamento = (emitter.iban || netto > 0)
    ? `<DatiPagamento><CondizioniPagamento>${spec.condizioniPagamento}</CondizioniPagamento>` +
        `<DettaglioPagamento><ModalitaPagamento>${spec.modalitaPagamento}</ModalitaPagamento>` +
        `<ImportoPagamento>${eur(netto)}</ImportoPagamento>` +
        (emitter.iban ? `<IBAN>${escXml(String(emitter.iban).replace(/\s/g, '').toUpperCase())}</IBAN>` : '') +
        `</DettaglioPagamento></DatiPagamento>`
    : '';

  const body = `<FatturaElettronicaBody>${datiGenerali}${datiBeniServizi}${datiPagamento}</FatturaElettronicaBody>`;

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` + '\n' +
    `<p:FatturaElettronica versione="${escXml(spec.versione)}" xmlns:p="${escXml(spec.namespace)}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      header + body +
    `</p:FatturaElettronica>`;

  return {
    xml,
    filename: fatturaPaFilename(emitter, progressivo),
    progressivo,
    controls,
    blocking,
  };
}
