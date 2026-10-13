/* Contrôle tarifs OT — fonctionnement hors ligne et mises à jour.
   En ligne : la page est toujours chargée depuis GitHub (dernière version publiée).
   Hors ligne (ou réseau trop lent) : la dernière copie enregistrée est utilisée. */
const VERSION = "2026-10-13.2";
const CACHE = "ctot-" + VERSION;
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", e => {
  /* cache: "reload" : contourne le cache HTTP de GitHub pour enregistrer les fichiers à jour */
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    /* Réseau d'abord (10 s max), sinon copie hors ligne */
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000);
        const r = await fetch(req.url.split("?")[0].split("#")[0], { cache: "no-cache", signal: ctl.signal }); clearTimeout(t);
        if (r.ok) { c.put("./index.html", r.clone()); return r; }
        throw new Error("HTTP " + r.status);
      } catch (_) { return (await c.match("./index.html")) || Response.error(); }
    })());
    return;
  }
  /* Icônes et manifeste : copie enregistrée, mise à jour en arrière-plan */
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
