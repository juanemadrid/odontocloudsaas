// Minimal Service Worker for PWA installability
const CACHE_NAME = 'odontocloud-v1';

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Only handle same-origin GET requests; never intercept external API or Supabase requests
    if (event.request.method !== 'GET') return;
    
    try {
        const url = new URL(event.request.url);
        if (url.origin !== self.location.origin) return;

        event.respondWith(
            fetch(event.request).catch(() => {
                // Return fallback for network drop without unhandled promise rejection
                return new Response('', { status: 408, statusText: 'Request Timed Out' });
            })
        );
    } catch {
        // Skip invalid URL requests
    }
});
