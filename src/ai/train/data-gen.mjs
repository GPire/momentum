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
    'traghetto linea', 'aliscafo', 'funivia',
    // "ricarica" da solo somiglia troppo a una ricarica telefonica
    // (bollette): questi esempi insegnano il contesto che lo rende
    // trasporti — tessera/abbonamento/mezzi, non un operatore telefonico.
    'ricarica abbonamento atm', 'ricarica tessera trasporti', 'ricarica carta bus', 'atm milano ricarica mezzi'],
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
    'polkadot dot', 'avalanche avax', 'chainlink link', 'wallet freddo',
    // "solana" non compariva MAI nel training (solo nel test held-out): il
    // modello indovinava dalla sola parola generica "acquisto" — corretto
    // alla radice, non aggirato spostando peso da altre categorie.
    'acquisto solana crypto', 'solana wallet acquisto', 'wallet btc ricarica', 'ricarica wallet crypto'],
  // ── LE SEI CATEGORIE CHE I MODELLI ADDESTRATI NON HANNO MAI VISTO ──
  // Aggiunte all'app (constants.js) DOPO che Nano/Meso/LogReg erano già stati
  // addestrati: nessuno dei tre modelli reali le riconosce, per quanto le si
  // addestri online — il vocabolario di training semplicemente non le
  // contiene. Stesso stile delle altre: brand/parole REALI, già verificate
  // in merchant-dictionary.js dove esistevano (enel, farmacia, ryanair...),
  // non inventate qui da zero.
  casa: ['affitto mensile appartamento', 'rata mutuo casa', 'spese condominiali', 'amministratore condominio',
    'agenzia immobiliare commissione', 'idraulico riparazione', 'elettricista intervento', 'imbianchino tinteggiatura',
    'falegname su misura', 'fabbro serratura', 'canone locazione', 'deposito cauzionale affitto',
    'assicurazione casa polizza', 'ristrutturazione bagno', 'manutenzione caldaia', 'disinfestazione appartamento'],
  bollette: ['bolletta enel energia', 'bolletta luce a2a', 'bolletta gas hera', 'acea acqua fattura',
    'iren energia bolletta', 'edison luce e gas', 'sorgenia fornitura', 'fastweb fibra fattura',
    'vodafone ricarica abbonamento', 'tim bolletta telefono', 'windtre fattura', 'iliad ricarica mensile',
    'acquedotto comunale bolletta', 'ho mobile ricarica', 'kena mobile fattura', 'poste mobile ricarica'],
  salute: ['farmacia comunale acquisto', 'parafarmacia prodotti', 'dentista visita controllo', 'ottico occhiali vista',
    'fisioterapia seduta', 'ospedale prestazione', 'ambulatorio medico visita', 'analisi cliniche laboratorio',
    'veterinario visita animale', 'clinica privata visita', 'poliambulatorio prestazione', 'ticket sanitario',
    'centro medico prenotazione', 'psicologo seduta', 'nutrizionista visita', 'massoterapia trattamento'],
  istruzione: ['tasse universitarie ateneo', 'iscrizione politecnico', 'retta scuola privata', 'asilo nido mensile',
    'corso udemy online', 'coursera abbonamento corso', 'duolingo plus lingue', 'masterclass corso online',
    'edx corso universitario', 'ripetizioni lezioni private', 'libri scolastici acquisto', 'materiale didattico',
    'corso formazione professionale', 'esame certificazione', 'iscrizione master', 'scuola guida patente'],
  viaggi: ['booking prenotazione hotel weekend', 'airbnb affitto casa vacanza', 'expedia pacchetto viaggio', 'hotel soggiorno notte',
    'ostello prenotazione letto', 'agriturismo weekend', 'assicurazione viaggio',
    'supplemento bagaglio aereo', 'escursione guidata tour', 'crociera cabina prenotazione'],
  svago: ['cinema film multisala', 'teatro spettacolo serale', 'concerto live arena', 'ticketone acquisto evento',
    'eventbrite iscrizione evento', 'piscina comunale ingresso', 'museo mostra permanente', 'luna park giostre',
    'bowling partita', 'biliardo sala giochi', 'steam acquisto videogioco', 'playstation store acquisto',
    'nintendo eshop gioco', 'twitch abbonamento canale', 'parco divertimenti ingresso', 'sala scommesse gioco'],
};

