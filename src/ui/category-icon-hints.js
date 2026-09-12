// Local, explainable name matching. The caller always preserves a manual choice.
const hints = {
  parcheggio: ['parcheggio','parking','parkeren','aparcamiento','estacionamento','stationnement','parken'],
  assicurazione: ['assicurazione','assicurazioni','insurance','versicherung','assurance','seguros','seguro','verzekering'],
  scuola: ['scuola','universita','school','education','schule','ecole','escuela','escola','onderwijs'],
  bambini: ['bambini','asilo','childcare','nursery','kinderbetreuung','creche','guarderia','kinderopvang'],
  spesa: ['supermercato','supermarket','groceries','supermarkt','supermarche','supermercado','boodschappen'],
  consegne: ['consegna','consegne','delivery','deliveries','lieferung','livraison','entrega','bezorging'],
  donazioni: ['donazione','donazioni','donation','donations','spenden','donaciones','donaties','donativos'],
  manutenzione: ['manutenzione','maintenance','wartung','entretien','mantenimiento','onderhoud','manutencao'],
  abbigliamento: ['abbigliamento','clothing','kleidung','vetements','ropa','kleding','roupa'],
  tecnologia: ['tecnologia','technology','technik','technologie','computer','laptop','smartphone'],
  alcolici: ['alcolici','alcool','alcohol','alcoholic','birra','beer','bier','biere','cerveza','cerveja','vino','wine','vin','vinho','wein'],
  tabacco: ['tabacco','tabaco','tabac','tobacco','tabak','sigarette','sigaretten','cigarettes','cigarette','cigarrillos','cigarros','zigaretten'],
  snack: ['snack','snacks','merenda','spuntino','chips','crisps','patatine','gouter','aperitivo','lanche'],
  trasporto: ['mezzi pubblici','trasporto pubblico','public transport','offentliche verkehrsmittel','transports en commun','transporte publico','openbaar vervoer','bus','autobus','metro','tram','treno','train','zug','trein','comboio'],
  caffe: ['caffe','cafe','coffee','kaffee','koffie','colazione','breakfast','fruhstuck','petit dejeuner','desayuno','ontbijt'],
  carburante: ['carburante','benzina','diesel','fuel','petrol','gasoline','gasolina','combustivel','carburant','benzin','brandstof','benzine'],
  sport: ['sport','sports','palestra','gym','fitness','yoga','pilates','sportschool','gimnasio','academia'],
  bellezza: ['bellezza','beauty','beauty salon','parrucchiere','hairdresser','friseur','coiffeur','peluqueria','kapper','cabeleireiro','cosmetici','cosmetics'],
  cinema: ['cinema','film','movies','netflix','streaming','kino','bioscoop'],
  gioco: ['gioco','giochi','videogiochi','gaming','games','playstation','xbox','videospiele','jeux','juegos','spelletjes','jogos'],
  libri: ['libro','libri','lettura','kindle','books','bucher','livres','libros','boeken','livros'],
  viaggi: ['viaggio','viaggi','volo','aereo','hotel','vacanza','travel','flights','reisen','voyage','viajes','reizen','viagem'],
  animali: ['cane','gatto','animali','veterinario','pet','pets','haustiere','animaux','mascotas','huisdieren','animais'],
  salute: ['farmacia','medico','dentista','salute','medicina','pharmacy','health','apotheke','sante','pharmacie','salud','gezondheid','saude'],
  regali: ['regalo','regali','compleanno','natale','gifts','geschenke','cadeaux','regalos','cadeaus','presentes'],
  casa: ['affitto','mutuo','casa','condominio','rent','home','miete','maison','loyer','alquiler','huur','aluguel'],
  musica: ['musica','concerto','spotify','music','musik','musique','muziek'],
  bollette: ['bolletta','bollette','fattura','utenze','internet','telefono','bills','utilities','rechnungen','factures','facturas','rekeningen','contas'],
};
export function suggestCategoryIcon(value) {
  const text = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!text) return null;
  return Object.entries(hints).find(([, words]) => words.some(word => ` ${text} `.includes(` ${word} `)))?.[0] ?? null;
}
