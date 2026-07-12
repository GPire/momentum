// ============================================================
// GENERATORE DATI DI TRAINING — qualità eccezionale, ogni simulazione (W0.2)
// ============================================================
// Genera descrizioni bancarie realistiche e SPORCHE per addestrare i modelli
// IN LOCALE. Pool di esercenti REALI multilingua (IT/ES/FR/DE/PT/EN),
// deliberatamente DIVERSI da quelli del bench (bench/categorizer-bench.mjs) →
// il bench resta un test HELD-OUT onesto (niente leakage → niente numeri
// gonfiati). Ogni tipo di rumore reale degli estratti conto è simulato.
'use strict';

// RNG deterministico (riproducibilità = numeri onesti).
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pool esercenti reali per categoria — ampio e multilingua. NON include i
// merchant del bench (esselunga/coop/lidl/netflix/binance…): quelli restano
// per il test held-out. Qui ci sono esercenti diversi ma della stessa classe,
// così il modello impara i PATTERN di categoria, non a memoria.
export const POOL = {
  spesa: ['gigante supermercati', 'famiglia cooperativa', 'in\'s mercato', 'prezzemolo vitale', 'naturasi bio',
    'mercadona compra', 'dia supermercado', 'edeka markt', 'rewe city', 'aldi sud', 'super u courses',
    'intermarche', 'jumbo boodschappen', 'pao de acucar mercado', 'continente modelo', 'grocery store',
    'alimentari rossi', 'macelleria bovina', 'panificio del corso', 'fruttivendolo', 'minimarket 24h',
    'supermercato di quartiere', 'discount alimentare', 'ipermercato periferia', 'bottega alimentari', 'market bio naturale',
    'salumeria gastronomia', 'pescheria del porto', 'forno pane fresco', 'drogheria storica', 'cash and carry',
    'mercato rionale', 'spaccio aziendale', 'emporio alimentare', 'negozio surgelati', 'enoteca vini spesa'],
  ristoranti: ['osteria del ponte', 'antica trattoria', 'pizzeria vesuvio', 'sushi zen', 'poke house milano',
    'hamburgueria do centro', 'cerveceria catalana', 'brasserie du marche', 'gasthaus zur post', 'taberna ibérica',
    'ramen ya', 'wok express', 'gelato artigianale', 'caffe del teatro', 'birrificio artigianale', 'churrascaria',
    'bistro parisien', 'padaria portuguesa', 'food truck tacos', 'street food market',
    'trattoria toscana', 'ristorante pesce', 'pizzeria napoletana', 'hamburgeria gourmet', 'sushi all you can',
    'tavola calda pranzo', 'paninoteca centro', 'gastronomia da asporto', 'pub irlandese birra', 'wine bar aperitivo',
    'caffetteria colazione', 'pasticceria dolci', 'creperia dessert', 'steakhouse grill', 'cucina messicana',
    'ristorante cinese', 'thai food', 'kebab doner', 'fast food drive', 'osteria vino cucina'],
  shopping: ['boutique eleganza', 'calzature rossi', 'gioielleria oro', 'ottica visione', 'elettronica store',
    'el corte fashion', 'galeries lafayette', 'saturn elektro', 'fnac store', 'worten eletronica',
    'brico center', 'obi baumarkt', 'toys planet', 'profumeria luxe', 'ottica avanti', 'concept store',
    'outlet village', 'cartolibreria', 'negozio sport', 'pet shop amici',
    'moda donna store', 'abbigliamento uomo', 'scarpe sportive shop', 'borse pelletteria', 'orologeria svizzera',
    'casalinghi bazar', 'arredamento design', 'mobili moderni', 'giocattoli bimbo', 'libreria universitaria',
    'ferramenta utensili', 'elettrodomestici casa', 'telefonia mobile store', 'computer notebook shop', 'videogiochi console',
    'cosmetici beauty', 'intimo lingerie', 'occhiali da sole', 'articoli regalo', 'negozio biciclette'],
  abbonamenti: ['hbo max', 'paramount plus', 'sky sport', 'nowtv sport', 'fitness club mensile',
    'gym membership', 'napster music', 'kindle unlimited', 'notion pro', 'adobe creative', 'github pro',
    'coursera plus', 'medium membership', 'patreon mensile', 'abbonamento rivista', 'canone servizio',
    'newsletter premium', 'cloud storage', 'vpn annuale', 'software licenza',
    'abbonamento palestra', 'quota mensile club', 'rinnovo streaming video', 'sottoscrizione musica', 'canone piattaforma',
    'membership annuale', 'abbonamento giornale', 'servizio cloud mensile', 'licenza software annua', 'iscrizione corso online',
    'abbonamento trasporti mensile', 'tessera annuale', 'rinnovo antivirus', 'piano premium app', 'abbonamento tv digitale'],
  trasporti: ['grab taxi', 'cabify viaje', 'bolt ride', 'renfe billete', 'sncf voyage', 'deutsche bahn',
    'metro valencia', 'bus urbano', 'noleggio auto', 'car2go minuti', 'shell stazione', 'agip rifornimento',
    'total carburant', 'repsol gasolina', 'pedaggio autostradale', 'parcheggio centro', 'ricarica elettrica',
    'traghetto linea', 'aliscafo', 'funivia'],
  stipendio: ['accredito compenso', 'bonifico retribuzione', 'pagamento prestazione', 'onorario professionale',
    'nomina empresa', 'gehalt firma', 'salaire entreprise', 'salario mensal', 'wage payment', 'fattura saldata',
    'compenso collaboratore', 'rimborso spese lavoro', 'anticipo stipendio', 'quattordicesima', 'premio produzione'],
  etf: ['acquisto fondo indice', 'quota etf azionario', 'etf obbligazionario', 'etf mercati emergenti',
    'jpmorgan etf', 'blackrock fund', 'state street spdr', 'ubs etf', 'pictet fund', 'pimco bond',
    'piano accumulo indice', 'sottoscrizione fondo', 'etf world equity', 'etf dividend', 'etf tecnologico',
    'etf sp500 acquisto', 'etf nasdaq 100', 'etf msci emerging', 'etf europe stoxx', 'etf oro fisico',
    'etf sanita healthcare', 'etf energia pulita', 'fondo pensione quota', 'trade republic etf', 'scalable capital etf',
    'etf immobiliare reit', 'etf small cap', 'etf value factor', 'etf momentum', 'gestione patrimoniale fondo'],
  crypto: ['acquisto token', 'exchange deposito', 'gemini bitcoin', 'bitstamp ethereum', 'crypto.com carta',
    'nexo interessi', 'ledger acquisto', 'metamask swap', 'uniswap scambio', 'defi staking', 'nft acquisto',
    'polkadot dot', 'avalanche avax', 'chainlink link', 'wallet freddo'],
};

