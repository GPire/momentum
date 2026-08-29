import { SCHEMA_VERSION, DEFAULT_CATEGORIES, ALL_CATS } from './constants.js';
import { simpleHash } from './utils.js';
import { findDuplicate, mergeTransaction } from './deduplicator.js';
import { novelty } from '../predict/dispatcher.js';
import { mergeTransactions, reconcileHead, markDeleted, pruneTombstones } from '../mesh/sync.js';

// Chiavi-mese adiacenti ('YYYY-MM') a una data: precedente, corrente, successivo.
// Serve al dedup cross-mese (una tx a cavallo di due mesi entro la finestra 48h).
function adjacentMonthKeys(month) {
  const [y, m] = String(month).split('-').map(Number);
  if (!y || !m) return [month];
  const k = (yy, mm) => `${yy}-${String(mm).padStart(2, '0')}`;
  const prev = m === 1 ? k(y - 1, 12) : k(y, m - 1);
  const next = m === 12 ? k(y + 1, 1) : k(y, m + 1);
  return [prev, month, next];
}

// ==========================================
// MIGRAZIONI DI SCHEMA — sicurezza dati tra versioni dell'app
// ==========================================
// Registro delle trasformazioni necessarie quando una versione futura
// cambia la STRUTTURA dei dati salvati (non le semplici aggiunte di nuovi
// campi, che sono già retrocompatibili di per sé grazie allo spread
// `{...this.state, ...p}` in init() — quelle non servono migrazioni).
// Chiave = versione di schema a cui la migrazione porta i dati.
// Oggi è vuoto: nessuna modifica pubblicata finora ha richiesto una
// trasformazione reale. Il meccanismo esiste comunque da adesso, pronto per
// quando servirà — va costruito PRIMA che serva, non il giorno in cui una
// modifica futura rompe silenziosamente i dati di chi aggiorna l'app.
const MIGRATIONS = {
  // 51.0: (state) => ({ ...state, campoNuovo: valoreDiDefault }),
};

// Applica in ordine ascendente ogni migrazione registrata con versione
// superiore a quella dei dati caricati. Funzione pura: non tocca
// localStorage/IndexedDB direttamente, per essere testabile in isolamento.
function runSchemaMigrations(loadedState, migrations = MIGRATIONS) {
  const fromVersion = loadedState.schemaVersion || 0;
  let state = loadedState;
  const targets = Object.keys(migrations).map(Number).filter(v => v > fromVersion).sort((a, b) => a - b);
  for (const target of targets) {
    state = { ...migrations[target](state), schemaVersion: target };
  }
  return state;
}

// Categoria sconosciuta (import con un'etichetta non nostra, categoria
// personalizzata cancellata, dato più vecchio dello schema): NON deve lasciare un
// buco grigio nella lista movimenti. Il ripiego ha una sua icona vera, così una
// riga resta leggibile a colpo d'occhio anche quando la categoria non esiste più.
const FALLBACK_CAT_ICON = `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v4M12 16h.01"></path></svg>`;
const getCatById = (id) => { const custom = VaultDAO.state.customCategories || []; return [...ALL_CATS, ...custom].find(c => c.id === id) || { name: 'Altro', emoji: '✨', type: 'uscita', color: '#64748b', icon: FALLBACK_CAT_ICON }; };
const getCatsByType = (type) => { const base = type === 'uscita' ? DEFAULT_CATEGORIES.expense : (type === 'entrata' ? DEFAULT_CATEGORIES.income : DEFAULT_CATEGORIES.invest); const custom = (VaultDAO.state.customCategories || []).filter(c => c.type === type); return [...base, ...custom]; };

