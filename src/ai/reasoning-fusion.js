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
import { buildCausalGraph, pruneNonCausal } from '../predict/causal-graph.js';
import { projectNetWorthByStrategy } from '../alpha/net-worth.js';
import { cashForecast } from '../predict/cash-forecast.js';

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

// STRATO BREVE TERMINE (ponte con la Cassa Unica, src/predict/cash-forecast.js):
// la STESSA cifra causale che alimenta la traiettoria a un anno (whatIf.totalMonthly)
// muove anche la simulazione dei prossimi 30 giorni — non due numeri scollegati,
// una domanda sola su due orizzonti. Onesto: senza impegni o stipendio noti il
// breve termine non è calcolabile (servono per il registro eventi) → il layer
// resta 'non disponibile', non si inventa nulla. Confidenza = la copertura di
// storico MISURATA dal profilo di spesa libera (non una stima a occhio).
function shortTermCashImpact({ allTx, monthlyEur, commitments, salary, now, horizonDays = 30 }) {
  if (!commitments?.length && !salary) return null;
  try {
    const dailyCut = monthlyEur / 30;
    const base = cashForecast({ allTx, commitments: commitments || [], salary: salary || null, now, horizonDays });
    if (!base.known) return null;
    const withCut = cashForecast({ allTx, commitments: commitments || [], salary: salary || null, now, horizonDays, extraDailyCut: dailyCut });
    if (!withCut.known) return null;
    const daysGained = !base.riskDay ? 0
      : !withCut.riskDay ? horizonDays - base.riskDay.inDays
        : withCut.riskDay.inDays - base.riskDay.inDays;
    return {
      dailyCut: +dailyCut.toFixed(2),
      baseEnd: base.end.p50,
      withCutEnd: withCut.end.p50,
      endDelta: +(withCut.end.p50 - base.end.p50).toFixed(2),
      daysGained,
      horizonDays,
      dataConfidence: base.confidence || 0,
    };
  } catch (_) { return null; }
}