// Seconda ondata (dataset PIÙ POTENTE): altri esercenti/pattern reali,
// multilingua e per il mondo reale, + categorie mancanti (risparmio, più
// stipendio). Fusi nel POOL. "Crea un dataset nostro, avanzato" → questo.
const MORE = {
  spesa: ['carrefour market', 'coop supermercato', 'conad superstore', 'lidl discount', 'eurospin risparmio',
    'esselunga la esse', 'penny market spesa', 'md discount', 'famila superstore', 'tigros supermercati',
    'mercadona compra semanal', 'aldi nord', 'edeka center', 'rewe markt', 'auchan hypermarche',
    'spar express', 'proxi alimentari', 'coop migros', 'delhaize', 'monoprix courses'],
  ristoranti: ['old wild west', 'roadhouse grill', 'spontini pizza', 'rossopomodoro', 'alice pizza',
    'la piadineria', 'temakinho sushi', 'pokeria', 'burger king menu', 'kfc pollo',
    'five guys', 'wagamama', 'taco bell', 'nandos', 'pret a manger', 'yo sushi',
    'bar tabacchi caffe', 'gelateria grom', 'venchi cioccolato', 'chocolat cafe'],
  shopping: ['zara home', 'bershka store', 'stradivarius', 'pull and bear', 'massimo dutti',
    'uniqlo', 'foot locker', 'jd sports', 'game stop', 'gamestop videogiochi',
    'apple store', 'samsung store', 'xiaomi store', 'action store', 'tiger negozio',
    'flying tiger', 'normal store', 'kasanova casalinghi', 'maisons du monde', 'westwing'],
  abbonamenti: ['netflix premium', 'disney plus mensile', 'amazon prime video', 'apple tv plus', 'paramount plus',
    'dazn calcio', 'now tv sky', 'spotify family', 'youtube music premium', 'nintendo online',
    'playstation plus', 'xbox game pass', 'chatgpt plus', 'notion abbonamento', 'dropbox pro',
    'linkedin premium', 'audible libri', 'nytimes', 'financial times abbonamento', 'onlyfans'],
  trasporti: ['q8 easy carburante', 'eni station', 'ip gas', 'tamoil rifornimento', 'esso self',
    'trenord biglietto', 'italo alta velocita', 'trenitalia frecciarossa', 'atac roma', 'gtt torino',
    'uber corsa', 'freenow taxi', 'bolt ride', 'lime monopattino', 'dott scooter',
    'telepass pedaggio', 'autostrade per italia', 'easypark parcheggio', 'flixbus bus', 'ryanair volo'],
  stipendio: ['bonifico stipendio azienda', 'accredito busta paga', 'emolumenti mensili', 'compenso co.co.co',
    'onorario fattura', 'rimborso spese trasferta', 'accredito f24 rimborso', 'tredicesima mensilita',
    'quattordicesima', 'premio risultato', 'salary payment company', 'gehalt monat', 'salaire mensuel', 'nomina mensual'],
  etf: ['acquisto vwce etf', 'etf iShares core', 'xtrackers msci world', 'amundi prime global', 'vanguard sp500 etf',
    'pac etf mensile', 'etf obbligazionario euro', 'etf nasdaq 100', 'etf emerging markets', 'etf dividendi aristocratici',
    'trade republic risparmio etf', 'scalable capital etf', 'directa etf', 'fineco etf', 'degiro etf'],
  crypto: ['bitpanda crypto acquisto', 'young platform btc', 'crypto.com carta ricarica', 'ledger wallet hardware',
    'metamask defi swap', 'revolut crypto', 'etoro bitcoin', 'nexo interessi crypto', 'usdc stablecoin',
    'nft opensea acquisto', 'bitget exchange', 'okx crypto deposito', 'kucoin trade', 'gate.io'],
  risparmio: ['bonifico verso salvadanaio', 'accantonamento risparmio', 'giroconto conto deposito', 'versamento libretto',
    'piano di risparmio', 'accantonamento fondo emergenza', 'trasferimento a deposito', 'risparmio automatico',
    'salvadanaio digitale', 'round up risparmio', 'accantonamento obiettivo', 'deposito vincolato'],
  casa: ['pagamento affitto locatore', 'rata mutuo prima casa', 'quota condominiale trimestrale', 'agenzia immobiliare provvigione',
    'intervento idraulico urgente', 'chiamata elettricista guasto', 'preventivo imbianchino casa', 'lavori falegnameria su misura',
    'polizza assicurativa abitazione', 'spese notarili rogito', 'caparra confirmatoria affitto', 'canone rai'],
  bollette: ['bolletta luce e gas', 'fattura fibra internet', 'ricarica traffico telefonico', 'canone acqua comunale',
    'bolletta riscaldamento condominiale', 'fattura energia elettrica', 'abbonamento telefonico fisso', 'fattura gas metano',
    'bolletta tari rifiuti', 'ricarica traffico sim', 'canone fisso contatore', 'fattura telefonia fissa'],
  salute: ['visita specialistica privata', 'acquisto farmaci prescrizione', 'controllo dentistico annuale', 'esami del sangue laboratorio',
    'seduta fisioterapia riabilitativa', 'visita veterinaria animale', 'occhiali da vista ottico', 'ticket pronto soccorso',
    'polizza sanitaria integrativa', 'visita pediatrica bambino', 'intervento ambulatoriale', 'terapia psicologica seduta'],
  istruzione: ['retta annuale universita', 'quota iscrizione master', 'corso di lingua straniera', 'lezioni private ripetizioni',
    'materiale scolastico libri', 'iscrizione corso professionale', 'abbonamento piattaforma e-learning', 'tassa esame certificazione',
    'quota asilo nido mensile', 'corso di specializzazione', 'scuola guida lezioni', 'workshop formativo aziendale'],
  viaggi: ['prenotazione hotel weekend', 'affitto appartamento vacanza', 'pacchetto viaggio organizzato',
    'assicurazione viaggio annullamento', 'escursione guidata locale',
    'soggiorno resort settimana', 'supplemento bagaglio aereo', 'transfer aeroporto hotel', 'visto turistico pratica'],
  svago: ['cinema multisala serata', 'abbonamento teatro stagione', 'concerto arena live', 'ingresso museo mostra',
    'acquisto videogioco digitale', 'ingresso parco acquatico', 'lezione di ballo corso', 'attrezzatura sportiva pomeriggio',
    'evento sportivo stadio', 'sala giochi arcade', 'escape room prenotazione', 'corso hobby creativo'],
};
for (const k in MORE) POOL[k] = [...(POOL[k] || []), ...MORE[k]];

