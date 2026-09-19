// ============================================================
// COMMISSIONI BANCARIE — quanto ti costa davvero il tuo conto
// ============================================================
// Nato da una ricerca di mercato reale (2026-09-16): le "commissioni
// nascoste" sono il reclamo #1 dei clienti bancari (40%+ le cita come la
// cosa più frustrante, 29% considera di cambiare banca per commissioni
// eccessive — fonte: mybanktracker.com/ConsumerAffairs, J.D. Power 2026 US
// Retail Banking Satisfaction Study). Nessuna app di budgeting generica
// isola questo dato: le commissioni finiscono mescolate fra le altre spese,
// mai sommate e mostrate come categoria a sé. Momentum vede TUTTE le
// transazioni reali dell'utente, su tutti i conti — è l'unico posto dove
// questo calcolo è possibile senza dover chiedere accesso diretto alla
// banca (che tra l'altro non ha alcun incentivo a fartelo notare).
//
// Distinzione onesta, non ovvia: l'IMPOSTA DI BOLLO su conto corrente non è
// una commissione bancaria, è una tassa di STATO (in Italia, 34,20€/anno se
// la giacenza media supera 5.000€, D.P.R. 642/1972 — verificato su fonti
// concordanti: confrontaconti.ilsole24ore.com, bancobpm.it/magazine). La
// banca la addebita ma non la decide: sommarla insieme alle commissioni
// vere darebbe un numero più alto ma un messaggio sbagliato ("è colpa della
// banca" quando in parte non lo è). Le due cifre sono SEMPRE tenute separate.
'use strict';

// Pattern ordinati dal più specifico al più generico (stesso principio di
// CAT_RULES in lexicon.js): un pattern specifico intercetta la voce prima
// che ricada sul generico "commissione", che da solo prenderebbe troppo.
// Termini reali di estratto conto italiani/inglesi/spagnoli, non inventati:
// verificati su più fonti (Qonto glossario, Facile.it, Confronta Conti,
// Banco BPM) per l'italiano; inglese/spagnolo sono la terminologia standard
// di settore (account maintenance fee/comisión de mantenimiento), stessa
// disciplina di copertura già in uso in lexicon.js per Spagna.
export const BANK_FEE_PATTERNS = [
  {
    id: 'bollo',
    label: 'Imposta di bollo',
    tassaStatale: true, // NON è una scelta della banca — vedi commento in testa al file
    kw: ['imposta di bollo', 'bollo c/c', 'bollo conto corrente', 'stamp duty'],
  },
  {
    id: 'canone_carta',
    label: 'Canone carta',
    tassaStatale: false,
    kw: ['canone carta', 'canone annuo carta', 'card fee', 'annual card fee', 'cuota tarjeta', 'cuota anual tarjeta'],
  },
  {
    id: 'canone_conto',
    label: 'Canone conto',
    tassaStatale: false,
    kw: ['canone mensile', 'canone conto', 'canone annuo conto', 'monthly account fee', 'maintenance fee', 'account maintenance', 'cuota de mantenimiento', 'comisión de mantenimiento', 'comision de mantenimiento'],
  },
  {
    id: 'tenuta_conto',
    label: 'Spese tenuta conto',
    tassaStatale: false,
    kw: ['spese tenuta conto', 'spese gestione conto', 'spese conto corrente'],
  },
  {
    id: 'commissione_bonifico',
    label: 'Commissione bonifico',
    tassaStatale: false,
    kw: ['commissione bonifico', 'spese bonifico', 'wire transfer fee', 'transfer fee', 'comisión transferencia', 'comision transferencia'],
  },
  {
    id: 'commissione_prelievo',
    label: 'Commissione prelievo',
    tassaStatale: false,
    kw: ['commissione prelievo', 'prelievo fuori rete', 'atm fee', 'withdrawal fee', 'comisión de retiro', 'comision de retiro', 'comisión cajero'],
  },
  {
    id: 'scoperto',
    label: 'Commissione scoperto/fido',
    tassaStatale: false,
    kw: ['commissione scoperto', 'interessi passivi', 'overdraft fee', 'insufficient funds fee', 'comisión de descubierto', 'comision de descubierto'],
  },
  {
    id: 'invio_documenti',
    label: 'Invio documenti/estratto conto',
    tassaStatale: false,
    kw: ['spese invio estratto conto', 'spese invio documenti', 'statement fee', 'paper statement fee'],
  },
  // Conversione valuta (aggiunta 2026-09-16, ricerca di mercato): la Dynamic
  // Currency Conversion (DCC) — pagare in valuta di casa invece che in
  // valuta locale all'estero — applica un markup tipico 3-7% sopra il
  // cambio interbancario reale (fonti concordanti: beancount.io,
  // bankrate.com, signaturepayments.com 2026); i viaggiatori britannici da
  // soli perdono ~500 milioni di sterline/anno solo di DCC (Bankrate/
  // Signature Payments 2026). Qui si intercetta solo la voce ESPLICITA in
  // estratto conto quando la banca la separa (non tutte lo fanno — limite
  // dichiarato, la DCC nascosta dentro un cambio già applicato al momento
  // dell'acquisto non lascia una riga propria e non è rilevabile da qui).
  {
    id: 'conversione_valuta',
    label: 'Commissione conversione valuta',
    tassaStatale: false,
    kw: ['commissione di conversione valuta', 'commissione conversione valuta', 'foreign transaction fee', 'currency conversion fee', 'cross-currency fee', 'comisión de conversión de divisa', 'comision de conversion de divisa'],
  },
  {
    id: 'commissione_generica',
    label: 'Altra commissione',
    tassaStatale: false,
    // Generico, ultimo della lista: intercetta solo ciò che i pattern sopra
    // non hanno già preso, mai il contrario (l'ordine dell'array è la guardia).
    kw: ['commissione', 'commission fee', 'service charge', 'bank fee', 'comisión bancaria', 'comision bancaria'],
  },
];

