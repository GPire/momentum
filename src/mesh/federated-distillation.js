// ============================================================
// FEDERATED DISTILLATION — far crescere il modello BASE senza far uscire i dati
// ============================================================
// La domanda che questo file risponde: come fa Momentum a imparare da migliaia
// di dispositivi sparsi nel mondo, restando un'app che non manda i dati
// finanziari da nessuna parte?
//
// La risposta che il settore dà di solito — "condividiamo i pesi del modello,
// non i dati" — NON è di per sé una garanzia di privacy: dai gradienti di un
// modello si possono ricostruire gli esempi di addestramento (gradient
// inversion, membership inference). È il punto in cui quasi tutti barano.
//
// Qui si fa una cosa diversa e più difendibile, su DUE livelli separati:
//
//  LIVELLO A — DISTILLAZIONE SU SONDE PUBBLICHE.
//    Non escono né pesi né gradienti: escono le PREVISIONI del modello locale
//    su un insieme di stringhe PUBBLICHE e fisse, uguali per tutti, che non
//    appartengono a nessuno (`PROBE_SET`). Il contributo di un dispositivo è
//    "come classifico io la parola 'panetteria'", non "cosa ho comprato".
//    L'inversione del gradiente qui non è attenuata: è impossibile per
//    costruzione, perché non c'è nessun gradiente e nessun dato dell'utente.
//
//  LIVELLO B — LESSICO CON SOGLIA DI CORROBORAZIONE.
//    Il beneficio vero è sui nomi LOCALI (la panetteria sotto casa), che per
//    definizione non stanno in un elenco pubblico. Un token specifico può
//    uscire SOLO dopo che almeno `k` dispositivi INDIPENDENTI lo hanno visto:
//    un esercente unico al mondo — che identificherebbe una persona — non esce
//    per costruzione, mai. Le origini si contano tramite id offuscati, così
//    lo stesso dispositivo non può gonfiare il conteggio da solo.
//
// Contro i peer malevoli: l'aggregazione usa la MEDIANA per coordinata, non la
// media. Un peer che spinge "farmacia → Intrattenimento" non sposta la mediana.
// In più pesa la reputazione già esistente (`update-ledger.js`).
//
// Budget di privacy: ogni rilascio consuma budget; esaurito, il dispositivo
// smette di contribuire fino al periodo successivo. Il budget è un numero
// mostrabile all'utente, non una rassicurazione.
//
// Funzioni PURE (nessun DOM, nessuna rete, tempo iniettabile).
'use strict';

// ── L'insieme di sonde: pubblico, versionato, uguale per tutti ──
// Sono TIPI di esercente generici in più lingue, non nomi di negozi reali di
// nessuno. Cambiarlo cambia il "linguaggio" del confronto, quindi è versionato:
// digest di versioni diverse non si fondono mai (sarebbe confrontare risposte a
// domande diverse).
export const PROBE_VERSION = 1;
export const PROBE_SET = [
  'panetteria', 'panificio', 'forno', 'bakery',
  'farmacia', 'parafarmacia', 'pharmacy',
  'supermercato', 'alimentari', 'market', 'grocery',
  'ristorante', 'trattoria', 'pizzeria', 'osteria', 'restaurant',
  'bar', 'caffe', 'caffetteria', 'pub',
  'benzina', 'carburante', 'distributore', 'fuel',
  'parrucchiere', 'barbiere', 'estetista',
  'palestra', 'piscina', 'gym',
  'libreria', 'cartoleria', 'edicola',
  'abbigliamento', 'calzature', 'boutique',
  'ferramenta', 'idraulico', 'elettricista',
  'taxi', 'autobus', 'metro', 'pedaggio', 'parcheggio',
  'ospedale', 'clinica', 'dentista', 'veterinario',
  'assicurazione', 'banca', 'notaio', 'commercialista',
];

// ── Budget di privacy ──
// Non è una metafora: è un contatore. Ogni rilascio costa, e quando il budget
// è finito non esce più nulla fino al periodo successivo. Mostrabile in chiaro.
export const DEFAULT_BUDGET = { perPeriod: 10, periodMs: 7 * 24 * 3600 * 1000 };

export function initPrivacyBudget(now = Date.now(), opts = {}) {
  const { perPeriod, periodMs } = { ...DEFAULT_BUDGET, ...opts };
  return { spent: 0, perPeriod, periodMs, periodStart: now };
}

