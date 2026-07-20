// ============================================================
// MEMORIA SEMANTICA — la "neocorteccia" di Momentum (W2)
// ============================================================
// Base di conoscenza finanziaria CURATA e CITABILE: fatti/regole verificabili
// dai grandi principi (Graham/Bogle/Dalio/Buffett) e dalle basi fiscali IT.
// NON è un modello addestrato né un LLM: è un insieme di regole con condizioni
// esplicite, ciascuna con la sua FONTE. Complementa la memoria episodica (DCGN,
// "cosa ha fatto l'utente") con la memoria semantica ("cosa è vero in finanza").
// Rende NeuroSym un ragionatore che spiega: "consiglio X perché regola R".
// Onestà (regola #1): ogni regola è un principio pubblico e verificabile, con
// il guardrail "non è consulenza finanziaria personalizzata".
'use strict';

// Ogni regola: id, statement (spiegazione umana, italiano = lingua di
// riferimento), statements (traduzioni EN/ES/FR/DE/PT per il chatbot
// multilingua; fallback all'italiano se manca la lingua), source
// (principio/autore, invariato tra le lingue), topic (per il retrieval),
// applies(ctx) → bool (quando è pertinente), priority (0-100, quanto è
// fondante). ctx è il profilo finanziario derivato dai dati dell'utente
// (tutto on-device).
export const RULES = [
  {
    id: 'emergency-fund-first',
    topic: ['investire', 'risparmio', 'emergenza', 'rischio'],
    statement: 'Prima di investire, tieni un fondo d\'emergenza di 3-6 mesi di spese su un conto liquido. Serve a non dover vendere gli investimenti in perdita quando arriva un imprevisto.',
    statements: {
      en: 'Before investing, keep an emergency fund of 3-6 months of expenses in a liquid account. It keeps you from having to sell investments at a loss when the unexpected happens.',
      es: 'Antes de invertir, mantén un fondo de emergencia de 3-6 meses de gastos en una cuenta líquida. Sirve para no tener que vender las inversiones en pérdida cuando llega un imprevisto.',
      fr: 'Avant d\'investir, garde un fonds d\'urgence de 3-6 mois de dépenses sur un compte liquide. Il évite de devoir vendre tes investissements à perte quand survient un imprévu.',
      de: 'Bevor du investierst, halte einen Notgroschen von 3-6 Monatsausgaben auf einem liquiden Konto. So musst du bei einem Notfall keine Investments mit Verlust verkaufen.',
      pt: 'Antes de investir, mantenha uma reserva de emergência de 3-6 meses de despesas em uma conta líquida. Ela evita ter que vender investimentos no prejuízo quando surge um imprevisto.',
    },
    source: 'Principio di gestione del rischio personale (Graham, Bogle)',
    priority: 95,
    applies: (ctx) => ctx.wantsToInvest && (ctx.emergencyMonths ?? 0) < 3,
  },
  {
    id: 'high-interest-debt-first',
    topic: ['debiti', 'investire', 'interessi'],
    statement: 'Estinguere un debito ad alto interesse (carte revolving, prestiti al consumo) rende in modo garantito quanto il suo tasso: spesso più di un investimento medio. Viene prima di investire.',
    statements: {
      en: 'Paying off high-interest debt (revolving cards, consumer loans) yields its rate, guaranteed: often more than an average investment. It comes before investing.',
      es: 'Saldar una deuda con intereses altos (tarjetas revolving, préstamos al consumo) rinde de forma garantizada tanto como su tasa: a menudo más que una inversión media. Va antes de invertir.',
      fr: 'Rembourser une dette à taux élevé (cartes revolving, crédits conso) rapporte de façon garantie autant que son taux : souvent plus qu\'un investissement moyen. Cela passe avant d\'investir.',
      de: 'Hochverzinste Schulden (Revolving-Karten, Konsumkredite) zu tilgen bringt garantiert so viel wie ihr Zinssatz: oft mehr als eine durchschnittliche Anlage. Das kommt vor dem Investieren.',
      pt: 'Quitar uma dívida com juros altos (cartões rotativos, crédito ao consumo) rende de forma garantida o valor da sua taxa: muitas vezes mais que um investimento médio. Vem antes de investir.',
    },
    source: 'Aritmetica del costo opportunità',
    priority: 92,
    applies: (ctx) => ctx.wantsToInvest && ctx.hasHighInterestDebt,
  },
  {
    id: 'diversification-reduces-variance',
    topic: ['investire', 'etf', 'rischio', 'diversificazione'],
    statement: 'Un ETF ampiamente diversificato riduce la varianza rispetto a poche azioni singole, senza ridurre il rendimento atteso di mercato: è "l\'unico pasto gratis" in finanza.',
    statements: {
      en: 'A broadly diversified ETF reduces variance compared to a few single stocks, without lowering the expected market return: it is "the only free lunch" in finance.',
      es: 'Un ETF ampliamente diversificado reduce la varianza frente a pocas acciones individuales, sin reducir el rendimiento esperado de mercado: es "el único almuerzo gratis" de las finanzas.',
      fr: 'Un ETF largement diversifié réduit la variance par rapport à quelques actions isolées, sans réduire le rendement attendu du marché : c\'est « le seul repas gratuit » de la finance.',
      de: 'Ein breit gestreuter ETF senkt die Varianz gegenüber wenigen Einzelaktien, ohne die erwartete Marktrendite zu mindern: das "einzige kostenlose Mittagessen" der Finanzwelt.',
      pt: 'Um ETF amplamente diversificado reduz a variância em relação a poucas ações isoladas, sem reduzir o retorno esperado do mercado: é "o único almoço grátis" das finanças.',
    },
    source: 'Markowitz (teoria del portafoglio) / Bogle (indicizzazione)',
    priority: 85,
    applies: (ctx) => ctx.wantsToInvest,
  },
  {
    id: 'costs-compound-negatively',
    topic: ['etf', 'costi', 'commissioni', 'investire'],
    statement: 'I costi si compongono al contrario: una commissione annua dell\'1% su 30 anni può erodere oltre un quarto del capitale finale. A parità di strategia, preferisci strumenti a basso costo.',
    statements: {
      en: 'Costs compound in reverse: a 1% annual fee over 30 years can erode more than a quarter of the final capital. For the same strategy, prefer low-cost instruments.',
      es: 'Los costes se componen al revés: una comisión anual del 1% en 30 años puede erosionar más de un cuarto del capital final. A igual estrategia, prefiere instrumentos de bajo coste.',
      fr: 'Les frais se composent à l\'envers : 1% de frais annuels sur 30 ans peuvent éroder plus d\'un quart du capital final. À stratégie égale, préfère les instruments à bas coût.',
      de: 'Kosten wirken beim Zinseszins negativ: 1% Jahresgebühr über 30 Jahre kann mehr als ein Viertel des Endkapitals aufzehren. Bei gleicher Strategie wähle kostengünstige Instrumente.',
      pt: 'Os custos se compõem ao contrário: uma taxa anual de 1% em 30 anos pode corroer mais de um quarto do capital final. Na mesma estratégia, prefira instrumentos de baixo custo.',
    },
    source: 'Bogle (the cost matters hypothesis)',
    priority: 80,
    applies: (ctx) => ctx.wantsToInvest,
  },
  {
    id: 'time-in-market',
    topic: ['investire', 'interesse composto', 'orizzonte'],
    statement: 'L\'interesse composto premia il TEMPO nel mercato più del tempismo. Iniziare presto con importi piccoli batte spesso iniziare tardi con importi grandi.',
    statements: {
      en: 'Compound interest rewards TIME in the market more than timing. Starting early with small amounts often beats starting late with large ones.',
      es: 'El interés compuesto premia el TIEMPO en el mercado más que el tempismo. Empezar pronto con importes pequeños suele ganar a empezar tarde con importes grandes.',
      fr: 'Les intérêts composés récompensent le TEMPS passé sur le marché plus que le timing. Commencer tôt avec de petits montants bat souvent commencer tard avec de gros montants.',
      de: 'Der Zinseszins belohnt die ZEIT im Markt mehr als das Timing. Früh mit kleinen Beträgen anzufangen schlägt oft spätes Anfangen mit großen Beträgen.',
      pt: 'Os juros compostos premiam o TEMPO no mercado mais que o timing. Começar cedo com valores pequenos muitas vezes vence começar tarde com valores grandes.',
    },
    source: 'Interesse composto (matematica finanziaria)',
    priority: 82,
    applies: (ctx) => ctx.wantsToInvest,
  },
  {
    id: 'risk-needs-horizon',
    topic: ['rischio', 'orizzonte', 'investire'],
    statement: 'Più alto è il rischio (azioni, crypto), più lungo deve essere l\'orizzonte: servono anni per assorbire i ribassi. Denaro che ti serve a breve NON va in asset volatili.',
    statements: {
      en: 'The higher the risk (stocks, crypto), the longer the horizon must be: it takes years to absorb downturns. Money you need soon does NOT belong in volatile assets.',
      es: 'Cuanto mayor es el riesgo (acciones, cripto), más largo debe ser el horizonte: hacen falta años para absorber las caídas. El dinero que necesitas a corto plazo NO va en activos volátiles.',
      fr: 'Plus le risque est élevé (actions, crypto), plus l\'horizon doit être long : il faut des années pour absorber les baisses. L\'argent dont tu as besoin à court terme ne va PAS dans des actifs volatils.',
      de: 'Je höher das Risiko (Aktien, Krypto), desto länger muss der Horizont sein: Es braucht Jahre, um Kursrückgänge zu verkraften. Geld, das du bald brauchst, gehört NICHT in volatile Anlagen.',
      pt: 'Quanto maior o risco (ações, cripto), mais longo deve ser o horizonte: são necessários anos para absorver as quedas. Dinheiro de que você precisa em breve NÃO vai em ativos voláteis.',
    },
    source: 'Relazione rischio-orizzonte (Dalio, asset allocation)',
    priority: 88,
    applies: (ctx) => ctx.wantsToInvest,
  },
  {
    id: 'dca-reduces-timing-risk',
    topic: ['pac', 'investire', 'volatilità'],
    statement: 'Un piano di accumulo (PAC) a importi costanti riduce il rischio di tempismo: compri di più quando i prezzi scendono e di meno quando salgono, mediando il prezzo di carico.',
    statements: {
      en: 'A savings plan with constant amounts (dollar-cost averaging) reduces timing risk: you buy more when prices fall and less when they rise, averaging your entry price.',
      es: 'Un plan de aportaciones periódicas de importe constante reduce el riesgo de tempismo: compras más cuando los precios bajan y menos cuando suben, promediando el precio de entrada.',
      fr: 'Un plan d\'investissement programmé à montants constants réduit le risque de timing : tu achètes plus quand les prix baissent et moins quand ils montent, en moyennant ton prix d\'entrée.',
      de: 'Ein Sparplan mit konstanten Beträgen senkt das Timing-Risiko: Du kaufst mehr, wenn die Kurse fallen, und weniger, wenn sie steigen, und mittelst so deinen Einstiegspreis.',
      pt: 'Um plano de aportes constantes reduz o risco de timing: você compra mais quando os preços caem e menos quando sobem, fazendo a média do preço de entrada.',
    },
    source: 'Dollar-cost averaging',
    priority: 75,
    applies: (ctx) => ctx.wantsToInvest,
  },
  {
    id: 'correlation-not-causation',
    topic: ['ragionamento', 'causale', 'previsione'],
    statement: 'Correlazione non implica causalità: due voci di spesa che si muovono insieme possono avere una causa comune, non un legame diretto. Le catene causali vanno verificate, non dedotte dalla sola co-occorrenza.',
    statements: {
      en: 'Correlation does not imply causation: two spending items that move together may share a common cause, not a direct link. Causal chains must be verified, not inferred from co-occurrence alone.',
      es: 'Correlación no implica causalidad: dos gastos que se mueven juntos pueden tener una causa común, no un vínculo directo. Las cadenas causales se verifican, no se deducen de la sola co-ocurrencia.',
      fr: 'Corrélation n\'implique pas causalité : deux postes de dépense qui évoluent ensemble peuvent avoir une cause commune, pas un lien direct. Les chaînes causales se vérifient, elles ne se déduisent pas de la seule co-occurrence.',
      de: 'Korrelation bedeutet nicht Kausalität: Zwei Ausgabenposten, die sich gemeinsam bewegen, können eine gemeinsame Ursache haben, keinen direkten Zusammenhang. Kausalketten muss man prüfen, nicht aus bloßem Gleichlauf ableiten.',
      pt: 'Correlação não implica causalidade: dois gastos que se movem juntos podem ter uma causa comum, não um vínculo direto. Cadeias causais devem ser verificadas, não deduzidas da simples coocorrência.',
    },
    source: 'Metodo statistico (inferenza causale)',
    priority: 70,
    applies: () => true,
  },
  {
    id: 'forfettario-set-aside',
    topic: ['tasse', 'partita iva', 'forfettario'],
    statement: 'In regime forfettario l\'imposta sostitutiva si calcola sul reddito imponibile (ricavi × coefficiente di redditività), al netto dei contributi INPS versati. Accantonare a ogni incasso evita la sorpresa a scadenza.',
    statements: {
      en: 'Under the Italian flat-rate regime ("forfettario") the substitute tax is computed on taxable income (revenue × profitability coefficient), net of INPS contributions paid. Setting aside at every payment received avoids the surprise at the deadline.',
      es: 'En el régimen "forfettario" italiano el impuesto sustitutivo se calcula sobre la renta imponible (ingresos × coeficiente de rentabilidad), neto de las cotizaciones INPS pagadas. Apartar en cada cobro evita la sorpresa al vencimiento.',
      fr: 'Dans le régime forfaitaire italien, l\'impôt substitutif se calcule sur le revenu imposable (recettes × coefficient de rentabilité), net des cotisations INPS versées. Mettre de côté à chaque encaissement évite la surprise à l\'échéance.',
      de: 'Im italienischen Pauschalregime ("forfettario") wird die Ersatzsteuer auf das zu versteuernde Einkommen (Einnahmen × Rentabilitätskoeffizient) berechnet, abzüglich gezahlter INPS-Beiträge. Bei jedem Zahlungseingang zurückzulegen vermeidet die Überraschung zum Stichtag.',
      pt: 'No regime forfetário italiano, o imposto substitutivo é calculado sobre a renda tributável (receitas × coeficiente de rentabilidade), líquido das contribuições INPS pagas. Separar a cada recebimento evita a surpresa no vencimento.',
    },
    source: 'Normativa regime forfettario (L. 190/2014 e succ.)',
    priority: 78,
    applies: (ctx) => ctx.isFreelance,
  },
  {
    id: 'not-financial-advice',
    topic: ['disclaimer'],
    statement: 'Queste sono proprietà calcolate sui tuoi dati e principi finanziari pubblici, non consulenza finanziaria personalizzata.',
    statements: {
      en: 'These are properties computed on your data plus public financial principles, not personalized financial advice.',
      es: 'Estas son propiedades calculadas sobre tus datos y principios financieros públicos, no asesoramiento financiero personalizado.',
      fr: 'Ce sont des propriétés calculées sur tes données et des principes financiers publics, pas un conseil financier personnalisé.',
      de: 'Dies sind aus deinen Daten berechnete Eigenschaften und öffentliche Finanzprinzipien, keine persönliche Finanzberatung.',
      pt: 'Estas são propriedades calculadas sobre os seus dados e princípios financeiros públicos, não consultoria financeira personalizada.',
    },
    source: 'Guardrail Momentum',
    priority: 10,
    applies: () => true,
  },
];

