// ============================================================
// VOICE-LEARNING — la voce impara IL TUO modo di parlare, on-device
// ============================================================
// Stesso principio di src/ai/qa-learning.js (il QA impara le formulazioni
// dell'utente), applicato qui alla TRASCRIZIONE: il riconoscimento vocale
// del browser sbaglia le stesse parole allo stesso modo per la STESSA
// persona — il tuo accento, il tuo microfono, i nomi che usi spesso
// (marchi, persone, luoghi) producono errori SISTEMATICI, non casuali.
// Un dizionario fisso di refusi comuni (intent-segmenter.js) non può
// saperlo in anticipo; questo modulo impara i TUOI refusi specifici da
// ciò che TU correggi, mai da un'inferenza silenziosa.
//
// Segnale di apprendimento: SOLO quando l'utente MODIFICA a mano la
// descrizione che la voce aveva capito, prima di salvare — mai
// un'osservazione indiretta. Stessa disciplina statistica di qa-learning.js:
// una correzione vale come candidata, solo alla SECONDA conferma
// indipendente (stessa coppia "sentito→corretto") si applica da sola —
// e lo dichiara sempre (mai una correzione "magica" senza dirlo).
//
// Dati mai condivisi, mai lasciano il dispositivo: è esattamente il
// vantaggio strutturale che nessun assistente vocale cloud può replicare,
// perché richiederebbe di inviare le tue trascrizioni altrove.
'use strict';

const MAX_LEARNED = 100;
export const CONFERME_PER_AUTOAPPLICARE = 2;

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

// Chiamata quando l'utente ha corretto a mano una descrizione popolata
// dalla voce, PRIMA di salvare. Se `originale` e `corretta` coincidono
// (nessuna modifica reale) non registra nulla — non è una correzione.
export function recordVoiceCorrection(state, originale, corretta) {
  const da = norm(originale), aNorm = norm(corretta);
  if (!da || !aNorm || da === aNorm) return state || { corrette: [] };
  const corrette = [...(state?.corrette || [])];
  // BUG REALE trovato dal test: il confronto usava `c.a` (la correzione
  // salvata CON la maiuscola originale, per poterla restituire pari pari)
  // contro `aNorm` (minuscolo) — non coincidevano mai, quindi una seconda
  // conferma della STESSA coppia non veniva mai riconosciuta come tale e
  // ne creava sempre una nuova. Ora il confronto usa il campo normalizzato
  // dedicato (aNorm), la capitalizzazione vera resta solo in `a`.
  const esistente = corrette.find((c) => c.da === da && c.aNorm === aNorm);
  if (esistente) {
    esistente.conferme += 1;
    esistente.ts = Date.now();
  } else {
    corrette.push({ da, a: corretta.trim(), aNorm, conferme: 1, ts: Date.now() });
  }
  return { ...state, corrette: corrette.slice(-MAX_LEARNED) };
}

// Cerca una correzione già confermata ≥2 volte per `testo`. Corrispondenza
// ESATTA (non fuzzy): una descrizione breve dove anche un piccolo errore di
// similarità cambierebbe completamente il significato — a differenza delle
// domande del QA (dove una parafrasi resta la stessa intenzione), qui
// "Nike" corretto in "Nike" e "Mike" sono due nomi diversi, non varianti
// della stessa cosa. Ritorna il testo corretto o null.
export function suggestVoiceCorrection(state, testo) {
  const chiave = norm(testo);
  if (!chiave) return null;
  const match = (state?.corrette || []).find((c) => c.da === chiave && c.conferme >= CONFERME_PER_AUTOAPPLICARE);
  return match ? match.a : null;
}

// Copertura misurata (stesso principio di qaLearningCoverage): quante
// correzioni sono ormai affidabili, quante ancora candidate.
export function voiceLearningCoverage(state) {
  const corrette = state?.corrette || [];
  const affidabili = corrette.filter((c) => c.conferme >= CONFERME_PER_AUTOAPPLICARE);
  return { correzioniAffidabili: affidabili.length, correzioniInAttesa: corrette.length - affidabili.length };
}
