// ============================================================
// BNPL — "paga a rate" (Klarna, PayPal, Scalapay... e QUALUNQUE altro) v2
// ============================================================
// Il problema di settore, reale e misurato dal comportamento degli utenti:
// il "buy now pay later" spezzetta un acquisto in 3-4 rate su UN provider, ma
// una persona ne usa spesso 2-3 in parallelo (Klarna per le scarpe, PayPal Pay
// in 3 per il volo, Scalapay per il regalo) — nessuna delle app dei singoli
// provider vede le ALTRE. Momentum sì: vede l'estratto conto, quindi vede
// TUTTI i piani attivi insieme, indipendentemente dal provider. Questo è
// l'"BNPL stacking" di cui parla il settore (i regolatori UK/EU lo chiamano
// così): la gente perde il conto di quanto deve complessivamente.
//
// Onestà (regola #2 del progetto): un piano si dichiara ATTIVO solo con
// evidenza vera — il NOME del provider nella descrizione (Klarna/PayPal Pay in
// N/Scalapay/Clearpay/Afterpay/Younited/Oney/Cofidis/Soisy: quelli davvero
// operativi in IT/EU) E almeno due addebiti dello stesso importo distanziati
// come una rata (10-40 giorni: copre sia il "Pay in 4" biweekly sia il "Pay in
// 3" mensile). Un singolo addebito Klarna (spesso è solo "paga con Klarna in
// un'unica soluzione", non un piano) NON basta e non genera un piano: si tace.
// Le rate ancora da venire sono una PROIEZIONE dichiarata tale (il totale
// rate standard di settore è 3 o 4 — mai un'invenzione, sempre segnalato).
//
// Funzioni pure, nessun DOM, nessuna rete.
'use strict';

import { descriptionSimilarity } from '../core/deduplicator.js';

const DAY_MS = 86_400_000;
const r2 = (n) => Math.round(n * 100) / 100;

// Provider REALMENTE operativi con addebito a rate (non semplici gateway di
// pagamento in un'unica soluzione), IT/EU + i grandi player globali. L'elenco
// è dichiarato e per forza incompleto (il settore ne genera di nuovi in
// continuazione) — per questo esiste ANCHE il rilevatore generico senza nome
// di marchio più sotto: la lista aiuta la PRECISIONE sui nomi noti, non è
// l'unica via per essere riconosciuti.
const PROVIDER_PATTERNS = [
  { id: 'klarna', label: 'Klarna', re: /klarna/i },
  { id: 'paypal-pay-later', label: 'PayPal (rate)', re: /paypal.*(pay\s*in|rateal|installment)/i },
  { id: 'scalapay', label: 'Scalapay', re: /scalapay/i },
  { id: 'clearpay', label: 'Clearpay', re: /clearpay/i },
  { id: 'afterpay', label: 'Afterpay', re: /afterpay/i },
  { id: 'younited', label: 'Younited', re: /younited/i },
  { id: 'oney', label: 'Oney', re: /\boney\b/i },
  { id: 'cofidis', label: 'Cofidis', re: /cofidis/i },
  { id: 'soisy', label: 'Soisy', re: /soisy/i },
  { id: 'zip', label: 'Zip', re: /\bzip\s*(co|pay)?\b/i },
  { id: 'sezzle', label: 'Sezzle', re: /sezzle/i },
  { id: 'affirm', label: 'Affirm', re: /affirm/i },
  { id: 'zilch', label: 'Zilch', re: /zilch/i },
  { id: 'tabby', label: 'Tabby', re: /tabby/i },
  { id: 'tamara', label: 'Tamara', re: /tamara/i },
  { id: 'alma', label: 'Alma', re: /\balma\b.*(pay|rate|fois)/i },
  { id: 'riverty', label: 'Riverty', re: /riverty/i },
  { id: 'splitit', label: 'Splitit', re: /splitit/i },
  { id: 'divido', label: 'Divido', re: /divido/i },
  { id: 'mondu', label: 'Mondu', re: /mondu/i },
  { id: 'billie', label: 'Billie', re: /\bbillie\b/i },
  { id: 'twisto', label: 'Twisto', re: /twisto/i },
  { id: 'findomestic-rateo', label: 'Findomestic Rateo', re: /findomestic.*(rateo|rate)/i },
  // termini generici multi-provider (quando la banca mostra "PAGAMENTO A RATE"
  // senza nome commerciale, o un provider non ancora nel nostro elenco usa un
  // linguaggio standard di settore).
  { id: 'generic-bnpl-term', label: 'Pagamento a rate', re: /\b(buy\s*now\s*pay\s*later|bnpl|pay\s*in\s*[234]\b|\d\s*\/\s*[234]\s*rate)/i },
];

