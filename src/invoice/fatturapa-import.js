// ============================================================
// RICEZIONE FATTURE PASSIVE — l'altra metà del lavoro di un portale
// ============================================================
// Momentum non riceve nulla da solo: non ha le credenziali del cassetto
// fiscale e non le chiederà mai (stessa regola di sempre — nessuna password
// in mano nostra). Quello che l'utente PUÒ fare: scaricare l'XML della
// fattura ricevuta dal cassetto fiscale/PEC/fornitore e darlo in pasto qui.
// Un parser leggero (niente DOMParser: stesso stile "zero dipendenze" già
// usato per generare l'XML in fatturapa-xml.js — solo string/regex, testabile
// in Node senza un DOM) estrae fornitore, data, imponibile e aliquota IVA per
// ogni riepilogo, pronti per il registro acquisti (iva-liquidazione.js) —
// colma la lacuna che prima richiedeva la digitazione manuale di ogni riga.
//
// ONESTÀ: legge solo i campi che le servono, non valida l'intero tracciato
// (non è questo il suo compito: chi genera l'XML lo valida già in
// fatturapa-xml.js). Un file che non è una FatturaPA valida ritorna un
// errore chiaro, mai un dato inventato.
'use strict';

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([^<]*)<\\/${name}>`));
  return m ? decodeEntities(m[1].trim()) : null;
}

function block(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`));
  return m ? m[1] : null;
}

function blocks(xml, name) {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'g');
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

// Ritorna { emittente, numero, data, righeRiepilogo, importoTotale } oppure
// { errore } se il file non sembra una FatturaPA valida — mai un crash, mai
// un dato a metà spacciato per completo.
export function parseFatturaPaXML(xmlString) {
  const xml = String(xmlString || '');
  if (!/<(?:\w+:)?FatturaElettronica[\s>]/.test(xml)) {
    return { errore: 'Questo file non sembra una fattura elettronica (FatturaPA): manca il tag <FatturaElettronica>.' };
  }

  const cedente = block(xml, 'CedentePrestatore') || '';
  const anagraficaCedente = block(cedente, 'Anagrafica') || cedente;
  const denominazione = tag(anagraficaCedente, 'Denominazione');
  const nome = tag(anagraficaCedente, 'Nome');
  const cognome = tag(anagraficaCedente, 'Cognome');
  const fornitore = denominazione || [nome, cognome].filter(Boolean).join(' ') || null;
  const partitaIvaCedente = tag(cedente, 'IdCodice');

  const datiGenerali = block(xml, 'DatiGeneraliDocumento') || '';
  const data = tag(datiGenerali, 'Data');
  const numero = tag(datiGenerali, 'Numero');
  const importoTotale = parseFloat(tag(datiGenerali, 'ImportoTotaleDocumento') || '0') || 0;

  const riepiloghi = blocks(xml, 'DatiRiepilogo');
  const righeRiepilogo = riepiloghi.map((r) => ({
    imponibile: parseFloat(tag(r, 'ImponibileImporto') || '0') || 0,
    aliquotaIva: parseFloat(tag(r, 'AliquotaIVA') || '0') / 100,
    imposta: parseFloat(tag(r, 'Imposta') || '0') || 0,
  })).filter((r) => r.imponibile > 0);

  if (!fornitore || !data || righeRiepilogo.length === 0) {
    return { errore: 'Il file sembra una FatturaPA ma mancano dati essenziali (fornitore, data o importo): controlla che sia il file XML completo, non un estratto.' };
  }

  return {
    fornitore, partitaIvaCedente, numero, data,
    righeRiepilogo, importoTotale: importoTotale || righeRiepilogo.reduce((s, r) => s + r.imponibile + r.imposta, 0),
  };
}

// Converte il risultato del parser in voci pronte per acquistiIva
// (iva-liquidazione.js: stesso formato già usato dal registro manuale, così
// non serve un secondo motore di calcolo per l'IVA a credito importata).
export function fatturaPassivaToAcquisti(parsed) {
  if (!parsed || parsed.errore) return [];
  return parsed.righeRiepilogo.map((r) => ({
    descrizione: `${parsed.fornitore}${parsed.numero ? ` (fatt. ${parsed.numero})` : ''}`,
    imponibile: r.imponibile,
    data: parsed.data,
    aliquotaIva: r.aliquotaIva,
    fonte: 'fattura-passiva-importata',
  }));
}
