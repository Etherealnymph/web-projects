import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, 'node_modules/katex');
const destination = path.join(root, 'vendor/katex');
const metadata = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
if (metadata.version !== '0.19.1') throw new Error('Expected exactly KaTeX 0.19.1');
await mkdir(destination, { recursive: true });
for (const name of ['katex.mjs', 'katex.min.css', 'fonts']) {
  await cp(path.join(source, 'dist', name), path.join(destination, name), { recursive: true });
}
await cp(path.join(source, 'LICENSE'), path.join(destination, 'LICENSE'));
const hashes = [];
for (const name of ['katex.mjs', 'katex.min.css', 'LICENSE']) {
  hashes.push(
    `${createHash('sha256')
      .update(await readFile(path.join(destination, name)))
      .digest('hex')}  ${name}`,
  );
}
await writeFile(path.join(destination, 'SHA256SUMS'), hashes.join('\n') + '\n');
console.log('Vendored KaTeX 0.19.1 and its fonts without source modifications.');
