

const SCHEMA_VERSION = 50.0;
const APP_VERSION = "Apex.V50.0.Quantum";
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

const DEFAULT_CATEGORIES = {
  expense: [
    { id: 'spesa', name: 'Alimentari', color: '#e11d48', type: 'uscita', emoji: '🛒', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>` },
    { id: 'ristoranti', name: 'Ristorazione', color: '#f97316', type: 'uscita', emoji: '🍽️', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="2" x2="6" y2="8"></line><line x1="10" y1="2" x2="10" y2="8"></line><line x1="14" y1="2" x2="14" y2="8"></line></svg>` },
    { id: 'shopping', name: 'Shopping', color: '#ec4899', type: 'uscita', emoji: '🛍️', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>` },
    { id: 'abbonamenti', name: 'Abbonamenti', color: '#8b5cf6', type: 'uscita', emoji: '📱', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>` },
    { id: 'trasporti', name: 'Mobilità', color: '#3b82f6', type: 'uscita', emoji: '🚗', icon: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>` },
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