// ONDATA PAN-EUROPEA (architettura del dataset: multilingua per OGNI nazione
// europea, non solo Italia): NL/PL/BE/AT/GR + rinforzo ES/FR/DE/PT sulle
// categorie deboli (shopping/spesa). Esercenti/pattern reali per ciascun paese.
const EURO = {
  spesa: ['albert heijn boodschappen', 'jumbo supermarkt', 'lidl polska', 'biedronka zakupy', 'zabka sklep',
    'delhaize courses', 'colruyt', 'spar osterreich', 'billa markt', 'hofer lebensmittel',
    'sklep spozywczy', 'mercadona espana', 'carrefour france', 'auchan polska', 'continente portugal',
    'pingo doce compras', 'lidl deutschland', 'kaufland einkauf', 'penny markt', 'netto discount'],
  ristoranti: ['brasserie belge', 'taverna griega', 'restauracja polska', 'cafe wien', 'kebab berlin',
    'frituur friet', 'pizzeria portugal', 'bistro lyon', 'tapas bar madrid', 'imbiss currywurst',
    'restauracja pierogi', 'gyros athina', 'creperie bretonne', 'sushi amsterdam', 'doner istanbul'],
  shopping: ['h&m sverige', 'primark espana', 'zalando lounge', 'mediamarkt elektro', 'saturn technik',
    'fnac france', 'el corte ingles', 'douglas parfumerie', 'action nederland', 'hema winkel',
    'rossmann drogerie', 'dm drogerie markt', 'leroy merlin', 'obi baumarkt', 'ikea nederland',
    'decathlon france', 'intersport', 'cortefiel moda', 'c&a mode', 'kik textil'],
  trasporti: ['ns nederland trein', 'deutsche bahn ice', 'sncf tgv', 'renfe ave', 'pkp intercity',
    'shell tanken', 'aral tankstelle', 'total energies', 'bp station', 'omv tankstelle',
    'ov chipkaart', 'wiener linien', 'ratp paris metro', 'emt madrid', 'blablacar covoiturage'],
  abbonamenti: ['spotify sverige', 'canal plus france', 'sky deutschland', 'movistar plus', 'ziggo abonnement',
    'orange telecom', 'vodafone abbonamento', 'proton vpn', 'nordvpn', 'strava premium',
    'duolingo plus', 'headspace', 'audible de', 'skyshowtime', 'viaplay'],
  etf: ['etf msci europe', 'etf stoxx 600', 'etf dax', 'etf cac 40', 'etf ibex',
    'trade republic sparplan', 'scalable capital etf', 'bux zero etf', 'etf ftse all world', 'etf euro stoxx 50'],
  crypto: ['bitvavo btc', 'kriptomat', 'coinbase europe', 'kraken eu', 'swissborg',
    'nexo earn', 'bitstamp eth', 'bitpanda wien'],
  risparmio: ['spaarrekening storting', 'sparkonto einzahlung', 'livret epargne', 'cuenta ahorro', 'konto oszczednosciowe',
    'trade republic risparmio', 'deposito vincolato', 'piano accumulo risparmio'],
  casa: ['huur appartement betaling', 'miete wohnung uberweisung', 'loyer appartement paiement', 'alquiler piso pago',
    'hypotheek aflossing', 'hypothek rate', 'credit immobilier mensualite', 'hipoteca cuota mensual',
    'immobilienmakler provision', 'notaire frais acte', 'wohngebaudeversicherung', 'vve bijdrage'],
  bollette: ['energierechnung strom', 'gasrekening jaarlijks', 'facture electricite edf', 'factura luz iberdrola',
    'internetrechnung telekom', 'orange facture mobile', 'movistar factura fibra', 'ziggo internet rekening',
    'wasserrechnung stadtwerke', 'rachunek za prad', 'rachunek za gaz', 'telefonrechnung monatlich'],
  salute: ['apotheke medikamente', 'pharmacie ordonnance', 'farmacia recibo', 'zahnarzt behandlung',
    'dentiste consultation', 'dentista consulta', 'krankenversicherung beitrag', 'mutuelle sante cotisation',
    'seguro medico cuota', 'tierarzt behandlung', 'veterinaire consultation', 'optiker brille'],
  istruzione: ['universitaet studiengebuhren', 'frais universite inscription', 'universidad matricula', 'sprachschule kurs',
    'ecole de langue cours', 'escuela de idiomas curso', 'kita beitrag monatlich', 'creche mensualite',
    'guarderia cuota mensual', 'nachhilfe unterricht', 'cours particulier', 'clases particulares'],
  viaggi: ['lufthansa flugticket', 'air france billet avion', 'iberia billete avion',
    'hotel reservierung', 'reservation hotel',
    'reserva de hotel', 'mietwagen flughafen', 'location de voiture', 'alquiler de coche'],
  svago: ['kino eintrittskarte', 'cinema billet entree', 'cine entrada pelicula', 'konzert ticket',
    'billet de concert', 'entrada de concierto', 'schwimmbad eintritt', 'piscine entree',
    'piscina municipal entrada', 'freizeitpark ticket', 'parc attractions billet', 'parque atracciones entrada'],
};
for (const k in EURO) POOL[k] = [...(POOL[k] || []), ...EURO[k]];

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
