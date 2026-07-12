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

// Ogni regola: id, statement (spiegazione umana), source (principio/autore),
// topic (per il retrieval), applies(ctx) → bool (quando è pertinente),
// priority (0-100, quanto è fondante). ctx è il profilo finanziario derivato
// dai dati dell'utente (tutto on-device).
export const RULES = [
  {
    id: 'emergency-fund-first',
    topic: ['investire', 'risparmio', 'emergenza', 'rischio'],
    statement: 'Prima di investire, tieni un fondo d\'emergenza di 3-6 mesi di spese su un conto liquido. Serve a non dover vendere gli investimenti in perdita quando arriva un imprevisto.',
    source: 'Principio di gestione del rischio personale (Graham, Bogle)',
    priority: 95,
    applies: (ctx) => ctx.wantsToInvest && (ctx.emergencyMonths ?? 0) < 3,
  },
  {
    id: 'high-interest-debt-first',
    topic: ['debiti', 'investire', 'interessi'],
    statement: 'Estinguere un debito ad alto interesse (carte revolving, prestiti al consumo) rende in modo garantito quanto il suo tasso: spesso più di un investimento medio. Viene prima di investire.',
    source: 'Aritmetica del costo opportunità',
    priority: 92,
    applies: (ctx) => ctx.wantsToInvest && ctx.hasHighInterestDebt,
  },
  {
    id: 'diversification-reduces-variance',
    topic: ['investire', 'etf', 'rischio', 'diversificazione'],
    statement: 'Un ETF ampiamente diversificato riduce la varianza rispetto a poche azioni singole, senza ridurre il rendimento atteso di mercato: è "l\'unico pasto gratis" in finanza.',
    source: 'Markowitz (teoria del portafoglio) / Bogle (indicizzazione)',
    priority: 85,
    applies: (ctx) => ctx.wantsToInvest,
  },
  {
    id: 'costs-compound-negatively',
    topic: ['etf', 'costi', 'commissioni', 'investire'],
    statement: 'I costi si compongono al contrario: una commissione annua dell\'1% su 30 anni può erodere oltre un quarto del capitale finale. A parità di strategia, preferisci strumenti a basso costo.',
    source: 'Bogle (the cost matters hypothesis)',
    priority: 80,
    applies: (ctx) => ctx.wantsToInvest,
  },
  {
    id: 'time-in-market',
    topic: ['investire', 'interesse composto', 'orizzonte'],
    statement: 'L\'interesse composto premia il TEMPO nel mercato più del tempismo. Iniziare presto con importi piccoli batte spesso iniziare tardi con importi grandi.',
    source: 'Interesse composto (matematica finanziaria)',
    priority: 82,
    applies: (ctx) => ctx.wantsToInvest,
  },
  {
    id: 'risk-needs-horizon',
    topic: ['rischio', 'orizzonte', 'investire'],
    statement: 'Più alto è il rischio (azioni, crypto), più lungo deve essere l\'orizzonte: servono anni per assorbire i ribassi. Denaro che ti serve a breve NON va in asset volatili.',
    source: 'Relazione rischio-orizzonte (Dalio, asset allocation)',
    priority: 88,
    applies: (ctx) => ctx.wantsToInvest,
  },
  {
    id: 'dca-reduces-timing-risk',
    topic: ['pac', 'investire', 'volatilità'],
    statement: 'Un piano di accumulo (PAC) a importi costanti riduce il rischio di tempismo: compri di più quando i prezzi scendono e di meno quando salgono, mediando il prezzo di carico.',
    source: 'Dollar-cost averaging',
    priority: 75,
    applies: (ctx) => ctx.wantsToInvest,
  },
  {
    id: 'correlation-not-causation',
    topic: ['ragionamento', 'causale', 'previsione'],
    statement: 'Correlazione non implica causalità: due voci di spesa che si muovono insieme possono avere una causa comune, non un legame diretto. Le catene causali vanno verificate, non dedotte dalla sola co-occorrenza.',
    source: 'Metodo statistico (inferenza causale)',
    priority: 70,
    applies: () => true,
  },
  {
    id: 'forfettario-set-aside',
    topic: ['tasse', 'partita iva', 'forfettario'],
    statement: 'In regime forfettario l\'imposta sostitutiva si calcola sul reddito imponibile (ricavi × coefficiente di redditività), al netto dei contributi INPS versati. Accantonare a ogni incasso evita la sorpresa a scadenza.',
    source: 'Normativa regime forfettario (L. 190/2014 e succ.)',
    priority: 78,
    applies: (ctx) => ctx.isFreelance,
  },
  {
    id: 'not-financial-advice',
    topic: ['disclaimer'],
    statement: 'Queste sono proprietà calcolate sui tuoi dati e principi finanziari pubblici, non consulenza finanziaria personalizzata.',
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

// Spiegazione pronta da mostrare: la regola più fondante applicabile + fonte,
// sempre col disclaimer. Ritorna { rule, cite } o null.
export function ground(ctx = {}) {
  const rules = applicableRules(ctx).filter(r => r.id !== 'not-financial-advice');
  if (!rules.length) return null;
  const rule = rules[0];
  return { rule, cite: `${rule.statement} (Fonte: ${rule.source})` };
}

export function getRule(id) { return RULES.find(r => r.id === id) || null; }
