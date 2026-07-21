// Generatore di dataset sintetico per il MODELLO FISCALE delle entrate
// (Wave v10): 3 classi — invoice (fattura P.IVA) / salary (stipendio, tassato
// alla fonte) / personal (rimborsi, regali, interessi, giroconti). Descrizioni
// realistiche IT+EN (export Revolut/banche), rumore bancario. RNG deterministico
// → dataset riproducibile bit-per-bit. Onestà: dati sintetici DICHIARATI,
// servono ad addestrare un classificatore reale (HashedLogReg), non a gonfiare
// un numero. Stesso pattern di src/ai/train/data-gen.mjs.

export function mulberry32(seed) {
  return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const CLIENTI = ['Studio Rossi', 'Acme SRL', 'Beta SpA', 'Bianchi & Partners', 'Delta Consulting', 'Omega Group', 'cliente Verdi', 'MediaLab SRL', 'TechnoItalia', 'Studio Legale Neri', 'Alfa Digital', 'Gamma Servizi', 'Rossi & Figli', 'Nuvola Software', 'Marketing Lab', 'Edizioni Ferro', 'Clinica San Marco', 'Fotostudio Luce', 'Agenzia Blu', 'Ristorante Da Gino'];
const AZIENDE = ['Azienda SpA', 'Datore SRL', 'Industrie Riunite', 'Metalmeccanica SRL', 'Gruppo Retail', 'Logistica Italia', 'Ospedale Civile', 'Comune di Milano', 'Scuola Media Dante', 'Supermercati Sole'];
const PERSONE = ['Mario', 'Luca', 'Giulia', 'papà', 'mamma', 'Marco Rossi', 'Anna', 'nonna', 'zio Beppe', 'Francesca', 'il coinquilino'];
// Piattaforme freelance/pagamenti: gli incassi da queste per un professionista
// sono REDDITO da fatturare (problema reale del settore: molti li scambiano per
// "entrate personali"). Etichettati invoice con contesto esplicito di payout.
const PIATTAFORME = ['Stripe', 'PayPal Business', 'Upwork', 'Fiverr', 'Gumroad', 'Amazon KDP', 'Etsy', 'Shopify Payments'];

// Ogni classe: generatori di frase (parametrici, con varietà reale IT+EN+ES).
const TEMPLATES = {
  invoice: [
    (r, p) => `Fattura n.${1 + Math.floor(r() * 90)} ${p(CLIENTI)}`,
    (r, p) => `Compenso prestazione ${p(['consulenza', 'sviluppo', 'progettazione', 'formazione', 'grafica', 'traduzione', 'fotografia', 'redazione'])} ${p(CLIENTI)}`,
    (r, p) => `Parcella ${p(CLIENTI)}`,
    (r, p) => `Saldo fattura ${p(CLIENTI)}`,
    (r, p) => `Acconto fattura ${p(CLIENTI)}`,
    (r, p) => `Onorario professionale ${p(CLIENTI)}`,
    (r, p) => `Invoice ${p(CLIENTI)} consulting`,
    (r, p) => `Corrispettivo ${p(CLIENTI)}`,
    (r, p) => `Compenso collaborazione ${p(CLIENTI)}`,
    (r, p) => `Notula ${p(CLIENTI)}`,
    (r, p) => `Pagamento fattura ${p(CLIENTI)}`,
    // Payout piattaforme = reddito professionale (contesto esplicito)
    (r, p) => `${p(PIATTAFORME)} payout`,
    (r, p) => `${p(PIATTAFORME)} earnings ${p(['payout', 'transfer', ''])}`,
    (r, p) => `Accredito ${p(PIATTAFORME)} vendite`,
    // ES (espansione mercato)
    (r, p) => `Factura ${p(CLIENTI)}`,
    (r, p) => `Honorarios ${p(['profesionales', 'consultoria'])} ${p(CLIENTI)}`,
  ],
  salary: [
    (r, p) => `Stipendio ${p(['mensile', 'del mese', ''])} ${p(AZIENDE)}`,
    (r, p) => `Cedolino ${p(AZIENDE)}`,
    (r, p) => `Busta paga ${p(AZIENDE)}`,
    (r, p) => `Retribuzione ${p(AZIENDE)}`,
    (r, p) => `Emolumenti ${p(AZIENDE)}`,
    (r, p) => `Salary payment ${p(AZIENDE)}`,
    (r, p) => `Tredicesima ${p(AZIENDE)}`,
    (r, p) => `Quattordicesima ${p(AZIENDE)}`,
    (r, p) => `Accredito stipendio ${p(AZIENDE)}`,
    (r, p) => `Netto in busta ${p(AZIENDE)}`,
    // Pensione = reddito tassato alla fonte come lo stipendio (problema utenti maturi)
    (r, p) => `Pensione ${p(['INPS', 'del mese', 'mensile'])}`,
    (r, p) => `Rata pensione INPS`,
    (r, p) => `Nómina ${p(AZIENDE)}`, // ES
  ],
  personal: [
    (r, p) => `Rimborso ${p(['spese', 'benzina', 'viaggio', 'anticipo', 'medico'])}`,
    (r, p) => `Rimborso ${p(['IRPEF', '730', 'IRPEF su conto', 'modello 730'])}`, // fiscale = non reddito nuovo
    (r, p) => `Bonifico da ${p(PERSONE)}`,
    (r, p) => `Transfer from ${p(PERSONE)}`,
    (r, p) => `Regalo ${p(['compleanno', 'laurea', 'natale'])}`,
    (r, p) => `Giroconto ${p(['conti', 'risparmio', 'tra i miei conti', ''])}`,
    (r, p) => `Interessi ${p(['maturati', 'conto', 'deposito', 'attivi'])}`,
    (r, p) => `Dividendo ${p(['ASML', 'ETF', 'azioni', 'VanEck', 'Enel'])}`,
    (r, p) => `Cashback ${p(['Revolut', 'carta', 'acquisti'])}`,
    (r, p) => `Refund ${p(['Amazon', 'ordine', 'reso', 'Booking'])}`,
    (r, p) => `Restituzione prestito ${p(PERSONE)}`,
    (r, p) => `Storno ${p(['pagamento', 'addebito'])}`,
    (r, p) => `Bonus ${p(['Revolut', 'benvenuto', 'fedeltà'])}`,
    (r, p) => `Vincita ${p(['scommessa', 'lotteria', 'gioco'])}`,
    (r, p) => `PayPal da ${p(PERSONE)}`, // personale (contrasto col PayPal Business)
    (r, p) => `Devolución ${p(['compra', 'pedido'])}`, // ES
  ],
};

const PREFIX = ['', '', 'BONIFICO ', 'ACCREDITO ', 'SEPA CREDIT ', 'CRV*', 'IN ENTRATA ', 'POS ', 'IST.SEPA '];
// Suffissi deterministici; il numero di riferimento si genera con l'RNG del
// dataset in noisify (niente Math.random → riproducibilità bit-per-bit).
const SUFFIX = ['', '', ` ${new Date().getFullYear()}`, ' EUR', ' IT', ' 05/07', ' RIF', ' *1234', ' TRN00'];

function noisify(text, r) {
  let t = text;
  const roll = r();
  if (roll < 0.25) t = t.toUpperCase();
  else if (roll < 0.4) t = t.split(' ').map(w => r() < 0.5 ? w.toUpperCase() : w).join(' ');
  const pre = PREFIX[Math.floor(r() * PREFIX.length)];
  let suf = SUFFIX[Math.floor(r() * SUFFIX.length)];
  if (suf === ' RIF') suf = ` rif.${1000 + Math.floor(r() * 8999)}`; // rif deterministico
  return (pre + t + suf).trim();
}

// Ritorna coppie [text, label] pronte per trainHashedLogReg.
export function generateIncomeDataset({ perClass = 400, seed = 4242 } = {}) {
  const r = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const out = [];
  for (const [label, tmpls] of Object.entries(TEMPLATES)) {
    for (let i = 0; i < perClass; i++) {
      const t = tmpls[Math.floor(r() * tmpls.length)](r, pick);
      out.push([noisify(t, r), label]);
    }
  }
  return out;
}

export const INCOME_CLASSES = Object.keys(TEMPLATES);
