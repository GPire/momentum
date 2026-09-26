// Blocco dopo inattività: pura logica di tempi, nessun DOM. Scatta se l'app
// resta in background oltre il limite, oppure in primo piano senza nessun
// tocco o tasto per lo stesso tempo. timeoutMs 0 = solo alla riapertura.
'use strict';

export const AUTO_LOCK_CHOICES_MIN = [1, 5, 15, 0];
export const AUTO_LOCK_DEFAULT_MIN = 5;

export function autoLockMinutes(value) {
  return AUTO_LOCK_CHOICES_MIN.includes(value) ? value : AUTO_LOCK_DEFAULT_MIN;
}

export function createAutoLock({ timeoutMs, onLock, now = () => Date.now() }) {
  let ultima = now();
  let nascostaDa = null;
  let scattato = false;
  const scatta = () => {
    if (scattato || !(timeoutMs > 0)) return;
    scattato = true;
    onLock();
  };
  return {
    activity() { if (nascostaDa === null) ultima = now(); },
    hidden() { nascostaDa = now(); },
    visible() {
      const via = nascostaDa;
      nascostaDa = null;
      if (via !== null && now() - via >= timeoutMs) scatta();
      else ultima = now();
    },
    tick() { if (nascostaDa === null && now() - ultima >= timeoutMs) scatta(); },
    setTimeoutMs(ms) { timeoutMs = ms; ultima = now(); },
    get locked() { return scattato; },
  };
}
