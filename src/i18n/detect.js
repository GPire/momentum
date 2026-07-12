// ============================================================
// RILEVAMENTO LINGUA — leggero, on-device, per il chatbot multilingua
// ============================================================
// Momentum va reso usabile oltre l'Italia. Priorità mercati EU per la
// diffusione: IT + EN (già), + ES (Spagna + America Latina = il bacino più
// grande dopo IT/EN), poi FR e DE (Francia/Germania, grandi mercati fintech).
// Onestà: è un rilevatore a parole-chiave/stopword, non un modello NLP —
// sufficiente e istantaneo per instradare il chatbot alla lingua giusta.
// Funzione pura, testabile.
'use strict';

// Stopword/marcatori distintivi per lingua (parole ad alta frequenza e
// tipiche di ciascuna lingua, poco ambigue tra loro).
const MARKERS = {
  it: ['quanto', 'ho', 'posso', 'speso', 'mese', 'soldi', 'questo', 'della', 'perché', 'come', 'quando', 'tasse', 'risparmio', 'investire'],
  en: ['how', 'much', 'can', 'spend', 'month', 'money', 'this', 'what', 'when', 'save', 'invest', 'taxes', 'did', 'my'],
  es: ['cuánto', 'cuanto', 'puedo', 'gastado', 'gastar', 'mes', 'dinero', 'este', 'por qué', 'cómo', 'cuándo', 'ahorro', 'invertir', 'impuestos', 'mis'],
  fr: ['combien', 'puis', 'dépensé', 'dépenser', 'mois', 'argent', 'pourquoi', 'comment', 'quand', 'épargne', 'investir', 'impôts', 'mes'],
  de: ['wie', 'viel', 'kann', 'ausgegeben', 'monat', 'geld', 'warum', 'wann', 'sparen', 'investieren', 'steuern', 'diesen', 'meine'],
  pt: ['quanto', 'posso', 'gastei', 'gastar', 'mês', 'mes', 'dinheiro', 'este', 'porquê', 'porque', 'como', 'quando', 'poupança', 'poupar', 'investir', 'impostos', 'meus'],
};

// Ritorna { lang, confidence, scores }. Default 'it' se nessun segnale
// (l'app nasce italiana). confidence = quota del vincitore sui match totali.
export function detectLanguage(text) {
  const t = ` ${String(text || '').toLowerCase()} `;
  const scores = {};
  let total = 0;
  for (const [lang, words] of Object.entries(MARKERS)) {
    let s = 0;
    for (const w of words) if (t.includes(` ${w} `) || t.includes(` ${w}?`) || t.includes(`${w} `)) s++;
    scores[lang] = s;
    total += s;
  }
  let best = 'it', bestScore = -1;
  for (const [lang, s] of Object.entries(scores)) if (s > bestScore) { bestScore = s; best = lang; }
  return {
    lang: bestScore > 0 ? best : 'it',
    confidence: total > 0 ? +(bestScore / total).toFixed(2) : 0,
    scores,
  };
}

// Lingue con supporto COMPLETO del chatbot (risposte localizzate) vs
// rilevate ma non ancora complete (fallback a EN).
export const SUPPORTED = ['it', 'en', 'es', 'fr', 'de', 'pt'];
export const DETECTED = ['it', 'en', 'es', 'fr', 'de', 'pt'];
export function isSupported(lang) { return SUPPORTED.includes(lang); }
