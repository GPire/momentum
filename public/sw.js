// Service worker v52 — doppia strategia.
// App (stesso origin): NETWORK-FIRST. La vecchia strategia cache-first serviva
// moduli JS stantii dopo ogni aggiornamento (bug reale trovato in sviluppo).
// Librerie CDN (Tailwind, three.js, Chart.js, pdf.js, Tesseract, font):
// CACHE-FIRST su una cache separata — sono URL versionati e immutabili, e
// senza questa cache l'app "offline-first" perdeva stile, grafici e OCR
// appena mancava la rete. La cache vendor NON viene spazzata dai bump
// dell'app: contiene anche i ~15MB di wasm/traineddata di Tesseract.
const APP_CACHE = 'momentum-vault-v108';
const VENDOR_CACHE = 'momentum-vendor-v1';

const CDN_HOSTS = [
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'tessdata.projectnaptha.com' // traineddata OCR, caricati a runtime da Tesseract
];

// Gli asset dichiarati in index.html. pdf.worker e i chunk Tesseract/font
// vengono comunque catturati a runtime dal ramo cache-first qui sotto.
const VENDOR_PRECACHE = [
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@400;500;700&display=swap',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js',
  'https://cdn.jsdelivr.net/npm/lightweight-charts@5.2.1/dist/lightweight-charts.standalone.production.js'
];

// Un asset alla volta, mai addAll (è atomico: un solo CDN irraggiungibile
// farebbe fallire l'intera install). Prima cors (risposta verificabile),
// poi fallback no-cors — ma senza sovrascrivere una entry già buona con
// una risposta opaca non ispezionabile.
async function precacheVendor() {
  const cache = await caches.open(VENDOR_CACHE);
  await Promise.allSettled(VENDOR_PRECACHE.map(async url => {
    try {
      await cache.add(new Request(url, { mode: 'cors' }));
    } catch (_) {
      const existing = await cache.match(url);
      if (!existing) {
        const res = await fetch(url, { mode: 'no-cors' });
        await cache.put(url, res);
      }
    }
  }));
}

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(Promise.all([
    caches.open(APP_CACHE).then(cache => cache.addAll([
      './', './index.html', './manifest.json',
      './icons/icon-192.png', './icons/icon-512.png',
      './icons/icon-maskable-192.png', './icons/icon-maskable-512.png',
      './icons/apple-touch-icon.png', './icons/favicon-32.png', './icons/favicon-16.png',
    ])),
    precacheVendor()
  ]));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        const staleApp = key.startsWith('momentum-vault-') && key !== APP_CACHE;
        const staleVendor = key.startsWith('momentum-vendor-') && key !== VENDOR_CACHE;
        return (staleApp || staleVendor) ? caches.delete(key) : undefined;
      }))
    ).then(() => self.clients.claim())
  );
});

async function vendorCacheFirst(request) {
  const cache = await caches.open(VENDOR_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  // Le risposte opache (no-cors, status 0) vanno cacheate comunque: per i
  // font e i chunk CDN è l'unica forma in cui il browser ce le consegna.
  if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  // Web Share Target (solo Android Chrome, PWA installata; iOS non supporta
  // share_target per le PWA — limite Apple, non aggirabile): l'utente
  // condivide uno screenshot (es. notifica del wallet) O testo (es. un SMS/
  // notifica inoltrata come testo) direttamente a Momentum. Il contenuto
  // viene parcheggiato nella cache come mailbox SW→client e la pagina viene
  // aperta con ?shared=1; consumeSharedContent() in main.js lo raccoglie —
  // l'immagine va nell'OCR esistente, il testo nel parser di notifiche
  // (src/import/notification-parser.js), con conferma dell'utente prima di
  // salvare (mai un testo condiviso salvato da solo, stessa cautela del
  // deep-link quick-add).
  if (e.request.method === 'POST' && new URL(e.request.url).pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const formData = await e.request.formData();
        const file = formData.get('image');
        const text = formData.get('text');
        const cache = await caches.open(APP_CACHE);
        if (file) {
          await cache.put('./__shared-image', new Response(file, { headers: { 'Content-Type': file.type || 'image/png' } }));
        }
        if (text) {
          await cache.put('./__shared-text', new Response(text, { headers: { 'Content-Type': 'text/plain' } }));
        }
      } catch (_) { /* condivisione malformata: si apre comunque l'app */ }
      return Response.redirect('./index.html?shared=1', 303);
    })());
    return;
  }

  if (e.request.method !== 'GET') return;

  let hostname = '';
  try { hostname = new URL(e.request.url).hostname; } catch (_) { /* url anomalo: passa al ramo app */ }
  if (CDN_HOSTS.includes(hostname)) {
    e.respondWith(vendorCacheFirst(e.request));
    return;
  }

  e.respondWith(
    fetch(e.request).then(networkResponse => {
      if (networkResponse.status === 200 && e.request.url.startsWith(self.location.origin)) {
        const cacheCopy = networkResponse.clone();
        caches.open(APP_CACHE).then(cache => cache.put(e.request, cacheCopy));
      }
      return networkResponse;
    }).catch(() => caches.match(e.request)) // offline: si usa l'ultima copia buona
  );
});

