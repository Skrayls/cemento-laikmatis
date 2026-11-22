import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const dist = new URL('../dist/', import.meta.url);
const port = Number(process.env.CEMENT_TIMER_PORT ?? 4173);
const host = '127.0.0.1';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const headers = Object.fromEntries((await readFile(new URL('_headers', dist), 'utf8'))
  .split('\n')
  .filter(line => /^\s+[\w-]+: /.test(line))
  .map(line => {
    const separator = line.indexOf(':');
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  }));

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, `http://${host}`);
  const asset = pathname === '/' ? 'index.html' : pathname.slice(1);
  const contentType = types[extname(asset)];
  if (!['GET', 'HEAD'].includes(request.method) || !/^[\w.-]+$/.test(asset) || !contentType) {
    response.writeHead(404).end();
    return;
  }
  try {
    const bytes = await readFile(new URL(asset, dist));
    response.writeHead(200, { ...headers, 'Content-Type': contentType });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, host, () => console.log(`Cement Timer PRO: http://${host}:${port}/`));
