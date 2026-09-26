// Salute del backup: quanto lavoro esiste in UN SOLO posto al mondo.
//
// Perché esiste questo modulo (dove il settore perde le persone, per davvero):
//  1. Il promemoria a CALENDARIO ("ricordati il backup ogni domenica") si impara
//     a ignorare in due settimane: arriva quando non è successo niente. Qui il
//     promemoria arriva quando c'è qualcosa DA PERDERE, e lo dice in numeri
//     concreti — "34 spese che non esistono da nessun'altra parte".
//  2. La passphrase dimenticata è la prima causa di perdita definitiva nei
//     sistemi cifrati dagli utenti (il mondo dei portafogli cripto lo ha
//     dimostrato su scala enorme). Per questo il kit a pezzi non ne ha una.
//  3. I pezzi finiti tutti nello STESSO posto sono l'errore classico della
//     frase di recupero fotografata e tenuta nello stesso telefono che si
//     vuole proteggere: la divisione diventa teatro. Qui il posto di ogni
//     pezzo è dichiarato e la qualità della custodia viene giudicata.
//  4. Il backup mai riaperto: nessuno prova a ripristinare finché non serve.
//     La prova la fa l'app da sola (vedi createRecoveryKit in backup.js).
//
// Funzioni PURE: nessun DOM, nessuna rete, tempo iniettabile.
'use strict';

import { t } from '../i18n/ui-strings.js';

// Ogni quanti movimenti non protetti la protezione va sollecitata. Non è un
// numero arbitrario: è la quantità oltre la quale rifare tutto a mano diventa
// realisticamente impossibile (una serata di lavoro).
const SOGLIA_ATTENZIONE = 15;
const SOGLIA_URGENTE = 40;
const GIORNI_ATTENZIONE = 21;

function allTx(state) {
  const buckets = state?.transactions || {};
  const out = [];
  for (const key of Object.keys(buckets)) {
    const list = buckets[key];
    if (Array.isArray(list)) out.push(...list);
  }
  return out;
}

const ts = (t) => {
  const d = new Date(t?.date ?? t?.createdAt ?? 0).getTime();
  return Number.isFinite(d) ? d : 0;
};

// Quanto vale, in lavoro dell'utente, ciò che esiste solo qui.
export function unprotectedValue(state, { now = new Date() } = {}) {
  const last = state?.backupHealth?.lastProtectedAt ? new Date(state.backupHealth.lastProtectedAt).getTime() : 0;
  const tx = allTx(state);
  const nuovi = tx.filter((t) => ts(t) > last);
  const daysSince = last ? Math.floor((now.getTime() - last) / 86_400_000) : null;
  const oldest = nuovi.reduce((min, t) => (ts(t) && ts(t) < min ? ts(t) : min), Infinity);
  return {
    txCount: nuovi.length,
    totalTx: tx.length,
    daysSinceProtected: daysSince,
    everProtected: last > 0,
    oldestUnprotectedAt: Number.isFinite(oldest) ? new Date(oldest).toISOString() : null,
  };
}

// Previsione: al ritmo delle ultime settimane, fra quanti giorni si supera la
// soglia? Serve per proporre la protezione PRIMA che il rischio esista, non
// dopo — l'unico momento in cui un promemoria non è un fastidio.
export function daysUntilAtRisk(state, { now = new Date(), lookbackDays = 28 } = {}) {
  const tx = allTx(state);
  const from = now.getTime() - lookbackDays * 86_400_000;
  const recenti = tx.filter((t) => ts(t) >= from).length;
  const alGiorno = recenti / lookbackDays;
  if (alGiorno <= 0) return null; // nessun ritmo osservato: non si inventa una previsione
  const { txCount } = unprotectedValue(state, { now });
  const mancano = SOGLIA_ATTENZIONE - txCount;
  if (mancano <= 0) return 0;
  return Math.ceil(mancano / alGiorno);
}

