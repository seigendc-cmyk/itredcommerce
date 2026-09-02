import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(rootDir, 'dist-server');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.resolve(rootDir, 'server/index.ts')],
  // .mjs (not .js/cjs) because server/db/migrate.ts relies on import.meta.url
  // to locate its migrations directory, which esbuild only preserves in ESM output.
  outfile: path.resolve(outDir, 'server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  logLevel: 'info',
  // Some bundled CJS deps (e.g. depd, a transitive express dependency) call
  // require() dynamically in ways esbuild can't statically resolve into the
  // bundle. In ESM output there's no ambient `require` for those calls to
  // fall back on, so restore one via node:module's createRequire.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});

// server/db/migrate.ts resolves MIGRATIONS_DIR relative to its own bundled
// location (import.meta.url), so migrations must sit next to server.js in
// the same relative layout they have in the source tree.
const migrationsSrc = path.resolve(rootDir, 'server/db/migrations');
const migrationsOut = path.resolve(outDir, 'migrations');
fs.mkdirSync(migrationsOut, { recursive: true });
for (const file of fs.readdirSync(migrationsSrc)) {
  if (file.endsWith('.sql')) {
    fs.copyFileSync(path.join(migrationsSrc, file), path.join(migrationsOut, file));
  }
}

console.log(`[build-server-bundle] wrote ${outDir}`);
