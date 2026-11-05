// Bundles the TypeScript unit suite with esbuild, then runs it on Node.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '.unit.build.mjs');

await build({
  entryPoints: [join(here, 'unit.spec.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: out,
  logLevel: 'error',
});

const r = spawnSync(process.execPath, [out], { stdio: 'inherit' });
process.exit(r.status ?? 1);
