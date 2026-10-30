// Copyright (c) 2026 [BRAND NAME], Walk Me Through It (WMTI) ([PUBLIC REPOSITORY URL]). PolyForm Noncommercial License 1.0.0; see LICENSE.
// The service worker of the installed (static host) build; build.py --target pages fills in the build id and the
// file list. On install it stores every published file in a cache named after this site and the build; requests are
// answered from that cache first, then the network, and a page load that fails offline gets the cached index.html.
// A new build installs beside the old one and waits: the page shows "New version ready" and its Reload button asks
// this worker to take over (message {type: "skipWaiting"}); on activate the older builds' caches are deleted.
// The user documentation under docs/ (published beside the app by publish_pages.py) is never in the file list: each
// docs file is stored the first time it is fetched, in a cache of its own that outlives builds, and then answered
// from there while a fresh copy is fetched for next time (stale-while-revalidate), so a page once read works offline.
// A docs page never read fails offline as any page would; it is never answered with the app's index.html.
// Each publish channel has its own worker and caches: the stable app at the site root ("wmti:", "wmti-docs:") and
// the beta in its beta/ folder ("wmti-beta:", "wmti-beta-docs:"). The stable worker's scope holds beta/, so it
// leaves every request there alone (the beta's own worker, or the network, answers it).
"use strict";

const BUILD_ID = "73586946e034";
const CHANNEL = "stable";
const CACHE_FAMILY = CHANNEL === "beta" ? "wmti-beta" : "wmti";
const CACHE_PREFIX = CACHE_FAMILY + ":" + self.registration.scope + ":";
const CACHE = CACHE_PREFIX + BUILD_ID;
const DOCS_CACHE = CACHE_FAMILY + "-docs:" + self.registration.scope;
const DOCS_PATH = new URL("docs/", self.registration.scope).pathname;
// The paths of the other channel inside this scope: the beta folder for the stable worker, none for the beta.
const OTHER_CHANNEL_PATHS = CHANNEL === "beta" ? [] : [new URL("beta/", self.registration.scope).pathname];
const FILES = [
 "./",
 "app.592c683923.js",
 "charts.ae4d661d99.js",
 "fonts/ibm-plex-mono-latin-400-normal.woff2",
 "fonts/ibm-plex-mono-latin-500-normal.woff2",
 "fonts/public-sans-latin-400-normal.woff2",
 "fonts/public-sans-latin-500-normal.woff2",
 "fonts/public-sans-latin-600-normal.woff2",
 "fonts/public-sans-latin-700-normal.woff2",
 "games.7803be786a.js",
 "gamify.ba629cda7e.js",
 "icons/apple-touch-icon.png",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon-maskable-512.png",
 "index.html",
 "insights.b610d1f57c.js",
 "jspdf.822d41ab6f.js",
 "legal.5beed0797f.js",
 "manifest.webmanifest",
 "pyodide/numpy-2.2.5-cp313-cp313-pyemscripten_2025_0_wasm32_whl.wasm",
 "pyodide/pandas-2.3.3-cp313-cp313-pyemscripten_2025_0_wasm32_whl.wasm",
 "pyodide/pyodide-lock.json",
 "pyodide/pyodide.asm.js",
 "pyodide/pyodide.asm.wasm",
 "pyodide/pyodide.js",
 "pyodide/python_dateutil-2.9.0.post0-py2.py3-none-any_whl.wasm",
 "pyodide/python_stdlib_zip.wasm",
 "pyodide/pytz-2025.2-py2.py3-none-any_whl.wasm",
 "pyodide/six-1.17.0-py2.py3-none-any_whl.wasm",
 "report.1d974b470e.js",
 "shared.bc867c6434.js",
 "wmti.53162db95e.wasm",
 "worker.2aeeb0f68d.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
    .map((key) => caches.delete(key)))));
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "skipWaiting") self.skipWaiting();
});

// A docs file: the stored copy at once (refreshed in the background), else the network (stored when it answers).
async function docsResponse(event) {
  const cache = await caches.open(DOCS_CACHE);
  const stored = await cache.match(event.request, { ignoreSearch: true });
  const fresh = fetch(event.request).then((response) => {
    if (response.ok) return cache.put(event.request, response.clone()).then(() => response);
    return response;
  });
  if (!stored) return fresh;
  event.waitUntil(fresh.catch(() => null));
  return stored;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (OTHER_CHANNEL_PATHS.some((path) => url.pathname.startsWith(path))) return;
  if (url.pathname.startsWith(DOCS_PATH)) {
    event.respondWith(docsResponse(event));
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const stored = await cache.match(request, { ignoreSearch: true });
    if (stored) return stored;
    try {
      return await fetch(request);
    } catch (error) {
      const page = request.mode === "navigate" ? await cache.match("index.html") : null;
      if (page) return page;
      throw error;
    }
  })());
});
