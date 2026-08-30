// ── Set di test HELD-OUT condiviso, per la categorizzazione (Nano/Meso/LogReg) ──
// Prima duplicato quasi identico in categorizer-bench.mjs e train-eval.mjs
// (stesso BASE/PREFIXES/SUFFIXES/noisify copiati due volte) — unificato qui,
// stesso principio già applicato al resto del progetto ("un solo posto per
// ogni testo/logica che appare in più punti", vedi project memory).
//
// STORIA: fino al 2026-08-30 il BASE copriva SOLO le 8 categorie originali
// (abbonamenti/crypto/etf/ristoranti/shopping/spesa/stipendio/trasporti) —
// le 7 categorie aggiunte dopo (casa/bollette/salute/istruzione/viaggi/
// svago/risparmio) non erano MAI misurate da nessun bench, nonostante
// LogReg le avesse già imparate (vedi public/momentum_logreg_model.json
// meta.gate.perCat) e Nano no. Esteso qui alle 15 categorie reali
// (src/core/constants.js ALL_CATS) con frasi DISGIUNTE da tutti i pool di
// training (src/ai/train/data-gen.mjs POOL/EURO/ANGLO/BRASILE/MORE) — mai
// lo stesso esercente in train e test, altrimenti il numero è gonfiato.
'use strict';

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BASE = {
  abbonamenti: ['netflix', 'spotify premium', 'disney plus', 'dazn', 'amazon prime', 'now tv', 'apple music', 'youtube premium', 'palestra mensile', 'telepass abbonamento'],
  crypto: ['binance acquisto btc', 'coinbase ethereum', 'kraken bitcoin', 'crypto exchange deposito', 'acquisto solana', 'bitpanda crypto', 'wallet btc ricarica'],
  etf: ['acquisto etf msci world', 'vanguard sp500', 'ishares etf global', 'pac etf mensile', 'directa acquisto etf', 'etf obbligazionario acquisto'],
  ristoranti: ['trattoria da mario', 'pizzeria bella napoli', 'sushi bar tokyo', 'ristorante il gambero', 'osteria del corso', 'mcdonalds', 'burger king', 'bar pasticceria centrale', 'kebab house'],
  shopping: ['zara abbigliamento', 'amazon marketplace', 'h m store', 'mediaworld elettronica', 'decathlon sport', 'zalando ordine', 'ikea mobili', 'sephora profumeria', 'libreria feltrinelli'],
  spesa: ['esselunga supermercato', 'coop alleanza', 'conad city', 'lidl italia', 'carrefour express', 'eurospin', 'pam panorama', 'mercato ortofrutta', 'penny market'],
  stipendio: ['accredito emolumenti azienda', 'stipendio mensile bonifico', 'salary payment', 'competenze mese corrente', 'bonifico stipendio srl', 'cedolino accredito'],
  trasporti: ['trenitalia biglietto', 'italo treno', 'atm milano ricarica', 'benzina q8', 'esso carburante', 'autostrade pedaggio', 'uber trip', 'taxi 3570', 'flixbus viaggio'],
  // ── 7 categorie estese qui il 2026-08-30, frasi verificate disgiunte da data-gen.mjs ──
  casa: ['rata leasing immobiliare', 'deposito cauzionale agenzia', 'spese notarili rogito', 'assicurazione incendio abitazione', 'canone locazione ufficio', 'quota ristrutturazione facciata'],
  bollette: ['bolletta gas naturale metano', 'fattura energia elettrica trimestrale', 'ricarica gas metano contatore', 'canone rai tv', 'bolletta telefono fisso fibra', 'fattura fornitura idrica comunale'],
  salute: ['esame diagnostico radiologia', 'visita specialistica cardiologo', 'intervento chirurgico day hospital', 'acquisto occhiali da vista', 'prestazione sanitaria privata', 'check up medico annuale'],
  istruzione: ['retta asilo nido comunale', 'quota iscrizione conservatorio', 'corso professionalizzante serale', 'abbonamento piattaforma e-learning', 'tassa esame stato professionale', 'materiale universitario libri testo'],
  viaggi: ['volo low cost prenotazione', 'noleggio auto aeroporto settimana', 'pacchetto viaggio tutto incluso', 'traghetto isola prenotazione', 'guida turistica tour organizzato', 'visto turistico consolato'],
  svago: ['biglietto stadio partita calcio', 'escape room gioco esperienza', 'abbonamento stagionale teatro lirico', 'ingresso parco acquatico estivo', 'noleggio attrezzatura sci montagna', 'torneo poker sala giochi'],
  risparmio: ['apertura conto deposito vincolato', 'versamento fondo pensione integrativo', 'accantonamento buffer liquidita', 'trasferimento verso libretto postale', 'sottoscrizione buoni fruttiferi', 'contributo cassa previdenza volontaria'],
  // ── 10 categorie SUBCAT (Fase 1, 2026-08-30) — frasi disgiunte dal pool
  // SUBCAT in src/ai/train/data-gen.mjs, stesso principio del resto. ──
  assicurazioni: ['polizza responsabilita civile', 'rinnovo assicurazione annuale', 'premio assicurativo abitazione', 'quota associativa assicurativa', 'copertura assicurativa viaggio', 'assicurazione animali domestici', 'car insurance renewal payment', 'home insurance annual premium'],
  commissioni: ['spese istruttoria pratica bancaria', 'commissione cambio assegno', 'penale chiusura anticipata conto', 'spese invio estratto conto cartaceo', 'overdraft charge notification', 'account maintenance fee monthly'],
  trasferimenti: ['movimento interno tra conti', 'spostamento fondi conto secondario', 'trasferimento verso conto cointestato', 'own account balance transfer'],
  regali: ['articolo da regalo confezionato', 'buono acquisto per anniversario', 'mazzo di fiori consegna', 'birthday present online order'],
  professionale: ['parcella professionista incarico', 'fattura consulenza tecnica', 'onorario perito tecnico', 'freelance invoice consulting fee'],
  rimborsi: ['accredito rimborso imposta', 'restituzione somma pagamento errato', 'rimborso viaggio cancellato', 'refund pending order cancelled'],
  scommesse: ['giocata al totocalcio', 'deposito piattaforma di gioco', 'puntata scommessa ippica', 'sports betting stake placed'],
  manutenzione: ['intervento urgente idraulico notturno', 'sostituzione guarnizione rubinetto', 'controllo impianto elettrico annuale', 'appliance repair callout fee'],
  animali: ['visita di controllo dal veterinario', 'acquisto cuccia per cane', 'trattamento antiparassitario animale', 'pet grooming appointment payment'],
  alcolici: ['bottega del vino acquisto', 'negozio specializzato superalcolici', 'acquisto cassa di birra artigianale', 'craft spirits online order'],
};

