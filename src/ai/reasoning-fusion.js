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
import { buildCausalGraph, pruneNonCausal, buildCategorySeries, annotateConditionalGranger } from '../predict/causal-graph.js';
import { projectNetWorthByStrategy } from '../alpha/net-worth.js';
import { cashForecast } from '../predict/cash-forecast.js';
import { isFreshNewsEvidence } from '../alpha/news.js';

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
    // v3 (Granger condizionale, src/predict/causal-graph.js): ANNOTA (non
    // scarta) ogni effetto a catena con la conferma condizionata su un'altra
    // categoria. PROVATO SPERIMENTALMENTE che filtrare in automatico è troppo
    // aggressivo su pochi dati personali — un test dedicato ha mostrato che
    // può uccidere un effetto REALE solo perché un'altra categoria condivide
    // la stessa causa di fondo (collinearità), non perché il legame fosse
    // falso. Onestà: meglio un caveat visibile ("potrebbe dipendere anche da
    // Z") che cancellare un effetto vero per sembrare più rigorosi di quanto
    // i dati permettano.
    if (whatIf) {
      try {
        const series = buildCategorySeries(allTx, referenceDate);
        const annotated = annotateConditionalGranger(links, series);
        whatIf.chainEffects = whatIf.chainEffects.map((e) => {
          const link = annotated.find(l => l.to === e.category && l.lagWeeks === e.lagWeeks);
          return { ...e, conditionalGrangerConfirmed: link?.conditionalGrangerConfirmed ?? null };
        });
      } catch (_) { /* l'annotazione è un affinamento: se fallisce gli effetti restano invariati */ }
    }
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
// Da quando src/ai/local-sentiment.js esiste, `sentimentScore` non è più
// Oltre ad Alpha Vantage, qualunque notizia del cascade (Finnhub/NewsAPI/
// GDELT/Hacker News/Federal Register/Fed/BCE, tutte a `null` prima) può arrivare
// con un punteggio stimato ON-DEVICE (opt-in, `n.sentimentSource ===
// 'on-device'`). Prima di questo, questo layer era quasi sempre vuoto per
// chi non aveva una chiave Alpha Vantage personale — ora si riempie per
// chiunque, ma la CONFIDENZA deve saperlo: uno score on-device stimato dal
// solo titolo da un modello da 82M parametri non vale quanto un servizio
// dedicato con più segnali. `onDevice:true` lo dichiara al chiamante (qui
// e in investmentReadiness), mai presentato come identico.
export function aggregateNewsSentiment(items = [], { now = Date.now() } = {}) {
  const scored = items.filter((n) => Number.isFinite(n?.sentimentScore) && Math.abs(n.sentimentScore) <= 1 && isFreshNewsEvidence(n, { now }));
  if (!scored.length) return null;
  // An aggregator can return many articles from one domain. Give each
  // domain one vote so repeats cannot manufacture agreement. A domain is
  // only a diversity proxy, not proof of independent editorial reporting.
  const byPublisher = new Map();
  for (const item of scored) {
    let publisher = '';
    try { publisher = new URL(item.url).hostname.toLowerCase().replace(/^www\./, ''); } catch (_) { /* source fallback below */ }
    publisher ||= String(item.source || 'unknown').split(' · ')[0].trim().toLowerCase();
    const scores = byPublisher.get(publisher) || [];
    scores.push(item.sentimentScore);
    byPublisher.set(publisher, scores);
  }
  const sourceCount = byPublisher.size;
  const avg = [...byPublisher.values()].reduce((sum, scores) =>
    sum + scores.reduce((part, score) => part + score, 0) / scores.length, 0) / sourceCount;
  const label = avg >= 0.35 ? 'bullish' : avg >= 0.15 ? 'somewhat-bullish' : avg <= -0.35 ? 'bearish' : avg <= -0.15 ? 'somewhat-bearish' : 'neutral';
  const onDevice = scored.some((n) => n.sentimentSource === 'on-device');
  const relayed = scored.some((n) => n.sentimentSource === 'relay-mesh');
  // This is a heuristic evidence weight, not a calibrated probability.
  const confidence = Math.min(relayed ? 0.5 : onDevice ? 0.6 : 0.7, 0.15 + 0.1 * sourceCount);
  const score = +avg.toFixed(3) || 0;
  return { score, label, n: scored.length, sourceCount, confidence, onDevice, relayed };
}

