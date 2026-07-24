// Service worker v52 — doppia strategia.
// App (stesso origin): NETWORK-FIRST. La vecchia strategia cache-first serviva
// moduli JS stantii dopo ogni aggiornamento (bug reale trovato in sviluppo).
// Librerie CDN (Tailwind, three.js, Chart.js, pdf.js, Tesseract, font):
// CACHE-FIRST su una cache separata — sono URL versionati e immutabili, e
// senza questa cache l'app "offline-first" perdeva stile, grafici e OCR
// appena mancava la rete. La cache vendor NON viene spazzata dai bump
// dell'app: contiene anche i ~15MB di wasm/traineddata di Tesseract.
const APP_CACHE = 'momentum-vault-v55';
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
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js'
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
  // condivide uno screenshot (es. notifica del wallet) direttamente a
  // Momentum. Il blob viene parcheggiato nella cache come mailbox SW→client
  // e la pagina viene aperta con ?shared=1; consumeSharedImage() in main.js
  // lo raccoglie e lo instrada nell'OCR esistente.
  if (e.request.method === 'POST' && new URL(e.request.url).pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const formData = await e.request.formData();
        const file = formData.get('image');
        if (file) {
          const cache = await caches.open(APP_CACHE);
          await cache.put('./__shared-image', new Response(file, { headers: { 'Content-Type': file.type || 'image/png' } }));
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
