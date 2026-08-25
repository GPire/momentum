// ============================================================
// RICONOSCIMENTO ACQUISTI DI TITOLI/CRIPTO dai parser di transazioni
// ============================================================
// Gap reale richiesto esplicitamente: un bonifico verso un broker o un
// exchange (Directa, Binance, Fineco...) oggi diventa solo una transazione
// categorizzata — non aggiorna MAI il portafoglio (VaultDAO.state.positions),
// che finora si poteva popolare SOLO con un CSV dedicato di posizioni
// (src/alpha/portfolio-import.js, mai collegato a un acquisto reale nel
// tempo). Qui si riconosce il caso "questa transazione sembra un acquisto"
// e si prova a leggere ticker/quantità dalla descrizione — quando NON sono
// chiari (`certo: false`), tocca all'interfaccia chiedere all'utente,
// MAI inventare un numero. Funzioni pure, nessun DOM, nessuna rete.
'use strict';

import { CRIPTO_ID_COINGECKO } from '../alpha/crypto-storico.js';

const PAROLE_BROKER = [
  'directa', 'fineco', 'degiro', 'trade republic', 'traderepublic', 'scalable capital',
  'interactive brokers', 'binance', 'coinbase', 'kraken', 'bitpanda', 'bitget',
  'etoro', 'xtb', 'ig markets', 'moneyfarm', 'freetrade',
];
const CATEGORIE_INVESTIMENTO = new Set(['etf', 'crypto', 'stock', 'investimenti', 'investments']);
const PAROLE_ACQUISTO = ['acquisto', 'acquisti', 'buy', 'compra', 'comprato', 'ordine eseguito', 'order filled', 'compravendita'];

const normalizza = (s) => String(s || '').toLowerCase();

// Una transazione "sembra" un acquisto di titoli/cripto se: è denaro in
// uscita, E (la categoria è già di tipo investimento, OPPURE il testo nomina
// un broker/exchange noto, OPPURE contiene una parola d'acquisto esplicita
// accanto a un token che sembra un ticker). Solo un primo filtro, grezzo per
// costruzione — l'estrazione dei dettagli sotto decide quanto ci si può
// fidare.
export function sembraAcquistoTitolo({ description, amount, category } = {}) {
  if (!(amount < 0)) return false;
  const d = normalizza(description);
  if (!d) return false;
  if (CATEGORIE_INVESTIMENTO.has(normalizza(category))) return true;
  if (PAROLE_BROKER.some((p) => d.includes(p))) return true;
  if (PAROLE_ACQUISTO.some((p) => d.includes(p)) && /\b[A-Z]{2,6}\b/.test(String(description || ''))) return true;
  return false;
}

const RE_QUANTITA_X_TICKER = /\b(\d+(?:[.,]\d+)?)\s*x\s*([A-Z]{2,6})\b/; // "10x AAPL", "2.5x BTC"
const RE_QUANTITA_PAROLA = /(\d+(?:[.,]\d+)?)\s*(?:azion[ei]|quote|titoli|shares?|units?)\b/i;
const RE_TICKER_MAIUSCOLO = /\b([A-Z]{2,6})\b/g;
const RE_PREZZO_UNITARIO = /(?:@|\ba\s)\s*(\d+(?:[.,]\d+)?)/i;
// BUG REALE TROVATO DAI TEST: "BINANCE*ORDER ETH" prendeva "ORDER" (il primo
// token maiuscolo, non un ticker) invece di "ETH"; "Bonifico a Directa SPA"
// prendeva "SPA" (abbreviazione societaria italiana, non un ticker). Un
// token maiuscolo qualsiasi non basta — serve escludere il vocabolario
// bancario/societario comune che è quasi sempre tutto maiuscolo per motivi
// che non c'entrano niente con un ticker.
const PAROLE_NON_TICKER = new Set([
  'ORDER', 'SPA', 'SRL', 'LTD', 'INC', 'LLC', 'PLC', 'SA', 'AG', 'BV', 'NV', 'GMBH', 'CORP',
  'ATM', 'POS', 'IBAN', 'BIC', 'SWIFT', 'REF', 'RIF', 'CRO', 'TRN', 'ID',
  'EUR', 'USD', 'GBP', 'CHF', 'JPY',
  'PAY', 'PAYMENT', 'CARD', 'DEBIT', 'CREDIT', 'BONIFICO', 'SEPA', 'ACH',
]);
function trovaTickerPlausibile(testo) {
  const m = [...String(testo || '').matchAll(RE_TICKER_MAIUSCOLO)];
  const candidato = m.find((match) => !PAROLE_NON_TICKER.has(match[1]));
  return candidato ? candidato[1] : null;
}

