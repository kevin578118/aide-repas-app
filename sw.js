// Aide repas — service worker minimal : réseau d'abord, cache en secours (hors ligne).
const CACHE = 'aide-repas-2026.10.10-2105';
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.registration.scope)) return;
  e.respondWith(
    fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request))
  );
});

// Notifications (envoyées par l'Edge Function `notify`) : { title, body, url, tag }
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Aide repas', {
    body: d.body || '', tag: d.tag, icon: 'icon-192.png', badge: 'icon-192.png', lang: 'fr', data: { url: d.url || self.registration.scope },
  }));
});
// Au toucher : ouvre l'app (ou la réutilise) sur la bonne page ; ?n= force un rechargement pour que #preparer soit lu
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const u = new URL(e.notification.data?.url || self.registration.scope, self.registration.scope);
  u.searchParams.set('n', Date.now());
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.registration.scope));
    if (c) return c.focus().then(w => (w || c).navigate(u.href));
    return clients.openWindow(u.href);
  }));
});
