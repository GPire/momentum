// ============================================================
// MARKET KNOWLEDGE — conoscenza finanziaria/macro verificabile (investment
// banking, ETF, azionario, cause-effetto macro consolidate)
// ============================================================
// Onestà (regola #1): NON sono previsioni né serie storiche inventate. Sono
// RELAZIONI CAUSA-EFFETTO macro CONSOLIDATE (insegnate in finanza, osservate
// ripetutamente negli ultimi decenni) e PRINCIPI dei grandi investitori, ognuno
// con meccanismo e fonte. Sono "tendenze tipiche", non garanzie — dichiarato.
// Alimentano il ragionamento di Omega/advisor/chat sulle domande di mercato.
'use strict';

// Relazioni macro cause→effetto consolidate. `when` = evento; `then` = effetto
// tipico; `mechanism` = perché; `confidence` = quanto è robusta la relazione.
export const MACRO_LINKS = [
  { id: 'rates-up-bonds-down', when: 'tassi di interesse in rialzo', then: 'i prezzi delle obbligazioni scendono', mechanism: 'una cedola fissa vale meno quando i nuovi bond rendono di più (relazione inversa prezzo-rendimento)', confidence: 'molto alta', source: 'aritmetica obbligazionaria (duration)' },
  { id: 'rates-up-growth-down', when: 'tassi in rialzo', then: 'le azioni growth/tech tendono a soffrire più delle value', mechanism: 'gli utili futuri lontani, scontati a un tasso più alto, valgono meno oggi', confidence: 'alta', source: 'discounted cash flow' },
  { id: 'inflation-real-assets', when: 'inflazione elevata', then: 'beni reali (materie prime, oro, immobili) tendono a proteggere il potere d\'acquisto', mechanism: 'il loro prezzo sale col livello generale dei prezzi, la liquidità si svaluta', confidence: 'media-alta', source: 'copertura dall\'inflazione (Dalio All Weather)' },
  { id: 'recession-defensives', when: 'recessione o rallentamento', then: 'i settori difensivi (utility, beni di prima necessità, salute) reggono meglio dei ciclici', mechanism: 'la domanda dei loro beni/servizi è poco sensibile al ciclo economico', confidence: 'alta', source: 'rotazione settoriale' },
  { id: 'usd-strong-em-pressure', when: 'dollaro forte', then: 'i mercati emergenti tendono a soffrire', mechanism: 'il loro debito in dollari costa di più e i capitali rientrano verso asset USA', confidence: 'media-alta', source: 'flussi di capitale globali' },
  { id: 'vix-up-risk-off', when: 'volatilità/paura in aumento (VIX)', then: 'gli investitori vendono asset rischiosi e comprano beni rifugio (bond di stato, oro, USD)', mechanism: 'avversione al rischio: si privilegia la protezione del capitale', confidence: 'alta', source: 'risk-off/flight to quality' },
  { id: 'diversification-variance', when: 'diversifichi tra asset poco correlati', then: 'la varianza del portafoglio scende senza ridurre il rendimento atteso di mercato', mechanism: 'i movimenti si compensano parzialmente (correlazione < 1)', confidence: 'molto alta', source: 'Markowitz, teoria del portafoglio' },
  { id: 'time-compounding', when: 'resti investito a lungo in un indice ampio', then: 'l\'interesse composto e il premio al rischio azionario storicamente premiano il tempo nel mercato', mechanism: 'il reinvestimento compone; i ribassi vengono assorbiti su orizzonti lunghi', confidence: 'alta (storica, non garantita)', source: 'equity risk premium (Bogle)' },
  // Ampliamento (50 anni di storia dei mercati): altre relazioni consolidate.
  { id: 'yield-curve-inversion', when: 'la curva dei rendimenti si inverte (2y > 10y)', then: 'storicamente ha spesso preceduto una recessione entro 12-24 mesi', mechanism: 'il mercato si aspetta tagli dei tassi futuri per crescita debole', confidence: 'alta (storica, non infallibile)', source: 'indicatore anticipatore classico' },
  { id: 'qe-asset-inflation', when: 'la banca centrale fa quantitative easing (compra asset)', then: 'i prezzi di azioni/obbligazioni tendono a salire', mechanism: 'più liquidità e tassi bassi spingono verso asset a rendimento più alto', confidence: 'media-alta', source: 'politica monetaria (post-2008)' },
  { id: 'credit-spreads-stress', when: 'gli spread creditizi si allargano', then: 'è segnale di stress finanziario e possibile calo delle azioni', mechanism: 'gli investitori chiedono più premio per il rischio di default', confidence: 'alta', source: 'mercato del credito' },
  { id: 'oil-shock-inflation', when: 'shock del prezzo del petrolio al rialzo', then: 'pressione inflazionistica e freno alla crescita (stagflazione nei casi estremi)', mechanism: 'l\'energia è un input diffuso: alza i costi ovunque', confidence: 'media-alta', source: 'shock petroliferi anni \'70 e successivi' },
  { id: 'value-momentum-factors', when: 'investi per FATTORI (value, momentum, quality, size, low-vol)', then: 'storicamente hanno mostrato premi persistenti ma ciclici (a volte sottoperformano per anni)', mechanism: 'compensano rischi o sfruttano bias comportamentali sistematici', confidence: 'media (evidenza accademica, non garanzia)', source: 'Fama-French, factor investing' },
  { id: 'mean-reversion-extremes', when: 'un asset è a valutazioni estreme (bolla o panico)', then: 'nel lungo periodo tende a tornare verso la media', mechanism: 'gli eccessi di ottimismo/pessimismo si correggono', confidence: 'media (tempistica imprevedibile)', source: 'mean reversion / Graham' },
  { id: 'dca-timing-risk', when: 'entri con un piano di accumulo (PAC) costante', then: 'riduci il rischio di tempismo e l\'impatto emotivo', mechanism: 'compri più quote quando i prezzi scendono, mediando il carico', confidence: 'alta', source: 'dollar-cost averaging' },
  { id: 'rebalancing-discipline', when: 'ribilanci periodicamente verso l\'allocazione target', then: 'vendi ciò che è salito e compri ciò che è sceso in modo sistematico', mechanism: 'impone "compra basso, vendi alto" senza emozioni; controlla il rischio', confidence: 'alta', source: 'portfolio rebalancing' },
];

