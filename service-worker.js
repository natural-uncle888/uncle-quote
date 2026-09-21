// 自然大叔報價單 PWA Service Worker
// 目的：讓 index.html 與 quotes.html 可以被手機瀏覽器加入主畫面，並支援基本離線外殼快取。
const CACHE_NAME = 'uncle-quote-pwa-v10-summary-payment-hotfix-20260921';
const APP_SHELL = [
  '/',
  '/index.html',
  '/quotes.html',
  '/quote/',
  '/admin/',
  '/app.js?v=20260921-summary-payment-v2.1',
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
        .catch(() => caches.match(req).then((cached) => cached || caches.match(url.pathname.startsWith('/admin/') ? '/quotes.html' : '/index.html')))
    );
    return;
  }

  // 核心程式碼採 network-first，避免手機持續執行舊版 app.js。
  if (url.origin === self.location.origin && (url.pathname === '/app.js' || url.pathname === '/service-worker.js')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 圖示與 manifest 等其餘靜態檔案採 cache-first。
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      return res;
    }))
  );
});
