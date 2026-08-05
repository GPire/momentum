// ============================================================
// TAX RULES — regole fiscali VERSIONATE e per ANNO D'IMPOSTA (v10)
// ============================================================
// Risposta onesta a "l'app deve ricevere aggiornamenti su regole/ATECO e
// aggiornarsi", nel rispetto del 100% on-device (nessun server): le regole
// sono DATI versionati per anno. Un commercialista applica le regole dell'anno
// pertinente (il tetto forfettario era 65.000€ fino al 2022, 85.000€ dal 2023;
// le aliquote cambiano con la legge di bilancio). Quando la legge cambia, si
// aggiorna QUESTO file → si propaga con l'aggiornamento dell'app, e l'app
// applica AUTOMATICAMENTE le regole dell'anno giusto a ogni calcolo.
// Onestà (regola #1): valori reali e datati, mai inventati; aggiornabili.
'use strict';

// Versione del set di regole — cambia a ogni aggiornamento normativo.
export const TAX_RULES_VERSION = '2026-07';

// Regole per anno d'imposta. Si aggiunge una entry SOLO quando i valori
// cambiano davvero; per gli anni intermedi vale l'ultima entry <= anno.
export const TAX_RULES = {
  2019: { forfettarioCeiling: 65000, impostaStd: 0.15, impostaStartup: 0.05, startupAnni: 5, inpsGestioneSeparata: 0.2607 },
  2023: { forfettarioCeiling: 85000, impostaStd: 0.15, impostaStartup: 0.05, startupAnni: 5, inpsGestioneSeparata: 0.2607 },
  // Scaglioni IRPEF REALI (Legge di Bilancio 2026, L. 199/2025) — verificati
  // dal vivo il 2026-08-05, non a memoria. Sostituiscono la stima piatta del
  // 27% usata finora per il regime ordinario: a fatturati grandi la
  // differenza tra "stima piatta" e "scaglioni veri" è enorme (il secondo
  // scaglione è sceso al 33%, il terzo resta al 43% oltre 50.000€). Anni
  // precedenti NON hanno scaglioni verificati qui: taxSetAside ripiega
  // onestamente sulla stima piatta finché non vengono aggiunti con la
  // stessa disciplina di verifica.
  2026: {
    forfettarioCeiling: 85000, impostaStd: 0.15, impostaStartup: 0.05, startupAnni: 5, inpsGestioneSeparata: 0.2607,
    // `fino: null` = scaglione aperto verso l'alto ("e oltre"). MAI
    // `Infinity`: i dati remoti arrivano via JSON (fetchRulesUpdate), che
    // non può rappresentare Infinity — sarebbe diventato `null` comunque
    // dopo un giro di rete, silenziosamente. `null` è la forma vera fin
    // dall'inizio, identica in locale e da remoto.
    irpefScaglioni: [
      { fino: 28000, aliquota: 0.23 },
      { fino: 50000, aliquota: 0.33 },
      { fino: null, aliquota: 0.43 },
    ],
    // Scadenze di versamento, verificate su fonti fiscali correnti
    // (2026-08-05): 30 giugno saldo + primo acconto, 30 novembre secondo
    // acconto, ripartizione 50%+50% (regola vigente dal 2024).
    // Stanno QUI, e non come costante nel codice, per un motivo preciso
    // (richiesta esplicita dell'utente): se le date cambiano e l'utente non
    // aggiorna l'app, il meccanismo di auto-aggiornamento già esistente
    // (fetchRulesUpdate, sotto) può portargliele comunque — validate dal
    // guardrail anti-veleno prima di essere adottate. Una costante nel
    // codice sarebbe invece congelata fino al prossimo rilascio.
    scadenze: [
      { id: 'saldo-primo-acconto', mese: 6, giorno: 30, quota: 0.5, label: 'Saldo + primo acconto' },
      { id: 'secondo-acconto', mese: 11, giorno: 30, quota: 0.5, label: 'Secondo acconto' },
    ],
  },
};

// Calcolo IRPEF PROGRESSIVO reale (a scaglioni), non un'aliquota media
// applicata su tutto il reddito — ogni fascia paga solo la propria
// aliquota, non l'intero imponibile alla fascia più alta raggiunta. Questo
// è l'errore più comune e più grave nei calcolatori fiscali "veloci": senza
// questo calcolo, un fatturato di 200.000€ risulterebbe tassato come se
// OGNI euro fosse al 43%, quando in realtà solo la quota sopra 50.000€ lo è.
export function computeIrpef(imponibile, scaglioni) {
  if (!Array.isArray(scaglioni) || !scaglioni.length || !(imponibile > 0)) return 0;
  let imposta = 0, sogliaPrec = 0;
  for (const { fino, aliquota } of scaglioni) {
    const soglia = fino == null ? Infinity : fino;
    if (imponibile <= sogliaPrec) break;
    const quota = Math.min(imponibile, soglia) - sogliaPrec;
    imposta += quota * aliquota;
    sogliaPrec = soglia;
  }
  return imposta;
}

// `override` opzionale = regole ricevute via aggiornamento dati (fetchRulesUpdate),
// applicate SOLO se già validate. Precedenza all'override quando presente.
export function rulesForYear(year = new Date().getFullYear(), override = null) {
  const source = (override && override.rules) ? { ...TAX_RULES, ...override.rules } : TAX_RULES;
  const anni = Object.keys(source).map(Number).sort((a, b) => a - b);
  let applicabile = anni[0];
  for (const y of anni) if (y <= year) applicabile = y;
  return { year: applicabile, requestedYear: year, ...source[applicabile] };
}

// Confronto versioni 'YYYY-MM' (o 'YYYY-MM-DD'): lessicografico è corretto.
function isNewer(v, current) { return typeof v === 'string' && v > String(current || ''); }