// Principi dei grandi investitori (verificabili, pubblici). Complementano le
// strategie già calcolate in src/alpha/*.
export const INVESTOR_PRINCIPLES = [
  { who: 'Warren Buffett', principle: 'Compra aziende di qualità a prezzo ragionevole e tienile a lungo; margine di sicurezza; cerchia di competenza.', keywords: /buffett|value|qualità|margine di sicurezza|lungo termine/i },
  { who: 'John Bogle', principle: 'I costi contano: un indice ampio a basso costo batte la maggior parte dei gestori attivi nel lungo periodo.', keywords: /bogle|indice|etf|costi|passivo|vanguard/i },
  { who: 'Ray Dalio', principle: 'All Weather: diversifica per rischio tra asset che reagiscono in modo opposto a crescita e inflazione.', keywords: /dalio|all weather|risk parity|diversifica|inflazione/i },
  { who: 'Benjamin Graham', principle: 'Investi con margine di sicurezza; il Mr. Market emotivo offre prezzi, non verità.', keywords: /graham|margine|mr market|difensivo/i },
  { who: 'Peter Lynch', principle: 'Investi in ciò che capisci; cerca crescita a prezzo ragionevole (PEG).', keywords: /lynch|crescita|peg|capisci/i },
  { who: 'Charlie Munger', principle: 'Inversione e modelli mentali: evita gli errori stupidi più che cercare la genialità.', keywords: /munger|inversione|modelli mentali/i },
  { who: 'George Soros', principle: 'Riflessività: le percezioni influenzano i fondamentali, creando cicli di feedback.', keywords: /soros|riflessività|feedback|bolla/i },
  { who: 'Jim Simons (Renaissance)', principle: 'Approccio quantitativo/statistico: segnali sistematici, diversificazione di molte piccole scommesse, disciplina sui dati.', keywords: /simons|quant|momentum|sistematico|statistico/i },
  { who: 'Howard Marks (Oaktree)', principle: 'Pensiero di secondo livello e consapevolezza del ciclo: il prezzo pagato determina il rendimento; conta di più evitare i grandi errori.', keywords: /marks|ciclo|secondo livello|rischio|prezzo/i },
  { who: 'Seth Klarman', principle: 'Margine di sicurezza e pazienza: tieni liquidità per comprare quando gli altri sono forzati a vendere.', keywords: /klarman|margine|liquidità|pazienza/i },
  { who: 'Stanley Druckenmiller', principle: 'Concentrazione quando la convinzione è alta; preserva il capitale; segui la liquidità e il quadro macro.', keywords: /druckenmiller|macro|concentrazione|liquidità/i },
  { who: 'John Templeton', principle: 'Compra al momento di massimo pessimismo; diversifica a livello globale.', keywords: /templeton|pessimismo|globale|contrarian/i },
  // Case di ricerca/gestione (framework istituzionali verificabili)
  { who: 'JP Morgan (Guide to the Markets)', principle: 'Resta investito: perdere i pochi giorni migliori del mercato riduce drasticamente il rendimento di lungo periodo; il tempo nel mercato batte il tempismo.', keywords: /jp ?morgan|guide to the markets|restare investito|migliori giorni|tempismo/i },
  { who: 'Vanguard', principle: 'Quattro principi: obiettivi chiari, ampia diversificazione, costi minimi, disciplina di lungo periodo.', keywords: /vanguard|principi|costi|diversificazione|disciplina/i },
  { who: 'VanEck', principle: 'Investimenti tematici e su "moat" durevoli, esposizione a oro/materie prime e mercati emergenti come diversificatori.', keywords: /vaneck|van eck|tematico|moat|oro|emergenti|materie prime/i },
  { who: 'McKinsey (Valuation)', principle: 'Il valore si crea quando il ROIC supera il costo del capitale e c\'è crescita; i flussi di cassa, non gli utili contabili, guidano il valore.', keywords: /mckinsey|valuation|roic|costo del capitale|flussi di cassa|dcf/i },
];

// Data un evento/parola-chiave, ritorna le relazioni causa-effetto pertinenti.
export function macroChains(query) {
  const q = String(query || '').toLowerCase();
  return MACRO_LINKS.filter(l => q.includes(l.when.split(' ')[0]) || l.when.split(' ').some(w => w.length > 4 && q.includes(w)) || l.then.split(' ').some(w => w.length > 5 && q.includes(w)));
}

// Principio del grande investitore pertinente alla domanda.
export function investorFor(query) {
  const q = String(query || '');
  return INVESTOR_PRINCIPLES.find(p => p.keywords.test(q)) || null;
}

// Spiegazione pronta (catena causa-effetto + fonte), con caveat onesto.
export function explainMacro(query) {
  const chains = macroChains(query);
  if (!chains.length) return null;
  const c = chains[0];
  return { text: `Quando ${c.when}, di norma ${c.then} — ${c.mechanism} (fonte: ${c.source}). È una tendenza tipica, non una certezza.`, link: c };
}