// Testi del quadro "posso investire?" nelle 7 lingue dell'interfaccia.
const READINESS_TEXT = {
  it: {
    none: 'Non hai un avanzo sicuro in questo momento (tolto ciò che il tuo ritmo di spesa userà nei prossimi 21 giorni): prima la tua liquidità, un eventuale investimento può aspettare.',
    stale: (d) => `, ${d} giorni fa: verifica un dato più recente`,
    news: (n, s, dev, rel, tone) => ` Le notizie recenti (${n} articoli, ${s} siti distinti${dev ? ', in parte classificati sul dispositivo dai soli titoli' : ''}${rel ? ', in parte valutati da dispositivi collegati' : ''}) hanno un tono ${tone}; non prova la direzione del prezzo.`,
    tone: { bullish: 'molto positivo', 'somewhat-bullish': 'positivo', bearish: 'molto negativo', 'somewhat-bearish': 'negativo', neutral: 'neutro' },
    on: (m, d, f, sn) => `Hai ${m} che non ti serviranno nei prossimi 21 giorni, e il mercato (dato al ${d}${f}) era in fase favorevole.${sn} Nessuna garanzia, nessun consiglio d'acquisto: solo il quadro.`,
    off: (m, d, f, sn) => `Hai ${m} di avanzo sicuro, ma il mercato (dato al ${d}${f}) era in fase debole o volatile: molti preferiscono aspettare stabilità, ma resta una scelta personale.${sn}`,
    flat: (m, d, f, sn) => `Hai ${m} di avanzo sicuro; il mercato (dato al ${d}${f}) non mostrava una direzione chiara (né forte né debole).${sn}`,
  },
  en: {
    none: "You don't have a safe surplus right now (after what your spending pace will use in the next 21 days): your cash comes first, any investment can wait.",
    stale: (d) => `, ${d} days ago: check a more recent figure`,
    news: (n, s, dev, rel, tone) => ` Recent news (${n} articles, ${s} distinct sites${dev ? ', partly classified on the device from headlines only' : ''}${rel ? ', partly assessed by linked devices' : ''}) has a ${tone} tone; it doesn't prove where prices will go.`,
    tone: { bullish: 'very positive', 'somewhat-bullish': 'positive', bearish: 'very negative', 'somewhat-bearish': 'negative', neutral: 'neutral' },
    on: (m, d, f, sn) => `You have ${m} you won't need in the next 21 days, and the market (as of ${d}${f}) was in a favourable phase.${sn} No guarantee, no buying advice: just the picture.`,
    off: (m, d, f, sn) => `You have ${m} of safe surplus, but the market (as of ${d}${f}) was weak or volatile: many prefer to wait for stability, but it's your choice.${sn}`,
    flat: (m, d, f, sn) => `You have ${m} of safe surplus; the market (as of ${d}${f}) showed no clear direction (neither strong nor weak).${sn}`,
  },
  de: {
    none: 'Du hast gerade keinen sicheren Überschuss (nach dem, was dein Ausgabentempo in den nächsten 21 Tagen braucht): zuerst deine Liquidität, eine Anlage kann warten.',
    stale: (d) => `, vor ${d} Tagen: prüfe einen aktuelleren Wert`,
    news: (n, s, dev, rel, tone) => ` Aktuelle Nachrichten (${n} Artikel, ${s} verschiedene Seiten${dev ? ', teils auf dem Gerät nur anhand der Überschriften eingeordnet' : ''}${rel ? ', teils von verbundenen Geräten bewertet' : ''}) haben einen ${tone} Ton; das beweist keine Kursrichtung.`,
    tone: { bullish: 'sehr positiven', 'somewhat-bullish': 'positiven', bearish: 'sehr negativen', 'somewhat-bearish': 'negativen', neutral: 'neutralen' },
    on: (m, d, f, sn) => `Du hast ${m}, die du in den nächsten 21 Tagen nicht brauchst, und der Markt (Stand ${d}${f}) war in einer günstigen Phase.${sn} Keine Garantie, keine Kaufempfehlung: nur das Bild.`,
    off: (m, d, f, sn) => `Du hast ${m} sicheren Überschuss, aber der Markt (Stand ${d}${f}) war schwach oder schwankend: viele warten lieber auf Stabilität, die Entscheidung liegt bei dir.${sn}`,
    flat: (m, d, f, sn) => `Du hast ${m} sicheren Überschuss; der Markt (Stand ${d}${f}) zeigte keine klare Richtung (weder stark noch schwach).${sn}`,
  },
  fr: {
    none: "Vous n'avez pas d'excédent sûr en ce moment (après ce que votre rythme de dépense utilisera dans les 21 prochains jours) : d'abord votre trésorerie, un placement peut attendre.",
    stale: (d) => `, il y a ${d} jours : vérifiez une donnée plus récente`,
    news: (n, s, dev, rel, tone) => ` Les actualités récentes (${n} articles, ${s} sites distincts${dev ? ', en partie classées sur l\'appareil à partir des seuls titres' : ''}${rel ? ', en partie évaluées par des appareils liés' : ''}) ont un ton ${tone} ; cela ne prouve pas la direction des prix.`,
    tone: { bullish: 'très positif', 'somewhat-bullish': 'positif', bearish: 'très négatif', 'somewhat-bearish': 'négatif', neutral: 'neutre' },
    on: (m, d, f, sn) => `Vous avez ${m} dont vous n'aurez pas besoin dans les 21 prochains jours, et le marché (au ${d}${f}) était en phase favorable.${sn} Aucune garantie, aucun conseil d'achat : juste le tableau.`,
    off: (m, d, f, sn) => `Vous avez ${m} d'excédent sûr, mais le marché (au ${d}${f}) était faible ou volatil : beaucoup préfèrent attendre la stabilité, mais le choix vous appartient.${sn}`,
    flat: (m, d, f, sn) => `Vous avez ${m} d'excédent sûr ; le marché (au ${d}${f}) ne montrait pas de direction claire (ni fort ni faible).${sn}`,
  },
  es: {
    none: 'Ahora mismo no tienes un excedente seguro (descontado lo que tu ritmo de gasto usará en los próximos 21 días): primero tu liquidez, una inversión puede esperar.',
    stale: (d) => `, hace ${d} días: comprueba un dato más reciente`,
    news: (n, s, dev, rel, tone) => ` Las noticias recientes (${n} artículos, ${s} sitios distintos${dev ? ', en parte clasificadas en el dispositivo solo por los titulares' : ''}${rel ? ', en parte valoradas por dispositivos vinculados' : ''}) tienen un tono ${tone}; no prueba la dirección del precio.`,
    tone: { bullish: 'muy positivo', 'somewhat-bullish': 'positivo', bearish: 'muy negativo', 'somewhat-bearish': 'negativo', neutral: 'neutro' },
    on: (m, d, f, sn) => `Tienes ${m} que no necesitarás en los próximos 21 días, y el mercado (dato del ${d}${f}) estaba en fase favorable.${sn} Sin garantías ni consejos de compra: solo el panorama.`,
    off: (m, d, f, sn) => `Tienes ${m} de excedente seguro, pero el mercado (dato del ${d}${f}) estaba débil o volátil: muchos prefieren esperar estabilidad, pero es tu decisión.${sn}`,
    flat: (m, d, f, sn) => `Tienes ${m} de excedente seguro; el mercado (dato del ${d}${f}) no mostraba una dirección clara (ni fuerte ni débil).${sn}`,
  },
  nl: {
    none: 'Je hebt nu geen veilig overschot (na wat je uitgaventempo de komende 21 dagen gebruikt): eerst je liquiditeit, beleggen kan wachten.',
    stale: (d) => `, ${d} dagen geleden: controleer een recenter cijfer`,
    news: (n, s, dev, rel, tone) => ` Recent nieuws (${n} artikelen, ${s} verschillende sites${dev ? ', deels op het apparaat ingedeeld op basis van alleen de koppen' : ''}${rel ? ', deels beoordeeld door gekoppelde apparaten' : ''}) heeft een ${tone} toon; dat bewijst de koersrichting niet.`,
    tone: { bullish: 'zeer positieve', 'somewhat-bullish': 'positieve', bearish: 'zeer negatieve', 'somewhat-bearish': 'negatieve', neutral: 'neutrale' },
    on: (m, d, f, sn) => `Je hebt ${m} die je de komende 21 dagen niet nodig hebt, en de markt (stand ${d}${f}) zat in een gunstige fase.${sn} Geen garantie, geen koopadvies: alleen het beeld.`,
    off: (m, d, f, sn) => `Je hebt ${m} veilig overschot, maar de markt (stand ${d}${f}) was zwak of beweeglijk: veel mensen wachten liever op stabiliteit, maar het blijft jouw keuze.${sn}`,
    flat: (m, d, f, sn) => `Je hebt ${m} veilig overschot; de markt (stand ${d}${f}) liet geen duidelijke richting zien (niet sterk en niet zwak).${sn}`,
  },
  pt: {
    none: 'Neste momento não tem um excedente seguro (descontado o que o seu ritmo de gasto vai usar nos próximos 21 dias): primeiro a sua liquidez, um investimento pode esperar.',
    stale: (d) => `, há ${d} dias: verifique um dado mais recente`,
    news: (n, s, dev, rel, tone) => ` As notícias recentes (${n} artigos, ${s} sites distintos${dev ? ', em parte classificadas no dispositivo só pelos títulos' : ''}${rel ? ', em parte avaliadas por dispositivos ligados' : ''}) têm um tom ${tone}; não prova a direção do preço.`,
    tone: { bullish: 'muito positivo', 'somewhat-bullish': 'positivo', bearish: 'muito negativo', 'somewhat-bearish': 'negativo', neutral: 'neutro' },
    on: (m, d, f, sn) => `Tem ${m} de que não vai precisar nos próximos 21 dias, e o mercado (dado de ${d}${f}) estava numa fase favorável.${sn} Sem garantias nem conselhos de compra: só o quadro.`,
    off: (m, d, f, sn) => `Tem ${m} de excedente seguro, mas o mercado (dado de ${d}${f}) estava fraco ou volátil: muitos preferem esperar estabilidade, mas a escolha é sua.${sn}`,
    flat: (m, d, f, sn) => `Tem ${m} de excedente seguro; o mercado (dado de ${d}${f}) não mostrava uma direção clara (nem forte nem fraco).${sn}`,
  },
};

