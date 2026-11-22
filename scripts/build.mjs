import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'public');
const output = join(root, 'dist');
const staticAssets = [
  'index.html', 'style.css', 'app.js', 'products.mjs', 'timing.mjs',
  'sw-register.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png',
];

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assets = Object.fromEntries(await Promise.all(staticAssets.map(async (asset) => {
  return [asset, await readFile(join(source, asset))];
})));
const checksums = Object.fromEntries(Object.entries(assets).map(([asset, bytes]) => [asset, sha256(bytes)]));
const workerTemplate = await readFile(join(root, 'scripts/sw-template.js'), 'utf8');
const headers = await readFile(join(source, '_headers'));
const release = sha256(JSON.stringify(checksums) + workerTemplate + headers.toString('utf8')).slice(0, 20);
const worker = workerTemplate
  .replace("'__RELEASE__'", JSON.stringify(release))
  .replace('/* __ASSETS__ */ ({})', JSON.stringify(checksums, null, 2));

const staged = await mkdtemp(join(root, '.dist-'));
try {
  await Promise.all([
    ...Object.entries(assets).map(([asset, bytes]) => writeFile(join(staged, asset), bytes)),
    writeFile(join(staged, 'sw.js'), worker),
    writeFile(join(staged, '_headers'), headers),
  ]);
  await rm(output, { recursive: true, force: true });
  await rename(staged, output);
  console.log(`Cement Timer PRO: ${release}; ${staticAssets.length} offline assets bundled in dist/`);
} finally {
  await rm(staged, { recursive: true, force: true });
}