export const PREFIXES = ['PAGAMENTO POS ', 'SATISPAY*', 'ADDEBITO SDD ', 'CRV*', 'PAGAMENTO CARTA ', 'POS ', ''];
export const SUFFIXES = [' CARTA *4412', ' 05/07', ' MILANO ITA', ' EUR', '', ''];

function dropVowels(s, p, rnd) {
  return s.split('').filter(ch => !('aeiou'.includes(ch) && rnd() < p)).join('');
}

export function makeNoisify(rnd) {
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  return function noisify(text) {
    let t = text;
    const roll = rnd();
    if (roll < 0.3) t = t.toUpperCase();
    else if (roll < 0.45) t = t.split(' ').map(w => rnd() < 0.5 ? w.toUpperCase() : w).join(' ');
    if (rnd() < 0.25) t = t.replace(/ /g, ''); // concatenazione senza spazi
    if (rnd() < 0.25) t = dropVowels(t, 0.25, rnd); // vocali cadute (OCR/abbreviazioni)
    return pick(PREFIXES) + t + pick(SUFFIXES);
  };
}

// Costruisce il set held-out completo (15 categorie), deterministico.
export function buildHeldOutSet({ perCat = 60, seed = 20260706, categories = null } = {}) {
  const rnd = mulberry32(seed);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const noisify = makeNoisify(rnd);
  const cats = categories || Object.keys(BASE);
  const dataset = [];
  for (const cat of cats) {
    const phrases = BASE[cat];
    if (!phrases) continue;
    for (let i = 0; i < perCat; i++) dataset.push({ text: noisify(pick(phrases)), cat });
  }
  return dataset;
}
