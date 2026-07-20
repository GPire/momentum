// ============================================================
// REASONING FUSION — Wave 12 v10, NeuroSym Financial Reasoning Layer
// ============================================================
// Estende Omega.reason() (src/ai/omega.js, il ragionatore a 5 strati già in
// produzione) con gli strati che non aveva ancora: l'impatto causale in euro
// (what-if.js) tradotto in traiettoria patrimoniale (net-worth.js Twin,
// Monte Carlo). Combina risultati di motori GIÀ reali e testati in UNA
// sintesi, propagando la confidenza invece di sceglierne una a caso.
//
// Onestà (regola #1): nessun layer qui "ragiona" da solo — ognuno è una
// chiamata a un motore deterministico già misurato altrove. Questo modulo fa
// SOLO combinazione e propagazione di confidenza, mai un numero inventato.
// Esempio reale che nessun tracker di portafoglio del settore fa: "se tagli
// ristoranti del 20%, il tuo patrimonio a 1 anno (strategia liquidità) è
// TOT€ più alto" — cashflow personale + traiettoria patrimoniale nella
// STESSA risposta, perché Momentum vede entrambi i dati (nessun cloud lo fa).
'use strict';

import { simulateCategoryChange } from '../predict/what-if.js';
import { projectNetWorthByStrategy } from '../alpha/net-worth.js';

// Combina la confidenza di più layer ETEROGENEI (analisi INDIPENDENTI che si
// completano a vicenda, non voti sulla stessa variabile). Ogni layer:
// { name, ok: bool, confidence?: 0..1 }. confidence di un layer riflette la
// SUFFICIENZA DEI DATI di quel motore (es. storico abbastanza lungo), mai
// una stima probabilistica del risultato in sé — quella resta del motore.
// Copertura piena non sconta; copertura parziale sconta fino a metà: meno
// layer hanno potuto rispondere, meno ci si fida della sintesi combinata.
export function combineConfidence(layers = []) {
  const answered = layers.filter(l => l.ok);
  if (!layers.length) return { confidence: 0, coverage: 0, agree: true, missing: [] };
  if (!answered.length) {
    return { confidence: 0, coverage: 0, agree: false, missing: layers.map(l => l.name) };
  }
  const avgConf = answered.reduce((s, l) => s + (l.confidence ?? 0.5), 0) / answered.length;
  const coverage = answered.length / layers.length;
  const confidence = +(avgConf * (0.5 + 0.5 * coverage)).toFixed(3);
  return {
    confidence,
    coverage: +coverage.toFixed(2),
    agree: answered.length === layers.length,
    missing: layers.filter(l => !l.ok).map(l => l.name),
  };
}

// "Se taglio/aumento la categoria X del N%": combina l'impatto € diretto+a
// catena (what-if.js, riusa il causale già misurato) con la traiettoria
// patrimoniale Monte Carlo A PARITÀ delle altre condizioni, con e senza il
// contributo liberato — sulla strategia più prudente (risparmio/liquidità:
// onesto per un orizzonte breve, non si spinge a inventare un profilo di
// rischio che l'utente non ha scelto). Mai un layer mancante rompe gli altri.
export function crossDomainWhatIf({ allTx, category, deltaPct, referenceDate = new Date(), netWorthStart = 0, years = 1 } = {}) {
  const layers = [];
  let whatIf = null;
  try {
    whatIf = simulateCategoryChange({ allTx, catId: category, deltaPct, referenceDate });
  } catch (_) { whatIf = null; }
  // confidence del layer causale: 0 se nessuno storico, altrimenti proporzionale
  // al numero di effetti a catena robusti trovati (più segnali = più fiducia),
  // sempre limitata a 0.85 (mai certezza assoluta su dati di co-variazione).
  const whatIfConf = whatIf ? Math.min(0.85, 0.5 + 0.1 * (whatIf.chainEffects?.length || 0)) : 0;
  layers.push({ name: 'causal-whatif', ok: !!whatIf, confidence: whatIfConf });

  let twin = null;
  if (whatIf && whatIf.totalMonthly !== 0) {
    try {
      const base = { start: netWorthStart, years, strategies: ['risparmio'], paths: 500, seed: 12345 };
      const without = projectNetWorthByStrategy({ ...base, monthlyContribution: 0 });
      const withChange = projectNetWorthByStrategy({ ...base, monthlyContribution: Math.max(0, whatIf.totalMonthly) });
      twin = {
        withoutChange: without.rows[0],
        withChange: withChange.rows[0],
        deltaP50: +((withChange.rows[0]?.p50 || 0) - (without.rows[0]?.p50 || 0)).toFixed(2),
        disclaimer: without.disclaimer,
      };
    } catch (_) { twin = null; }
  }
  layers.push({ name: 'net-worth-twin', ok: !!twin, confidence: twin ? 0.6 : 0 });

  return { whatIf, twin, layers, combined: combineConfidence(layers) };
}
