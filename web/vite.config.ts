import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import type { Plugin } from 'vite';

// Dev only: serve the repo's cases/ folder at /cases so a running `ditto loop` shows up live.
function serveCases(dir: string): Plugin {
  return {
    name: 'ditto-serve-cases',
    configureServer(server) {
      server.middlewares.use('/cases', (req, res, next) => {
        const file = normalize(join(dir, decodeURIComponent((req.url ?? '/').split('?')[0])));
        if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) return next();
        res.setHeader('cache-control', 'no-store');
        if (file.endsWith('.json')) res.setHeader('content-type', 'application/json');
        createReadStream(file).pipe(res);
      });
    },
  };
}

// The console reads cases/<id>/case.json. In dev, Vite serves the repo's cases/ folder as /cases.
const root = fileURLToPath(new URL('.', import.meta.url));
const casesDir = fileURLToPath(new URL('../cases', import.meta.url));
export default defineConfig({
  root,
  base: './',
  plugins: [react(), serveCases(casesDir)],
  server: { port: 5180, host: '127.0.0.1', fs: { allow: ['..'] } },
  build: { outDir: 'dist', emptyOutDir: true },
});