// ==========================================
// DURABLE STORE — IndexedDB (primario) + localStorage (cache di compatibilità)
// localStorage resta la lettura sincrona all'avvio; IndexedDB è la copia
// durevole (quota molto più alta, non evictata con la stessa facilità) e
// ospita il log append-only delle transazioni per il sync federato differenziale.
// ==========================================
const DurableStore = {
  db: null,
  available: typeof indexedDB !== 'undefined',
  async open() {
    if (!this.available) return null;
    if (this.db) return this.db;
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('momentum_vault', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
        if (!db.objectStoreNames.contains('tx_log')) db.createObjectStore('tx_log', { autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.db;
  },
  async get(store, key) {
    const db = await this.open();
    if (!db) return undefined;
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async put(store, value, key) {
    const db = await this.open();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readwrite').objectStore(store).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  async append(store, value) {
    const db = await this.open();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readwrite').objectStore(store).add(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  // Serve al recupero da tx_log (2026-08-29, vedi reconstructMissingFromTxLog
  // sotto): legge OGNI voce di uno store, non solo una chiave nota.
  async getAll(store) {
    const db = await this.open();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
};

// ==========================================
// PONTE iOS — Safari → PWA installata (2026-08-28)
// ==========================================
// BUG REALE segnalato da utenti: su iPhone, dopo "Aggiungi a Home", ogni
// transazione andava reinserita a mano. Causa VERIFICATA via ricerca (non
// ipotizzata): WebKit isola completamente localStorage/IndexedDB/cookie tra
// Safari e l'istanza standalone, ANCHE per la stessa identica origine — un
// limite di iOS (Android invece condivide lo storage, nessun problema lì).
//
// La via SICURA e sempre affidabile resta il backup-file manuale (un tap,
// window.exportPlainBackup + window.restoreEncryptedBackup, collegati nella
// guida d'installazione e nella Dashboard vuota). QUESTO blocco aggiunge
// solo una scorciatoia AUTOMATICA best-effort: da iOS 14 Safari condivide
// la Cache Storage (non lo storage web classico) con l'istanza standalone —
// comportamento MAI documentato ufficialmente da Apple, e trovato rotto su
// iOS 17 beta in alcuni test indipendenti. Per questo è SOLO un livello in
// più, silenzioso, mai l'unica via: se non trova nulla (Safari chiuso da
// troppo tempo, versione iOS dove non funziona), il percorso manuale resta
// intatto e resta quello onestamente garantito.
const IOS_HANDOFF_CACHE = 'momentum-ios-handoff-v1';
const IOS_HANDOFF_KEY = 'https://momentum.local/ios-handoff-snapshot';
function isIosNonStandalone() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent || '') && !/Windows Phone/.test(navigator.userAgent || '');
  if (!ios) return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  return !standalone;
}
function saveIosHandoff(payload) {
  if (typeof caches === 'undefined' || !isIosNonStandalone()) return;
  caches.open(IOS_HANDOFF_CACHE)
    .then((c) => c.put(IOS_HANDOFF_KEY, new Response(payload, { headers: { 'content-type': 'application/json' } })))
    .catch(() => {});
}
// Chiamata SOLO al boot di un'istanza standalone senza dati propri (mai
// altrimenti: non deve MAI sovrascrivere dati reali già presenti). Ritorna
// lo stato trovato o null — chi chiama decide se e come proporlo
// all'utente (mai un ripristino silenzioso senza conferma).
async function tryReadIosHandoff() {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(IOS_HANDOFF_CACHE);
    const res = await cache.match(IOS_HANDOFF_KEY);
    if (!res) return null;
    return JSON.parse(await res.text());
  } catch (_) { return null; }
}

// ==========================================
// RECUPERO DA tx_log — per chi ha già subito il bug di perdita dati sopra
// ==========================================
// `tx_log` (IndexedDB, append-only, mai riscritto) registra ogni transazione
// aggiunta manualmente/da voce/da singolo import — vedi addTransaction():
// `if (!opts.bulk) DurableStore.append('tx_log', { month, tx, ts })`. Il bug
// di perdita dati (vedi init()/save() sopra) colpiva SOLO lo snapshot
// consolidato "state"/"main": tx_log è uno store IndexedDB SEPARATO, con le
// sue proprie chiavi auto-incrementali, mai toccato da quella logica — le
// transazioni che un utente aveva aggiunto prima del bug possono quindi
// essere ancora tutte lì, anche se lo snapshot consolidato le ha "perse".
//
// Limiti onesti, dichiarati (mai spacciato per un ripristino completo):
// (1) i BULK import (CSV/PDF di centinaia di righe) saltano il log per
//     prestazioni — non recuperabili da qui, serve il backup-file manuale;
// (2) una categoria corretta DOPO l'aggiunta (updateTransactionCategory) non
//     viene ri-loggata: una transazione recuperata torna con la categoria
//     ORIGINALE, non con eventuali correzioni successive;
// (3) mai un ripristino silenzioso: questa funzione è pura e SOLO calcola
//     cosa manca — chi chiama decide se e come proporlo all'utente, la
//     scrittura reale avviene solo con VaultDAO.applyTxLogRecovery(),
//     mai automaticamente.
function reconstructMissingFromTxLog(txLogEntries, currentState) {
  const existingIds = new Set();
  for (const arr of Object.values(currentState?.transactions || {})) {
    for (const t of (arr || [])) if (t?.id) existingIds.add(t.id);
  }
  // Una transazione cancellata di proposito (lapide in deletedTx) non va
  // mai fatta "resuscitare" da un log più vecchio della cancellazione.
  const deletedIds = new Set(Object.keys(currentState?.deletedTx || {}));
  const seen = new Set();
  const recovered = {};
  let addedCount = 0;
  for (const entry of (txLogEntries || [])) {
    const tx = entry?.tx;
    if (!tx || !tx.id || existingIds.has(tx.id) || deletedIds.has(tx.id) || seen.has(tx.id)) continue;
    seen.add(tx.id);
    const month = entry.month || (tx.date ? String(tx.date).slice(0, 7) : null);
    if (!month) continue;
    if (!recovered[month]) recovered[month] = [];
    recovered[month].push(tx);
    addedCount++;
  }
  return { recovered, addedCount };
}

// ==========================================
// VAULTDAO STORAGE LAYER
// ==========================================
const VaultDAO = {
  state: {
    schemaVersion: SCHEMA_VERSION,
    isFirstLaunch: true,
    currentDate: new Date(),
    transactions: {},
    themeDark: true,
    currentView: 'dashboard',
    customCategories: [],
    subscriptions: [],
    monthlyBudget: 1500,
    aiAggression: 'advisor',
    ghostRadarActive: true,
    soundActive: true,
    onboardingProfile: { riskProfile: 'bilanciato', horizon: 'medio' },
    // expertBandit (Wave 13 v10, src/ai/expert-bandit.js): additivo dentro
    // mlData, cresce solo con l'uso — vedi commento su advisorBandit sotto.
    mlData: { vocab: {}, catCounts: {}, totalWords: 0, lastTraining: Date.now(), expertBandit: { version: 1, arms: {} } },
    lastHash: "GENESIS",
    events: [],
    // Campi ADDITIVI (retention layer, src/predict/engagement.js): coperti
    // dallo spread di init() senza migrazione. Se in futuro uno di questi
    // cambia STRUTTURA (non solo si aggiunge), serve una entry in MIGRATIONS.
    engagement: { lastActiveDay: null, streak: 0, bestStreak: 0 },
    achievements: {}, // { id: isoDate } — traguardi sbloccati (Wave 3 v10, additivo)
    taxLearned: {},   // { tokenMittente: 'invoice'|'salary'|'personal' } — apprendimento fiscale dalle conferme utente
    invoices: [],     // fatture create on-device: { number, year, date, client, imponibile, description, regime }
    // Dati emittente + logo + Paese (default Italia, pronto per ogni mercato).
    // I campi `fiscale` sono ADDITIVI e servono SOLO alla FatturaPA XML ufficiale
    // (P.IVA/CF/regime/sede): senza di essi il PDF di cortesia funziona lo stesso;
    // con essi si genera l'XML valido per lo SdI. Tutti opzionali, nessuna invenzione.
    invoiceProfile: {
      emitter: '', emitterInfo: '', logo: '', accent: '', country: 'IT',
      fiscale: {
        partitaIva: '', codiceFiscale: '', regime: 'forfettario',
        indirizzo: '', cap: '', comune: '', provincia: '', nazione: 'IT',
        iban: '',
      },
    },
    savingsGoals: [],
    splitGroups: [], // divisione spese P2P (src/split/split-engine.js): gruppi/spese condivise, additivo
    // Identità persistente di QUESTO dispositivo (mai il nome di una persona,
    // solo un id tecnico): serve a claimMember/myMemberId in split-engine.js
    // per sapere quale membro di un gruppo condiviso è "questo telefono",
    // così un dispositivo non può mai scegliere di "essere" un altro membro
    // già rivendicato (es. il creatore del gruppo). Generato una sola volta:
    // dopo il primo save() il valore persistito vince sempre su questo default.
    deviceId: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `device-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    // Spese cancellate (id → quando): servono a far arrivare la cancellazione
    // anche agli ALTRI tuoi dispositivi. Senza, la spesa cancellata sul telefono
    // tornava indietro dal tablet al primo sync. Vedi mesh/sync.js.
    deletedTx: {},
    // Quando questo dispositivo ha iniziato a usare Momentum (mai sovrascritto
    // dopo il primo save): serve solo a proporre UNA volta il feedback dopo un
    // po' di giorni di uso reale, non appena installata — mai al primo avvio.
    firstUsedAt: Date.now(),
    feedbackPromptShown: false,
    // Bandit dell'advisor (src/predict/advisor-bandit.js, Wave 1 v10): impara
    // per-contesto quale nudge fa agire l'utente. arms cresce solo con l'uso,
    // additivo, mai retroattivo su tx esistenti.
    advisorBandit: { version: 1, arms: {} },
    banditPending: null
  },
  // Conta le transazioni reali di uno stato candidato — unico criterio
  // onesto per scegliere fra due copie salvate quando divergono (mai un
  // checksum cieco, vedi sotto). Esposta anche fuori dalla classe per i test.
  _countTx(s) {
    return Object.values((s && s.transactions) || {}).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
  },
  // BUG CRITICO REALE (trovato 2026-08-29, segnalato da utenti che perdevano
  // le transazioni "ogni tot tempo o al rilascio di una nuova versione" e si
  // ritrovavano con i dati di esempio del primo avvio): la vecchia init()
  // faceva UN solo tentativo — se il checksum di "shadow" non combaciava con
  // "main", si fidava CIECAMENTE di "shadow" anche quando era semplicemente
  // rimasta indietro (causa verificata: "shadow" è ~33% più grande del
  // payload reale per via della codifica base64 in save(), quindi può
  // superare la quota di localStorage PRIMA del payload vero — main si
  // salva, shadow no, resta vecchia). Peggio: se quel tentativo di fallback
  // falliva (shadow corrotta), l'ECCEZIONE risaliva fino al catch esterno e
  // scartava in silenzio anche "main", che nel frattempo era stata già
  // analizzata con successo — un utente con dati perfettamente validi in
  // "main" finiva con lo stato di default (isFirstLaunch:true, transactions
  // vuote), che la UI mostra come i dati dimostrativi del primo avvio.
  //
  // Fix: mai un solo tentativo silenzioso. Si prova a leggere OGNI copia
  // disponibile, si scarta solo quella che non fa JSON.parse (loggando
  // perché, mai in silenzio), e fra le copie valide si sceglie quella con
  // PIÙ transazioni reali — mai la "shadow" per definizione, mai la prima
  // che càpita. Solo se NESSUNA copia è leggibile si riparte dal default,
  // e anche allora si logga forte (mai un errore ingoiato senza traccia).
  init() {
    const main = localStorage.getItem('omega_core_db');
    const shadow = localStorage.getItem('omega_shadow_vault');
    const candidates = [];
    if (main) {
      try { candidates.push({ source: 'main', state: JSON.parse(main) }); }
      catch (e) { console.error('VaultDAO.init: omega_core_db corrotto, JSON non valido — scartato:', e); }
    }
    if (shadow) {
      try { candidates.push({ source: 'shadow', state: JSON.parse(decodeURIComponent(escape(atob(shadow)))) }); }
      catch (e) { console.error('VaultDAO.init: omega_shadow_vault corrotto — scartato:', e); }
    }
    if (candidates.length > 0) {
      let best = candidates[0];
      for (const c of candidates.slice(1)) if (this._countTx(c.state) > this._countTx(best.state)) best = c;
      if (candidates.length > 1 && candidates.some(c => this._countTx(c.state) !== this._countTx(best.state))) {
        const riepilogo = candidates.map(c => `${c.source}:${this._countTx(c.state)}tx`).join(', ');
        console.warn(`VaultDAO.init: le copie salvate divergono (${riepilogo}) — uso "${best.source}" (più transazioni), mai un checksum cieco.`);
      }
      try {
        const p = runSchemaMigrations(best.state);
        this.state = { ...this.state, ...p, schemaVersion: SCHEMA_VERSION, currentDate: new Date() };
      } catch (e) {
        console.error('VaultDAO.init: migrazione schema fallita — parto dal default, dati NON applicati:', e);
      }
    }
    window.state = this.state;
  },
  // Riconciliazione con IndexedDB, da chiamare PRIMA di init(): stessa
  // disciplina "mai un checksum cieco" di init() sopra, estesa a una TERZA
  // copia (IndexedDB, quota molto più alta — il backstop più affidabile).
  // Riscrive SEMPRE main+shadow allineate alla copia più completa fra le
  // tre, così la init() sincrona che segue trova dati già coerenti — non
  // deve più indovinare quale fonte fidarsi.
  async initDurable() {
    try {
      const idbPayload = await DurableStore.get('state', 'main');
      const lsMain = localStorage.getItem('omega_core_db');
      const lsShadow = localStorage.getItem('omega_shadow_vault');
      const candidates = [];
      const tryParse = (raw, source, decode) => {
        if (!raw) return;
        try { candidates.push({ source, state: JSON.parse(decode ? decode(raw) : raw) }); }
        catch (e) { console.error(`VaultDAO.initDurable: copia "${source}" corrotta — scartata:`, e); }
      };
      tryParse(lsMain, 'localStorage(main)');
      tryParse(lsShadow, 'localStorage(shadow)', (raw) => decodeURIComponent(escape(atob(raw))));
      tryParse(idbPayload, 'indexedDB');
      if (candidates.length === 0) return; // nessuna copia leggibile: init() partirà dal default
      let best = candidates[0];
      for (const c of candidates.slice(1)) if (this._countTx(c.state) > this._countTx(best.state)) best = c;
      if (candidates.some(c => this._countTx(c.state) !== this._countTx(best.state))) {
        const riepilogo = candidates.map(c => `${c.source}:${this._countTx(c.state)}tx`).join(', ');
        console.warn(`VaultDAO.initDurable: copie salvate non allineate (${riepilogo}) — ricostruisco da "${best.source}" (più completa).`);
      }
      const bestPayload = JSON.stringify(best.state);
      localStorage.setItem('omega_core_db', bestPayload);
      localStorage.setItem('omega_shadow_vault', btoa(unescape(encodeURIComponent(bestPayload))));
      if (best.source !== 'indexedDB') await DurableStore.put('state', bestPayload, 'main').catch(() => {});
    } catch (e) {
      console.warn('IndexedDB non disponibile, continuo con localStorage:', e);
    }
  },
  save() {
    const payload = JSON.stringify({ ...this.state, currentDate: this.state.currentDate.toISOString() });
    try {
      localStorage.setItem('omega_core_db', payload);
    } catch (e) {
      console.error('VaultDAO.save: scrittura di omega_core_db fallita (localStorage pieno?):', e);
    }
    try {
      localStorage.setItem('omega_shadow_vault', btoa(unescape(encodeURIComponent(payload))));
    } catch (e) {
      // "shadow" è ~33% più grande del payload reale (overhead base64): può
      // superare la quota PRIMA del payload vero, lasciando una copia
      // VECCHIA — causa verificata del bug di perdita dati (vedi init()).
      // Meglio nessuna shadow che una shadow stantia che sembri "più fresca"
      // a un futuro controllo di mismatch.
      console.error('VaultDAO.save: scrittura di omega_shadow_vault fallita — la rimuovo per non lasciare una copia stantia:', e);
      try { localStorage.removeItem('omega_shadow_vault'); } catch (_) {}
    }
    DurableStore.put('state', payload, 'main').catch((e) => console.error('VaultDAO.save: scrittura IndexedDB fallita:', e));
    // Ponte iOS best-effort (2026-08-28) — vedi IOS_HANDOFF sotto: scrive un
    // istantanea in Cache Storage, MAI l'unica via di ripristino (quella
    // resta il backup file, sempre affidabile). Fire-and-forget, mai un
    // errore qui deve interrompere il salvataggio vero.
    try { saveIosHandoff(payload); } catch (_) {}
  },
  // Rileva se `tx` è già presente (stessa spesa arrivata da due canali, es. notifica
  // push + import PDF). In caso di duplicato arricchisce l'esistente con eventuali
  // campi mancanti (es. description) SENZA toccare amount/category/hash: quei campi
  // sono nella catena hash (prevHash/hash) e riscriverli invaliderebbe la catena per
  // ogni transazione successiva. Ritorna { duplicate: true, mergedInto } oppure
  // { duplicate: false, route } dove `route` (fast/incremental/heavy) viene dal
  // dispatcher a soglia (src/predict/dispatcher.js): dice al chiamante se vale la
  // pena svegliare subito il worker di forecast pesante o se questa transazione è
  // abbastanza di routine da aspettare il prossimo render naturale.
  // opts.bulk = true: import di massa (CSV/PDF di 5 anni). Salta il save() e il
  // novelty() PER-RIGA — che serializzavano/scansionavano l'INTERO vault a ogni
  // inserimento (O(n²) → l'app si congelava su file grandi). In bulk il
  // chiamante fa UN solo save() alla fine (flushBulk()). Il dedup per-mese
  // resta (economico: scansiona solo il mese, non tutto).
  addTransaction(month, tx, opts = {}) {
    if (!this.state.transactions[month]) this.state.transactions[month] = [];
    const existingList = this.state.transactions[month];

    // ANTI-DUPLICAZIONE cross-canale (manuale/CSV/PDF/screenshot/SEPA): il dedup
    // deve guardare anche i mesi ADIACENTI, perché una stessa operazione a
    // cavallo di due mesi (31/1 23:00 vs 1/2 00:30, entro la finestra 48h) finirebbe
    // in bucket diversi e sfuggirebbe. Candidati = mese corrente + precedente + successivo.
    // opts.noDedup: la sorgente ha già un ID univoco (es. transaction_id Revolut)
    // → si SALTA la dedup fuzzy (che fonderebbe due acquisti DISTINTI di pari
    // importo/giorno). La dedup fuzzy resta per screenshot/manuale.
    const candMonths = adjacentMonthKeys(month);
    const candidates = [];
    for (const mk of candMonths) { const b = this.state.transactions[mk]; if (b) for (const t of b) candidates.push(t); }
    // La finestra di 48 ore (findDuplicate, deduplicator.js) e' pensata per
    // fondere la STESSA operazione descritta da fonti diverse (l'SMS della
    // banca e la riga del CSV che arriva due giorni dopo) — un problema di
    // AMBIGUITA' fra canali. Un tocco manuale sul modulo di aggiunta non ha
    // quella ambiguita': l'utente sta guardando lo schermo e ha appena deciso
    // consapevolmente di registrare QUESTA spesa. Applicargli la stessa
    // finestra di 48 ore significa che due caffe' identici comprati in due
    // giorni consecutivi (un'abitudine vera, non un doppione) vengono fusi in
    // uno solo — e proprio quella fusione toglie al motore delle abitudini
    // (src/predict/amount-memory.js, src/predict/context-predictor.js) le
    // occorrenze ripetute di cui ha bisogno per riconoscere un pattern.
    // BUG REALE, trovato aggiungendo tre spese vere identiche dal modulo e
    // vedendone salvate solo una: l'utente ha chiesto "sei sicuro che
    // funzioni? non vedo suggerimenti" ed era la domanda giusta.
    // opts.dedupWindowHours permette a chi chiama di restringere la finestra
    // senza toccare il comportamento di import/CSV, che restano a 48 ore.
    const match = opts.noDedup ? null : findDuplicate(tx, candidates, opts.dedupWindowHours != null ? { windowHours: opts.dedupWindowHours } : {});
    if (match) {
      const merged = mergeTransaction(match, tx);
      merged.amount = match.amount;
      merged.category = match.category;
      merged.hash = match.hash;
      merged.prevHash = match.prevHash;
      // riconciliazione di un bonifico auto-avviato col rigo banca: marcalo così
      // un eventuale terzo movimento simile NON si fonde per errore (idempotenza).
      if (match.selfTransfer) merged.reconciledBank = true;
      // il match può stare in un mese adiacente: aggiorna il bucket giusto.
      let home = month;
      if (!existingList.some(t => t.id === match.id)) {
        home = candMonths.find(mk => (this.state.transactions[mk] || []).some(t => t.id === match.id)) || month;
      }
      const bucket = this.state.transactions[home];
      const idx = bucket.findIndex(t => t.id === match.id);
      bucket[idx] = merged;
      if (!opts.bulk) this.save();
      return { duplicate: true, mergedInto: match.id };
    }

    // calcolato PRIMA dell'inserimento: la storia di riferimento non deve
    // includere la transazione che sta arrivando ora. In bulk si salta (il
    // "route" del dispatcher non serve durante un import massivo).
    let route = 'bulk';
    if (!opts.bulk) {
      route = 'heavy'; // default prudente se il dispatcher fallisce per qualsiasi motivo
      try {
        route = novelty(tx, this.state.transactions, { monthlyBudget: this.state.monthlyBudget }).route;
      } catch (e) { console.warn('Dispatcher novelty() fallito, uso percorso pesante di default:', e); }
    }

    tx.prevHash = this.state.lastHash;
    tx.hash = simpleHash(tx.id + tx.amount + tx.category + tx.prevHash);
    this.state.lastHash = tx.hash;
    existingList.push(tx);
    if (!opts.bulk) {
      this.save();
      // log append-only: base per il sync federato differenziale (mai riscritto)
      DurableStore.append('tx_log', { month, tx, ts: Date.now() }).catch(() => {});
    }
    return { duplicate: false, route };
  },
  // Cancellare una spesa lascia una LAPIDE (id → quando). Senza, il sync con un
  // altro tuo dispositivo la faceva TORNARE: lui ce l'aveva ancora, la vedeva
  // mancante qui e ce la rimandava. Bug reale, dimostrato e corretto in
  // mesh/sync.js. Le lapidi si potano dopo un anno per non crescere all'infinito.
  deleteTransaction(month, id) {
    if (this.state.transactions[month]) {
      this.state.transactions[month] = this.state.transactions[month].filter(t => t.id !== id);
      this.state.deletedTx = pruneTombstones(markDeleted(this.state.deletedTx || {}, id));
      this.save();
    }
  },

  // Correggere la categoria era IMPOSSIBILE: la riga di un movimento aveva
  // solo il cestino (main.js: rigaTx). Dopo un import di centinaia di righe
  // con categorizzazione imperfetta, l'unica azione era eliminare — e tutta
  // l'infrastruttura che impara dalle correzioni (orchestrator.learn():
  // gerarchia esercenti, morfologia, rete neurale online, DCGN) restava
  // alimentata solo dal form di aggiunta manuale, mai dalla lista.
  //
  // NON tocca hash/prevHash: quella catena serve al digest del sync mesh
  // (src/mesh/sync.js), che identifica le transazioni per ID, non per hash
  // — un id già noto al peer non viene mai re-inviato ne' re-scritto in quel
  // merge, quindi ricalcolare l'hash qui non lo romperebbe ma non servirebbe
  // a nulla: la correzione locale resta locale, come ogni altra modifica di
  // stato che questo vault non propaga automaticamente agli altri device.
  updateTransactionCategory(month, id, newCategory) {
    const list = this.state.transactions[month];
    if (!list) return null;
    const tx = list.find(t => t.id === id);
    if (!tx || tx.category === newCategory) return null;
    const prima = tx.category;
    tx.category = newCategory;
    this.save();
    return { id, prima, dopo: newCategory };
  },

  // Applica un merge di sync differenziale (src/mesh/sync.js): unisce le
  // transazioni ricevute da un device fidato senza toccare quelle esistenti
  // (hash chain intatta) e riallinea la testa della catena. Ritorna quante
  // ne sono state aggiunte. Usato dalla mesh al pairing e per il recupero.
  applySyncMerge(incomingByMonth) {
    const { merged, added, tombstones, removed } = mergeTransactions(this.state.transactions, incomingByMonth, this.state.deletedTx || {});
    this.state.transactions = merged;
    this.state.deletedTx = tombstones;
    this.state.lastHash = reconcileHead(merged);
    // Si salva anche quando arrivano solo CANCELLAZIONI (removed > 0): prima il
    // salvataggio dipendeva dalle sole aggiunte, quindi una cancellazione
    // ricevuta dall'altro dispositivo si perdeva al riavvio.
    if (added > 0 || removed > 0) this.save();
    return added;
  },

  // Calcola SOLO cosa manca rispetto a tx_log — non scrive nulla (pura
  // rispetto allo stato: legge IndexedDB ma non muta this.state). Chi
  // chiama (main.js) decide come proporlo all'utente, mai un ripristino
  // silenzioso — vedi reconstructMissingFromTxLog sopra per i limiti onesti.
  async checkTxLogRecovery() {
    try {
      const entries = await DurableStore.getAll('tx_log');
      if (!entries.length) return { recovered: {}, addedCount: 0 };
      return reconstructMissingFromTxLog(entries, this.state);
    } catch (e) {
      console.warn('VaultDAO.checkTxLogRecovery: impossibile leggere tx_log:', e);
      return { recovered: {}, addedCount: 0 };
    }
  },
  // Applica SOLO dopo conferma esplicita dell'utente (mai chiamata da sola).
  // Puramente additivo: non tocca/sovrascrive nessuna transazione già
  // presente, per costruzione (reconstructMissingFromTxLog esclude già gli
  // id noti, questo è un controllo ridondante di sicurezza in più).
  applyTxLogRecovery(recovered) {
    let added = 0;
    for (const [month, txs] of Object.entries(recovered || {})) {
      if (!this.state.transactions[month]) this.state.transactions[month] = [];
      const existingIds = new Set(this.state.transactions[month].map(t => t.id));
      for (const tx of txs) {
        if (!existingIds.has(tx.id)) { this.state.transactions[month].push(tx); added++; }
      }
    }
    if (added > 0) this.save();
    return added;
  }
};

export { getCatById, getCatsByType, VaultDAO, DurableStore, runSchemaMigrations, tryReadIosHandoff, reconstructMissingFromTxLog };