// Prova a leggere ticker/quantità/prezzo dalla descrizione. Mai
// un'invenzione: un campo non trovato con certezza resta `null`.
// Async (2026-08-25, richiesto esplicitamente: rendere il riconoscimento
// "più avanzato"): quando ticker/cripto non emergono da un pattern esplicito,
// riusa trovaAziendaInTesto (screener-settore.js, già testato — confine di
// parola vero, stesso motore del QA di mercato) per riconoscere un nome
// d'azienda scritto per esteso ("ho comprato azioni Apple" → AAPL), invece
// di limitarsi a un token maiuscolo esplicito. Import dinamico apposta: il
// pannello aziende (2,9MB) non deve pesare su OGNI import bancario, solo
// quando il resto non ha già trovato un ticker.
export async function estraiDettagliAcquisto(description, { criptoMap = CRIPTO_ID_COINGECKO } = {}) {
  const testo = String(description || '');
  let quantity = null, ticker = null, prezzoUnitario = null;

  const mX = testo.match(RE_QUANTITA_X_TICKER);
  if (mX && !PAROLE_NON_TICKER.has(mX[2].toUpperCase())) {
    quantity = parseFloat(mX[1].replace(',', '.'));
    ticker = mX[2].toUpperCase();
  } else {
    const mQ = testo.match(RE_QUANTITA_PAROLA);
    if (mQ) quantity = parseFloat(mQ[1].replace(',', '.'));
    ticker = trovaTickerPlausibile(testo);
  }
  const mP = testo.match(RE_PREZZO_UNITARIO);
  if (mP) prezzoUnitario = parseFloat(mP[1].replace(',', '.'));

  // Cripto citata per nome ("bitcoin", "eth"), non solo come ticker maiuscolo.
  if (!ticker) {
    const chiave = Object.keys(criptoMap).find((k) => new RegExp(`\\b${k}\\b`, 'i').test(testo));
    if (chiave) ticker = chiave.toUpperCase();
  }

  // Nome azienda per esteso, o conferma del ticker già trovato — SEMPRE
  // tentato (non solo come ultima risorsa), e ha PRECEDENZA sul match
  // grezzo del regex quando trova qualcosa. BUG REALE TROVATO DAI TEST: le
  // estrazioni bancarie sono spesso TUTTE MAIUSCOLE ("ACQUISTO 5 AZIONI DI
  // NVIDIA") — il regex ingenuo prendeva "NVIDIA" come se fosse già un
  // ticker valido (6 lettere maiuscole, non in lista d'esclusione), invece
  // del vero ticker NVDA. trovaAziendaInTesto (screener-settore.js, già
  // testato, confine di parola vero) riconosce sia ticker sia nomi per
  // esteso: quando risolve qualcosa, è più affidabile del regex grezzo. Se
  // il pannello non è disponibile (offline, errore sul chunk), si resta sul
  // match grezzo invece di rompere l'intero import per questo.
  try {
    const { trovaAziendaInTesto } = await import('../alpha/screener-settore.js');
    const az = trovaAziendaInTesto(testo);
    if (az?.ticker) ticker = az.ticker;
  } catch (_) { /* onesto: resta il match grezzo, se c'era */ }

  return {
    ticker, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : null, prezzoUnitario,
    certo: !!(ticker && Number.isFinite(quantity) && quantity > 0),
  };
}

// Il punto d'ingresso per un parser/import: dato l'oggetto transazione
// (description/amount/category, la stessa forma già usata dal resto della
// categorizzazione), dice se sembra un acquisto e cosa si è capito. Se
// `rilevato:true` e `certo:false`, l'interfaccia deve chiedere all'utente —
// mai assumere una quantità.
export async function rilevaAcquistoTitolo(transazione) {
  if (!sembraAcquistoTitolo(transazione)) return { rilevato: false };
  return { rilevato: true, ...(await estraiDettagliAcquisto(transazione?.description)) };
}

// Aggiorna (o crea) una posizione dopo un acquisto REALE nel tempo: se il
// ticker esiste già, la quantità si SOMMA e il prezzo medio di carico si
// ricalcola ponderato — mai una sovrascrittura che cancella lo storico. È
// deliberatamente diverso da mergePositions (multi-import.js), che
// sostituisce perché un CSV di portafoglio è uno snapshot completo, non un
// singolo acquisto incrementale.
export function aggiornaPosizioneConAcquisto(positions, { ticker, quantity, prezzoUnitario, assetClass = 'stock', currency = 'USD' } = {}) {
  if (!ticker || !Number.isFinite(quantity) || quantity <= 0) return positions || [];
  const elenco = [...(positions || [])];
  const i = elenco.findIndex((p) => p.ticker === ticker);
  const prezzo = Number.isFinite(prezzoUnitario) && prezzoUnitario > 0 ? prezzoUnitario : null;
  if (i < 0) {
    elenco.push({ ticker, assetClass, quantity, avgPrice: prezzo || 0, currency });
    return elenco;
  }
  const esistente = elenco[i];
  const nuovaQuantita = (esistente.quantity || 0) + quantity;
  const nuovoPrezzoMedio = prezzo
    ? (((esistente.quantity || 0) * (esistente.avgPrice || 0)) + (quantity * prezzo)) / nuovaQuantita
    : esistente.avgPrice;
  elenco[i] = { ...esistente, quantity: nuovaQuantita, avgPrice: Number.isFinite(nuovoPrezzoMedio) ? +nuovoPrezzoMedio.toFixed(4) : esistente.avgPrice };
  return elenco;
}
