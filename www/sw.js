/* ══════════════════════════════════════════════
   SERVICE WORKER — EscanerGuías
   Cachea el shell de la app + recursos externos
   (fuentes Google, html5-qrcode, xlsx) para que
   TODO funcione sin conexión a internet.
══════════════════════════════════════════════ */

const APP_CACHE = 'escanerguias-app-v1';
const RUNTIME_CACHE = 'escanerguias-runtime-v1';

// Archivos propios de la app (ajusta si tienes más assets locales,
// p.ej. iconos adicionales)
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE).then(cache =>
      // addAll falla completo si UN archivo no existe; los agregamos
      // uno por uno para que un icono faltante no rompa el cacheo del resto
      Promise.all(
        APP_SHELL.map(url => cache.add(url).catch(() => {}))
      )
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== APP_CACHE && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    // App shell: cache-first, con actualización en segundo plano
    event.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(APP_CACHE).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  } else {
    // Recursos externos (fuentes Google, CDN de html5-qrcode/xlsx, etc.):
    // stale-while-revalidate. Sirve de caché al instante y actualiza
    // en segundo plano si hay internet.
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(cache =>
        cache.match(req).then(cached => {
          const fetchPromise = fetch(req).then(res => {
            if (res && res.status === 200) {
              cache.put(req, res.clone());
            }
            return res;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
  }
});