export function budgetStatus(budget, now = Date.now()) {
  const b = budget && Number.isFinite(budget.periodStart) ? budget : initPrivacyBudget(now);
  const scaduto = now - b.periodStart >= b.periodMs;
  const spesi = scaduto ? 0 : b.spent;
  const rimasti = Math.max(0, b.perPeriod - spesi);
  return {
    rimasti, totali: b.perPeriod, spesi,
    rinnovoTra: scaduto ? 0 : Math.max(0, b.periodMs - (now - b.periodStart)),
    puoContribuire: rimasti > 0,
  };
}

export function spendBudget(budget, now = Date.now(), costo = 1) {
  const b = budget && Number.isFinite(budget.periodStart) ? budget : initPrivacyBudget(now);
  const scaduto = now - b.periodStart >= b.periodMs;
  const base = scaduto ? { ...b, spent: 0, periodStart: now } : b;
  if (base.spent + costo > base.perPeriod) return { budget: base, ok: false };
  return { budget: { ...base, spent: base.spent + costo }, ok: true };
}

// ── LIVELLO A: distillazione su sonde pubbliche ──

// Arrotondamento a due decimali: due dispositivi con modelli quasi identici
// producono lo stesso digest, e piccole differenze numeriche (che potrebbero
// distinguere un utente) spariscono.
const round2 = (x) => Math.round(x * 100) / 100;

// Costruisce il digest da inviare: per ogni sonda pubblica, la distribuzione
// di probabilità sulle categorie secondo il modello LOCALE.
// `predictFn(testo) -> { categoria: probabilita }` — si passa il predittore
// (l'orchestratore, la morfologia, quello che è) invece di importarlo, così
// questo modulo resta puro e testabile.
export function buildDistillationDigest(predictFn, {
  probes = PROBE_SET, probeVersion = PROBE_VERSION, minConfidence = 0.15,
} = {}) {
  const answers = {};
  for (const probe of probes) {
    let dist = null;
    try { dist = predictFn(probe); } catch (_) { dist = null; }
    if (!dist || typeof dist !== 'object') continue;

    // Si tengono solo le categorie con probabilità non trascurabile: la coda
    // lunga dei valori vicini a zero è rumore che non aiuta nessuno e allunga
    // il messaggio.
    const filtrate = Object.entries(dist)
      .filter(([, p]) => Number.isFinite(p) && p >= minConfidence)
      .map(([cat, p]) => [cat, round2(p)]);
    if (!filtrate.length) continue;

    // Rinormalizza dopo il filtro: la somma deve restare 1, altrimenti la
    // mediana tra peer confronterebbe scale diverse.
    const somma = filtrate.reduce((s, [, p]) => s + p, 0);
    answers[probe] = Object.fromEntries(filtrate.map(([cat, p]) => [cat, round2(p / somma)]));
  }
  return { kind: 'distillation', probeVersion, answers };
}

// Quello che l'utente vede PRIMA di attivare la condivisione: le righe VERE
// che uscirebbero, non una descrizione rassicurante. Nessun competitor lo
// mostra, perché nessuno potrebbe mostrarlo senza spaventare.
export function previewOutgoing(digest, { limit = 12 } = {}) {
  const righe = [];
  for (const [probe, dist] of Object.entries(digest?.answers || {})) {
    const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
    if (top) righe.push(`${probe} → ${top[0]} (${Math.round(top[1] * 100)}%)`);
    if (righe.length >= limit) break;
  }
  return {
    righe,
    totale: Object.keys(digest?.answers || {}).length,
    contieneImporti: false,
    contieneDate: false,
    contieneNomiTuoi: false,
  };
}