// Retrieval per argomento: ritorna le regole pertinenti a un topic/parola-chiave,
// ordinate per priorità. Usato dal chatbot/Q&A come "contesto" (RAG deterministico).
export function recall(topicOrText) {
  const q = String(topicOrText || '').toLowerCase();
  const scored = RULES
    .map(r => ({ r, hit: r.topic.some(t => q.includes(t) || t.includes(q)) }))
    .filter(x => x.hit)
    .sort((a, b) => b.r.priority - a.r.priority)
    .map(x => x.r);
  return scored;
}

// Dato il contesto finanziario dell'utente, ritorna le regole APPLICABILI ora,
// con la fonte — è la "spiegazione fondata" che NeuroSym può citare.
// ctx: { wantsToInvest, emergencyMonths, hasHighInterestDebt, isFreelance, ... }
export function applicableRules(ctx = {}) {
  return RULES
    .filter(r => { try { return r.applies(ctx); } catch { return false; } })
    .sort((a, b) => b.priority - a.priority);
}

// Cite localizzata di una regola: statement nella lingua richiesta (fallback
// italiano se la traduzione manca), fonte invariata (i principi citati non
// cambiano con la lingua). Ritorna la stringa "statement (Fonte: source)".
export function citeFor(rule, lang = 'it') {
  if (!rule) return null;
  const statement = (rule.statements && rule.statements[lang]) || rule.statement;
  return `${statement} (Fonte: ${rule.source})`;
}

// Spiegazione pronta da mostrare: la regola più fondante applicabile + fonte,
// sempre col disclaimer. Ritorna { rule, cite } o null. lang opzionale
// (default 'it'): i chiamanti esistenti passano solo ctx e restano italiani.
export function ground(ctx = {}, lang = 'it') {
  const rules = applicableRules(ctx).filter(r => r.id !== 'not-financial-advice');
  if (!rules.length) return null;
  const rule = rules[0];
  return { rule, cite: citeFor(rule, lang) };
}

export function getRule(id) { return RULES.find(r => r.id === id) || null; }
