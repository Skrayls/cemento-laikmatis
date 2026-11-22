import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { expect, test } from '@playwright/test';

const dist = new URL('../../dist/', import.meta.url);
const mime = {
  html: 'text/html',
  js: 'text/javascript',
  mjs: 'text/javascript',
  css: 'text/css',
  webmanifest: 'application/manifest+json',
  svg: 'image/svg+xml',
  png: 'image/png',
};
const asSha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('a new offline release waits and does not change an active client’s assets', async ({ page }) => {
  const originalCss = await readFile(new URL('style.css', dist), 'utf8');
  const revisedCss = originalCss + '\n/* automated offline release fixture */\n';
  const originalSw = await readFile(new URL('sw.js', dist), 'utf8');
  const revisedSw = originalSw
    .replace(/const release = "[^"]+";/, 'const release = "test-release-b";')
    .replace(asSha256(originalCss), asSha256(revisedCss));

  let revised = false;
  const server = createServer(async (request, response) => {
    // Simulate Cloudflare Pages' redirect for direct requests to /index.html.
    if (request.url === '/index.html') {
      response.writeHead(308, { Location: '/' }).end();
      return;
    }
    const name = request.url === '/' ? 'index.html' : request.url.slice(1);
    const type = mime[name.split('.').at(-1)];
    if (!/^[\w.-]+$/.test(name) || !type) {
      response.writeHead(404).end();
      return;
    }
    try {
      const bytes = revised && name === 'sw.js' ? revisedSw
        : revised && name === 'style.css' ? revisedCss
          : await readFile(new URL(name, dist));
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(bytes);
    } catch {
      response.writeHead(404).end();
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    await page.goto(url);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.locator('#conditions').check();
    await page.locator('#start').click();
    await expect(page.locator('body')).toHaveAttribute('data-running', 'true');

    revised = true;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await expect.poll(() => page.evaluate(async () => {
      return (await navigator.serviceWorker.getRegistration()).waiting?.state;
    })).toBe('installed');
    const servedCss = await page.evaluate(async () => (await fetch('style.css')).text());
    expect(servedCss).toBe(originalCss);
    await expect(page.locator('#start')).toBeHidden();

    const oldRelease = originalSw.match(/const release = "([^"]+)";/)[1];
    const cacheName = `cement-timer-pro:/:${oldRelease}`;
    const mixedReleaseRejected = await page.evaluate(async (name) => {
      const cache = await caches.open(name);
      await cache.delete(new URL('style.css', location.href));
      try {
        await fetch('style.css');
        return false;
      } catch {
        return true;
      }
    }, cacheName);
    expect(mixedReleaseRejected).toBe(true);
  } finally {
    await page.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
