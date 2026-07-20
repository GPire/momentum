import { SCHEMA_VERSION, DEFAULT_CATEGORIES, ALL_CATS } from './constants.js';
import { simpleHash } from './utils.js';
import { findDuplicate, mergeTransaction } from './deduplicator.js';
import { novelty } from '../predict/dispatcher.js';
import { mergeTransactions, reconcileHead } from '../mesh/sync.js';

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

const getCatById = (id) => { const custom = VaultDAO.state.customCategories || []; return [...ALL_CATS, ...custom].find(c => c.id === id) || { name: 'Altro', emoji: '✨', type: 'uscita', color: '#64748b', icon: '' }; };
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
  }
};

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
    invoiceProfile: { emitter: '', emitterInfo: '', logo: '', accent: '' }, // i tuoi dati emittente + logo (ricordati)
    savingsGoals: [],
    // Bandit dell'advisor (src/predict/advisor-bandit.js, Wave 1 v10): impara
    // per-contesto quale nudge fa agire l'utente. arms cresce solo con l'uso,
    // additivo, mai retroattivo su tx esistenti.
    advisorBandit: { version: 1, arms: {} },
    banditPending: null
  },
  init() {
    let main = localStorage.getItem('omega_core_db');
    let shadow = localStorage.getItem('omega_shadow_vault');
    if (main) {
      try {
        let p = JSON.parse(main);
        if (shadow && btoa(unescape(encodeURIComponent(main))) !== shadow) {
          p = JSON.parse(decodeURIComponent(escape(atob(shadow))));
        }
        p = runSchemaMigrations(p);
        this.state = { ...this.state, ...p, schemaVersion: SCHEMA_VERSION, currentDate: new Date() };
      } catch(e) {}
    }
    window.state = this.state;
  },
  // Riconciliazione con IndexedDB, da chiamare PRIMA di init():
  // - se IndexedDB ha uno stato e localStorage no (evizione/pulizia), lo ripristina;
  // - se localStorage ha dati e IndexedDB no, migra (una-tantum).
  // In caso di errore IndexedDB l'app continua con solo localStorage, come prima.
  async initDurable() {
    try {
      const idbPayload = await DurableStore.get('state', 'main');
      const lsPayload = localStorage.getItem('omega_core_db');
      if (idbPayload && !lsPayload) {
        localStorage.setItem('omega_core_db', idbPayload);
        localStorage.setItem('omega_shadow_vault', btoa(unescape(encodeURIComponent(idbPayload))));
      } else if (lsPayload && !idbPayload) {
        await DurableStore.put('state', lsPayload, 'main');
      }
    } catch (e) {
      console.warn('IndexedDB non disponibile, continuo con localStorage:', e);
    }
  },
  save() {
    const payload = JSON.stringify({ ...this.state, currentDate: this.state.currentDate.toISOString() });
    localStorage.setItem('omega_core_db', payload);
    localStorage.setItem('omega_shadow_vault', btoa(unescape(encodeURIComponent(payload))));
    DurableStore.put('state', payload, 'main').catch(() => {});
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

    // opts.noDedup: la sorgente ha già un ID univoco (es. transaction_id
    // Revolut, dedotto a monte) → si SALTA la dedup fuzzy, che altrimenti
    // fonderebbe transazioni DISTINTE di pari importo/giorno (es. due acquisti
    // ricorrenti dello stesso titolo). La dedup fuzzy resta per screenshot/manuale.
    const match = opts.noDedup ? null : findDuplicate(tx, existingList);
    if (match) {
      const merged = mergeTransaction(match, tx);
      merged.amount = match.amount;
      merged.category = match.category;
      merged.hash = match.hash;
      merged.prevHash = match.prevHash;
      const idx = existingList.findIndex(t => t.id === match.id);
      existingList[idx] = merged;
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
  deleteTransaction(month, id) {
    if (this.state.transactions[month]) {
      this.state.transactions[month] = this.state.transactions[month].filter(t => t.id !== id);
      this.save();
    }
  },

  // Applica un merge di sync differenziale (src/mesh/sync.js): unisce le
  // transazioni ricevute da un device fidato senza toccare quelle esistenti
  // (hash chain intatta) e riallinea la testa della catena. Ritorna quante
  // ne sono state aggiunte. Usato dalla mesh al pairing e per il recupero.
  applySyncMerge(incomingByMonth) {
    const { merged, added } = mergeTransactions(this.state.transactions, incomingByMonth);
    this.state.transactions = merged;
    this.state.lastHash = reconcileHead(merged);
    if (added > 0) this.save();
    return added;
  }
};

export { getCatById, getCatsByType, VaultDAO, DurableStore, runSchemaMigrations };
