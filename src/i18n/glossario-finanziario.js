// ============================================================
// IL GLOSSARIO FINANZIARIO BLOCCATO — la serratura, non ancora la porta
// ============================================================
// Perché esiste ORA, prima che esista la pipeline di traduzione (Cantiere J
// del piano: opus-mt a tempo di build + cancello semantico con
// spazio-momentum.js). Il glossario è il pezzo che NON dipende da quella
// pipeline — è vocabolario, non codice di traduzione — e serve fin da subito
// come precedente diretto di un bug già preso sul fatto in questa sessione:
// il correttore di refusi (qa-engine.js: correctTypos) riscriveva "perdere"
// in "spendere" (distanza di Levenshtein 2) e "vendere" in "spendere" —
// stesso identico principio, dominio diverso. PAROLE_PROTETTE_IT lì è
// l'antenato diretto di questo file: una lista di termini che NON si toccano
// perché confonderli cambia il significato finanziario della frase.
//
// COSA FA, con onestà sui limiti:
// - Raggruppa i termini finanziari per CATEGORIA di significato (perdita,
//   vendita, spesa... — categorie che nel dominio dei soldi NON sono
//   intercambiabili, a differenza di sinonimi generici).
// - coerenzaGlossario() verifica che una categoria presente nel testo
//   ORIGINALE compaia ANCHE nella sua traduzione — se "perdita" c'è
//   nell'originale italiano e "loss"/"pérdida"/... non compare nella
//   traduzione, quel termine è SLITTATO: la frase non deve passare.
// - Le forme per lingua sono le più comuni (singolare/plurale, infinito),
//   NON un'analisi morfologica completa: un participio raro non riconosciuto
//   è un falso negativo accettabile (il cancello diventa più severo, mai
//   più permissivo — meglio bloccare una frase buona per errore che
//   lasciarne passare una con un termine finanziario scambiato).
// - Le traduzioni sono vocabolario economico di base (non gergo, non
//   regionalismi), scelte con cura ma non da un traduttore professionista
//   certificato: vanno validate quando la pipeline reale (Cantiere J) potrà
//   confrontarle con opus-mt e col cancello semantico — questo file è la
//   base di partenza, dichiarata tale, non l'ultima parola.
'use strict';

