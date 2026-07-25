// Minimal Service Worker for PWA installability
const CACHE_NAME = 'odontocloud-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Pass-through: Just fetch from network
    event.respondWith(fetch(event.request));
});
