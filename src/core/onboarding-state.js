// ============================================================
// "QUESTA PERSONA HA GIÀ FINITO L'ONBOARDING?"
// ============================================================
// Una domanda sola, ma decide la prima cosa che l'utente vede all'avvio: la
// hero di benvenuto oppure la sua dashboard. Sbagliarla in un verso significa
// far rivedere l'onboarding a chi usa l'app da mesi; sbagliarla nell'altro
// significa chiudere fuori chi non l'ha mai finito, lasciandolo su una
// dashboard di esempio senza una via per entrare davvero.
//
// BUG REALE che ha motivato questo modulo (2026-09-06): il controllo era
// `localStorage.getItem('omega_core_db')`, cioè "esiste lo stato salvato?".
// Ma VaultDAO scrive quella chiave GIÀ al primissimo avvio, con
// `isFirstLaunch: true` — quindi bastava aprire l'app una volta, chiuderla
// senza rispondere alle domande e tornare più tardi per non rivedere mai più
// l'onboarding. La chiave esiste sempre: non dice niente su chi l'ha finito.
//
// Il segnale VERO è `isFirstLaunch === false`, scritto in un solo posto
// (seedProfileState / seedProfileStateMinor in main.js) e solo al
// completamento — compreso il percorso "lampo" da invito, che passa comunque
// da lì (activateLite → seedProfileState).
//
// I due fallback esistono per gli stati salvati molto vecchi, che potrebbero
// non avere il campo: chi ha transazioni registrate o un profilo di
// onboarding salvato è dentro da tempo, qualunque cosa dica il flag. Meglio
// non far rivedere l'onboarding a chi ha dati veri che il contrario.
//
// Funzione PURA: nessun DOM, nessuno storage. Chi la chiama le passa lo stato.
// ATTENZIONE: la stessa identica logica è ripetuta in uno script inline in
// index.html, che gira PRIMA che il bundle sia scaricato (serve a non far
// nemmeno dipingere la hero a chi è già dentro). Se cambi questa, cambia
// anche quella — c'è un test che verifica che restino allineate.
'use strict';

export function haCompletatoOnboarding(state) {
  if (!state || typeof state !== 'object') return false;
  if (state.isFirstLaunch === false) return true;
  const mesi = state.transactions && typeof state.transactions === 'object'
    ? Object.keys(state.transactions) : [];
  // Integrato da un branch parallelo dopo revisione mirata (2026-09-11): se
  // il flag esiste ed è ancora true, un profilo di onboarding predefinito da
  // solo non prova che le domande siano state completate — solo i dati veri
  // (transazioni) possono superare un flag incoerente dopo un ripristino
  // parziale. Il fallback su onboardingProfile resta SOLO per gli stati
  // storici privi del flag (sotto), non per chi il flag ce l'ha e dice true.
  if (state.isFirstLaunch === true) return mesi.length > 0;
  // Fallback esclusivamente per stati storici privi del flag.
  if (state.onboardingProfile) return true;
  return mesi.length > 0;
}
