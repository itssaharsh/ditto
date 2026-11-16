// Serves the legacy app and the rewrite as static sites, and builds the rewrite.
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** A tiny static file server; no caching so a rebuilt rewrite is picked up at once. */
export function serveStatic(rootDir: string, port: number, host = '127.0.0.1'): Promise<Server> {
  const root = resolve(rootDir);
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0].split('#')[0]);
    let file = normalize(join(root, urlPath));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => ok(server));
  });
}

export async function isUp(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}

export interface ShellResult {
  code: number;
  output: string;
}

export function sh(cmd: string, cwd: string, timeoutMs = 300_000): Promise<ShellResult> {
  return new Promise((ok) => {
    const child = spawn('bash', ['-lc', cmd], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const add = (c: Buffer) => {
      out += c.toString();
      if (out.length > 40_000) out = out.slice(-40_000);
    };
    child.stdout.on('data', add);
    child.stderr.on('data', add);
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      ok({ code: code ?? -1, output: out });
    });
  });
}

/** Serve the built console with the live cases/ folder mounted at /cases (for `ditto ui`). */
export function serveConsole(webDist: string, casesDir: string, port: number, host = '127.0.0.1'): Promise<Server> {
  const roots: [string, string][] = [
    ['/cases/', resolve(casesDir)],
    ['/', resolve(webDist)],
  ];
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0].split('#')[0]);
    for (const [prefix, root] of roots) {
      if (!urlPath.startsWith(prefix)) continue;
      let file = normalize(join(root, urlPath.slice(prefix.length - 1)));
      if (!file.startsWith(root)) break;
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!existsSync(file)) continue;
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      createReadStream(file).pipe(res);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => ok(server));
  });
}
