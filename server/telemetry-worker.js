// Contatore ANONIMO di installazioni/utenti attivi di Momentum — l'UNICO
// pezzo di infrastruttura server dell'intero progetto, e SOLO per questo:
// dare a chi gestisce Momentum un numero reale (installazioni totali,
// utenti attivi al mese, tasso di adozione) per investitori/partner. Non
// riceve MAI dati finanziari, transazioni, o identità reali — solo un id
// casuale generato dal client (src/core/telemetry.js) e un evento
// 'install'/'active'. Attivo di default nel client (opt-OUT esplicito e
// immediato al primo avvio, mai nascosto — vedi telemetry.js): con
// l'endpoint vuoto (default del repo finché non distribuito) questo worker
// può comunque ricevere traffico zero per anni, è normale.
//
// DEPLOY (5 minuti, gratuito su Cloudflare — free tier: 100k richieste/
// giorno, ampiamente sufficiente in questa fase):
//   1. npm install -g wrangler
//   2. wrangler login
//   3. wrangler kv namespace create MOMENTUM_TELEMETRY
//      (copia l'id restituito dentro wrangler.toml, vedi server/wrangler.toml)
//   4. wrangler secret put STATS_TOKEN   (scegli una password lunga a caso:
//      protegge /stats, altrimenti chiunque potrebbe leggere i tuoi numeri)
//   5. wrangler deploy
//   6. L'URL stampato a fine deploy va incollato in src/core/telemetry.js
//      come endpoint (vedi commento ENDPOINT lì) e in App Vault → Impostazioni
//      → "Aiuta a far crescere Momentum" per chi accetta di attivarlo.
//
// Uso: POST / {id, event:'install'|'active'|'active_day'|'feature', key?,
// month?:'YYYY-MM', day?:'YYYY-MM-DD', platform?, source?} per contare;
// GET /stats?token=IL_TUO_STATS_TOKEN per leggere i numeri.
'use strict';

// Elenchi chiusi (2026-08-28) per platform/source sull'evento 'install' —
// STESSI elenchi del client (src/core/telemetry.js:PLATFORMS/INSTALL_SOURCES),
// duplicati qui per lo stesso motivo di FEATURE_KEYS sotto: il worker non si
// fida mai di un valore arbitrario mandato dal client.
const PLATFORMS = new Set(['ios', 'android', 'mac', 'windows', 'altro']);
const INSTALL_SOURCES = new Set(['invito', 'diretto']);

// STESSO elenco chiuso del client (src/core/telemetry.js:FEATURE_KEYS) —
// duplicato qui apposta (difesa in profondità): il worker non si fida MAI
// di una chiave arbitraria mandata dal client per costruirci una chiave KV,
// anche se il client onesto la filtra già. Se i due elenchi divergono, un
// evento nuovo dal client viene scartato qui finché non si aggiorna anche
// questo file — un piccolo attrito voluto, mai un salvataggio automatico
// di una chiave mai vista prima.
const FEATURE_KEYS = new Set([
  'onboarding_completed', 'first_real_transaction', 'analysis_tensor_opened',
  'spain_tax_activated', 'swiss_tax_opened', 'italy_piva_activated', 'group_chat_used',
  'milestone_shared', 'app_invite_shared',
  'nudge_acted_sweep', 'nudge_acted_causal', 'nudge_acted_month-end',
  'nudge_acted_price-hike', 'nudge_acted_budget-stale', 'nudge_acted_bnpl-exposure',
  'nudge_acted_es-tax-set-aside', 'nudge_acted_investment-readiness',
]);