// categoria → { lingua: [forme più comuni] }. Le categorie sono scelte per
// essere semanticamente DISTINTE nel dominio dei soldi: "perdita" e "vendita"
// non sono sinonimi anche se entrambe parlano di soldi che se ne vanno.
export const GLOSSARIO = {
  perdita: {
    it: ['perdere', 'perdita', 'perdite', 'perso', 'persa', 'perse', 'persi'],
    en: ['lose', 'loss', 'losses', 'lost'],
    es: ['perder', 'pérdida', 'pérdidas', 'perdido'],
    fr: ['perdre', 'perte', 'pertes', 'perdu'],
    de: ['verlieren', 'verlust', 'verluste', 'verloren'],
    pt: ['perder', 'perda', 'perdas', 'perdido'],
  },
  vendita: {
    it: ['vendere', 'vendita', 'vendite', 'venduto', 'venduta', 'vendo'],
    en: ['sell', 'sale', 'sales', 'sold'],
    es: ['vender', 'venta', 'ventas', 'vendido'],
    fr: ['vendre', 'vente', 'ventes', 'vendu'],
    de: ['verkaufen', 'verkauf', 'verkäufe', 'verkauft'],
    pt: ['vender', 'venda', 'vendas', 'vendido'],
  },
  spesa: {
    it: ['spendere', 'spesa', 'spese', 'speso', 'spesi'],
    en: ['spend', 'expense', 'expenses', 'spent'],
    es: ['gastar', 'gasto', 'gastos', 'gastado'],
    fr: ['dépenser', 'dépense', 'dépenses', 'dépensé'],
    de: ['ausgeben', 'ausgabe', 'ausgaben', 'ausgegeben'],
    pt: ['gastar', 'gasto', 'gastos', 'gasto'],
  },
  investimento: {
    it: ['investire', 'investimento', 'investimenti', 'investito'],
    en: ['invest', 'investment', 'investments', 'invested'],
    es: ['invertir', 'inversión', 'inversiones', 'invertido'],
    fr: ['investir', 'investissement', 'investissements', 'investi'],
    de: ['investieren', 'investition', 'investitionen', 'investiert'],
    pt: ['investir', 'investimento', 'investimentos', 'investido'],
  },
  risparmio: {
    it: ['risparmiare', 'risparmio', 'risparmi', 'risparmiato'],
    en: ['save', 'saving', 'savings', 'saved'],
    es: ['ahorrar', 'ahorro', 'ahorros', 'ahorrado'],
    fr: ['épargner', 'épargne', 'économies', 'épargné'],
    de: ['sparen', 'ersparnis', 'ersparnisse', 'gespart'],
    pt: ['poupar', 'poupança', 'poupanças', 'poupado'],
  },
  guadagno: {
    it: ['guadagnare', 'guadagno', 'guadagni', 'guadagnato'],
    en: ['earn', 'gain', 'gains', 'earned'],
    es: ['ganar', 'ganancia', 'ganancias', 'ganado'],
    fr: ['gagner', 'gain', 'gains', 'gagné'],
    de: ['verdienen', 'gewinn', 'gewinne', 'verdient'],
    pt: ['ganhar', 'ganho', 'ganhos', 'ganhado'],
  },
  entrata: {
    it: ['entrata', 'entrate', 'reddito'],
    en: ['income', 'earnings', 'revenue'],
    es: ['ingreso', 'ingresos', 'renta'],
    fr: ['revenu', 'revenus', 'recette'],
    de: ['einkommen', 'einnahme', 'einnahmen'],
    // "rendimento" NON qui: in portoghese e' anche il termine per "rendimento
    // finanziario" (ambiguo davvero, non un errore di battitura) — tenuto
    // solo sotto la categoria "rendimento" per non farlo appartenere a due
    // categorie insieme, cosa che il cancello non saprebbe risolvere.
    pt: ['renda', 'receita'],
  },
  rendimento: {
    it: ['rendimento', 'rendimenti', 'rendita', 'rendite'],
    en: ['return', 'returns', 'yield'],
    es: ['rendimiento', 'rendimientos', 'rentabilidad'],
    fr: ['rendement', 'rendements'],
    de: ['rendite', 'renditen'],
    pt: ['rendimento', 'rendimentos', 'rentabilidade'],
  },
  rischio: {
    it: ['rischio', 'rischi', 'rischiare', 'rischioso'],
    en: ['risk', 'risks', 'risky'],
    es: ['riesgo', 'riesgos', 'arriesgado'],
    fr: ['risque', 'risques', 'risqué'],
    de: ['risiko', 'risiken', 'riskant'],
    pt: ['risco', 'riscos', 'arriscado'],
  },
  patrimonio: {
    it: ['patrimonio', 'patrimoni'],
    en: ['net worth', 'wealth', 'assets'],
    es: ['patrimonio', 'patrimonios'],
    fr: ['patrimoine', 'patrimoines'],
    de: ['vermögen', 'nettovermögen'],
    pt: ['patrimônio', 'patrimônios', 'patrimonio'],
  },
  stipendio: {
    it: ['stipendio', 'stipendi', 'salario'],
    en: ['salary', 'wage', 'paycheck'],
    es: ['salario', 'sueldo', 'nómina'],
    fr: ['salaire', 'salaires', 'paie'],
    de: ['gehalt', 'lohn'],
    pt: ['salário', 'ordenado', 'salario'],
  },
  debito: {
    it: ['debito', 'debiti'],
    en: ['debt', 'debts'],
    es: ['deuda', 'deudas'],
    fr: ['dette', 'dettes'],
    de: ['schuld', 'schulden'],
    pt: ['dívida', 'dívidas', 'divida'],
  },
  tasso: {
    it: ['tasso', 'tassi'],
    en: ['rate', 'rates'],
    es: ['tasa', 'tasas'],
    // "taux" e' invariabile (stessa forma al singolare e al plurale): la
    // seconda forma e' un composto reale, non una ripetizione.
    fr: ['taux', "taux d'intérêt"],
    de: ['zinssatz', 'zinssätze', 'satz'],
    pt: ['taxa', 'taxas'],
  },
  tassa: {
    it: ['tassa', 'tasse', 'imposta', 'imposte'],
    en: ['tax', 'taxes'],
    es: ['impuesto', 'impuestos'],
    fr: ['impôt', 'impôts', 'taxe'],
    de: ['steuer', 'steuern'],
    pt: ['imposto', 'impostos'],
  },
};

// Confine di parola per lingue latine + inglese/tedesco/portoghese: le
// lettere accentate proprie di ciascuna lingua (é/è/ü/ö/ã/ç...) vanno incluse
// nel "carattere di parola", altrimenti "pérdida" si spezzerebbe su "é".
const RE_CONFINE = /[a-zà-ÿ]+/gi;

function paroleDi(testo) {
  return (String(testo || '').toLowerCase().match(RE_CONFINE)) || [];
}

// Quali categorie del glossario compaiono in un testo, per una data lingua.
// Match su parola INTERA (non sottostringa): "renderà" non deve far scattare
// "rendimento" solo perché condividono un pezzo di lettere.
export function categorieTrovate(testo, lingua) {
  const parole = new Set(paroleDi(testo));
  const trovate = [];
  for (const [categoria, perLingua] of Object.entries(GLOSSARIO)) {
    const forme = perLingua[lingua];
    if (!forme) continue;
    // "net worth" (inglese) è due parole: cercata come sottostringa intera,
    // le altre forme (una parola sola) per appartenenza all'insieme.
    const trovata = forme.some((f) => f.includes(' ') ? testo.toLowerCase().includes(f) : parole.has(f));
    if (trovata) trovate.push(categoria);
  }
  return trovate;
}

// LA SERRATURA VERA: le categorie presenti nell'originale che NON si trovano
// (in nessuna forma nota) nella traduzione — quelle sono gli slittamenti che
// devono bloccare la frase. Vuoto = tutto tradotto coerentemente.
export function coerenzaGlossario(testoOriginale, linguaOriginale, testoTradotto, linguaTradotta) {
  const nellOriginale = categorieTrovate(testoOriginale, linguaOriginale);
  const nellaTraduzione = new Set(categorieTrovate(testoTradotto, linguaTradotta));
  return nellOriginale.filter((cat) => !nellaTraduzione.has(cat));
}
