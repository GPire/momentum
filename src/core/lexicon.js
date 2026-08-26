

// Spagnolo aggiunto 2026-08-26 (catene/parole reali, non inventate — stesso
// principio già seguito per le keyword italiane: marchi noti + parole di uso
// comune, mai termini troppo corti/ambigui che genererebbero falsi positivi
// diffusi, es. "ave" scartato di proposito). CAT_RULES è la PRIMA passata di
// NeuralNexus.predict() (src/ai/neural-nexus.js:337, confidenza 75 se
// matcha) — prima di questa aggiunta, un utente con transazioni descritte
// in spagnolo cadeva sempre sul fallback Naive Bayes/priors di riserva,
// mai su queste regole ad alta precisione.
const CAT_RULES = [
  { id: 'spesa', kw: ['esselunga', 'carrefour', 'coop', 'lidl', 'aldi', 'eurospin', 'conad', 'spesa', 'pam', 'tigros', 'despar', 'penny', 'md ', 'mercatone', 'sisa', 'iper', 'groceries', 'market', 'mercadona', 'alcampo', 'eroski', 'consum', 'supermercado'] },
  { id: 'ristoranti', kw: ['mcdonald', 'burger king', 'kfc', 'pizzeria', 'ristorante', ' bar ', 'caffè', 'cafe', 'trattoria', 'sushi', 'pizza', 'bistrot', 'starbucks', 'dinner', 'lunch', 'restaurante', 'cafetería', 'cafeteria', 'comida'] },
  { id: 'trasporti', kw: ['atm ', 'trenord', 'trenitalia', 'italo', 'freccia', 'uber', 'taxi', 'autobus', 'metro', 'benzina', 'carburante', 'eni ', 'q8', 'bp ', 'ip ', 'parcheggio', 'toll', 'gasoline', 'renfe', 'cercanías', 'cercanias', 'repsol', 'cepsa', 'gasolina', 'gasolinera', 'autobús', 'peaje'] },
  { id: 'bollette', kw: ['enel', 'a2a', 'hera', 'bolletta', 'utenza', 'fastweb', 'vodafone', 'tim ', 'wind', 'iliad', 'fibra', 'electricity', 'gas bill', 'iberdrola', 'endesa', 'naturgy', 'movistar', 'orange', 'factura de la luz', 'factura del agua', 'recibo de la luz'] },
  { id: 'shopping', kw: ['zara', 'h&m', 'amazon', 'zalando', 'nike', 'adidas', 'vestiti', 'scarpe', 'abbigliamento', 'apple', 'mediaworld', 'unieuro', 'decathlon', 'ikea', 'clothes', 'purchase', 'el corte inglés', 'el corte ingles', 'mango', 'ropa'] },
  { id: 'salute', kw: ['farmacia', 'farmac', 'medico', 'dottore', 'visita', 'esame', 'analisi', 'dentista', 'ottico', 'fisioterapia', 'ospedale', 'pharmacy', 'doctor', 'médico', 'hospital', 'fisioterapeuta'] },
  { id: 'svago', kw: ['netflix', 'spotify', 'prime video', 'disney', 'cinema', 'teatro', 'concert', 'palestra', 'gym', 'sport', 'dazn', 'sky ', 'steam', 'playstation', 'xbox', 'gimnasio', 'entradas'] },
  { id: 'casa', kw: ['affitto', 'mutuo', 'condominio', 'pulizie', 'assicurazione', 'idraulico', 'elettricista', 'mobili', 'rent', 'mortgage', 'alquiler', 'hipoteca', 'seguro del hogar', 'fontanero', 'electricista'] },
  { id: 'istruzione', kw: ['universita', 'universität', 'scuola', 'corso', 'retta', 'tasse universitarie', 'libri scolastici', 'iscrizione esame', 'tuition', 'school fee', 'university', 'universidad', 'colegio', 'matrícula', 'matricula'] },
  { id: 'viaggi', kw: ['ryanair', 'easyjet', 'volotea', 'wizzair', 'ita airways', 'booking', 'airbnb', 'hotel', 'volo', 'aeroporto', 'valigia', 'trivago', 'expedia', 'flight', 'vueling', 'iberia', 'vuelo', 'aeropuerto', 'maleta'] },
  { id: 'stipendio', kw: ['stipendio', 'salario', 'bonifico', 'accredito', 'rimborso', 'salary', 'payroll', 'nómina', 'nomina', 'sueldo', 'transferencia recibida'] }
];

const SYNONYMS = {
  'eni': 'carburante', 'q8': 'carburante', 'tamoil': 'carburante',
  'netflix': 'abbonamento', 'spotify': 'abbonamento', 'disneyplus': 'abbonamento',
  'esselunga': 'spesa', 'coop': 'spesa', 'conad': 'spesa',
  'zara': 'abbigliamento', 'h&m': 'abbigliamento', 'zalando': 'shopping',
  'mcdonalds': 'ristorante', 'kfc': 'ristorante', 'burgerking': 'ristorante',
  'mercadona': 'spesa', 'iberdrola': 'bollette', 'endesa': 'bollette',
  'renfe': 'trasporti', 'repsol': 'carburante', 'elcorteingles': 'shopping',
};

const FUZZY_AMOUNTS_IT = {
  'zero': 0, 'uno': 1, 'due': 2, 'tre': 3, 'quattro': 4, 'cinque': 5, 'sei': 6, 'sette': 7, 'otto': 8, 'nove': 9, 'dieci': 10,
  'undici': 11, 'dodici': 12, 'tredici': 13, 'quattordici': 14, 'quindici': 15, 'sedici': 16, 'diciassette': 17, 'diciotto': 18, 'diciannove': 19,
  'venti': 20, 'trenta': 30, 'quaranta': 40, 'cinquanta': 50, 'sessanta': 60, 'settanta': 70, 'ottanta': 80, 'novanta': 90, 'cento': 100,
  'duecento': 200, 'trecento': 300, 'mille': 1000, 'una ventina': 20, 'una trentina': 30, 'una cinquantina': 50, 'quasi cento': 95, 'circa cento': 100
};


export { CAT_RULES, SYNONYMS, FUZZY_AMOUNTS_IT };
