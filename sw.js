// Aide repas — service worker. Les fichiers de l'app (liste posée au build) s'ouvrent depuis le téléphone, sans
// attendre le réseau : en magasin, l'écran restait vide le temps de les retélécharger. Une nouvelle version est
// téléchargée en entier à l'installation de ce fichier (il change à chaque build) et sert à l'ouverture suivante.
// Le reste (page de test…) : réseau d'abord, cache en secours.
const CACHE = 'aide-repas-2026.10.31-1357';
const SHELL = ["./", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "vendor/supabase-js-2.117.2.js", "fonts/instrument-sans-latin-wght-normal.woff2", "fonts/instrument-sans-latin-ext-wght-normal.woff2"];   // chemins relatifs au scope ; './' = la page de l'app
self.addEventListener('install', e => {
  // cache: 'reload' : jamais la copie du cache HTTP (GitHub Pages la garde 10 min), qui mêlerait deux versions
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.registration.scope)) return;
  const path = new URL(e.request.url).pathname.slice(new URL(self.registration.scope).pathname.length);
  // ouverture de l'app (avec ou sans ?n= d'une notification) : la page gardée ; fichiers de l'app : leur copie gardée
  const key = e.request.mode === 'navigate' ? (path === '' || path === 'index.html' ? './' : null) : (SHELL.includes(path) ? path : null);
  e.respondWith(key ? caches.open(CACHE).then(c => c.match(key)).then(r => r || networkFirst(e.request)) : networkFirst(e.request));
});
// seules les réponses OK vont au cache : une erreur (404, 500…) ne remplace jamais une bonne version hors ligne
function networkFirst(req) {
  return fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); } return r; })
    .catch(() => caches.match(req));
}

// Notifications (envoyées par l'Edge Function `notify`) : { title, body, url, tag }
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Aide repas', {
    body: d.body || '', tag: d.tag, icon: 'icon-192.png', badge: 'icon-192.png', lang: 'fr', data: { url: d.url || self.registration.scope },
  }));
});
// Au toucher : ouvre l'app (ou la réutilise) sur la bonne page ; ?n= force un rechargement pour que #preparer soit lu.
// Seulement une adresse de l'app (dans le scope du service worker) : sinon, l'accueil de l'app.
function inScope(url) {
  const scope = self.registration.scope;
  try { const u = new URL(url || scope, scope); return u.href.startsWith(scope) ? u : new URL(scope); } catch { return new URL(scope); }
}
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const u = inScope(e.notification.data?.url);
  u.searchParams.set('n', Date.now());
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.registration.scope));
    if (c) return c.focus().then(w => (w || c).navigate(u.href));
    return clients.openWindow(u.href);
  }));
});
