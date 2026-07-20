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
};

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
