// ============================================================
// INVOICE PDF — generatore PDF on-device SENZA dipendenze (v10)
// ============================================================
// Il PDF è un formato testuale: si può scrivere a mano, senza librerie (niente
// jsPDF/350KB), restando 100% on-device e con footprint minimo. Genera un
// documento A4 a una pagina con Helvetica (font standard PDF, non serve
// embeddare) e codifica WinAnsi (€ e accenti resi correttamente).
// Onestà (regola #1): è un PDF VERO e valido (apribile/allegabile ovunque),
// layout pulito; il logo immagine NON è incluso in questa v1 (embeddare
// immagini in PDF richiede FlateDecode/DCTDecode — dichiarato, non un bug):
// per il logo resta la stampa HTML→PDF. Funzioni pure, nessun DOM.
'use strict';

import { invoiceCountry } from './country-invoicing.js';

// Mappa un carattere Unicode al byte WinAnsi (Windows-1252) corrispondente.
// Copre i simboli/accenti comuni delle fatture italiane; ignoto → '?'.
const WINANSI_SPECIAL = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f };
function toWinAnsiBytes(str) {
  const out = [];
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    let b;
    if (cp <= 0xff) b = cp;                       // Latin-1 coincide con WinAnsi in 0xA0-0xFF e ASCII
    else if (WINANSI_SPECIAL[ch] != null) b = WINANSI_SPECIAL[ch];
    else b = 0x3f;                                // '?' per l'ignoto
    // Escape dei caratteri speciali PDF nelle stringhe: ( ) \
    if (b === 0x28 || b === 0x29 || b === 0x5c) out.push(0x5c);
    out.push(b);
  }
  return out;
}

const round2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;
const eur = (n) => `${round2(n).toFixed(2).replace('.', ',')} €`;

// Costruisce il PDF come Uint8Array (byte esatti, niente problemi UTF-8).
// inv = output di computeInvoice; meta = { number, year, date, client,
// clientInfo, emitter, emitterInfo, description }.
export function invoicePdfBytes(inv = {}, meta = {}) {
  // ── Content stream: comandi di testo PDF (BT/ET, Tf, Td, Tj) ──
  const lines = []; // { x, y, size, bold, text, rightAt? }
  const push = (x, y, text, size = 11, bold = false, rightAt = null) => lines.push({ x, y, size, bold, text, rightAt });
  let y = 800;
  const A4W = 595;
  push(50, y, meta.emitter || '', 16, true); y -= 22;
  push(50, y, `Fattura n. ${meta.number ?? '—'}/${meta.year ?? new Date().getFullYear()}`, 13, true); y -= 16;
  push(50, y, `Data: ${meta.date || new Date().toLocaleDateString('it-IT')}`, 10); y -= 10;
  if (meta.emitterInfo) { push(50, y, meta.emitterInfo, 9); }
  y -= 30;
  push(50, y, 'Cliente', 9, true); y -= 14;
  push(50, y, meta.client || '', 12, true); y -= 12;
  if (meta.clientInfo) { push(50, y, meta.clientInfo, 9); y -= 12; }
  y -= 12;
  if (meta.description) { push(50, y, meta.description, 11); y -= 22; }
  // Righe importi (con importo allineato a destra)
  for (const r of (inv.righe || [])) {
    push(50, y, r.voce, 11);
    push(0, y, `${r.importo < 0 ? '-' : ''}${eur(Math.abs(r.importo))}`, 11, false, A4W - 50);
    y -= 16;
  }
  y -= 8;
  push(0, y, `Totale fattura: ${eur(inv.totaleFattura)}`, 12, true, A4W - 50); y -= 18;
  push(0, y, `Netto a ricevere: ${eur(inv.nettoARicevere)}`, 14, true, A4W - 50); y -= 30;
  if (inv.note) { push(50, y, inv.note, 8); y -= 12; }
  // Disclaimer PER-PAESE (architettura pronta a ogni mercato): IT = copia di
  // cortesia + SdI; altri = fattura-documento valida. Onesto, mai fuorviante.
  const disc = invoiceCountry(meta.country).disclaimerLines;
  push(50, 52, disc[0] || '', 8);
  if (disc[1]) push(50, 42, disc[1], 8);

  // Larghezza approssimata Helvetica (per l'allineamento a destra), ~0.52em.
  const textWidth = (t, size) => [...String(t)].length * size * 0.52;
  const cmds = [];
  for (const l of lines) {
    const font = l.bold ? '/F2' : '/F1';
    const x = l.rightAt != null ? Math.max(50, l.rightAt - textWidth(l.text, l.size)) : l.x;
    const bytes = toWinAnsiBytes(l.text);
    cmds.push(`BT ${font} ${l.size} Tf ${x.toFixed(1)} ${l.y} Td (`);
    cmds.push(bytes);
    cmds.push(`) Tj ET\n`);
  }

  // ── Assemblaggio oggetti PDF ──
  const enc = (s) => [...s].map(c => c.charCodeAt(0));
  const streamBytes = [];
  for (const c of cmds) { if (typeof c === 'string') streamBytes.push(...enc(c)); else streamBytes.push(...c); }

  const objects = [];
  objects.push('<</Type/Catalog/Pages 2 0 R>>');
  objects.push('<</Type/Pages/Kids[3 0 R]/Count 1>>');
  objects.push('<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R/F2 5 0 R>>>>/Contents 6 0 R>>');
  // Font serif "old money" (Times, standard PDF, niente embedding): elegante e
  // classico, coerente col design premium richiesto.
  objects.push('<</Type/Font/Subtype/Type1/BaseFont/Times-Roman/Encoding/WinAnsiEncoding>>');
  objects.push('<</Type/Font/Subtype/Type1/BaseFont/Times-Bold/Encoding/WinAnsiEncoding>>');
  // oggetto 6 = stream (lunghezza dai byte reali)

  const out = [];
  const pushStr = (s) => out.push(...enc(s));
  const offsets = [];
  pushStr('%PDF-1.4\n');
  for (let i = 0; i < objects.length; i++) {
    offsets[i + 1] = out.length;
    pushStr(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`);
  }
  offsets[6] = out.length;
  pushStr(`6 0 obj\n<</Length ${streamBytes.length}>>\nstream\n`);
  out.push(...streamBytes);
  pushStr('\nendstream\nendobj\n');
  const xrefStart = out.length;
  pushStr('xref\n0 7\n0000000000 65535 f \n');
  for (let i = 1; i <= 6; i++) pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  pushStr(`trailer\n<</Size 7/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`);
  return new Uint8Array(out);
}

export function invoicePdfBlob(inv, meta) {
  return new Blob([invoicePdfBytes(inv, meta)], { type: 'application/pdf' });
}

// Nome file INTELLIGENTE: numero, cliente (slug), data. Predittivo e ordinabile.
export function invoiceFilename(meta = {}) {
  const slug = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'cliente';
  const date = (meta.isoDate || new Date().toISOString().slice(0, 10));
  return `Fattura_${meta.number ?? 'x'}-${meta.year ?? ''}_${slug(meta.client)}_${date}.pdf`;
}
