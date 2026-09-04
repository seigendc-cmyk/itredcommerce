// Prepares the two pieces `tauri build`/`tauri dev` package into a release
// Tauri install so each install can run its own independent copy of the
// Express backend as a Tauri sidecar (see ITRED_GOVERNANCE_AND_ARCHITECTURE.md's
// "Tauri Desktop Packaging" addendum):
//
// 1. `src-tauri/binaries/itred-server-<target-triple>.exe` — the sidecar
//    binary itself. Rather than compiling the Node backend into a native
//    executable (Node's Single Executable Application feature is still
//    experimental and complicates native built-ins like `node:sqlite`), this
//    ships the real Node.js runtime binary under Tauri's sidecar naming
//    convention and invokes it with the bundled server as an argument —
//    functionally `node.exe dist-server/server.mjs`, just packaged so Tauri
//    treats it as an external binary it's allowed to spawn.
// 2. `src-tauri/resources/server/` — the bundled server (`server.mjs` +
//    migrations, from `scripts/build-server-bundle.mjs`) plus a copy of the
//    built frontend (`dist/`), laid out exactly like the existing `npm start`
//    production layout so `server/index.ts`'s existing static-file-serving
//    branch (`env.isProduction` + `env.distDir`) works unmodified.
//
// Windows-only for now (confirmed scope: MSI/NSIS installers only).

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tauriDir = path.resolve(rootDir, 'src-tauri');

const TARGET_TRIPLE = 'x86_64-pc-windows-msvc';

// --- 1. Sidecar binary: a renamed copy of the Node runtime that built this
// bundle. Not a build of the app itself — just Node, which is why no
// cross-compilation concern applies here (it always matches the machine
// running `tauri build`, which is fine for this Windows-only build).
const binariesDir = path.resolve(tauriDir, 'binaries');
fs.mkdirSync(binariesDir, { recursive: true });
const sidecarDest = path.resolve(binariesDir, `itred-server-${TARGET_TRIPLE}.exe`);
fs.copyFileSync(process.execPath, sidecarDest);
console.log(`[prepare-sidecar] copied Node runtime (${process.execPath}) -> ${sidecarDest}`);

// --- 2. Resources: dist-server/ (server.mjs + migrations) + dist/ (built frontend)
const resourcesServerDir = path.resolve(tauriDir, 'resources', 'server');
fs.rmSync(resourcesServerDir, { recursive: true, force: true });
fs.mkdirSync(resourcesServerDir, { recursive: true });

const distServerSrc = path.resolve(rootDir, 'dist-server');
if (!fs.existsSync(distServerSrc)) {
  throw new Error('[prepare-sidecar] dist-server/ not found — run scripts/build-server-bundle.mjs first');
}
fs.cpSync(distServerSrc, resourcesServerDir, { recursive: true });

const distSrc = path.resolve(rootDir, 'dist');
if (!fs.existsSync(distSrc)) {
  throw new Error('[prepare-sidecar] dist/ not found — run `vite build` first');
}
fs.cpSync(distSrc, path.resolve(resourcesServerDir, 'dist'), { recursive: true });

console.log(`[prepare-sidecar] wrote ${resourcesServerDir}`);