// Mediana per coordinata: robusta ai peer malevoli. Con un numero pari di
// valori si prende la media dei due centrali (la mediana standard).
function median(values) {
  if (!values.length) return 0;
  const a = [...values].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// Fonde i digest ricevuti. Il locale conta come un peer con reputazione piena:
// il modello del dispositivo NON viene mai sopraffatto dalla folla se la folla
// dice qualcosa di molto diverso — resta un voto, autorevole ma non unico.
export function mergeDistillationDigests(localDigest, peerDigests = [], {
  ledger = [], reputationWeightFn = null, minPeers = 2, probeVersion = PROBE_VERSION,
} = {}) {
  const valide = (peerDigests || []).filter((p) => p?.digest?.probeVersion === probeVersion);
  const scartatePerVersione = (peerDigests || []).length - valide.length;

  // Peer con reputazione zero: nessun voto. Non serve bandirli esplicitamente.
  const pesate = valide.filter(({ peerId }) => {
    if (!reputationWeightFn) return true;
    return reputationWeightFn(ledger, peerId, 1) > 0;
  });

  const perProbe = new Map();
  const aggiungi = (answers, ripetizioni = 1) => {
    for (const [probe, dist] of Object.entries(answers || {})) {
      if (!perProbe.has(probe)) perProbe.set(probe, new Map());
      const perCat = perProbe.get(probe);
      for (const [cat, p] of Object.entries(dist)) {
        if (!Number.isFinite(p)) continue;
        if (!perCat.has(cat)) perCat.set(cat, []);
        for (let i = 0; i < ripetizioni; i++) perCat.get(cat).push(p);
      }
    }
  };

  if (localDigest?.probeVersion === probeVersion) aggiungi(localDigest.answers, 1);
  for (const { peerId, digest } of pesate) {
    const w = reputationWeightFn ? reputationWeightFn(ledger, peerId, 1) : 1;
    // Il peso della reputazione diventa un numero LIMITATO di voti ripetuti:
    // un peer autorevole pesa di più, ma non può da solo spostare la mediana.
    aggiungi(digest.answers, Math.max(1, Math.min(3, Math.round(w * 3))));
  }

  const merged = {};
  let probeIgnorate = 0;
  for (const [probe, perCat] of perProbe) {
    // Una sonda su cui hanno risposto meno di `minPeers` fonti NON entra nel
    // consenso: un'opinione sola non è saggezza della folla.
    const fonti = Math.max(...[...perCat.values()].map((v) => v.length));
    if (fonti < minPeers) { probeIgnorate++; continue; }
    const mediane = [...perCat.entries()].map(([cat, vals]) => [cat, median(vals)]);
    const somma = mediane.reduce((s, [, v]) => s + v, 0);
    if (somma <= 0) { probeIgnorate++; continue; }
    merged[probe] = Object.fromEntries(mediane.map(([cat, v]) => [cat, round2(v / somma)]));
  }

  return {
    kind: 'distillation', probeVersion, answers: merged,
    stats: { peerAccettati: pesate.length, scartatePerVersione, probeIgnorate, probeFuse: Object.keys(merged).length },
  };
}

// Il segnale per il rilevatore di deriva lenta (contribution-drift.js). Riduce
// il digest di ogni peer a UN numero per round: quanta probabilità mette,
// sonda per sonda, sulla categoria che il modello LOCALE considera in testa —
// mediato sulle sole sonde in comune. Un peer onesto oscilla per rumore; uno
// che avvelena piano concorda sempre un po' meno (o sempre di più su una
// categoria sbagliata), sonda dopo sonda, mesi interi: è la persistenza che
// CUSUM sa vedere e che un confronto isolato, per costruzione, non vede.
//
// Il locale è il riferimento SOLO qui, per questo scopo diagnostico:
// mergeDistillationDigests (la funzione che decide il consenso vero) continua
// a trattarlo come un voto fra pari, mai come una verità nota.
export function roundContributions(localDigest, peerEntries = []) {
  const answers = localDigest?.answers || {};
  const contributi = {};
  for (const { peerId, digest } of peerEntries || []) {
    if (!peerId || digest?.probeVersion !== localDigest?.probeVersion) continue;
    let somma = 0, n = 0;
    for (const [probe, dist] of Object.entries(answers)) {
      const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!top) continue;
      const peerDist = digest.answers?.[probe];
      if (!peerDist) continue;
      somma += peerDist[top] || 0;
      n++;
    }
    // Meno di 3 sonde in comune non è un confronto (stesso principio di
    // minSupport altrove nel progetto): meglio tacere che dare un giudizio
    // costruito su una manciata di coincidenze.
    if (n >= 3) contributi[peerId] = somma / n;
  }
  return contributi;
}

// ── LIVELLO B: lessico con soglia di corroborazione k-anonima ──

