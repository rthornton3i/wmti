// Copyright (c) 2026 [BRAND NAME], Walk Me Through It (WMTI) ([PUBLIC REPOSITORY URL]). PolyForm Noncommercial License 1.0.0; see LICENSE.
// The service worker of the installed (static host) build; build.py --target pages fills in the build id and the
// file list. On install it stores every published file in a cache named after this site and the build; requests are
// answered from that cache first, then the network, and a page load that fails offline gets the cached index.html.
// A new build installs beside the old one and waits: the page shows "New version ready" and its Reload button asks
// this worker to take over (message {type: "skipWaiting"}); on activate the older builds' caches are deleted.
"use strict";

const BUILD_ID = "3ca00c969d87";
const CACHE_PREFIX = "wmti:" + self.registration.scope + ":";
const CACHE = CACHE_PREFIX + BUILD_ID;
const FILES = [
 "./",
 "app.3d37f34ff2.js",
 "charts.a69151b17d.js",
 "fonts/ibm-plex-mono-latin-400-normal.woff2",
 "fonts/ibm-plex-mono-latin-500-normal.woff2",
 "fonts/public-sans-latin-400-normal.woff2",
 "fonts/public-sans-latin-500-normal.woff2",
 "fonts/public-sans-latin-600-normal.woff2",
 "fonts/public-sans-latin-700-normal.woff2",
 "icons/apple-touch-icon.png",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon-maskable-512.png",
 "index.html",
 "legal.3250d44a4a.js",
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
 "shared.25a39642e0.js",
 "wmti.a6d04f7b64.wasm",
 "worker.6733b76dd5.js"
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

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
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
