// Service worker minimal untuk Populi WA (installable PWA + offline shell).
// Strategi: navigasi = network-first (selalu app terbaru; fallback shell saat offline);
// aset statis = cache-first; API/webhook = SELALU jaringan (jangan pernah di-cache).
const CACHE = "populi-wa-v2";
const SHELL = ["/", "/index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // biarkan default (API lintas-metode/origin)
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/webhook")) return; // API/webhook selalu jaringan

  // Navigasi SPA → network-first, fallback ke index.html dari cache saat offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/index.html")));
    return;
  }

  // Aset statis (js/css/img) → cache-first, isi cache saat pertama diambil.
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      });
    }),
  );
});
