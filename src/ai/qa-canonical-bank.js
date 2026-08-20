// ============================================================
// BANCO DI ESEMPI CANONICI — riconoscimento AL PRIMO TENTATIVO
// ============================================================
// Differenza rispetto a qa-learning.js: lì il QA impara una formulazione
// SOLO dopo che QUESTO utente l'ha insegnata e confermata due volte — utile,
// ma inutile la primissima volta che qualcuno chiede qualcosa in un modo
// che i pattern fissi non prevedono. Qui invece un piccolo insieme di
// formulazioni CURATE (non insegnate dall'utente, verificate da chi scrive
// il codice) fa da riferimento semantico: se la domanda nuova è
// abbastanza VICINA nel significato a uno di questi esempi, si riconosce
// subito — zero addestramento necessario.
//
// Soglia più alta di quella usata per le correzioni imparate
// (qa-learning.js, SOGLIA_SIMILE_SEMANTICA=0,62): qui non c'è nessuna
// conferma esplicita dell'utente a fare da rete di sicurezza, quindi serve
// più margine prima di fidarsi — meglio restare onestamente "non capito"
// che rispondere alla domanda sbagliata.
//
// SOLO intenti che non richiedono di ESTRARRE un dato dal testo della
// domanda (un importo, un nome di categoria, un obiettivo) — per quelli
// ('affordability', 'causal', 'goal') forzare il riconoscimento su una
// parafrasi rischierebbe di far scattare l'intento senza il dato che gli
// serve per rispondere davvero. Meglio lasciarli ai pattern espliciti.
'use strict';

export const SOGLIA_CANONICA = 0.72;