function normalizza(s) {
  return String(s || '').toLowerCase();
}

// Pura: trova la PRIMA regola che matcha (stesso ordine dichiarato sopra),
// mai un doppio conteggio della stessa transazione su due pattern.
export function classificaCommissione(descrizione) {
  const d = normalizza(descrizione);
  if (!d) return null;
  for (const regola of BANK_FEE_PATTERNS) {
    if (regola.kw.some((k) => d.includes(k))) return regola;
  }
  return null;
}

// Scansiona le transazioni REALI (mai un dato di secondo grado): solo uscite,
// mai un'entrata classificata per errore come commissione. Ritorna l'elenco
// completo con la regola associata — nessuna aggregazione qui, per restare
// componibile (chi chiama decide la finestra temporale).
export function detectBankFees(transactions) {
  const risultati = [];
  for (const tx of transactions || []) {
    if (tx.type !== 'uscita') continue;
    const regola = classificaCommissione(tx.description);
    if (regola) risultati.push({ tx, patternId: regola.id, label: regola.label, tassaStatale: regola.tassaStatale, amount: +tx.amount || 0 });
  }
  return risultati;
}

// Riepilogo onesto: totale commissioni VERE (controllate dalla banca) SEMPRE
// separato dal totale tasse di stato addebitate dalla banca per conto terzi
// (oggi solo il bollo) — mai un unico numero che confonda le due cose.
// `year` filtra su tx.date (stringa YYYY-MM-DD, come il resto del Vault).
export function bankFeesSummary(transactions, { year } = {}) {
  const rilevate = detectBankFees(transactions).filter((r) => !year || String(r.tx.date || '').startsWith(String(year)));
  const commissioniVere = rilevate.filter((r) => !r.tassaStatale);
  const tasseStato = rilevate.filter((r) => r.tassaStatale);
  const sumOf = (arr) => +arr.reduce((s, r) => s + r.amount, 0).toFixed(2);
  const perTipo = {};
  for (const r of commissioniVere) {
    perTipo[r.patternId] = perTipo[r.patternId] || { label: r.label, totale: 0, conteggio: 0 };
    perTipo[r.patternId].totale = +(perTipo[r.patternId].totale + r.amount).toFixed(2);
    perTipo[r.patternId].conteggio += 1;
  }
  return {
    totaleCommissioni: sumOf(commissioniVere),
    totaleTasseStato: sumOf(tasseStato),
    conteggioCommissioni: commissioniVere.length,
    perTipo: Object.entries(perTipo).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.totale - a.totale),
  };
}
