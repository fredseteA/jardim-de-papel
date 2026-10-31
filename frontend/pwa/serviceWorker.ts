/** Build-time generated worker. Only the explicit static shell is cached.
 * API, Supabase, admin pages and story media keep their existing ownership. */
export function serviceWorkerSource(version: string, assets: string[]) {
  return `const CACHE = ${JSON.stringify(`jdp-pwa-shell-${version}`)};
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('jdp-pwa-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.headers.has('Authorization') || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/auth/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match('/offline.html'))));
    return;
  }
  if (url.search || !ASSETS.includes(url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(request).then(cached => cached || fetch(request))));
});
`;
}