export const ESEMPI_CANONICI = {
  // ── OTTO esempi per intento invece di quattro ──
  // La misura che ha deciso l'ampliamento: con un banco di 44 frasi lo spazio
  // di Momentum (spazio-momentum.js) sceglie geometria e soglia su pochissime
  // coppie, e la soglia calibrata risulta fragile. Piu' esempi = piu' coppie
  // = una geometria e una soglia stimate meglio, e non costa niente a runtime
  // (gli embedding del banco si calcolano una volta e restano in cache).
  //
  // Ogni intento ha ora: due formulazioni italiane piane, una colloquiale,
  // una lunga/contorta come la scrive chi ha fretta, due inglesi, una
  // spagnola e una francese. Il multilingue non e' decorazione: l'app
  // risponde in cinque lingue, e un banco solo italiano taglierebbe fuori
  // proprio chi non ha le parole chiave giuste.
  safeToSpend: [
    'quanto posso spendere oggi',
    'quanto mi posso permettere di spendere adesso senza problemi',
    'quanto ho da spendere oggi senza fare danni',
    'oggi quanto posso tirare fuori senza sballare il mese',
    'how much can I spend today',
    'what is safe to spend right now',
    'cuánto puedo gastar hoy',
    'combien puis-je dépenser aujourd\'hui',
  ],
  budgetLeft: [
    'quanto mi resta questa settimana',
    'quanto budget mi è rimasto',
    'quanto ho ancora da parte per questi giorni',
    'quanto mi avanza da qui a fine settimana',
    'how much budget do I have left',
    'what remains of my weekly budget',
    'cuánto me queda esta semana',
    'combien me reste-t-il cette semaine',
  ],
  monthEnd: [
    'come chiudo il mese',
    'come andrà a finire il mese con queste spese',
    'arrivo a fine mese o no',
    'di questo passo dove vado a finire questo mese',
    'how will I end the month',
    'am I going to overspend this month',
    'cómo termino el mes',
    'comment vais-je finir le mois',
  ],
  subscriptions: [
    'quali abbonamenti pago',
    'che abbonamenti ho attivi in questo momento',
    'quali addebiti fissi mi partono ogni mese',
    'che roba mi si rinnova automaticamente',
    'what subscriptions do I pay',
    'which recurring charges do I have',
    'qué suscripciones pago',
    'quels abonnements est-ce que je paie',
  ],
  topCategory: [
    'dove spendo di più',
    'qual è la mia spesa più grande questo mese',
    'dove mi scappano più soldi',
    'in cosa se ne vanno la maggior parte dei miei soldi',
    'where do I spend the most',
    'what is my biggest expense category',
    'en qué gasto más',
    'où est-ce que je dépense le plus',
  ],
  savings: [
    'quanto ho risparmiato',
    'quanto sono riuscito a mettere via questo mese',
    'quanto mi è rimasto in tasca alla fine',
    'sono riuscito a mettere da parte qualcosa',
    'how much have I saved',
    'what is my net savings this month',
    'cuánto he ahorrado',
    'combien ai-je économisé',
  ],
  income: [
    'quanto ho guadagnato',
    'quali sono state le mie entrate questo mese',
    'quanto mi è entrato in totale',
    'quanti soldi sono arrivati questo mese',
    'how much have I earned',
    'what was my income this month',
    'cuánto he ganado',
    'combien ai-je gagne',
  ],
  netWorth: [
    'quanto vale il mio patrimonio',
    'qual è la mia situazione patrimoniale complessiva',
    'a quanto ammonta tutto quello che possiedo',
    'sommando tutto quanto ho messo insieme',
    "what's my net worth",
    'how much am I worth in total',
    'cuánto vale mi patrimonio',
    'quel est mon patrimoine total',
  ],
  payday: [
    'quando mi pagano',
    'quanto manca al prossimo stipendio',
    'quanti giorni mancano allo stipendio',
    'fra quanto arriva il bonifico dello stipendio',
    'when do I get paid',
    'how many days until my next salary',
    'cuándo me pagan',
    'quand est-ce que je suis payé',
  ],
  bnplOwed: [
    'quanto devo ancora a rate',
    'quanto mi resta da pagare sui piani rateali',
    'quanto mi manca da saldare delle rate',
    'quanto ho ancora in ballo fra tutte le rate aperte',
    'how much do I still owe in installments',
    'what is my remaining balance on buy now pay later plans',
    'cuánto debo todavía a plazos',
    'combien me reste-t-il à payer en plusieurs fois',
  ],
  invest: [
    'quanto posso investire',
    'quanti soldi posso mettere da parte per investire senza rischi',
    'quanto mi avanza da poter investire',
    'quanto potrei mettere sugli investimenti senza restare scoperto',
    'how much can I invest',
    'what surplus do I have available to invest',
    'cuánto puedo invertir',
    'combien puis-je investir',
  ],
};

// Confronta `question` con OGNI esempio del banco tramite `similarity`
// (stessa firma sincrona di suggestLearnedIntent: (a,b) -> punteggio 0..1,
// precalcolata da embedding già in cache — src/ai/semantic-embed.js). Mai
// chiamata se `similarity` manca: senza un vero motore semantico questo
// banco non serve a niente (il confronto a parole lo fa già qa-learning.js
// sulle correzioni VERE dell'utente, più affidabili di esempi generici).
// `soglia` opzionale: quando il motore semantico ha CALIBRATO una soglia sul
// banco di questo dispositivo (src/ai/spazio-momentum.js), quella vince sulla
// costante scritta qui. Motivo misurato: correggendo la geometria dello spazio
// la scala si sposta, e una soglia fissa smette di funzionare — le domande
// imparentate finivano sotto 0,72 e non venivano piu' riconosciute.
export function matchCanonico(question, similarity, { soglia = null } = {}) {
  if (!similarity || !question) return null;
  const limite = Number.isFinite(soglia) ? soglia : SOGLIA_CANONICA;
  let best = null, bestScore = 0;
  for (const [intent, esempi] of Object.entries(ESEMPI_CANONICI)) {
    for (const esempio of esempi) {
      const score = similarity(question, esempio);
      if (score > bestScore) { bestScore = score; best = intent; }
    }
  }
  if (!best || bestScore < limite) return null;
  return { intent: best, confidenza: +bestScore.toFixed(2) };
}
