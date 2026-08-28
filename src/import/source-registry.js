// ============================================================
// SOURCE REGISTRY — affidabilità MISURATA per canale di import
// ============================================================
// Momentum importa da più canali (notifica bancaria, screenshot/OCR, CSV,
// PDF, condivisione testo) — ognuno sbaglia in modo diverso e con frequenza
// diversa. Oggi ogni riconoscimento incerto chiede sempre conferma
// all'utente, indipendentemente da quante volte QUEL canale, su QUESTO
// dispositivo, si sia già dimostrato affidabile — attrito inutile per un
// canale che non sbaglia mai, fiducia eccessiva per uno che sbaglia spesso.
//
// Questo modulo misura, non decide: espone quanto ci si può fidare di ogni
// canale, un'etichetta semplice ("va bene"/"da controllare"/"non lo so
// ancora"), mai un numero statistico grezzo da interpretare. Chi consuma
// questo modulo (auto-import.js, non ancora scritto) decide COSA fare con
// quell'informazione — restare sempre col tap di conferma è una scelta
// legittima quanto usarla per abbassare l'attrito: qui si misura soltanto.
//
// Stesso algoritmo di advisor-bandit.js (Beta-Bernoulli, Thompson-ready),
// NON importato direttamente: stesso principio già seguito per i moduli
// fiscali (tax.js/tax-ch.js/tax-es.js) — stesso schema, domini distinti,
// mai una dipendenza incrociata fra parti del prodotto che cambiano per
// motivi diversi. Funzioni pure: lo stato arriva e torna dal chiamante,
// nessun accesso diretto a VaultDAO/localStorage — testabile in isolamento.
'use strict';

const PRIOR_A = 1, PRIOR_B = 1;   // Beta(1,1): nessuna fiducia né sfiducia di partenza
const DECAY = 0.98;               // un canale può peggiorare (la banca cambia formato
                                   // di notifica): il passato recente pesa di più del lontano

export const CANALI = ['notifica', 'screenshot', 'csv', 'pdf', 'testo-condiviso', 'manuale'];

// Sotto questa soglia di osservazioni REALI (a+b-2, il prior non conta) il
// canale è ancora "da imparare" — mostrare un'etichetta di fiducia con 1-2
// casi soli sarebbe un numero finto travestito da misura.
const OSSERVAZIONI_MIN_PER_FIDARSI = 5;

export function initSourceRegistry() {
  return { version: 1, canali: {} };
}

function getCanale(registry, canale) {
  const r = registry && registry.canali ? registry : initSourceRegistry();
  return r.canali[canale] || { a: PRIOR_A, b: PRIOR_B };
}

// Un import da questo canale è stato confermato corretto (esito true) o
// corretto dall'utente/rifiutato (esito false). Aggiornamento Beta-Bernoulli
// con decadimento esponenziale verso il prior neutro, stessa formula già in
// produzione per il bandit dei consigli.
export function observeImport(registry, canale, corretto) {
  if (!CANALI.includes(canale)) return registry || initSourceRegistry();
  const r = registry && registry.canali ? registry : initSourceRegistry();
  const arm = getCanale(r, canale);
  const esito = corretto ? 1 : 0;
  const a = PRIOR_A + (arm.a - PRIOR_A) * DECAY + esito;
  const b = PRIOR_B + (arm.b - PRIOR_B) * DECAY + (1 - esito);
  return { ...r, canali: { ...r.canali, [canale]: { a, b } } };
}

// Quante osservazioni REALI ha visto questo canale (senza contare il prior)
// — usato solo per decidere se l'etichetta di fiducia è già significativa.
function osservazioniReali(arm) {
  return Math.max(0, (arm.a - PRIOR_A) + (arm.b - PRIOR_B));
}

// Etichetta semplice, mai un numero grezzo: "bene" (storicamente affidabile,
// abbastanza osservazioni), "da-confermare" (o non abbastanza osservazioni,
// o storicamente incerto), "male" (sbaglia più spesso di quanto azzecchi,
// con abbastanza osservazioni per dirlo con sicurezza).
export function affidabilitaCanale(registry, canale) {
  const arm = getCanale(registry, canale);
  const n = osservazioniReali(arm);
  const media = arm.a / (arm.a + arm.b);
  if (n < OSSERVAZIONI_MIN_PER_FIDARSI) {
    return { etichetta: 'da-confermare', media: +media.toFixed(2), osservazioni: Math.round(n) };
  }
  if (media >= 0.85) return { etichetta: 'bene', media: +media.toFixed(2), osservazioni: Math.round(n) };
  if (media <= 0.5) return { etichetta: 'male', media: +media.toFixed(2), osservazioni: Math.round(n) };
  return { etichetta: 'da-confermare', media: +media.toFixed(2), osservazioni: Math.round(n) };
}

// Riassunto per la UI (es. Momentum Vault → "Come importo i miei dati"): un
// canale per riga, mai quelli mai usati (osservazioni=0 E ancora al prior) —
// non c'è niente di onesto da dire su un canale che l'utente non ha ancora
// mai toccato.
export function riepilogoAffidabilita(registry) {
  const r = registry && registry.canali ? registry : initSourceRegistry();
  return CANALI
    .map((canale) => ({ canale, ...affidabilitaCanale(r, canale) }))
    .filter((riga) => riga.osservazioni > 0);
}
