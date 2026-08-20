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
  safeToSpend: [
    'quanto posso spendere oggi',
    'quanto mi posso permettere di spendere adesso senza problemi',
    'how much can I spend today',
    'what is safe to spend right now',
  ],
  budgetLeft: [
    'quanto mi resta questa settimana',
    'quanto budget mi è rimasto',
    'how much budget do I have left',
    'what remains of my weekly budget',
  ],
  monthEnd: [
    'come chiudo il mese',
    'come andrà a finire il mese con queste spese',
    'how will I end the month',
    'am I going to overspend this month',
  ],
  subscriptions: [
    'quali abbonamenti pago',
    'che abbonamenti ho attivi in questo momento',
    'what subscriptions do I pay',
    'which recurring charges do I have',
  ],
  topCategory: [
    'dove spendo di più',
    'qual è la mia spesa più grande questo mese',
    'where do I spend the most',
    'what is my biggest expense category',
  ],
  savings: [
    'quanto ho risparmiato',
    'quanto sono riuscito a mettere via questo mese',
    'how much have I saved',
    'what is my net savings this month',
  ],
  income: [
    'quanto ho guadagnato',
    'quali sono state le mie entrate questo mese',
    'how much have I earned',
    'what was my income this month',
  ],
  netWorth: [
    'quanto vale il mio patrimonio',
    'qual è la mia situazione patrimoniale complessiva',
    "what's my net worth",
    'how much am I worth in total',
  ],
  payday: [
    'quando mi pagano',
    'quanto manca al prossimo stipendio',
    'when do I get paid',
    'how many days until my next salary',
  ],
  bnplOwed: [
    'quanto devo ancora a rate',
    'quanto mi resta da pagare sui piani rateali',
    'how much do I still owe in installments',
    'what is my remaining balance on buy now pay later plans',
  ],
  invest: [
    'quanto posso investire',
    'quanti soldi posso mettere da parte per investire senza rischi',
    'how much can I invest',
    'what surplus do I have available to invest',
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