// Il giudizio, in una frase che si capisce senza sapere cos'è un backup.
export function backupRisk(state, { now = new Date(), lang = 'it' } = {}) {
  const v = unprotectedValue(state, { now });
  const previsione = daysUntilAtRisk(state, { now });

  if (v.totalTx === 0) {
    return { level: 'ok', headline: t('bhNothing', lang), detail: '', shouldPrompt: false, ...v, daysUntilAtRisk: previsione };
  }
  if (!v.everProtected) {
    const urgente = v.txCount >= SOGLIA_URGENTE;
    return {
      level: urgente ? 'urgente' : 'attenzione',
      headline: t('bhOnlyHere', lang, v.txCount),
      detail: t('bhNeverDetail', lang),
      shouldPrompt: v.txCount >= SOGLIA_ATTENZIONE,
      ...v, daysUntilAtRisk: previsione,
    };
  }
  if (v.txCount >= SOGLIA_URGENTE) {
    return {
      level: 'urgente',
      headline: t('bhNewUnsafe', lang, v.txCount),
      detail: t('bhUrgentDetail', lang),
      shouldPrompt: true, ...v, daysUntilAtRisk: previsione,
    };
  }
  if (v.txCount >= SOGLIA_ATTENZIONE || (v.daysSinceProtected ?? 0) >= GIORNI_ATTENZIONE) {
    return {
      level: 'attenzione',
      headline: t('bhNewSince', lang, v.txCount),
      detail: t('bhAttentionDetail', lang),
      shouldPrompt: true, ...v, daysUntilAtRisk: previsione,
    };
  }
  return {
    level: 'ok',
    headline: t('bhAllSafe', lang),
    detail: previsione !== null && previsione <= 14
      ? t('bhSoon', lang, previsione)
      : '',
    shouldPrompt: false, ...v, daysUntilAtRisk: previsione,
  };
}

// ---- Dove sono finiti i pezzi ----
// Un pezzo "custodito" è tale solo se sta in un posto che NON sparisce insieme
// a questo telefono. Tre pezzi nello stesso telefono non sono una divisione.
const POSTI = {
  questoDispositivo: { label: 'placeThisDevice', indipendente: false },
  altroDispositivo: { label: 'placeOtherDevice', indipendente: true },
  mail: { label: 'placeMail', indipendente: true },
  cloud: { label: 'placeCloud', indipendente: true },
  chiavetta: { label: 'placeUsb', indipendente: true },
  personaFidata: { label: 'placePerson', indipendente: true },
  stampato: { label: 'placePrinted', indipendente: true },
};

export function placeLabel(where, lang = 'it') { return t(POSTI[where]?.label || 'placeOther', lang); }

// Giudizio onesto sulla custodia: quanti pezzi stanno davvero in posti che
// sopravvivono alla perdita del telefono, e se bastano a rientrare.
export function placementQuality(kit, { lang = 'it' } = {}) {
  const threshold = kit?.threshold ?? 2;
  const total = kit?.total ?? 3;
  const placements = Array.isArray(kit?.placements) ? kit.placements : [];

  const perPezzo = new Map();
  for (const p of placements) perPezzo.set(p.index, p.where);

  const posti = [...perPezzo.values()];
  const indipendenti = posti.filter((w) => POSTI[w]?.indipendente).length;
  // Due pezzi nello stesso tipo di posto sono, di fatto, un posto solo.
  const postiDistinti = new Set(posti.filter((w) => POSTI[w]?.indipendente)).size;
  const alSicuro = Math.min(indipendenti, postiDistinti === 0 ? 0 : indipendenti);

  const mancanti = [];
  for (let i = 1; i <= total; i++) if (!perPezzo.has(i)) mancanti.push(i);

  if (postiDistinti >= threshold) {
    return {
      ok: true, alSicuro, postiDistinti, mancanti,
      headline: t('pqSafeHead', lang),
      detail: threshold === 1
        ? t('pqSingleSheet', lang)
        : t('pqPlaces', lang, postiDistinti, threshold),
    };
  }
  if (posti.length >= threshold && postiDistinti < threshold) {
    return {
      ok: false, alSicuro, postiDistinti, mancanti,
      headline: t('pqTooClose', lang),
      detail: t('pqTooCloseDetail', lang, threshold),
    };
  }
  return {
    ok: false, alSicuro, postiDistinti, mancanti,
    headline: t('pqStillToPlace', lang, threshold - postiDistinti),
    detail: t('pqNotYet', lang),
  };
}

// Segna dove è stato messo un pezzo (campo additivo nello stato).
export function recordPlacement(kit, index, where, { now = new Date() } = {}) {
  const placements = (kit?.placements || []).filter((p) => p.index !== index);
  placements.push({ index, where, at: now.toISOString() });
  placements.sort((a, b) => a.index - b.index);
  return { ...kit, placements };
}
