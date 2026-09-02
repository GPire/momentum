// ============================================================
// ITEM-LEVEL SPLIT — dividere una spesa per singola voce, non solo equamente
// o a pesi
// ============================================================
// Caso reale non coperto da addSharedExpense: uno scontrino al ristorante
// dove ognuno ha ordinato cose diverse ("pizza di Marco 12€, pasta di Anna
// 10€, antipasto misto diviso in tre, vino diviso fra tutti") — dividere
// il totale equamente sarebbe onesto ma sbagliato (chi ha preso solo
// un'insalata pagherebbe come chi ha preso la bistecca).
//
// Questo modulo fa SOLO il calcolo: da un elenco di voci (ognuna con un
// importo e a chi va assegnata) produce le quote IDEALI per persona — non
// ancora arrotondate a centesimi esatti. L'arrotondamento a somma esatta
// (resto massimo, seed deterministico) resta dentro addSharedExpense
// (split-engine.js, idealShares+balanceRounding): non lo si rifà qui, la
// spesa finale nasce chiamando addSharedExpense(group, { shares: { byId },
// amount: total, ... }) esattamente come per una divisione a quote esatte
// già esistente — nessuna seconda strada nel motore.
// Pure, nessun DOM, nessuna rete.
'use strict';

const round2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;

// items: [{ description, amount, assignedTo: [id,...] | 'all' | undefined }]
// memberIds: tutti gli id validi del gruppo (per validare/risolvere 'all').
// tip: importo aggiuntivo (mancia/servizio) opzionale, diviso fra i
// partecipanti EFFETTIVAMENTE coinvolti in almeno una voce (chi non ha
// ordinato nulla, es. chi paga solo un giro di caffè altrove, non paga
// mancia su un conto a cui non ha partecipato).
// tipMode: 'proporzionale' (default, chi ha consumato di più paga più
// mancia — la convenzione più comune) oppure 'equa' (divisa a testa).
export function itemSplitShares(items, memberIds, { tip = 0, tipMode = 'proporzionale' } = {}) {
  if (!Array.isArray(items) || !items.length) throw new Error('nessuna voce inserita');
  const owed = {};
  let total = 0;
  for (const it of items) {
    const amt = +it.amount;
    const etichetta = it.description || 'una voce';
    if (!(amt > 0)) throw new Error(`importo non valido per "${etichetta}"`);
    const assegnatari = (!it.assignedTo || it.assignedTo === 'all')
      ? memberIds
      : it.assignedTo.filter(id => memberIds.includes(id));
    if (!assegnatari.length) throw new Error(`nessun partecipante assegnato a "${etichetta}"`);
    const quota = amt / assegnatari.length;
    for (const id of assegnatari) owed[id] = (owed[id] || 0) + quota;
    total += amt;
  }
  const coinvolti = Object.keys(owed);
  let totaleFinale = total;
  if (tip > 0) {
    if (tipMode === 'equa') {
      const quotaTip = tip / coinvolti.length;
      for (const id of coinvolti) owed[id] += quotaTip;
    } else {
      // proporzionale: chi ha consumato una quota X del totale paga la
      // stessa quota X della mancia — mai su un totale già arrotondato,
      // altrimenti l'ultimo centesimo del totale sballerebbe la proporzione.
      for (const id of coinvolti) owed[id] += tip * (owed[id] / total);
    }
    totaleFinale = total + tip;
  }
  return { byId: owed, total: round2(totaleFinale) };
}
