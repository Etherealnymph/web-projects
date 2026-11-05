// Run with a path to the extracted @o.z/ngspice-wasm@0.0.0 package.
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const source = process.argv[2];
if (!source) throw Error('Usage: node tools/prepare-vendor.mjs /path/to/extracted/package');
const packageJson = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
if (packageJson.name !== '@o.z/ngspice-wasm' || packageJson.version !== '0.0.0')
  throw Error('Expected pinned @o.z/ngspice-wasm 0.0.0');
const target = fileURLToPath(new URL('../vendor/', import.meta.url));
let script = await readFile(join(source, 'ngspice.js'), 'utf8');
if (script.split('preInit();run();').length !== 2) throw Error('Unexpected vendor wrapper');
script = script.replace('preInit();run();', 'Module["callMain"]=callMain;preInit();run();');
await writeFile(resolve(target, 'ngspice.mjs'), script);
await copyFile(join(source, 'COPYING'), resolve(target, 'NGSPICE-COPYING.txt'));
await copyFile(join(source, 'LICENSE'), resolve(target, 'WASM-LICENSE.txt'));
