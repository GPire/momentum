// ============================================================
// QA-LEARNING — il QA impara IL TUO modo di chiedere, on-device
// ============================================================
// Oggi (qa-engine.js) il riconoscimento dell'intento è una lista fissa di
// pattern per lingua: una domanda fuori da quei pattern resta sempre
// "unknown", per sempre, anche se l'utente la fa ogni settimana con le
// stesse parole. Nessuna app di finanza personale impara il MODO in cui tu
// chiedi le cose — questo modulo lo fa, senza rete, senza server, senza
// inventare risposte: solo insegnandogli a riconoscere una domanda che tu
// stesso hai già disambiguato una volta.
//
// Regola di fiducia (stessa disciplina statistica usata ovunque nel
// progetto per gli n piccoli — mai un'azione automatica da un solo caso):
// una correzione dell'utente vale come "candidata", non come "verità".
// Solo alla SECONDA conferma indipendente (stessa intenzione, formulazione
// abbastanza simile) il QA la applica da solo — e lo dichiara sempre in
// chiaro (mai una risposta "magica" senza dire che è stata imparata).
//
// Segnale di apprendimento: SOLO conferme esplicite dell'utente (tocca un
// suggerimento dopo una domanda non riconosciuta). Mai un'inferenza
// silenziosa da comportamento osservato — sarebbe indistinguibile da un
// indovinare, e romperebbe la fiducia che il progetto protegge ovunque.
'use strict';

const STOPWORDS = new Set([
  'il', 'lo', 'la', 'i', 'gli', 'le', 'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
  'e', 'o', 'un', 'uno', 'una', 'che', 'cosa', 'come', 'quando', 'dove', 'quanto', 'quanta',
  'quanti', 'quante', 'mi', 'ti', 'si', 'ci', 'vi', 'sono', 'ho', 'hai', 'ha', 'abbiamo',
  'avete', 'hanno', 'posso', 'puoi', 'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'with',
  'and', 'or', 'what', 'how', 'when', 'where', 'is', 'are', 'do', 'does', 'did', 'i', 'you',
  'he', 'she', 'we', 'they', 'my', 'can', 'que', 'de', 'el', 'la', 'los', 'las', 'para',
  'como', 'cuando', 'donde', 'cuanto', 'que', 'du', 'des', 'pour', 'comment', 'quand', 'wie',
  'was', 'wenn', 'wo', 'kann', 'ich', 'der', 'die', 'das',
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // via gli accenti: confronto robusto tra lingue
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function jaccard(aTokens, bTokens) {
  const a = new Set(aTokens), b = new Set(bTokens);
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

const MAX_UNKNOWN_LOG = 200;
const MAX_LEARNED = 100;
const SOGLIA_SIMILE = 0.5;
export const CONFERME_PER_AUTOAPPLICARE = 2;

// Log ADDITIVO (stesso stile di backup-health.js/recovery-shares.js): mai
// mutato in place, sempre una nuova copia dello stato.
export function recordUnknownQuestion(state, question) {
  const tokens = tokenize(question);
  if (!tokens.length) return state || { unknownLog: [], learned: [] };
  const log = [...(state?.unknownLog || []), { question, tokens, ts: Date.now() }].slice(-MAX_UNKNOWN_LOG);
  return { ...state, unknownLog: log };
}

// Chiamata SOLO quando l'utente conferma esplicitamente (tap su un
// suggerimento) quale intento intendeva davvero per una domanda che prima
// non era riconosciuta. Se una voce molto simile esiste già per lo STESSO
// intento, la rinforza (conferme+1) invece di duplicarla — è così che si
// raggiunge la soglia delle 2 conferme richieste prima di fidarsi.
export function learnCorrection(state, question, intent) {
  const tokens = tokenize(question);
  if (!tokens.length || !intent) return state || { unknownLog: [], learned: [] };
  const learned = [...(state?.learned || [])];
  const esistente = learned.find((l) => l.intent === intent && jaccard(l.tokens, tokens) >= SOGLIA_SIMILE);
  if (esistente) {
    esistente.conferme += 1;
    esistente.ts = Date.now();
  } else {
    learned.push({ question, tokens, intent, conferme: 1, ts: Date.now() });
  }
  return { ...state, learned: learned.slice(-MAX_LEARNED) };
}

// Cerca tra le correzioni imparate una corrispondenza per `question`.
// Ritorna { intent, confidenza, conferme, autoApplicabile } o null.
export function suggestLearnedIntent(state, question) {
  const tokens = tokenize(question);
  if (!tokens.length) return null;
  let best = null, bestScore = 0;
  for (const l of state?.learned || []) {
    const score = jaccard(l.tokens, tokens);
    if (score > bestScore) { bestScore = score; best = l; }
  }
  if (!best || bestScore < SOGLIA_SIMILE) return null;
  return {
    intent: best.intent,
    confidenza: +bestScore.toFixed(2),
    conferme: best.conferme,
    autoApplicabile: best.conferme >= CONFERME_PER_AUTOAPPLICARE,
  };
}

// Copertura MISURATA, non dichiarata: quante famiglie di domande sono ormai
// riconosciute da sole (≥2 conferme), quante sono ancora candidate (1 sola
// conferma, non ancora affidabili), quante restano senza risposta. Ogni
// famiglia imparata copre TUTTE le formulazioni simili future, non solo
// quella esatta confermata — è il motivo per cui la copertura cresce più in
// fretta del numero di correzioni fatte a mano, senza bisogno di
// inventare una curva "esponenziale": il numero reale basta da solo.
export function qaLearningCoverage(state) {
  const learned = state?.learned || [];
  const affidabili = learned.filter((l) => l.conferme >= CONFERME_PER_AUTOAPPLICARE);
  return {
    famiglieRiconosciute: affidabili.length,
    famiglieInAttesaDiConferma: learned.length - affidabili.length,
    domandeMaiChiarite: (state?.unknownLog || []).length,
  };
}

// Le domande MAI chiarite sono il segnale più onesto di cosa manca davvero
// al QA — nessun numero di mercato inventato, solo ciò che QUESTO utente ha
// cercato senza trovarlo. Raggruppa per SOMIGLIANZA (stessa soglia Jaccard
// di suggestLearnedIntent, non uguaglianza esatta): due formulazioni con
// qualche parola in più/meno ("dove mangio stasera" / "dove posso mangiare
// stasera vicino") contano come la stessa famiglia di domanda, non due
// domande diverse. Clustering greedy in un solo passaggio (O(n·k), k =
// famiglie trovate finora) — adeguato ai volumi di un log locale (≤200).
export function mostFrequentUnknowns(state, n = 5) {
  const log = state?.unknownLog || [];
  const famiglie = [];
  for (const { question, tokens } of log) {
    if (!tokens.length) continue;
    let f = famiglie.find((x) => jaccard(x.tokens, tokens) >= SOGLIA_SIMILE);
    if (!f) { f = { question, tokens, count: 0 }; famiglie.push(f); }
    f.count += 1;
  }
  return famiglie
    .map(({ question, count }) => ({ question, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}
