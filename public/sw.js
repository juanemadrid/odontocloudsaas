// Minimal Service Worker for PWA installability
// v2: si una descarga falla por un corte breve, se reintenta una vez; si sigue fallando se
// deja el error normal del navegador (antes devolvía una respuesta vacía de "tiempo agotado" que hacía
// fallar la carga de módulos y mostraba la pantalla de error por unos segundos).
const CACHE_NAME = 'odontocloud-v2';

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

self.addEventListener('fetch', (event) => {
    // Only handle same-origin GET requests; never intercept external API or Supabase requests
    if (event.request.method !== 'GET') return;

    try {
        const url = new URL(event.request.url);
        if (url.origin !== self.location.origin) return;

        const request = event.request;
        event.respondWith(
            fetch(request).catch(() => pause(800).then(() => fetch(request))).catch(() => Response.error())
        );
    } catch {
        // Skip invalid URL requests
    }
});
