// SPES Rádios - Service Worker
const CACHE = 'spes-radios-v1';
const STATIC = [
  '/radios/',
  '/radios/radio.html',
  '/radios/profile.html',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Deixa Firebase, audio streams e APIs passarem direto
  const url = e.request.url;
  if (url.includes('firebase') || url.includes('gstatic') ||
      url.includes('.mp3') || url.includes('.aac') || url.includes('.m3u8') ||
      url.includes('googleapis') || url.includes('firebaseio')) {
    return;
  }
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
