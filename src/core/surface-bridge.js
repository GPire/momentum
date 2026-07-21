// ============================================================
// SURFACE BRIDGE — la PWA e il browser sono LA STESSA app (v11)
// ============================================================
// PROBLEMA REALE: l'utente installa la PWA, poi un giorno cerca "Momentum" su
// Google e ci arriva dal browser. Deve ritrovare LA SUA app: gli stessi dati e
// lo stesso aggiornamento, non un guscio vuoto che sembra un'altra cosa.
//
// COSA DICE DAVVERO LA PIATTAFORMA (verificato, non supposto):
// - Android / desktop: PWA installata e scheda browser condividono l'origine e
//   quindi localStorage/IndexedDB. I dati sono GIA' gli stessi, non serve nulla.
// - iOS / iPadOS: la PWA sulla Home ha un contenitore SEPARATO da Safari.
//   Cookie, Web Storage e IndexedDB NON si vedono tra loro. Non esiste API che
//   li unisca: dirlo sarebbe una facciata.
//   MA la Cache Storage e' condivisa tra le due istanze — e' l'unico canale che
//   attraversa quel confine.
//   Fonti: netguru "share session/state between PWA standalone and Safari on
//   iOS"; magicbell "PWA iOS limitations 2026".
//
// SCELTA DI ARCHITETTURA: usare la Cache Storage come canale UNICO su tutte le
// piattaforme. Su iOS e' l'unica strada; altrove funziona comunque (stessa
// origine). Un solo meccanismo, nessun ramo per sistema operativo, nessuna
// finzione: dove il SO non permette qualcosa, il codice lo dichiara.
//
// ⚠️ ATTENZIONE (bug evitato): public/sw.js cancella ogni cache che inizia con
// 'momentum-vault-'. Il canale DEVE stare fuori da quel prefisso o l'activate
// del service worker lo distrugge.
//
// ⚠️ NON ANCORA VERIFICATO SU iPHONE REALE. Il comportamento della Cache
// Storage condivisa e' documentato ma va confermato sul dispositivo, come si e'
// fatto per il fix "Consacra" della v9.0. Finche' non e' confermato resta
// dichiarato tale, non spacciato per fatto.
//
// Limiti onesti da non nascondere: iOS puo' svuotare le cache quando lo spazio
// scarseggia, e cancellare la cronologia di Safari azzera anche queste. Il
// canale e' un PONTE, non una fonte di verita': il vault resta l'originale.
'use strict';

export const BRIDGE_CACHE = 'momentum-bridge-v1'; // NON 'momentum-vault-*'
const ORIGIN_TAG = 'https://momentum.local/bridge/';

const now_ = () => Date.now();

function cachesOf(opts = {}) {
  return opts.cachesImpl || (typeof caches !== 'undefined' ? caches : null);
}

// ── Su quale superficie stiamo girando? ──────────────────────────────────────
// display-mode standalone/fullscreen = PWA installata; navigator.standalone e'
// la variante storica di iOS. Se nulla e' disponibile: 'browser' (prudente).
export function detectSurface(env = {}) {
  const mm = env.matchMediaImpl || (typeof matchMedia !== 'undefined' ? matchMedia : null);
  const nav = env.navigatorImpl || (typeof navigator !== 'undefined' ? navigator : null);
  let standalone = false;
  try {
    if (mm) standalone = !!(mm('(display-mode: standalone)').matches || mm('(display-mode: fullscreen)').matches);
  } catch (_) { /* ambiente senza matchMedia */ }
  if (!standalone && nav && nav.standalone === true) standalone = true; // iOS storico
  return { surface: standalone ? 'pwa' : 'browser', standalone };
}

// ── Primitive del canale ─────────────────────────────────────────────────────
export async function putBridge(key, value, opts = {}) {
  const c = cachesOf(opts);
  if (!c) return false;
  try {
    const cache = await c.open(BRIDGE_CACHE);
    const body = JSON.stringify({ v: value, at: opts.now ?? now_() });
    await cache.put(ORIGIN_TAG + key, new Response(body, {
      headers: { 'content-type': 'application/json' },
    }));
    return true;
  } catch (_) { return false; }
}