function detectProvider(description) {
  const d = description || '';
  return PROVIDER_PATTERNS.find(p => p.re.test(d)) || null;
}

function flattenTx(allTx) {
  const out = [];
  for (const [mk, txs] of Object.entries(allTx || {})) {
    for (const t of (txs || [])) if (t && t.type === 'uscita') out.push({ ...t, _month: mk });
  }
  return out.sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Incatena una lista (già filtrata su UN gruppo — stesso provider o stessa
// insegna) in serie di importo compatibile e cadenza da rata. Condiviso tra il
// rilevamento per MARCHIO NOTO e quello GENERICO (vedi sotto): la logica di
// "cos'è una serie" è unica, cambia solo COME si raggruppano le transazioni.
function chainInstallments(list, { amountTol, cadenceMin, cadenceMax }) {
  const chains = [];
  const used = new Set();
  for (let i = 0; i < list.length; i++) {
    if (used.has(i)) continue;
    const chain = [list[i]];
    used.add(i);
    let cursor = list[i];
    for (let j = i + 1; j < list.length; j++) {
      if (used.has(j)) continue;
      const amt = +list[j].amount, ref = +cursor.amount;
      const withinAmount = Math.abs(amt - ref) / ref <= amountTol;
      const days = (new Date(list[j].date) - new Date(cursor.date)) / DAY_MS;
      if (withinAmount && days >= cadenceMin && days <= cadenceMax) {
        chain.push(list[j]);
        used.add(j);
        cursor = list[j];
      }
    }
    if (chain.length >= 2) chains.push(chain);
  }
  return chains;
}

function seriesFromChain(chain, providerId, providerLabel, confidence) {
  const amounts = chain.map(c => +c.amount);
  const cadenceDays = r2((new Date(chain.at(-1).date) - new Date(chain[0].date)) / DAY_MS / (chain.length - 1));
  return {
    id: `${providerId}-${chain[0].date}-${r2(amounts[0])}`,
    providerId, providerLabel,
    installmentAmount: r2(amounts.reduce((s, a) => s + a, 0) / amounts.length),
    paidCount: chain.length,
    cadenceDays,
    firstDate: chain[0].date,
    lastPaidDate: chain.at(-1).date,
    category: chain.find(c => c.category)?.category || null,
    txIds: chain.map(c => c.id),
    confidence,
  };
}

// ── 1. RILEVAMENTO SERIE ────────────────────────────────────────────────────
// Raggruppa gli addebiti dello stesso provider e importo (tolleranza minima:
// l'ultima rata a volte assorbe un arrotondamento) in serie con cadenza da
// rata (10-40 giorni tra un addebito e il successivo). Ogni serie con ALMENO 2
// addebiti è un piano; un addebito isolato non lo è (potrebbe essere un
// pagamento in un'unica soluzione via quel provider, non un piano a rate).
//
// AUTO-ADATTIVO oltre l'elenco marchi (settore in continua espansione — Zip,
// Sezzle, Tabby, Alma, Riverty e altri nascono di continuo, un elenco statico
// invecchia da solo): `includeUnbranded` (default true) aggiunge un secondo
// rilevatore SENZA nome di marchio, per QUALSIASI esercente/servizio mai
// sentito nominare. Si affida al segnale più forte e sicuro che esiste senza
// un brand a confermarlo: la cadenza BIWEEKLY (10-18gg). Un vero abbonamento
// (Netflix, palestra, assicurazione) è quasi sempre mensile o annuale — nella
// pratica nessun abbonamento fattura ogni 2 settimane, mentre "Pay in 4" lo fa
// SEMPRE. Confidenza dichiarata più bassa (`confidence:'pattern'` vs
// `'brand'`) perché manca la conferma del nome: onesto, non nascosto.
export function detectBnplSeries(allTx, {
  amountTol = 0.03, cadenceMin = 10, cadenceMax = 40, now = Date.now(),
  includeUnbranded = true, unbrandedCadenceMax = 18, unbrandedMinAmount = 15,
  unbrandedSimilarity = 0.8,
} = {}) {
  const flat = flattenTx(allTx).filter(t => +t.amount > 0);
  const withProvider = flat.map(t => ({ ...t, provider: detectProvider(t.description) }));
  const branded = withProvider.filter(t => t.provider);

  const byProvider = new Map();
  for (const t of branded) {
    const list = byProvider.get(t.provider.id) || [];
    list.push(t);
    byProvider.set(t.provider.id, list);
  }

  const series = [];
  const brandedIds = new Set();
  for (const [providerId, list] of byProvider) {
    for (const chain of chainInstallments(list, { amountTol, cadenceMin, cadenceMax })) {
      series.push(seriesFromChain(chain, providerId, chain[0].provider.label, 'brand'));
      for (const c of chain) brandedIds.add(c.id);
    }
  }

  if (includeUnbranded) {
    // solo le transazioni SENZA marchio riconosciuto e non già in una serie
    // di marchio noto — evita di duplicare o "rubare" addebiti già spiegati.
    const rest = withProvider.filter(t => !t.provider && !brandedIds.has(t.id) && +t.amount >= unbrandedMinAmount);
    // raggruppa per descrizione SIMILE (stesso giudice del deduplicatore, ma
    // soglia più stretta: qui non c'è un nome di marchio a corroborare).
    const groups = [];
    for (const t of rest) {
      let g = groups.find(g => descriptionSimilarity(g.rep, t.description || '') >= unbrandedSimilarity);
      if (!g) { g = { rep: t.description || '', items: [] }; groups.push(g); }
      g.items.push(t);
    }
    for (const g of groups) {
      for (const chain of chainInstallments(g.items, { amountTol, cadenceMin, cadenceMax: unbrandedCadenceMax })) {
        const label = (g.rep || 'Pagamento a rate').trim();
        series.push(seriesFromChain(chain, `generic:${label.toLowerCase()}`, `${label} (rate)`, 'pattern'));
      }
    }
  }

  return series.sort((a, b) => new Date(a.firstDate) - new Date(b.firstDate));
}

// ── 2. PROIEZIONE DELLE RATE RESIDUE ────────────────────────────────────────
// Il "Pay in 4" biweekly e il "Pay in 3" mensile sono standard di settore
// (dichiarati, non inventati): la cadenza osservata sceglie l'ipotesi.
// Se sono già state pagate più rate di quelle standard, il piano è più lungo
// del previsto (vero finanziamento a rate) → si estende di UNA rata alla
// volta finché non si osserva la fine (nessuna invenzione di un totale certo).
function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// AUTO-ADDESTRANTE: lo standard di settore (3/4 rate) è il punto di partenza
// onesto quando non sappiamo nulla di questo utente — ma se ha già CHIUSO
// piani con QUESTO provider in passato, la lunghezza REALE che osserviamo per
// lui vale più della media di settore (esattamente come learnCommitmentAmount
// in fixed-commitments.js impara l'importo reale di una bolletta invece del
// numero digitato). Serve ALMENO 2 piani chiusi con lo stesso provider prima
// di fidarsi del appreso (un solo piano potrebbe essere un caso anomalo).
// TRE LIVELLI di fiducia, dal più specifico al più generico — MAI un livello
// più debole usato se ne esiste uno più forte, e MAI un default di settore se
// c'è QUALSIASI storia personale (anche di un altro provider: chi fa piani a
// rate lunghi con Klarna probabilmente li fa lunghi anche con PayPal, è la
// stessa abitudine di spesa, non una proprietà del brand):
//  1. QUESTO provider, ≥2 piani chiusi → il livello più affidabile.
//  2. QUALSIASI provider di QUESTO utente, ≥2 piani chiusi in totale → la sua
//     abitudine personale, anche se mai vista con QUESTO provider prima.
//  3. Standard di settore (3 o 4 rate) → solo se non sappiamo nulla di lui.
function pooledClosedLengths(learned) {
  return Object.values(learned || {}).flatMap(e => e.closedLengths || []);
}
function pooledClosedCadences(learned) {
  return Object.values(learned || {}).flatMap(e => e.closedCadences || []);
}

function learnedTotalFor(providerId, learned) {
  const specific = learned?.[providerId]?.closedLengths || [];
  if (specific.length >= 2) return { value: Math.round(median(specific)), tier: 'provider' };
  const pooled = pooledClosedLengths(learned);
  if (pooled.length >= 2) return { value: Math.round(median(pooled)), tier: 'personale' };
  return null;
}

function assumedTotal(cadenceDays, paidCount, providerId, learned) {
  const learnedN = learnedTotalFor(providerId, learned);
  const standard = learnedN?.value || (cadenceDays <= 20 ? 4 : 3);   // biweekly→4, mensile→3
  // Se sono già state pagate almeno quante rate lo standard prevede, il piano
  // si considera concluso: non si assume MAI una rata in più senza evidenza
  // (un vero finanziamento più lungo del solito resterebbe scoperto per un
  // ciclo, ma è l'errore onesto — sbagliare in eccesso sarebbe peggio).
  return Math.max(standard, paidCount);
}

// Impronta di un piano CHIUSO — evita di re-imparare la stessa chiusura a ogni
// render (stesso principio di labelFingerprint in commitment-training.js).
export const closedPlanFingerprint = (s) => `${s.providerId}|${s.firstDate}|${s.paidCount}`;

// Osserva i piani ormai chiusi (rate pagate ≥ standard di settore, nessuna
// nuova rata rilevata da almeno una cadenza di margine — cioè non più
// "in corso") e aggiorna la lunghezza-tipo appresa per quel provider. Additivo:
// il chiamante conserva `learned` nel vault (campo `mlData.bnplLearned`).
export function learnPlanLengths(series, learned = {}, { now = Date.now(), seen = [] } = {}) {
  const next = JSON.parse(JSON.stringify(learned || {}));
  const known = new Set(seen);
  const taught = [];
  for (const s of series) {
    const p = projectSeries(s, { now, learned });
    if (p.active) continue; // ancora in corso: non è una lunghezza "chiusa" affidabile
    const fp = closedPlanFingerprint(s);
    if (known.has(fp)) continue;
    const entry = next[s.providerId] || { closedLengths: [], closedCadences: [] };
    entry.closedLengths = [...entry.closedLengths, s.paidCount].slice(-12); // finestra recente, cap anti-deriva
    entry.closedCadences = [...(entry.closedCadences || []), s.cadenceDays].slice(-12);
    next[s.providerId] = entry;
    known.add(fp);
    taught.push(fp);
  }
  return { learned: next, seen: [...known], taught };
}

export function projectSeries(s, { now = Date.now(), learned = {} } = {}) {
  const learnedN = learnedTotalFor(s.providerId, learned);
  const total = assumedTotal(s.cadenceDays, s.paidCount, s.providerId, learned);
  const remaining = Math.max(0, total - s.paidCount);
  const upcoming = [];
  let cursor = new Date(s.lastPaidDate).getTime();
  for (let i = 0; i < remaining; i++) {
    cursor += Math.round(s.cadenceDays) * DAY_MS;
    upcoming.push({ date: new Date(cursor).toISOString().slice(0, 10), ms: cursor, amount: s.installmentAmount });
  }
  return {
    ...s,
    assumedTotal: total,
    remainingCount: remaining,
    remainingTotal: r2(remaining * s.installmentAmount),
    upcoming,
    active: remaining > 0,
    learnedFromHistory: learnedN !== null,
    learnedTier: learnedN?.tier || null,
    assumption: learnedN?.tier === 'provider'
      ? `imparato dai tuoi piani ${s.providerLabel} passati: di solito sono ${total} rate`
      : learnedN?.tier === 'personale'
        ? `imparato dai tuoi altri piani a rate (non specifico per ${s.providerLabel}): di solito sono ${total} rate`
        : `stima di settore: la maggior parte dei piani ${s.cadenceDays <= 20 ? 'biweekly (Pay in 4)' : 'mensili (Pay in 3)'} è di ${total} rate — non certezza, aggiornata quando arrivano nuovi addebiti`,
  };
}

// ── 3. ESPOSIZIONE TOTALE (l'"BNPL stacking" che nessun provider vede) ──────
// Tutti i piani ATTIVI insieme, indipendentemente dal provider: il numero che
// nessuna app di Klarna/PayPal può dare perché ognuna vede solo se stessa.
export function bnplExposure(allTx, { anticipate = false, ...opts } = {}) {
  const confirmed = detectBnplSeries(allTx, opts).map(s => projectSeries(s, opts)).filter(s => s.active);
  // ANTICIPAZIONE (predittivo, non solo retrospettivo): normalmente si aspetta
  // la 2ª rata prima di parlare di un piano. Ma se questo utente ha già chiuso
  // ≥2 piani con lo stesso provider in passato, conosciamo la sua cadenza e
  // lunghezza tipiche — anticipiamo il piano dalla PRIMA rata invece di
  // aspettare la seconda. Onesto: parla solo con storia personale vera.
  const anticipated = anticipate ? anticipateFromFirstCharge(allTx, opts.learned || {}, opts) : [];
  const series = [...confirmed, ...anticipated];
  const totalRemaining = r2(series.reduce((sum, s) => sum + s.remainingTotal, 0));
  const nextDue = series.flatMap(s => s.upcoming.map(u => ({ ...u, providerLabel: s.providerLabel, anticipated: !!s.anticipated })))
    .sort((a, b) => a.ms - b.ms)[0] || null;
  return {
    plans: series,
    count: series.length,
    confirmedCount: confirmed.length,
    anticipatedCount: anticipated.length,
    totalRemaining,
    nextDue,
    byProvider: series.map(s => ({ providerLabel: s.providerLabel, remainingTotal: s.remainingTotal, remainingCount: s.remainingCount, anticipated: !!s.anticipated })),
  };
}

// ── ANTICIPAZIONE DA UN SOLO ADDEBITO ───────────────────────────────────────
// Il resto del modulo aspetta la 2ª rata (onesto: un addebito solo potrebbe
// essere un pagamento in un'unica soluzione via quel provider, non un piano).
// Ma con ≥2 piani CHIUSI dello stesso provider in passato, la cadenza e la
// lunghezza tipiche di QUESTO utente sono note — si può proiettare l'intero
// piano dalla prima rata. Zero invenzione: tace esattamente come prima senza
// quella storia personale (mai un default di settore usato per anticipare).
export function anticipateFromFirstCharge(allTx, learned = {}, { now = Date.now() } = {}) {
  const confirmedIds = new Set(detectBnplSeries(allTx, { now }).flatMap(s => s.txIds));
  const txs = flattenTx(allTx).map(t => ({ ...t, provider: detectProvider(t.description) }))
    .filter(t => t.provider && +t.amount > 0 && !confirmedIds.has(t.id));

  const results = [];
  for (const t of txs) {
    // stessa gerarchia a tre livelli di assumedTotal: provider specifico →
    // abitudine personale tra provider diversi → (qui: silenzio, mai il
    // default di settore per ANTICIPARE — è la soglia più prudente perché
    // qui si parla PRIMA che una 2ª rata reale confermi qualunque cosa).
    const hist = learned[t.provider.id];
    const specificLen = hist?.closedLengths || [], specificCad = hist?.closedCadences || [];
    const pooledLen = pooledClosedLengths(learned), pooledCad = pooledClosedCadences(learned);
    const useSpecific = specificLen.length >= 2 && specificCad.length >= 2;
    const usePooled = !useSpecific && pooledLen.length >= 2 && pooledCad.length >= 2;
    if (!useSpecific && !usePooled) continue; // nessuna storia vera: si tace
    const tier = useSpecific ? 'provider' : 'personale';
    const lengths = useSpecific ? specificLen : pooledLen;
    const cadences = useSpecific ? specificCad : pooledCad;
    const totalGuess = Math.max(2, Math.round(median(lengths)));
    const cadenceGuess = Math.max(7, Math.round(median(cadences)));
    const upcoming = [];
    let cursor = new Date(t.date).getTime();
    for (let i = 1; i < totalGuess; i++) {
      cursor += cadenceGuess * DAY_MS;
      if (cursor < now) continue; // rate che sarebbero già scadute: non proiettarle nel futuro
      upcoming.push({ date: new Date(cursor).toISOString().slice(0, 10), ms: cursor, amount: +t.amount });
    }
    if (!upcoming.length) continue;
    results.push({
      id: `anticipated-${t.provider.id}-${t.date}`,
      providerId: t.provider.id, providerLabel: t.provider.label,
      firstDate: t.date, installmentAmount: +t.amount, paidCount: 1,
      assumedTotal: totalGuess, remainingCount: upcoming.length,
      remainingTotal: r2(upcoming.reduce((s, u) => s + u.amount, 0)),
      upcoming, active: true, anticipated: true, learnedFromHistory: true, learnedTier: tier,
      assumption: tier === 'provider'
        ? `anticipato dalla prima rata: i tuoi piani ${t.provider.label} passati erano di solito ${totalGuess} rate ogni ~${cadenceGuess} giorni`
        : `anticipato dalla prima rata: basato sui tuoi altri piani a rate (mai visto ${t.provider.label} prima), di solito ${totalGuess} rate ogni ~${cadenceGuess} giorni`,
    });
  }
  return results;
}

// ── 4. PONTE VERSO LA CASSA UNICA (src/predict/cash-forecast.js) ───────────
// Le rate future sono eventi tanto certi quanto un impegno dichiarato: le
// converte nello stesso formato del ledger (kind:'bnpl') così "oggi puoi
// spendere" e la curva le tengono conto senza doppio lavoro.
export function bnplToLedgerEvents(allTx, { now = Date.now(), horizonDays = 45, ...opts } = {}) {
  const { plans } = bnplExposure(allTx, { now, ...opts });
  // confronto per GIORNO, non per istante esatto: una rata di "oggi" (mezzanotte)
  // non deve sparire solo perché `now` è mezzogiorno dello stesso giorno.
  const todayStart = (() => { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); })();
  const end = todayStart + horizonDays * DAY_MS;
  const events = [];
  for (const p of plans) {
    for (const u of p.upcoming) {
      if (u.ms < todayStart || u.ms > end) continue;
      // le rate ANTICIPATE (dalla prima carica, storia personale) sono meno
      // certe di quelle di un piano già confermato da 2 addebiti reali — la
      // banda della Cassa Unica si allarga di conseguenza (stesso meccanismo
      // già usato per gli abbonamenti non ancora dichiarati come impegni).
      events.push({
        date: u.date, ms: u.ms, amount: -r2(u.amount), kind: 'bnpl',
        label: `${p.providerLabel} (rata${p.anticipated ? ' prevista' : ''})`,
        source: 'bnpl', certain: !p.anticipated,
      });
    }
  }
  return events.sort((a, b) => a.ms - b.ms);
}

// ── 5. PROPAGAZIONE DELLA CATEGORIA (Momentum Core / orchestrator) ─────────
// Se l'utente corregge la categoria di UNA rata, è la stessa identica spesa
// delle altre rate della stessa serie (è lo stesso acquisto spezzettato) — non
// ha senso corregerla 4 volte. Insegna al Core una volta per rata rimanente
// (stesso principio di evidenza-limitata di commitment-training.js).
export function propagateSeriesCategory(orchestrator, series, category, { now = Date.now() } = {}) {
  if (!series || !category) return { taught: 0 };
  let taught = 0;
  const reps = Math.min(4, Math.max(1, series.paidCount));
  for (let i = 0; i < reps; i++) {
    try {
      orchestrator.learn(series.providerLabel, category, series.installmentAmount, new Date(now));
      taught++;
    } catch (_) { /* l'apprendimento non deve mai rompere la UI */ }
  }
  return { taught };
}
