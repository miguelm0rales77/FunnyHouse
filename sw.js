/* FunnyHouse — service worker.
   Guarda la app en el móvil para que abra al instante y funcione sin cobertura.
   Los datos NUNCA se cachean aquí: eso lo gestiona la propia app. */

const VERSION = "funnyhouse-v2";
const SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];
const FONT_CACHE = VERSION + "-fonts";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== VERSION && k !== FONT_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Datos: siempre a la red, nunca caché.
  if (url.hostname.endsWith(".supabase.co")) return;

  // Tipografías: se sirven de caché y se refrescan por detrás.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          const net = fetch(req).then((res) => {
            if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
            return res;
          }).catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }

  // La propia app: caché primero, y se actualiza en segundo plano.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(VERSION).then((cache) =>
        cache.match(req, { ignoreSearch: true }).then((hit) => {
          const net = fetch(req).then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => hit || caches.match("./index.html"));
          return hit || net;
        })
      )
    );
  }
});