// Offusca l'origine: serve solo a CONTARE quante fonti distinte hanno visto un
// token, mai a sapere chi sono. Deterministico per dispositivo (così lo stesso
// dispositivo non conta due volte) ma non riconducibile all'identità.
export function originTag(deviceId, token) {
  const s = `${String(deviceId)}|${String(token)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h >>> 0).toString(36);
}

export function initLexiconPool() { return { version: 1, entries: {} }; }

// Registra un'osservazione "questo token appartiene a questa categoria",
// venuta da un dispositivo. Non esce ancora nulla: entra solo nel conteggio.
// `fidato` (opzionale) e' la risposta di `sybil-resistance.js` alla domanda
// "dietro questo dispositivo c'e' una persona con cui ho una storia vera?".
// Arriva come booleano gia' calcolato dal chiamante, non come identita': il
// tag di origine resta offuscato com'era, e qui entra solo un si'/no. Senza
// questo campo il comportamento e' identico a prima.
export function observeLexicon(pool, { token, category, deviceId, fidato = null }, now = Date.now()) {
  const t = String(token || '').trim().toLowerCase();
  const c = String(category || '').trim();
  if (!t || !c) return pool;
  const base = pool?.entries ? pool : initLexiconPool();
  const key = `${t}\u0000${c}`;
  const prev = base.entries[key] || { token: t, category: c, origins: [], originsFidate: [], lastSeen: 0 };
  const tag = originTag(deviceId, t);
  const origins = prev.origins.includes(tag) ? prev.origins : [...prev.origins, tag];
  const giaFidate = prev.originsFidate || [];
  const originsFidate = fidato === true && !giaFidate.includes(tag) ? [...giaFidate, tag] : giaFidate;
  return { ...base, entries: { ...base.entries, [key]: { ...prev, origins, originsFidate, lastSeen: now } } };
}

// LA REGOLA CHE PROTEGGE: esce solo ciò che almeno `k` dispositivi
// indipendenti hanno visto. Sotto la soglia, l'entrata resta locale — per
// sempre, se necessario. Un negozio unico al mondo non esce MAI.
export const DEFAULT_K_ANONYMITY = 3;

// `soloFidati`: si contano le origini dietro cui c'e' una persona con una
// storia condivisa vera, invece degli identificatori. E' una riga di
// differenza e cambia la garanzia da "tre id diversi" a "tre persone diverse"
// — senza, tre identita' fabbricate in un minuto bastavano a far uscire un
// token (vedi sybil-resistance.js). Spento per default: acceso dal chiamante
// quando ha un grafo di fiducia da cui giudicare.
export function eligibleLexicon(pool, { k = DEFAULT_K_ANONYMITY, soloFidati = false } = {}) {
  const out = [];
  for (const e of Object.values(pool?.entries || {})) {
    const fonti = (soloFidati ? e.originsFidate?.length : e.origins?.length) || 0;
    if (fonti >= k) out.push({ token: e.token, category: e.category, fonti });
  }
  return out.sort((a, b) => b.fonti - a.fonti || a.token.localeCompare(b.token));
}

// Cosa NON è ancora uscibile e perché — serve alla UI per essere onesta:
// "abbiamo 41 nomi che restano solo qui perché nessun altro li ha visti".
export function heldBackLexicon(pool, { k = DEFAULT_K_ANONYMITY, soloFidati = false } = {}) {
  const out = [];
  for (const e of Object.values(pool?.entries || {})) {
    const n = (soloFidati ? e.originsFidate?.length : e.origins?.length) || 0;
    if (n < k) out.push({ token: e.token, category: e.category, fonti: n, mancano: k - n });
  }
  return out;
}

// Costruisce il pacchetto lessicale da inviare: SOLO le voci sopra soglia, e
// senza i tag di origine (che non devono viaggiare: servivano solo a contare).
export function buildLexiconDigest(pool, { k = DEFAULT_K_ANONYMITY, soloFidati = false } = {}) {
  return {
    kind: 'lexicon',
    version: 1,
    entries: eligibleLexicon(pool, { k, soloFidati }).map(({ token, category }) => ({ token, category })),
  };
}

// Fonde i pacchetti lessicali ricevuti: per ogni token vince la categoria
// indicata dal maggior numero di peer DISTINTI (voto di maggioranza, non
// somma di conteggi — così un peer che ripete mille volte la stessa cosa vale
// come uno). In caso di parità non si sceglie: si lascia decidere al modello
// locale, che sui propri dati ne sa di più.
export function mergeLexiconDigests(peerDigests = [], { minVoti = 2 } = {}) {
  const voti = new Map(); // token -> Map(categoria -> Set(peerId))
  for (const { peerId, digest } of peerDigests || []) {
    if (digest?.kind !== 'lexicon') continue;
    for (const { token, category } of digest.entries || []) {
      const t = String(token || '').toLowerCase();
      if (!t || !category) continue;
      if (!voti.has(t)) voti.set(t, new Map());
      const perCat = voti.get(t);
      if (!perCat.has(category)) perCat.set(category, new Set());
      perCat.get(category).add(peerId);
    }
  }

  const accettati = [];
  const inParita = [];
  for (const [token, perCat] of voti) {
    const classifica = [...perCat.entries()].map(([cat, set]) => [cat, set.size]).sort((a, b) => b[1] - a[1]);
    const [primo, secondo] = classifica;
    if (!primo || primo[1] < minVoti) continue;
    if (secondo && secondo[1] === primo[1]) { inParita.push({ token, opzioni: classifica.map(([c]) => c) }); continue; }
    accettati.push({ token, category: primo[0], voti: primo[1] });
  }
  return { accettati: accettati.sort((a, b) => b.voti - a.voti || a.token.localeCompare(b.token)), inParita };
}
