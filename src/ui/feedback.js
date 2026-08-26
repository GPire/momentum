import { $ } from '../core/constants.js';
import { haptic } from '../core/utils.js';

// Notifiche a "vetro" (2026-08-26): prima erano pillole a colore piatto
// (bg-[var(--green)] ecc.), l'unica superficie dell'app che non era una
// .card — segnalato dal vivo dall'utente come incoerente con lo spazio/
// stelle/orb dietro ogni altra schermata. Ora riusano ESATTAMENTE la stessa
// ricetta già in produzione per le insight card (main.js:SEVERITY_STYLE /
// insightCardHeader): superficie in vetro (--glass-bg/--glass-blur, la
// STESSA di .card in index.html), bordo e chip icona tonali, testo su
// --on-surface — non un secondo linguaggio visivo inventato qui.
const TOAST_TONE = {
  success: { border: 'border-emerald-500/25', tint: 'bg-emerald-950/20', badge: 'bg-emerald-500/15', text: 'text-emerald-400', icon: '<path d="M20 6L9 17l-5-5"/>' },
  error:   { border: 'border-rose-500/25', tint: 'bg-rose-950/20', badge: 'bg-rose-500/15', text: 'text-rose-400', icon: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>' },
  info:    { border: 'border-sky-500/25', tint: 'bg-sky-950/20', badge: 'bg-sky-500/15', text: 'text-sky-400', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>' },
};

// Shared Alerts
const showSignatureAlert = (title, body) => {
  const t = document.createElement('div');
  t.className = `p-4 sm:p-5 rounded-2xl shadow-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl text-[var(--on-surface)] flex gap-3 transform transition-all duration-500 translate-y-[-40px] opacity-0 max-w-[90%] sm:max-w-md mx-auto pointer-events-auto`;
  t.innerHTML = `<div class="w-10 h-10 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></div><div><h3 class="font-extrabold text-xs uppercase tracking-widest text-[var(--primary)]">${title}</h3><p class="text-xs font-semibold mt-1 leading-relaxed">${body}</p></div>`;
  const toastContainer = $('#toast-container');
  if (toastContainer) {
      toastContainer.appendChild(t); haptic('heavy'); requestAnimationFrame(() => t.classList.remove('translate-y-[-40px]', 'opacity-0')); setTimeout(() => { t.classList.add('translate-y-[-40px]', 'opacity-0'); setTimeout(() => t.remove(), 500); }, 5000);
  }
};

const showToast = (msg, tone = 'info') => {
  const s = TOAST_TONE[tone] || TOAST_TONE.info;
  const t = document.createElement('div');
  t.className = `p-3 rounded-xl shadow-2xl border ${s.border} ${s.tint} bg-[var(--glass-bg)] backdrop-blur-xl text-[var(--on-surface)] text-xs font-bold flex items-center gap-2.5 transform transition-all duration-300 translate-y-[-20px] opacity-0 pointer-events-auto`;
  t.innerHTML = `<span class="shrink-0 w-6 h-6 rounded-full ${s.badge} flex items-center justify-center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 ${s.text}">${s.icon}</svg></span><span class="min-w-0">${msg}</span>`;
  const toastContainer = $('#toast-container');
  if (toastContainer) {
      toastContainer.appendChild(t); requestAnimationFrame(() => t.classList.remove('translate-y-[-20px]', 'opacity-0')); setTimeout(() => { t.classList.add('translate-y-[-20px]', 'opacity-0'); setTimeout(() => t.remove(), 300); }, 3000);
  }
};



export { showSignatureAlert, showToast };
