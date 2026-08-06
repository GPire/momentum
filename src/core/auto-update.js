// ============================================================
// AUTO UPDATE CYCLE — il pezzo che va DAVVERO su internet a controllare
// ============================================================
// `data-freshness.js` decide QUANDO controllare e CON CHE PRIORITÀ. Questo
// file è il pezzo che mancava ancora: ESEGUE il controllo vero, chiamando le
// funzioni che già scaricano da internet e verificano la firma
// (`fetchRulesUpdate` in predict/tax-rules.js, `fetchFormatUpdate` in
// invoice/fatturapa-format.js — entrambe reali, non simulate: fanno una
// richiesta HTTP vera a una fonte whitelisted e validano il payload prima di
// adottarlo). Senza questo pezzo, l'app saprebbe SOLO di avere dati vecchi,
// mai andrebbe a cercarli.
//
// Il ciclo è onesto sul fallimento: una fonte irraggiungibile non blocca le
// altre, e chi fallisce entra in un backoff crescente (data-freshness.js)
// invece di essere martellata ad ogni ciclo.
//
// `sources` è una lista di descrittori, ognuno con un `checkFn` iniettato dal
// chiamante — la stessa disciplina di funzione pura più adattatore usata in
// tutto il progetto: qui non c'è alcun `fetch` diretto, solo orchestrazione.
'use strict';

import { scheduleChecks, nextBackoff } from './data-freshness.js';

// Un ciclo: sceglie chi controllare (budget + priorità), chiama il checkFn
// vero di ognuno, applica gli aggiornamenti riusciti tramite `onUpdated`
// (il chiamante decide COME salvarli — vault, localStorage, quel che serve),
// e restituisce un referto completo, mai silenzioso.
export async function runUpdateCycle(sources = [], {
  now = Date.now(), budget = 3, backoffState = {}, onUpdated = null,
} = {}) {
  const piano = scheduleChecks(sources, { now, budget });
  const byId = new Map(sources.map((s) => [s.id, s]));
  const risultati = [];
  const nuovoBackoff = { ...backoffState };

  for (const voce of piano) {
    const src = byId.get(voce.id);
    if (!src || typeof src.checkFn !== 'function') {
      risultati.push({ id: voce.id, esito: 'non-verificabile', motivo: 'nessuna funzione di controllo collegata a questa fonte' });
      continue;
    }

    const stato = backoffState[voce.id];
    if (stato && stato.riprovaDa > now) {
      risultati.push({ id: voce.id, esito: 'in-attesa', riprovaTraMs: stato.riprovaDa - now });
      continue;
    }

    try {
      const esito = await src.checkFn();
      if (esito?.updated) {
        if (onUpdated) await onUpdated(voce.id, esito);
        risultati.push({ id: voce.id, esito: 'aggiornato', versione: esito.version });
        delete nuovoBackoff[voce.id];
      } else {
        // "Non aggiornato" NON è un errore: la maggior parte dei controlli
        // trova semplicemente che i dati sono già quelli giusti — il motivo
        // dichiarato da fetchRulesUpdate/fetchFormatUpdate lo dice.
        risultati.push({ id: voce.id, esito: 'gia-aggiornato', motivo: esito?.reason || 'nessun aggiornamento disponibile' });
        delete nuovoBackoff[voce.id];
      }
    } catch (e) {
      const tentativi = (stato?.tentativi || 0) + 1;
      const attesa = nextBackoff(tentativi);
      nuovoBackoff[voce.id] = { tentativi, riprovaDa: now + attesa };
      risultati.push({ id: voce.id, esito: 'fallito', motivo: e.message, riprovaTraMs: attesa });
    }
  }

  return { risultati, backoffState: nuovoBackoff };
}

// Riassunto in una frase, per un pannello impostazioni o un log leggibile.
export function cycleSummary(result) {
  const r = result?.risultati || [];
  if (!r.length) return 'Nessun controllo eseguito in questo giro.';
  const aggiornati = r.filter((x) => x.esito === 'aggiornato');
  const falliti = r.filter((x) => x.esito === 'fallito');
  const parti = [];
  if (aggiornati.length) parti.push(`${aggiornati.length} aggiornat${aggiornati.length === 1 ? 'o' : 'i'}`);
  if (falliti.length) parti.push(`${falliti.length} non raggiungibil${falliti.length === 1 ? 'e' : 'i'} (riprova più avanti da solo)`);
  const invariati = r.length - aggiornati.length - falliti.length;
  if (invariati > 0) parti.push(`${invariati} già a posto`);
  return `Controllo dati: ${parti.join(', ')}.`;
}

// ── Adattatori per le fonti reali già esistenti nel progetto ──
// Costruiscono il `checkFn` che runUpdateCycle chiama, senza duplicare la
// logica di rete/validazione (che resta in tax-rules.js/fatturapa-format.js).
export function taxRulesSource({ url, fetchImpl, currentVersion, label = 'Regole fiscali', priority = 0.6, dueInDays = null, generatedAt = null, maxAgeDays = 180 } = {}) {
  return {
    id: 'tax-rules', label, priority, dueInDays, generatedAt, maxAgeDays,
    checkFn: async () => {
      const { fetchRulesUpdate } = await import('../predict/tax-rules.js');
      return fetchRulesUpdate({ url, fetchImpl, currentVersion });
    },
  };
}

export function fatturaPaFormatSource({ url, fetchImpl, currentVersion, label = 'Tracciato fattura elettronica', priority = 0.3, generatedAt = null, maxAgeDays = 365 } = {}) {
  return {
    id: 'fatturapa-format', label, priority, generatedAt, maxAgeDays,
    checkFn: async () => {
      const { fetchFormatUpdate } = await import('../invoice/fatturapa-format.js');
      return fetchFormatUpdate({ url, fetchImpl, currentVersion });
    },
  };
}

// Aliquote di capital gain/bollo per Paese (net-return.js — "il netto vero"
// per gli investimenti): stessa disciplina anti-veleno, priorità più bassa
// (cambiano tipicamente una volta l'anno, non serve controllarle spesso).
export function netReturnRatesSource({ url, fetchImpl, currentVersion, label = 'Aliquote investimenti (netto vero)', priority = 0.4, generatedAt = null, maxAgeDays = 365 } = {}) {
  return {
    id: 'net-return-rates', label, priority, generatedAt, maxAgeDays,
    checkFn: async () => {
      const { fetchNetReturnRatesUpdate } = await import('../alpha/net-return.js');
      return fetchNetReturnRatesUpdate({ url, fetchImpl, currentVersion });
    },
  };
}
