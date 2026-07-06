import { $ } from '../core/constants.js';
import { haptic } from '../core/utils.js';

// Shared Alerts
const showSignatureAlert = (title, body) => {
  const t = document.createElement('div');
  t.className = `p-4 sm:p-5 rounded-2xl shadow-2xl border border-[var(--outline)] bg-[var(--surface-elevated)] text-[var(--on-surface)] flex gap-3 transform transition-all duration-500 translate-y-[-40px] opacity-0 max-w-[90%] sm:max-w-md mx-auto pointer-events-auto`;
  t.innerHTML = `<div class="w-10 h-10 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></div><div><h3 class="font-extrabold text-xs uppercase tracking-widest text-[var(--primary)]">${title}</h3><p class="text-xs font-semibold mt-1 leading-relaxed">${body}</p></div>`;
  const toastContainer = $('#toast-container');
  if (toastContainer) {
      toastContainer.appendChild(t); haptic('heavy'); requestAnimationFrame(() => t.classList.remove('translate-y-[-40px]', 'opacity-0')); setTimeout(() => { t.classList.add('translate-y-[-40px]', 'opacity-0'); setTimeout(() => t.remove(), 500); }, 5000);
  }
};

const showToast = (msg, tone = 'info') => {
  const t = document.createElement('div'); const bg = tone === 'error' ? 'bg-[var(--danger-gradient)]' : tone === 'success' ? 'bg-[var(--green)]' : 'bg-[var(--apex-gradient)]';
  t.className = `p-3.5 rounded-xl shadow-2xl text-white text-xs font-bold flex items-center gap-2 transform transition-all duration-300 translate-y-[-20px] opacity-0 ${bg} pointer-events-auto`; t.innerHTML = `<span>${msg}</span>`;
  const toastContainer = $('#toast-container');
  if (toastContainer) {
      toastContainer.appendChild(t); requestAnimationFrame(() => t.classList.remove('translate-y-[-20px]', 'opacity-0')); setTimeout(() => { t.classList.add('translate-y-[-20px]', 'opacity-0'); setTimeout(() => t.remove(), 300); }, 3000);
  }
};



export { showSignatureAlert, showToast };