export function investmentReadiness({
  allTx = {}, commitments = [], salary = null, now = Date.now(), assetKey = 'indice',
  liveRegime = null, newsItems = null, lang = 'it',
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

  const sentiment = aggregateNewsSentiment(newsItems || [], { now });
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
  const LOC = { it: 'it-IT', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', nl: 'nl-NL', pt: 'pt-PT' };
  const W = READINESS_TEXT[lang] || READINESS_TEXT.it;
  const dateOf = (iso) => new Date(iso).toLocaleDateString(LOC[lang] || 'it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

  let verdict = null;
  if (regimeInfo && cash) {
    const marketAsOf = regimeSource === 'live' ? new Date(now).toISOString() : asset.fetchedAt;
    const staleDays = regimeSource === 'live' ? 0 : Math.round((now - new Date(asset.fetchedAt).getTime()) / 86_400_000);
    const freshnessNote = regimeSource === 'live' ? '' : W.stale(staleDays);
    const sentimentNote = sentiment ? W.news(sentiment.n, sentiment.sourceCount, sentiment.onDevice, sentiment.relayed, W.tone[sentiment.label] || W.tone.neutral) : '';
    verdict = {
      marketRegime: regimeInfo.regime,
      marketAsOf,
      marketStaleDays: staleDays,
      regimeSource,
      newsSentiment: sentiment,
      personalSafeSurplus: cash.safeSurplus,
      canConsider: cash.safeSurplus > 0,
      message: cash.safeSurplus <= 0
        ? W.none
        : regimeInfo.regime === 'risk-on'
          ? W.on(money(cash.safeSurplus), dateOf(marketAsOf), freshnessNote, sentimentNote)
          : regimeInfo.regime === 'risk-off'
            ? W.off(money(cash.safeSurplus), dateOf(marketAsOf), freshnessNote, sentimentNote)
            : W.flat(money(cash.safeSurplus), dateOf(marketAsOf), freshnessNote, sentimentNote),
    };
  }

  return { regime: regimeInfo, cash, verdict, layers, combined: combineConfidence(layers) };
}
