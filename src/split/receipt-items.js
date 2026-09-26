// ============================================================
// RIGHE DELLO SCONTRINO — dal testo letto (OCR) alle voci da dividere
// ============================================================
// Splitwise Pro legge dallo scontrino solo il totale, Tricount non lo legge
// affatto (verificato a settembre 2026): chi divide una cena deve riscrivere
// ogni piatto a mano. Qui il testo dell'OCR diventa l'elenco delle voci già
// pronto per la divisione per voce (item-split.js), in 7 lingue di scontrino.
//
// Onestà prima di tutto: la somma delle voci lette viene confrontata col
// TOTALE stampato. Se torna al centesimo le voci sono "verificate"; se non
// torna si dice di quanto non torna, e la differenza non viene mai
// spalmata di nascosto su una voce.
// Pura, nessun DOM, nessuna rete.
'use strict';

const round2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;

// Righe che non sono voci: totali, imposte, pagamento, resto, intestazioni.
const TOTALE = /^(totale|total|tot\.?|summe|gesamt(betrag)?|totaal|te betalen|importo pagato|a pagar|montant|net a payer|net à payer|zu zahlen)\b/i;
const SUBTOTALE = /(subtotale|sub-?total|zwischensumme|subtotaal|sous-total|sous total)/i;
// Riga d'imposta: comincia con la parola ("IVA 10%", "Tax") o riporta un'aliquota.
// "City tax" dell'hotel invece è una voce vera e resta.
const IMPOSTA = /^(iva|vat|tax|sales tax|mwst|ust|tva|btw|imposta|impuesto|imposto)\b|\d{1,2}([.,]\d{1,2})?\s*%/i;
const PAGAMENTO = /\b(contant[ei]|cash|bar\b|carta|card|karte|kaart|carte|tarjeta|cart[aã]o|bancomat|pagamento|payment|zahlung|betaling|paiement|pago\b|resto|change|rückgeld|wisselgeld|rendu|cambio|troco|visa|mastercard|maestro|amex|pin)\b/i;
const INTESTAZIONE = /\b(p\.?\s?iva|partita iva|c\.f\.|tel\.?|www\.|http|scontrino|documento commerciale|receipt|beleg|bon|ticket|ricevuta|rechnung|factura|fatura|facture|cassa|kasse|operatore|cashier|tavolo|table|tisch)\b/i;
const SCONTO = /(sconto|discount|rabatt|korting|remise|descuento|desconto|promo)/i;
const SERVIZIO = /(servizio|service|bedienung|bediening|servicio|servi[çc]o|mancia|tip\b|trinkgeld|fooi|pourboire|propina|gorjeta)/i;

// Importo in fondo alla riga: 12,50 / 12.50 / 1.234,50 / -3,00 / 12,50 €.
const IMPORTO_FINALE = /(-?)\s*(\d{1,5}(?:[.,\s]\d{3})*[.,]\d{2})\s*(?:€|eur|euro|chf|£|\$|[a-z]{1,2})?\s*$/i;
const QUANTITA = /^(\d{1,3})\s*[x×*]\s*/i;

function numero(s) {
  const t = String(s).replace(/\s/g, '');
  const ultimo = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
  const intero = t.slice(0, ultimo).replace(/[.,]/g, '');
  return parseFloat(`${intero}.${t.slice(ultimo + 1)}`);
}

function pulisciDescrizione(s) {
  return s.replace(/[*#_|]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/[\s.:-]+$/, '').trim();
}

export function parseReceiptItems(rawText) {
  const righe = String(rawText || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items = [];
  let totale = null;
  let servizio = 0;
  let sconti = 0;
  let imposte = 0;

  for (const riga of righe) {
    const m = riga.match(IMPORTO_FINALE);
    if (!m) continue;
    const valore = numero(m[2]) * (m[1] === '-' ? -1 : 1);
    if (!Number.isFinite(valore)) continue;
    const testo = riga.slice(0, m.index).trim();

    if (SUBTOTALE.test(testo)) continue;
    if (TOTALE.test(testo)) { if (totale === null) totale = Math.abs(valore); continue; }
    if (IMPOSTA.test(testo)) { imposte = round2(imposte + Math.abs(valore)); continue; }
    if (PAGAMENTO.test(testo) || INTESTAZIONE.test(testo)) continue;
    if (SERVIZIO.test(testo)) { servizio = round2(servizio + Math.abs(valore)); continue; }
    if (SCONTO.test(testo) || valore < 0) { sconti = round2(sconti + Math.abs(valore)); continue; }

    let descrizione = testo;
    let quantita = 1;
    const q = descrizione.match(QUANTITA);
    if (q) { quantita = +q[1]; descrizione = descrizione.slice(q[0].length); }
    descrizione = pulisciDescrizione(descrizione);
    // Una riga senza lettere è quasi sempre un codice o una data letti male.
    if ((descrizione.match(/\p{L}/gu) || []).length < 2) continue;
    items.push({ description: descrizione.slice(0, 60), amount: round2(valore), quantity: quantita });
  }

  const sommaVoci = round2(items.reduce((s, it) => s + it.amount, 0));
  const atteso = totale === null ? null : round2(totale);
  let calcolato = round2(sommaVoci - sconti + servizio);
  // Imposta di solito già inclusa nei prezzi (Europa). Dove invece si aggiunge
  // in fondo (sales tax USA/Canada) il totale torna solo sommandola: in quel
  // caso, e solo in quello, la si considera un'aggiunta da dividere.
  let impostaAggiunta = 0;
  if (atteso !== null && imposte > 0 && Math.abs(atteso - calcolato) >= 0.01 && Math.abs(atteso - calcolato - imposte) < 0.01) {
    impostaAggiunta = imposte;
    calcolato = round2(calcolato + imposte);
  }
  const differenza = atteso === null ? null : round2(atteso - calcolato);
  return {
    items,
    total: atteso,
    discounts: sconti,
    service: servizio,
    addedTax: impostaAggiunta,
    itemsSum: sommaVoci,
    // verificato: le voci lette, meno gli sconti, più il servizio, fanno
    // esattamente il totale stampato. Senza totale leggibile non si verifica.
    verified: differenza !== null && Math.abs(differenza) < 0.01 && items.length > 0,
    difference: differenza,
  };
}