// Categorie del bench (per allineare le etichette).
export const CATEGORIES = Object.keys(POOL);

const PREFIXES = ['PAGAMENTO POS ', 'SATISPAY*', 'ADDEBITO SDD ', 'CRV*', 'PAGAMENTO CARTA ', 'POS ', 'BONIFICO ', 'ADEBITO ', 'OPER ', 'ACQUISTO ', ''];
const SUFFIXES = [' CARTA *4412', ' 05/07', ' MILANO ITA', ' EUR', ' REF.12345', ' ORE 14:32', ' COD.998', ' BARCELONA ESP', ' PARIS FRA', '', '', ''];

// Ogni tipo di rumore reale + simulazioni aggiuntive: maiuscole, vocali cadute
// (OCR/abbreviazioni), concatenazione, troncamento, typo, cifre inserite.
function noisify(text, rnd) {
  let t = text;
  const roll = rnd();
  if (roll < 0.3) t = t.toUpperCase();
  else if (roll < 0.5) t = t.split(' ').map(w => rnd() < 0.5 ? w.toUpperCase() : w).join(' ');
  if (rnd() < 0.22) t = t.replace(/ /g, '');                                  // concatenazione
  if (rnd() < 0.22) t = t.split('').filter(ch => !('aeiou'.includes(ch) && rnd() < 0.25)).join(''); // vocali cadute
  if (rnd() < 0.12 && t.length > 8) t = t.slice(0, Math.floor(t.length * (0.6 + rnd() * 0.3))); // troncamento
  if (rnd() < 0.12) { const i = Math.floor(rnd() * t.length); t = t.slice(0, i) + t.slice(i + 1); } // typo (drop char)
  if (rnd() < 0.15) t = t + ' ' + Math.floor(rnd() * 900 + 100);              // codice numerico
  return PREFIXES[Math.floor(rnd() * PREFIXES.length)] + t + SUFFIXES[Math.floor(rnd() * SUFFIXES.length)];
}

// Genera un dataset [[testo, categoria], ...] con `perCat` esempi per categoria.
export function generateDataset({ perCat = 400, seed = 12345 } = {}) {
  const rnd = mulberry32(seed);
  const data = [];
  for (const [cat, merchants] of Object.entries(POOL)) {
    for (let i = 0; i < perCat; i++) {
      const m = merchants[Math.floor(rnd() * merchants.length)];
      data.push([noisify(m, rnd), cat]);
    }
  }
  // shuffle finale
  for (let i = data.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [data[i], data[j]] = [data[j], data[i]]; }
  return data;
}