async function listAllKeys(kv, prefix) {
  const keys = [];
  let cursor;
  for (;;) {
    const page = await kv.list({ prefix, cursor });
    keys.push(...page.keys);
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  return keys;
}

function monthKeysBack(n, now) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Tasso di adozione/retention: quota di id attivi nel mese M-1 che sono
// ANCORA attivi nel mese M. Richiede gli id reali (non solo il conteggio)
// per fare l'intersezione — per questo si leggono le chiavi per intero,
// non solo count(). A scala molto grande andrebbe sostituito con Durable
// Objects/D1, ma per la fase attuale (poche migliaia di dispositivi) KV
// con list() è più che sufficiente e a costo zero.
export async function computeStats(kv, { monthsBack = 6, now = new Date() } = {}) {
  const installs = await listAllKeys(kv, 'install:');
  const months = monthKeysBack(monthsBack, now);
  const activeIdsByMonth = {};
  for (const m of months) {
    const keys = await listAllKeys(kv, `active:${m}:`);
    activeIdsByMonth[m] = new Set(keys.map((k) => k.name.slice(`active:${m}:`.length)));
  }
  const activeByMonth = Object.fromEntries(months.map((m) => [m, activeIdsByMonth[m].size]));
  let retentionRate = null;
  if (months.length >= 2) {
    const [curr, prev] = months; // months[0] = mese corrente, months[1] = precedente
    const prevSet = activeIdsByMonth[prev];
    if (prevSet.size > 0) {
      let retained = 0;
      for (const id of prevSet) if (activeIdsByMonth[curr].has(id)) retained++;
      retentionRate = +(retained / prevSet.size).toFixed(3);
    }
  }
  // Eventi di funzionalità: dispositivi UNICI che hanno toccato ogni pietra
  // miliare, per mese — stesso principio di activeByMonth sopra (unicità
  // per id, mai un conteggio grezzo di eventi). Chiave KV:
  // feature:<key>:<month>:<id> — <key> non contiene mai ':' (whitelist
  // sopra), quindi lo split resta sicuro anche se <id> lo contenesse.
  const featureKeys = await listAllKeys(kv, 'feature:');
  const monthSet = new Set(months);
  const featureByMonth = Object.fromEntries(months.map((m) => [m, {}]));
  for (const k of featureKeys) {
    const [, key, month] = k.name.split(':');
    if (!key || !month || !monthSet.has(month) || !FEATURE_KEYS.has(key)) continue;
    featureByMonth[month][key] = (featureByMonth[month][key] || 0) + 1;
  }
  // Attivi OGGI (2026-08-28) — DAU, e il rapporto DAU/MAU ("stickiness":
  // quanto spesso torna chi è già attivo questo mese, non solo SE torna).
  // Un id in activeDayIds è per costruzione anche in activeIdsByMonth[mese
  // corrente] (active_day non viene mai mandato senza il ping 'active'
  // dello stesso avvio) — nessuna intersezione da calcolare, il rapporto è
  // diretto.
  const todayKey = dayKey(now);
  const activeDayKeys = await listAllKeys(kv, `active_day:${todayKey}:`);
  const currentDayActive = activeDayKeys.length;
  const currentMonthActive = activeByMonth[months[0]] || 0;
  const dauMauRatio = currentMonthActive > 0 ? +(currentDayActive / currentMonthActive).toFixed(3) : null;

  // Piattaforma e provenienza (2026-08-28) — SOLO sull'evento 'install',
  // una volta per dispositivo: dice dove investire per primi (bug/feature)
  // e se gli inviti fanno crescere Momentum da soli (coefficiente virale
  // grezzo: quota di installazioni con source='invito').
  const platformKeys = await listAllKeys(kv, 'install_platform:');
  const installsByPlatform = {};
  for (const k of platformKeys) {
    const [, piattaforma] = k.name.split(':');
    if (!PLATFORMS.has(piattaforma)) continue;
    installsByPlatform[piattaforma] = (installsByPlatform[piattaforma] || 0) + 1;
  }
  const sourceKeys = await listAllKeys(kv, 'install_source:');
  const installsBySource = {};
  for (const k of sourceKeys) {
    const [, provenienza] = k.name.split(':');
    if (!INSTALL_SOURCES.has(provenienza)) continue;
    installsBySource[provenienza] = (installsBySource[provenienza] || 0) + 1;
  }
  const totaleConProvenienza = (installsBySource.invito || 0) + (installsBySource.diretto || 0);
  const viralShare = totaleConProvenienza > 0 ? +((installsBySource.invito || 0) / totaleConProvenienza).toFixed(3) : null;

  return {
    totalInstallsEver: installs.length,
    activeByMonth,
    currentMonthActive,
    currentDayActive,
    dauMauRatio,
    retentionRateMonthOverMonth: retentionRate,
    featureByMonth,
    installsByPlatform,
    installsBySource,
    viralShare,
    generatedAt: now.toISOString(),
  };
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/stats') {
    if (!env.STATS_TOKEN || url.searchParams.get('token') !== env.STATS_TOKEN) {
      return new Response('Non autorizzato.', { status: 401 });
    }
    const stats = await computeStats(env.MOMENTUM_TELEMETRY);
    return new Response(JSON.stringify(stats, null, 2), { headers: { 'Content-Type': 'application/json' } });
  }
  if (request.method === 'POST' && url.pathname === '/') {
    let body;
    try { body = await request.json(); } catch (_) { return new Response('JSON non valido.', { status: 400 }); }
    const { id, event, month, day, key, platform, source } = body || {};
    if (!id || typeof id !== 'string' || id.length > 128) return new Response('id mancante o non valido.', { status: 400 });
    if (event === 'install') {
      await env.MOMENTUM_TELEMETRY.put(`install:${id}`, String(Date.now()));
      // platform/source sono opzionali (client più vecchi non li mandano
      // ancora) e SOLO se dentro l'elenco chiuso — mai un valore libero.
      if (PLATFORMS.has(platform)) await env.MOMENTUM_TELEMETRY.put(`install_platform:${platform}:${id}`, '1');
      if (INSTALL_SOURCES.has(source)) await env.MOMENTUM_TELEMETRY.put(`install_source:${source}:${id}`, '1');
    } else if (event === 'active' && /^\d{4}-\d{2}$/.test(month || '')) {
      await env.MOMENTUM_TELEMETRY.put(`active:${month}:${id}`, String(Date.now()));
    } else if (event === 'active_day' && /^\d{4}-\d{2}-\d{2}$/.test(day || '')) {
      await env.MOMENTUM_TELEMETRY.put(`active_day:${day}:${id}`, String(Date.now()));
    } else if (event === 'feature' && /^\d{4}-\d{2}$/.test(month || '') && FEATURE_KEYS.has(key)) {
      await env.MOMENTUM_TELEMETRY.put(`feature:${key}:${month}:${id}`, String(Date.now()));
    } else {
      return new Response('event non valido.', { status: 400 });
    }
    return new Response('ok');
  }
  return new Response('Momentum telemetry worker: solo POST / e GET /stats.', { status: 404 });
}

export default { fetch: handleRequest };
