/* ================================================
   QPAY AO — Service Worker
   Cache offline para funcionamento sem internet
================================================ */

const CACHE_NAME = 'qpay-ao-v1.0.0';

const STATIC_ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './qrcode.html',
  './scanner.html',
  './transferir.html',
  './historico.html',
  './css/style.css',
  './js/app.js',
  './js/auth.js',
  './js/wallet.js',
  './js/transactions.js',
  './js/qr.js',
  './manifest.json'
];

// Bypass Service Worker caching during development

self.addEventListener('install', event => {
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Always Network-first / Bypass cache
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
