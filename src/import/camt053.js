// ============================================================
// CAMT.053 (ISO 20022) — l'estratto conto STRUTTURATO, non indovinato
// ============================================================
// csv-parser.js risolve l'estratto conto quando la banca dà solo un CSV senza
// un formato garantito: INFERISCE colonna data/importo/direzione dai dati
// stessi, perché non c'è altro. Molte banche europee offrono anche un export
// diverso — CAMT.053, lo standard ISO 20022 che il SEPA impone alle banche
// per gli estratti conto in formato dati — dove data, importo, direzione
// (CdtDbtInd) e descrizione sono campi ESPLICITI e tipizzati: qui non serve
// indovinare niente, il file stesso dichiara cosa è cosa.
//
// PERCHÉ CONTA: un CSV ambiguo può sbagliare la direzione di un importo (un
// segno interpretato al contrario capovolge entrata/uscita), o la data
// (giorno/mese invertiti su formati regionali diversi). Un CAMT.053 non ha
// questa classe di errore per costruzione — è un guadagno di affidabilità,
// non solo un formato in più.
//
// STESSO STILE "ZERO DIPENDENZE" di fatturapa-import.js: niente DOMParser,
// solo string/regex — testabile in Node senza un DOM, coerente col resto
// dell'import. Non è un parser XML generale: legge SOLO i tag che servono a
// una transazione bancaria, e si ferma lì.
//
// ONESTÀ: un file che non ha il tag <BkToCstmrStmt> non è un CAMT.053 e
// ritorna array vuoto — mai un dato inventato da un formato che non
// riconosce. Un movimento senza data o importo viene scartato, non stimato.
'use strict';

function tag(xml, name) {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${name}[^>]*>([^<]*)<\\/(?:\\w+:)?${name}>`));
  return m ? decodeEntities(m[1].trim()) : null;
}

function block(xml, name) {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`));
  return m ? m[1] : null;
}

function blocks(xml, name) {
  const re = new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// Riconosce un CAMT.053 dal tag radice reale, non dall'estensione del file
// (che l'utente potrebbe aver rinominato, o che un file .xml generico
// condivide con qualunque altro tracciato XML — SdI compreso).
export function isCamt053(text) {
  return /<(?:\w+:)?BkToCstmrStmt[\s>]/.test(String(text || ''));
}

// <Dt>2026-08-15</Dt> oppure <DtTm>2026-08-15T10:30:00</DtTm>: si tiene solo
// la parte data, l'orario di un movimento bancario non serve a Momentum.
function dataDaBlocco(xml) {
  if (!xml) return null;
  const d = tag(xml, 'Dt') || tag(xml, 'DtTm');
  if (!d) return null;
  const iso = d.slice(0, 10);
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// La descrizione migliore disponibile, in ordine di informatività: il testo
// libero che il mittente ha scritto (RmtInf/Ustrd), poi la nota aggiuntiva
// della banca (AddtlNtryInf), poi il nome della controparte (RltdPties),
// mai un vuoto silenzioso — un movimento senza descrizione riconoscibile
// prende un'etichetta onesta invece di sparire dall'import.
function descrizioneDaEntry(entryXml, dettagli) {
  const ustrd = dettagli && tag(dettagli, 'Ustrd');
  if (ustrd) return ustrd;
  const addtl = tag(entryXml, 'AddtlNtryInf');
  if (addtl) return addtl;
  const rltd = dettagli && block(dettagli, 'RltdPties');
  if (rltd) {
    const cdtr = block(rltd, 'Cdtr') || block(rltd, 'Dbtr');
    const nome = cdtr && tag(cdtr, 'Nm');
    if (nome) return nome;
  }
  return 'Movimento bancario';
}

// Ritorna [{date, amount, type, description, externalId}], stesso formato
// normalizzato di revolut-csv.js/pdf-parser.js — pronto per multi-import.js.
export function parseCamt053(xmlString) {
  const xml = String(xmlString || '');
  if (!isCamt053(xml)) return [];

  const entries = blocks(xml, 'Ntry');
  const out = [];
  for (const entry of entries) {
    // Solo movimenti REGISTRATI (Booked): un pending può ancora cambiare
    // importo o sparire, e camt.053 è per definizione l'estratto di
    // chiusura — ma non tutte le banche popolano <Sts>, e allora non si
    // scarta per un campo assente.
    const stato = tag(entry, 'Sts');
    if (stato && !/^book/i.test(stato)) continue;

    const importo = parseFloat(tag(entry, 'Amt') || '');
    if (!Number.isFinite(importo) || importo === 0) continue;

    const verso = tag(entry, 'CdtDbtInd'); // CRDT = entrata, DBIT = uscita
    if (verso !== 'CRDT' && verso !== 'DBIT') continue; // campo obbligatorio nello standard: se manca, non si indovina

    const date = dataDaBlocco(block(entry, 'BookgDt')) || dataDaBlocco(block(entry, 'ValDt'));
    if (!date) continue;

    const dettagli = block(entry, 'NtryDtls');
    const txDtls = dettagli && block(dettagli, 'TxDtls');
    const rmtInf = txDtls && block(txDtls, 'RmtInf');
    const description = descrizioneDaEntry(entry, rmtInf || txDtls);

    const externalId = tag(entry, 'AcctSvcrRef') || tag(entry, 'NtryRef');

    out.push({
      date, amount: Math.abs(importo), type: verso === 'CRDT' ? 'entrata' : 'uscita',
      description, externalId: externalId ? `camt:${externalId}` : '',
    });
  }
  return out;
}
