

const CAT_RULES = [
  { id: 'spesa', kw: ['esselunga', 'carrefour', 'coop', 'lidl', 'aldi', 'eurospin', 'conad', 'spesa', 'pam', 'tigros', 'despar', 'penny', 'md ', 'mercatone', 'sisa', 'iper', 'groceries', 'market'] },
  { id: 'ristoranti', kw: ['mcdonald', 'burger king', 'kfc', 'pizzeria', 'ristorante', ' bar ', 'caffè', 'cafe', 'trattoria', 'sushi', 'pizza', 'bistrot', 'starbucks', 'dinner', 'lunch'] },
  { id: 'trasporti', kw: ['atm ', 'trenord', 'trenitalia', 'italo', 'freccia', 'uber', 'taxi', 'autobus', 'metro', 'benzina', 'carburante', 'eni ', 'q8', 'bp ', 'ip ', 'parcheggio', 'toll', 'gasoline'] },
  { id: 'bollette', kw: ['enel', 'a2a', 'hera', 'bolletta', 'utenza', 'fastweb', 'vodafone', 'tim ', 'wind', 'iliad', 'fibra', 'electricity', 'gas bill'] },
  { id: 'shopping', kw: ['zara', 'h&m', 'amazon', 'zalando', 'nike', 'adidas', 'vestiti', 'scarpe', 'abbigliamento', 'apple', 'mediaworld', 'unieuro', 'decathlon', 'ikea', 'clothes', 'purchase'] },
  { id: 'salute', kw: ['farmacia', 'farmac', 'medico', 'dottore', 'visita', 'esame', 'analisi', 'dentista', 'ottico', 'fisioterapia', 'ospedale', 'pharmacy', 'doctor'] },
  { id: 'svago', kw: ['netflix', 'spotify', 'prime video', 'disney', 'cinema', 'teatro', 'concert', 'palestra', 'gym', 'sport', 'dazn', 'sky ', 'steam', 'playstation', 'xbox'] },
  { id: 'casa', kw: ['affitto', 'mutuo', 'condominio', 'pulizie', 'assicurazione', 'idraulico', 'elettricista', 'mobili', 'rent', 'mortgage'] },
  { id: 'stipendio', kw: ['stipendio', 'salario', 'bonifico', 'accredito', 'rimborso', 'salary', 'payroll'] }
];

const SYNONYMS = {
  'eni': 'carburante', 'q8': 'carburante', 'tamoil': 'carburante',
  'netflix': 'abbonamento', 'spotify': 'abbonamento', 'disneyplus': 'abbonamento',
  'esselunga': 'spesa', 'coop': 'spesa', 'conad': 'spesa',
  'zara': 'abbigliamento', 'h&m': 'abbigliamento', 'zalando': 'shopping',
  'mcdonalds': 'ristorante', 'kfc': 'ristorante', 'burgerking': 'ristorante'
};

const FUZZY_AMOUNTS_IT = {
  'zero': 0, 'uno': 1, 'due': 2, 'tre': 3, 'quattro': 4, 'cinque': 5, 'sei': 6, 'sette': 7, 'otto': 8, 'nove': 9, 'dieci': 10,
  'undici': 11, 'dodici': 12, 'tredici': 13, 'quattordici': 14, 'quindici': 15, 'sedici': 16, 'diciassette': 17, 'diciotto': 18, 'diciannove': 19,
  'venti': 20, 'trenta': 30, 'quaranta': 40, 'cinquanta': 50, 'sessanta': 60, 'settanta': 70, 'ottanta': 80, 'novanta': 90, 'cento': 100,
  'duecento': 200, 'trecento': 300, 'mille': 1000, 'una ventina': 20, 'una trentina': 30, 'una cinquantina': 50, 'quasi cento': 95, 'circa cento': 100
};


export { CAT_RULES, SYNONYMS, FUZZY_AMOUNTS_IT };
