

const SCHEMA_VERSION = 50.0;
const APP_VERSION = "Apex.V50.0.Quantum";
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// Icone disegnate nello stesso stile — tratto 2.5, angoli arrotondati,
// viewBox 24x24 — non emoji di sistema: l'utente ha chiesto esplicitamente
// "non emoji standard, ma di design e coerenti col resto". Restano SVG a
// contorno come le originali; quello che cambia e' il materiale del cerchio
// che le contiene (vedi .cat-icon-glow in index.html): non piu' un colore
// piatto, ma un rilievo luminoso con la stessa fisica dell'orb.
const DEFAULT_CATEGORIES = {
  expense: [
    { id: 'spesa', name: 'Alimentari', color: '#e11d48', type: 'uscita', emoji: '🛒', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>` },
    { id: 'ristoranti', name: 'Ristorazione', color: '#f97316', type: 'uscita', emoji: '🍽️', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="2" x2="6" y2="8"></line><line x1="10" y1="2" x2="10" y2="8"></line><line x1="14" y1="2" x2="14" y2="8"></line></svg>` },
    { id: 'shopping', name: 'Shopping', color: '#ec4899', type: 'uscita', emoji: '🛍️', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>` },
    // Era un cerchio con una linea diagonale che sbucava fuori a caso — un
    // arco SVG con un segmento "l5.67-5.67" incollato per errore in coda al
    // tracciato, che disegnava una sberla obliqua invece di richiudere il
    // cerchio. L'utente l'ha notata: "storta". Sostituita con un vero doppio
    // ricircolo — due archi e due frecce, lo stesso glifo che ovunque
    // significa "si ripete", pulito.
    { id: 'abbonamenti', name: 'Abbonamenti', color: '#8b5cf6', type: 'uscita', emoji: '📱', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>` },
    { id: 'trasporti', name: 'Mobilità', color: '#3b82f6', type: 'uscita', emoji: '🚗', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>` },
    // Le sei categorie qui sotto colmano il buco più concreto misurato in
    // sessione: con solo 5 categorie di spesa, il demo dataset era COSTRETTO
    // a mettere affitto e bolletta della luce dentro "Abbonamenti" (vedi
    // ui/demo-dataset.js) — la prova che mancava qualcosa, dentro l'app
    // stessa. 'casa', 'bollette', 'salute' e 'svago' non sono id inventati
    // ora: esistevano già come regole morte in core/lexicon.js (CAT_RULES),
    // scritte per categorie che il dizionario non conosceva — un classificatore
    // che sapeva già rispondere "bollette" a "enel" ma la cui risposta cadeva
    // sempre nel fallback "Altro" perché nessuna categoria con quell'id
    // esisteva. Usare gli stessi id le sblocca senza toccare il motore.
    { id: 'casa', name: 'Casa', color: '#b45309', type: 'uscita', emoji: '🏠', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10L12 3l9 7"/><path d="M5 9v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9"/></svg>` },
    { id: 'bollette', name: 'Bollette', color: '#06b6d4', type: 'uscita', emoji: '💡', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h7l-1 8 11-14h-7l1-8z"/></svg>` },
    { id: 'salute', name: 'Salute', color: '#ef4444', type: 'uscita', emoji: '⚕️', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>` },
    { id: 'istruzione', name: 'Istruzione', color: '#6366f1', type: 'uscita', emoji: '🎓', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5"/></svg>` },
    { id: 'viaggi', name: 'Viaggi', color: '#0ea5e9', type: 'uscita', emoji: '✈️', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>` },
    { id: 'svago', name: 'Tempo libero', color: '#d946ef', type: 'uscita', emoji: '🎟️', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 1 0 0 4v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 1 0 0-4V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/><path d="M13 5v14"/></svg>` },
  ],
  income: [
    { id: 'stipendio', name: 'Entrata', color: '#10b981', type: 'entrata', emoji: '💰', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>` },
  ],
  invest: [
    { id: 'etf', name: 'Asset Market', color: '#eab308', type: 'invest', emoji: '📈', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>` },
    { id: 'crypto', name: 'Crypto', color: '#a855f7', type: 'invest', emoji: '₿', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>` },
    { id: 'risparmio', name: 'Risparmio', color: '#14b8a6', type: 'invest', emoji: '🏦', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6"/></svg>` },
  ]
};

const ALL_CATS = [...DEFAULT_CATEGORIES.expense, ...DEFAULT_CATEGORIES.income, ...DEFAULT_CATEGORIES.invest];
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const formatMoney = val => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export { SCHEMA_VERSION, APP_VERSION, isTouch, DEFAULT_CATEGORIES, ALL_CATS, $, $$, formatMoney, monthKey };