// Valida un payload di regole ricevuto da una fonte esterna PRIMA di adottarlo:
// struttura corretta + valori PLAUSIBILI (guardrail anti-veleno, come sources.js
// e mergePeerPrices). Mai adottare dati malformati o assurdi che romperebbero i
// calcoli fiscali. Ritorna { ok, reason }.
export function validateRulesPayload(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'payload non valido' };
  if (typeof payload.version !== 'string' || payload.version.length < 4) return { ok: false, reason: 'versione mancante o non valida' };
  if (!payload.rules || typeof payload.rules !== 'object' || !Object.keys(payload.rules).length) return { ok: false, reason: 'regole mancanti' };
  for (const [y, r] of Object.entries(payload.rules)) {
    if (!/^\d{4}$/.test(y)) return { ok: false, reason: `anno non valido: ${y}` };
    if (!(r.forfettarioCeiling >= 30000 && r.forfettarioCeiling <= 300000)) return { ok: false, reason: `tetto forfettario implausibile per ${y}` };
    if (!(r.impostaStd > 0 && r.impostaStd < 0.6)) return { ok: false, reason: `imposta standard implausibile per ${y}` };
    if (!(r.impostaStartup >= 0 && r.impostaStartup < r.impostaStd)) return { ok: false, reason: `imposta startup implausibile per ${y}` };
    if (!(r.inpsGestioneSeparata > 0 && r.inpsGestioneSeparata < 0.5)) return { ok: false, reason: `aliquota INPS implausibile per ${y}` };
    // irpefScaglioni è OPZIONALE (anni senza scaglioni verificati ripiegano
    // sulla stima piatta), ma se presente deve avere una forma plausibile:
    // soglie crescenti, aliquote in un range reale, ultima soglia infinita
    // (l'ultimo scaglione copre sempre "in su", mai un buco scoperto).
    if (r.irpefScaglioni !== undefined) {
      if (!Array.isArray(r.irpefScaglioni) || !r.irpefScaglioni.length) return { ok: false, reason: `scaglioni IRPEF implausibili per ${y}` };
      let sogliaPrec = -1;
      for (let i = 0; i < r.irpefScaglioni.length; i++) {
        const s = r.irpefScaglioni[i];
        const ultimo = i === r.irpefScaglioni.length - 1;
        const sogliaOk = ultimo ? s.fino === null : (typeof s.fino === 'number' && s.fino > sogliaPrec);
        if (!sogliaOk || !(s.aliquota > 0 && s.aliquota < 0.6)) return { ok: false, reason: `scaglione IRPEF implausibile per ${y}` };
        sogliaPrec = s.fino;
      }
    }
    // `scadenze` è OPZIONALE (un anno senza scadenze verificate ripiega sul
    // default incluso nell'app), ma se arriva da una fonte esterna deve
    // essere plausibile: date reali, quote che sommano a 1. Una scadenza
    // avvelenata (es. "31 febbraio", o quote che sommano a 3) manderebbe
    // fuori strada la previsione di cassa di un utente vero.
    if (r.scadenze !== undefined) {
      if (!Array.isArray(r.scadenze) || !r.scadenze.length) return { ok: false, reason: `scadenze implausibili per ${y}` };
      let sommaQuote = 0;
      for (const s of r.scadenze) {
        if (!(s.mese >= 1 && s.mese <= 12)) return { ok: false, reason: `mese di scadenza non valido per ${y}` };
        if (!(s.giorno >= 1 && s.giorno <= 31)) return { ok: false, reason: `giorno di scadenza non valido per ${y}` };
        if (!(s.quota > 0 && s.quota <= 1)) return { ok: false, reason: `quota di scadenza implausibile per ${y}` };
        if (typeof s.id !== 'string' || !s.id) return { ok: false, reason: `scadenza senza identificativo per ${y}` };
        sommaQuote += s.quota;
      }
      // Tolleranza per l'aritmetica in virgola mobile (0.5+0.5, 0.4+0.6...).
      if (Math.abs(sommaQuote - 1) > 0.01) return { ok: false, reason: `le quote delle scadenze non coprono il 100% per ${y} (somma ${sommaQuote})` };
    }
  }
  return { ok: true };
}

// AUTO-AGGIORNAMENTO DATI (anche senza aggiornare l'app): scarica un payload di
// regole da una fonte STRUTTURATA FIDATA (url whitelisted), lo valida, e lo
// adotta SOLO se più recente delle regole correnti E plausibile. Se la fonte
// non è configurata o non è raggiungibile → si resta sulle regole incluse
// nell'app (fallback sicuro, mai un buco). Cadenza consigliata: una volta al
// giorno quando online (le regole cambiano ~annualmente: più spesso è spreco).
// Onestà (regola #1): NON inventa dati; senza una fonte reale, non fa nulla.
export async function fetchRulesUpdate({ url, fetchImpl, currentVersion = TAX_RULES_VERSION } = {}) {
  if (!url || typeof fetchImpl !== 'function') {
    return { updated: false, reason: 'nessuna fonte dati configurata: uso le regole incluse nell\'app' };
  }
  try {
    const res = await fetchImpl(url);
    if (!res || !res.ok) return { updated: false, reason: `fonte non raggiungibile (HTTP ${res && res.status})` };
    const payload = await res.json();
    const v = validateRulesPayload(payload);
    if (!v.ok) return { updated: false, reason: `dati NON adottati (anti-veleno): ${v.reason}` };
    if (!isNewer(payload.version, currentVersion)) return { updated: false, reason: 'regole già aggiornate' };
    return { updated: true, version: payload.version, rules: payload.rules };
  } catch (e) {
    return { updated: false, reason: `errore rete/parsing: ${e.message} — resto sulle regole incluse` };
  }
}
