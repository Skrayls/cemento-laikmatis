/// <reference lib="webworker" />

const worker = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));
const release = '__RELEASE__';
const scope = new URL(worker.registration.scope);
const prefix = `cement-timer-pro:${scope.pathname}:`;
const cacheName = prefix + release;

/** @type {Readonly<Record<string, string>>} */
const checksums = /* __ASSETS__ */ ({});

/**
 * Refuse to install a mixed-version shell if deployment changes while the
 * worker is downloading it. The previous active worker remains valid.
 * @param {string} asset
 * @param {string} expectedChecksum
 */
async function verifiedAsset(asset, expectedChecksum) {
  const url = new URL(asset, scope);
  // Pages redirects /index.html to /. Fetch the shell at its canonical URL.
  const response = await fetch(asset === 'index.html' ? scope : url, { cache: 'reload', redirect: 'error' });
  if (!response.ok) throw new Error(`Unable to precache ${asset}`);
  const bytes = await response.clone().arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const actualChecksum = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  if (actualChecksum !== expectedChecksum) throw new Error(`Changed asset: ${asset}`);
  return { url, response };
}

worker.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const entries = await Promise.all(
      Object.entries(checksums).map(([asset, checksum]) => verifiedAsset(asset, checksum)),
    );
    const cache = await caches.open(cacheName);
    try {
      // Wait for every write to finish before deleting a failed cache.
      const writes = await Promise.allSettled(entries.map(({ url, response }) => cache.put(url, response)));
      if (writes.some(write => write.status === 'rejected')) throw new Error('Offline cache write failed');
    } catch (error) {
      await caches.delete(cacheName);
      throw error;
    }
  })());
  // No skipWaiting(): open pages keep the exact release they started with.
});

worker.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(prefix) && key !== cacheName)
      .map(key => caches.delete(key)));
  })());
  // No clients.claim(): don't replace the release behind already loaded pages.
});

worker.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const path = url.pathname.slice(scope.pathname.length);
  const asset = path === '' && event.request.mode === 'navigate' ? 'index.html' : path;
  if (!Object.hasOwn(checksums, asset)) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(new URL(asset, scope));
    if (cached) return cached;
    // An evicted entry can be repaired online, but only with identical bytes.
    try {
      const { url: key, response } = await verifiedAsset(asset, checksums[asset]);
      await cache.put(key, response.clone()).catch(() => {});
      return response;
    } catch {
      return Response.error();
    }
  })());
});