// ── AVVISI DI PREZZO AD APP CHIUSA (Periodic Background Sync) ───────────────
// LIMITE ONESTO, dichiarato e non nascosto: senza un server che spinga un
// messaggio (Web Push), NESSUNA app può notificare mentre il browser è
// completamente chiuso — nemmeno questa. Periodic Background Sync fa
// controllare i prezzi al sistema operativo anche ad app chiusa, ma:
// (1) solo su PWA installata, solo Chrome/Edge (no Safari/Firefox);
// (2) l'intervallo minimo lo decide il browser in base all'uso reale
//     dell'app (euristica "site engagement"), MAI garantito, spesso ore;
// (3) NON è "tempo reale" — è il meglio possibile senza un server, che
//     questo progetto rifiuta di introdurre per restare 100% on-device.
// Duplica qui (invece di importare) la logica minima di controllo soglia:
// un service worker classico (non-module, per compatibilità) non può
// importare l'albero di moduli ES di main.js senza un bundle dedicato.
async function readVaultState() {
  return new Promise((resolve) => {
    const req = indexedDB.open('momentum_vault', 1);
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction('state', 'readonly').objectStore('state').get('main');
        tx.onsuccess = () => resolve(tx.result || null);
        tx.onerror = () => resolve(null);
      } catch (_) { resolve(null); }
    };
  });
}

async function writeVaultState(state) {
  return new Promise((resolve) => {
    const req = indexedDB.open('momentum_vault', 1);
    req.onerror = () => resolve();
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction('state', 'readwrite').objectStore('state').put(state, 'main');
        tx.onsuccess = () => resolve();
        tx.onerror = () => resolve();
      } catch (_) { resolve(); }
    };
  });
}

async function fetchPriceForAlert(a, apiKey) {
  try {
    if (a.kind === 'crypto') {
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(a.symbol.toLowerCase())}&vs_currencies=eur`);
      const j = await r.json();
      return j?.[a.symbol.toLowerCase()]?.eur ?? null;
    }
    if (!apiKey) return null;
    const r = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(a.symbol)}&apikey=${encodeURIComponent(apiKey)}`);
    const j = await r.json();
    const price = parseFloat(j?.['Global Quote']?.['05. price']);
    return Number.isFinite(price) ? price : null;
  } catch (_) { return null; }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag !== 'momentum-price-watch') return;
  event.waitUntil((async () => {
    const state = await readVaultState();
    const alerts = state?.priceAlerts || [];
    const pending = alerts.filter(a => !a.triggeredAt);
    if (!pending.length) return;
    let changed = false;
    for (const a of pending.slice(0, 5)) {
      const price = await fetchPriceForAlert(a, state?.liveDataKeys?.alphavantage);
      if (!Number.isFinite(price)) continue;
      const hit = a.direction === 'above' ? price >= a.threshold : price <= a.threshold;
      if (!hit) continue;
      a.triggeredAt = Date.now();
      a.triggeredPrice = price;
      changed = true;
      await self.registration.showNotification('Momentum · avviso di prezzo', {
        body: `${a.symbol} ha ${a.direction === 'above' ? 'superato' : 'toccato sotto'} ${a.threshold} (ora ${price}).`,
        icon: '/icons/icon-192.png',
      });
    }
    if (changed) await writeVaultState(state);
  })());
});