// "Se taglio/aumento la categoria X del N%": combina l'impatto € diretto+a
// catena (what-if.js, riusa il causale già misurato) con la traiettoria
// patrimoniale Monte Carlo A PARITÀ delle altre condizioni (con e senza il
// contributo liberato) E con la Cassa Unica sui prossimi 30 giorni — la stessa
// causa vista su TRE orizzonti (breve/annuale) nella STESSA risposta, cosa che
// nessun tracker del settore fa perché nessuno vede insieme spese, impegni e
// patrimonio. Mai un layer mancante rompe gli altri.
export function crossDomainWhatIf({ allTx, category, deltaPct, referenceDate = new Date(), netWorthStart = 0, years = 1,
  commitments = [], salary = null } = {}) {
  const layers = [];
  let whatIf = null;
  try {
    // Wave 14 (src/predict/causal-graph.js): il grafo passa dall'euristica di
    // precedenza (pruneNonCausal) prima di propagare l'impatto — quando A→B e
    // B→A (stesso lag) risultano entrambi sopra soglia, si tiene solo la
    // direzione più forte invece di trattarle come due fatti indipendenti.
    const links = pruneNonCausal(buildCausalGraph(allTx, referenceDate));
    whatIf = simulateCategoryChange({ allTx, catId: category, deltaPct, referenceDate, links });
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

  let shortTerm = null;
  if (whatIf && whatIf.totalMonthly !== 0) {
    shortTerm = shortTermCashImpact({
      allTx, monthlyEur: whatIf.totalMonthly, commitments, salary,
      now: referenceDate instanceof Date ? referenceDate.getTime() : Date.now(),
    });
  }
  layers.push({ name: 'short-term-cash', ok: !!shortTerm, confidence: shortTerm ? shortTerm.dataConfidence : 0 });

  return { whatIf, twin, shortTerm, layers, combined: combineConfidence(layers) };
}

// ============================================================
// "POSSO PERMETTERMI DI INVESTIRE ORA?" — il ponte che nessun broker/terminal
// può fare (non vedono la cassa personale) e nessuna app di budget fa (non ha
// un segnale di mercato): combina DUE fatti reali e indipendenti.
// ============================================================
// Onestà tecnica ASSOLUTA (regola #1 del progetto): Momentum è on-device,
// senza rete a runtime — NON compete con Bloomberg Terminal/Revolut/Trade
// Republic su dati di mercato in tempo reale, notizie o sentiment: quelli
// hanno feed live, questo modulo usa uno SCATTO STATICO datato (measured-
// assumptions.js, rigenerato periodicamente da bench/generate-measured-
// assumptions.mjs su prezzi storici veri). Ogni risposta dichiara la data
// dello scatto. Mai un consiglio "compra/vendi": la decisione è dell'utente,
// qui c'è solo il quadro — regime macro + disponibilità di cassa reale —
// che nessun altro strumento del settore mette insieme nella stessa risposta.
import measuredAssumptions from '../alpha/measured-assumptions.js';
import { cashFromTransactions } from '../alpha/net-worth.js';

// Sentiment reale aggregato (src/alpha/news.js: ticker_sentiment_score per
// articolo, -1..1). Layer INDIPENDENTE dal regime tecnico: due fatti diversi
// (prezzo/volatilità vs cosa dicono le notizie) che possono anche non
// concordare — combineConfidence li tratta come fonti separate, mai fuse a
// forza in un unico numero. Onestà: sotto 3 articoli con punteggio reale la
// confidenza resta bassa (troppo poco per un'aggregazione affidabile), mai
// finta certezza da 1-2 titoli.
export function aggregateNewsSentiment(items = []) {
  const scored = items.filter((n) => Number.isFinite(n?.sentimentScore));
  if (!scored.length) return null;
  const avg = scored.reduce((s, n) => s + n.sentimentScore, 0) / scored.length;
  const label = avg >= 0.35 ? 'bullish' : avg >= 0.15 ? 'somewhat-bullish' : avg <= -0.35 ? 'bearish' : avg <= -0.15 ? 'somewhat-bearish' : 'neutral';
  return { score: +avg.toFixed(3), label, n: scored.length, confidence: Math.min(0.7, 0.2 + 0.1 * scored.length) };
}

export function investmentReadiness({
  allTx = {}, commitments = [], salary = null, now = Date.now(), assetKey = 'indice',
  liveRegime = null, newsItems = null,
} = {}) {
  const asset = assetKey === 'cripto' ? measuredAssumptions?.btc : measuredAssumptions?.spy;
  // Regime LIVE (rilevato da src/alpha/regime.js sulla serie prezzi appena
  // scaricata, vedi idleFetchPrices in main.js) prevale sullo scatto statico
  // quando disponibile: più fresco, stessa fonte di verità (detectRegime),
  // nessuna architettura parallela. `regimeSource` dichiara sempre quale dei
  // due sta rispondendo — mai presentato come "live" se non lo è davvero.
  const regimeInfo = liveRegime || asset?.regime || null;
  const regimeSource = liveRegime ? 'live' : (asset?.regime ? 'static' : null);
  const layers = [{ name: 'market-regime', ok: !!regimeInfo, confidence: regimeInfo ? (liveRegime ? 0.65 : 0.5) : 0 }];

  const sentiment = aggregateNewsSentiment(newsItems || []);
  layers.push({ name: 'news-sentiment', ok: !!sentiment, confidence: sentiment ? sentiment.confidence : 0 });

  // Il minimo PRUDENTE (Cassa Unica) fino al prossimo stipendio: quanto puoi
  // mettere via SENZA rischiare di restare a corto se spendi come al solito.
  // Non "quanto hai adesso" (un numero che ignora impegni e ritmo) — quello
  // che questo strumento sa fare e nessun broker può sapere.
  let cash = null;
  try {
    // saldo REALE (non relativo): stesso calcolo onesto già usato dal
    // Salvadanaio (entrate−uscite−investito cumulate da tutti i movimenti) —
    // senza, "il minimo prudente da qui a 21 giorni" parte da zero e cade
    // quasi sempre a zero per chiunque spenda, rendendo il segnale inutile.
    const { cash: liquidity } = cashFromTransactions(allTx);
    const fc = cashForecast({ allTx, commitments, salary, startBalance: liquidity, now, horizonDays: 21 });
    if (fc.known) {
      const prudentMin = Math.min(fc.end.p10, ...fc.path.map(p => p.p10));
      cash = { safeSurplus: Math.max(0, +prudentMin.toFixed(2)), relative: fc.relative, confidence: fc.confidence || 0 };
    }
  } catch (_) { cash = null; }
  layers.push({ name: 'personal-cash-safety', ok: !!cash, confidence: cash ? Math.max(0.4, cash.confidence) : 0 });

  const money = (n) => `${(+n || 0).toFixed(2).replace('.', ',')} €`;
  const dateOf = (iso) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

  let verdict = null;
  if (regimeInfo && cash) {
    const marketAsOf = regimeSource === 'live' ? new Date(now).toISOString() : asset.fetchedAt;
    const staleDays = regimeSource === 'live' ? 0 : Math.round((now - new Date(asset.fetchedAt).getTime()) / 86_400_000);
    const freshnessNote = regimeSource === 'live' ? '' : `, ${staleDays} giorni fa — verifica un dato più recente`;
    const sentimentNote = sentiment ? ` Le notizie recenti (${sentiment.n} fonti reali) sono ${sentiment.label === 'bullish' ? 'nettamente positive' : sentiment.label === 'somewhat-bullish' ? 'leggermente positive' : sentiment.label === 'bearish' ? 'nettamente negative' : sentiment.label === 'somewhat-bearish' ? 'leggermente negative' : 'neutre'}.` : '';
    verdict = {
      marketRegime: regimeInfo.regime,
      marketAsOf,
      marketStaleDays: staleDays,
      regimeSource,
      newsSentiment: sentiment,
      personalSafeSurplus: cash.safeSurplus,
      canConsider: cash.safeSurplus > 0,
      message: cash.safeSurplus <= 0
        ? `Non hai un avanzo sicuro in questo momento (tolto ciò che il tuo ritmo di spesa userà nei prossimi 21 giorni): prima la tua liquidità, un eventuale investimento può aspettare.`
        : regimeInfo.regime === 'risk-on'
          ? `Hai ${money(cash.safeSurplus)} che non ti serviranno nei prossimi 21 giorni, e il mercato (dato al ${dateOf(marketAsOf)}${freshnessNote}) era in fase favorevole.${sentimentNote} Nessuna garanzia, nessun consiglio d'acquisto: solo il quadro.`
          : regimeInfo.regime === 'risk-off'
            ? `Hai ${money(cash.safeSurplus)} di avanzo sicuro, ma il mercato (dato al ${dateOf(marketAsOf)}${freshnessNote}) era in fase debole/volatile: molti preferiscono aspettare stabilità, ma resta una scelta personale.${sentimentNote}`
            : `Hai ${money(cash.safeSurplus)} di avanzo sicuro; il mercato (dato al ${dateOf(marketAsOf)}${freshnessNote}) non mostrava una direzione chiara (né forte né debole).${sentimentNote}`,
    };
  }

  return { regime: regimeInfo, cash, verdict, layers, combined: combineConfidence(layers) };
}