export async function getBridge(key, opts = {}) {
  const c = cachesOf(opts);
  if (!c) return null;
  try {
    const cache = await c.open(BRIDGE_CACHE);
    const res = await cache.match(ORIGIN_TAG + key);
    if (!res) return null;
    const parsed = await res.json();
    return parsed && 'v' in parsed ? parsed : null;
  } catch (_) { return null; }
}

// ── 1) RICONOSCIMENTO: ogni superficie lascia traccia di se' ────────────────
// Cosi' la scheda browser SA che esiste una PWA installata su questo
// dispositivo, e viceversa — anche su iOS, dove nient'altro glielo direbbe.
export async function announcePresence(opts = {}) {
  const { surface } = opts.surface ? { surface: opts.surface } : detectSurface(opts);
  const at = opts.now ?? now_();
  const prev = (await getBridge('presence', opts))?.v || {};
  const next = { ...prev, [surface]: { lastSeen: at, version: opts.version ?? null } };
  await putBridge('presence', next, opts);
  return next;
}

export async function readPresence(opts = {}) {
  return (await getBridge('presence', opts))?.v || {};
}

// "La PWA e' installata?" = si e' fatta viva di recente su questo dispositivo.
// Onesto: non e' un'API di sistema, e' un'INFERENZA da un'osservazione. Se
// l'utente disinstalla, la traccia scade da sola.
export async function isPwaInstalled(opts = {}) {
  const p = await readPresence(opts);
  const seen = p?.pwa?.lastSeen;
  if (!seen) return false;
  const maxAge = opts.maxAgeMs ?? 60 * 86_400_000;
  return (opts.now ?? now_()) - seen <= maxAge;
}

// ── 2) AGGIORNAMENTO CONDIVISO ───────────────────────────────────────────────
// Chi trova per primo una versione firmata piu' recente (PWA o browser) la
// annuncia; l'altra superficie la prende alla sua prossima apertura, senza
// ripetere tutta la scoperta di rete. Nessun push server (vietato dai vincoli):
// il passaggio avviene all'apertura, che e' esattamente quando serve.
export async function publishUpdateFinding(finding, opts = {}) {
  if (!finding || !finding.version) return false;
  const cur = (await getBridge('update', opts))?.v || null;
  if (cur && compare(cur.version, finding.version) >= 0) return false; // mai retrocedere
  return putBridge('update', {
    version: finding.version,
    url: finding.url ?? null,
    manifest: finding.manifest ?? null,
    foundBy: finding.foundBy ?? detectSurface(opts).surface,
  }, opts);
}

export async function readUpdateFinding(opts = {}) {
  return (await getBridge('update', opts))?.v || null;
}

