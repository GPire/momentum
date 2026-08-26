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
// Uso: POST / {id, event:'install'|'active', month?:'YYYY-MM'} per contare;
// GET /stats?token=IL_TUO_STATS_TOKEN per leggere i numeri.
'use strict';

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
  return {
    totalInstallsEver: installs.length,
    activeByMonth,
    currentMonthActive: activeByMonth[months[0]] || 0,
    retentionRateMonthOverMonth: retentionRate,
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
    const { id, event, month } = body || {};
    if (!id || typeof id !== 'string' || id.length > 128) return new Response('id mancante o non valido.', { status: 400 });
    if (event === 'install') {
      await env.MOMENTUM_TELEMETRY.put(`install:${id}`, String(Date.now()));
    } else if (event === 'active' && /^\d{4}-\d{2}$/.test(month || '')) {
      await env.MOMENTUM_TELEMETRY.put(`active:${month}:${id}`, String(Date.now()));
    } else {
      return new Response('event non valido.', { status: 400 });
    }
    return new Response('ok');
  }
  return new Response('Momentum telemetry worker: solo POST / e GET /stats.', { status: 404 });
}

export default { fetch: handleRequest };
