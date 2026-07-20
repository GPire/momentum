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

const CLIENTI = ['Studio Rossi', 'Acme SRL', 'Beta SpA', 'Bianchi & Partners', 'Delta Consulting', 'Omega Group', 'cliente Verdi', 'MediaLab SRL', 'TechnoItalia', 'Studio Legale Neri', 'Alfa Digital', 'Gamma Servizi'];
const AZIENDE = ['Azienda SpA', 'Datore SRL', 'Industrie Riunite', 'Metalmeccanica SRL', 'Gruppo Retail', 'Logistica Italia'];
const PERSONE = ['Mario', 'Luca', 'Giulia', 'papà', 'mamma', 'Marco Rossi', 'Anna', 'nonna'];

// Ogni classe: generatori di frase (parametrici, con varietà reale).
const TEMPLATES = {
  invoice: [
    (r, p) => `Fattura n.${1 + Math.floor(r() * 90)} ${p(CLIENTI)}`,
    (r, p) => `Compenso prestazione ${p(['consulenza', 'sviluppo', 'progettazione', 'formazione', 'grafica'])} ${p(CLIENTI)}`,
    (r, p) => `Parcella ${p(CLIENTI)}`,
    (r, p) => `Saldo fattura ${p(CLIENTI)}`,
    (r, p) => `Acconto fattura ${p(CLIENTI)}`,
    (r, p) => `Onorario professionale ${p(CLIENTI)}`,
    (r, p) => `Invoice ${p(CLIENTI)} consulting`,
    (r, p) => `Corrispettivo ${p(CLIENTI)}`,
    (r, p) => `Compenso collaborazione ${p(CLIENTI)}`,
  ],
  salary: [
    (r, p) => `Stipendio ${p(['mensile', 'del mese', ''])} ${p(AZIENDE)}`,
    (r, p) => `Cedolino ${p(AZIENDE)}`,
    (r, p) => `Busta paga ${p(AZIENDE)}`,
    (r, p) => `Retribuzione ${p(AZIENDE)}`,
    (r, p) => `Emolumenti ${p(AZIENDE)}`,
    (r, p) => `Salary payment ${p(AZIENDE)}`,
    (r, p) => `Tredicesima ${p(AZIENDE)}`,
    (r, p) => `Accredito stipendio ${p(AZIENDE)}`,
  ],
  personal: [
    (r, p) => `Rimborso ${p(['spese', 'benzina', 'viaggio', 'anticipo'])}`,
    (r, p) => `Bonifico da ${p(PERSONE)}`,
    (r, p) => `Transfer from ${p(PERSONE)}`,
    (r, p) => `Regalo ${p(['compleanno', 'laurea', 'natale'])}`,
    (r, p) => `Giroconto ${p(['conti', 'risparmio', ''])}`,
    (r, p) => `Interessi ${p(['maturati', 'conto', 'deposito'])}`,
    (r, p) => `Dividendo ${p(['ASML', 'ETF', 'azioni', 'VanEck'])}`,
    (r, p) => `Cashback ${p(['Revolut', 'carta', 'acquisti'])}`,
    (r, p) => `Refund ${p(['Amazon', 'ordine', 'reso'])}`,
    (r, p) => `Restituzione prestito ${p(PERSONE)}`,
    (r, p) => `Storno ${p(['pagamento', 'addebito'])}`,
    (r, p) => `Bonus ${p(['Revolut', 'benvenuto', 'fedeltà'])}`,
  ],
};

const PREFIX = ['', '', 'BONIFICO ', 'ACCREDITO ', 'SEPA CREDIT ', 'CRV*', 'IN ENTRATA '];
const SUFFIX = ['', '', ` ${new Date().getFullYear()}`, ' EUR', ' IT', ' 05/07'];

function noisify(text, r) {
  let t = text;
  const roll = r();
  if (roll < 0.25) t = t.toUpperCase();
  else if (roll < 0.4) t = t.split(' ').map(w => r() < 0.5 ? w.toUpperCase() : w).join(' ');
  const pre = PREFIX[Math.floor(r() * PREFIX.length)];
  const suf = SUFFIX[Math.floor(r() * SUFFIX.length)];
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
