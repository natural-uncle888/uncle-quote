// 自然大叔報價單 PWA Service Worker
// 目的：讓 index.html 與 quotes.html 可以被手機瀏覽器加入主畫面，並支援基本離線外殼快取。
const CACHE_NAME = 'uncle-quote-pwa-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/quotes.html',
  '/app.js',
  '/manifest-quote.webmanifest',
  '/manifest-admin.webmanifest',
  '/icons/quote-192.png',
  '/icons/quote-512.png',
  '/icons/admin-192.png',
  '/icons/admin-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // API、Netlify Functions、Cloudinary 資料不快取，避免報價狀態或管理列表變舊。
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/functions/') || url.hostname.includes('cloudinary.com')) {
    event.respondWith(fetch(req));
    return;
  }

  // HTML 頁面優先走網路，失敗才用快取，避免使用者看到舊版報價單畫面。
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // 靜態檔案採 cache-first，加快從主畫面開啟速度。
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      return res;
    }))
  );
});