// Confronto semver-lite, coerente con update-locator.compareVersions.
function compare(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

// ── 3) STESSI DATI ───────────────────────────────────────────────────────────
// Dove l'origine e' condivisa (Android/desktop) i dati sono gia' gli stessi e
// questo non serve. Serve su iOS, dove i due contenitori non si vedono.
// Si deposita uno stato CIFRATO (envelope di src/core/backup.js) piu' un
// digest, cosi' l'altra superficie sa se ha qualcosa da recuperare.
// Il merge resta quello gia' verificato della sync (VaultDAO.applySyncMerge):
// qui si trasporta soltanto, non si reinventa la fusione.
export async function publishVaultHandoff({ envelope, digest, txCount }, opts = {}) {
  if (!envelope || !digest) return false;
  return putBridge('vault', {
    envelope, digest, txCount: txCount ?? null,
    from: detectSurface(opts).surface,
  }, opts);
}

export async function readVaultHandoff(opts = {}) {
  const rec = await getBridge('vault', opts);
  if (!rec?.v?.envelope) return null;
  return { ...rec.v, at: rec.at };
}

// C'e' qualcosa da recuperare dall'altra superficie? Confronto per digest:
// se coincide, i due lati sono gia' allineati e non si tocca nulla.
export async function pendingHandoff(localDigest, opts = {}) {
  const h = await readVaultHandoff(opts);
  if (!h) return null;
  if (localDigest && h.digest === localDigest) return null;
  if (h.from === detectSurface(opts).surface) return null; // e' roba nostra
  return h;
}

// ── 4) CRESCITA DI MOMENTUM CORE ATTRAVERSO LE SUPERFICI ────────────────────
// Il problema che quasi nessuno vede: su iOS, un utente che a volte apre la PWA
// e a volte arriva dal browser fa imparare al Core DUE META' separate, e
// nessuna delle due diventa brava. L'apprendimento si dimezza in silenzio.
//
// Qui il Core si auto-addestra ATTRAVERSO le superfici: si trasportano solo i
// CONTEGGI dei modelli gerarchici (merchant-hierarchy, discovery-memory), mai
// le transazioni. Stesso principio della mesh federata — ma con una differenza
// di fiducia che va detta esplicitamente:
//   - peer della mesh = SCONOSCIUTO  → tetto anti-poisoning stretto (5)
//   - altra superficie = STESSO UTENTE, STESSO DISPOSITIVO → il tetto puo'
//     essere alto, perche' non e' un estraneo: e' lui stesso.
// Trattare i due casi allo stesso modo sarebbe un errore in entrambe le
// direzioni: paranoico qui, ingenuo li'.
export async function publishCoreLearning(models, opts = {}) {
  if (!models) return false;
  return putBridge('core', {
    merchantHierarchy: models.merchantHierarchy ?? null,
    discovery: models.discovery ?? null,
    from: detectSurface(opts).surface,
    coreVersion: models.coreVersion ?? null,
  }, opts);
}

export async function readCoreLearning(opts = {}) {
  const rec = await getBridge('core', opts);
  if (!rec?.v) return null;
  return { ...rec.v, at: rec.at };
}

// Assorbe l'apprendimento dell'altra superficie nei modelli locali.
// `mergeFn` e' iniettata (mergeHierarchical) per tenere questo modulo puro e
// senza dipendenze circolari. Non fa nulla se l'annuncio e' nostro.
export async function absorbCoreLearning(local, mergeFn, opts = {}) {
  const remote = await readCoreLearning(opts);
  if (!remote || typeof mergeFn !== 'function') return { merged: false, reason: 'niente da assorbire' };
  if (remote.from === detectSurface(opts).surface) return { merged: false, reason: 'e\' il nostro stesso annuncio' };
  const cap = opts.maxPeerWeight ?? 1e9; // stesso dispositivo: nessun sospetto
  let merged = false;
  if (local.merchantHierarchy && remote.merchantHierarchy) {
    mergeFn(local.merchantHierarchy, remote.merchantHierarchy, { maxPeerWeight: cap });
    merged = true;
  }
  if (local.discovery?.hosts && remote.discovery?.hosts) {
    mergeFn(local.discovery.hosts, remote.discovery.hosts, { maxPeerWeight: cap });
    merged = true;
  }
  return { merged, from: remote.from, reason: merged ? 'apprendimento unito' : 'nessun modello compatibile' };
}

// ── Diagnosi leggibile: cosa sta succedendo su questo dispositivo ───────────
export async function bridgeStatus(opts = {}) {
  const { surface } = detectSurface(opts);
  const presence = await readPresence(opts);
  const installed = await isPwaInstalled(opts);
  const update = await readUpdateFinding(opts);
  const both = !!(presence.pwa?.lastSeen && presence.browser?.lastSeen);
  return {
    surface, presence, pwaInstalled: installed, update,
    message: both
      ? 'Stessa app su entrambe le superfici: dati e aggiornamenti condivisi.'
      : surface === 'browser' && installed
        ? 'Hai gia\' Momentum installata su questo dispositivo: e\' la stessa app, con i tuoi stessi dati.'
        : 'Prima apertura su questa superficie.',
  };
}
