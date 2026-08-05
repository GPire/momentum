// ============================================================
// CAUSAL-MACRO-NOTE — la frase d'avviso quando un legame chiesto dall'utente
// nel QA è probabilmente spiegato da un fattore macroeconomico esterno
// (predict/macro-context.js) invece che da una relazione causale diretta.
// ============================================================
// Estratto da qa-engine.js per renderlo testabile in isolamento: trovare un
// caso REALE in cui sia il motore causale legacy (Granger a coppie) SIA
// PCMCI concordano contemporaneamente su un legame macro-spiegato è raro per
// costruzione (limite statistico onesto, documentato in macro-context.test.js
// — dopo il condizionamento sul proprio passato di PCMCI il segnale macro
// spesso si assottiglia). Qui si verificano invece, in modo deterministico,
// LA REGOLA e ogni sua diramazione: quale frase esce, in quale lingua, e
// quando non esce nulla.
'use strict';

// avvertimenti: analisi.diagnosi?.avvertimenti (array). Ritorna il caso
// macro-spiegato che coinvolge `namedCat`, o null.
export function findMacroConfounderWarning(avvertimenti, namedCat) {
  const caso = (avvertimenti || []).find((a) => a.tipo === 'causa-comune-non-vista');
  return caso?.casi?.find((c) => c.tra?.includes(namedCat) && c.spiegatoDaMacro) || null;
}

const NOTE_BY_LANG = {
  it: (namedCat, altra, motivo) => ` Attenzione: ${namedCat} e ${altra} si muovono insieme probabilmente per ${motivo}, non perché una causa l'altra — aumentare ${namedCat} da sola potrebbe non spostare nulla.`,
  en: (namedCat, altra, motivo) => ` Note: ${namedCat} and ${altra} move together probably because of ${motivo}, not because one causes the other — raising ${namedCat} alone might not move anything.`,
  es: (namedCat, altra, motivo) => ` Atención: ${namedCat} y ${altra} se mueven juntos probablemente por ${motivo}, no porque uno cause el otro.`,
  fr: (namedCat, altra, motivo) => ` Attention : ${namedCat} et ${altra} bougent ensemble probablement à cause de ${motivo}, pas parce que l'un cause l'autre.`,
  de: (namedCat, altra, motivo) => ` Achtung: ${namedCat} und ${altra} bewegen sich wahrscheinlich wegen ${motivo} gemeinsam, nicht weil eins das andere verursacht.`,
};

// avviso: il caso restituito da findMacroConfounderWarning (non null).
export function macroConfounderNote(avviso, namedCat, lang = 'it') {
  const altra = avviso.tra.find((c) => c !== namedCat);
  const fn = NOTE_BY_LANG[lang] || NOTE_BY_LANG.it;
  return fn(namedCat, altra, avviso.spiegatoDaMacro);
}
