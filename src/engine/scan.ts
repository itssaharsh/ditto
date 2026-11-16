// "At scale": replay the oracle's recordings on other builds of the same app (here, official TodoMVC
// implementations in other frameworks). Pure replays only, so a matching build costs ~0 credits.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { join } from 'node:path';
import { serveStatic } from './apps.js';
import { summarize, type RunSummary } from './case.js';
import type { LoadedConfig } from './config.js';
import { runTestmd } from './kane.js';
import type { DittoLoop } from './loop.js';

export interface ScanTarget {
  name: string;
  dir: string;
  entry?: string; // path under dir to open, e.g. "browser/"
  source: string;
}

export interface ScanFile {
  createdAt: string;
  updatedAt: string;
  note: string;
  tests: string[];
  targets: { name: string; source: string; results: Record<string, RunSummary> }[];
}

export function findTargets(root: string): ScanTarget[] {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => existsSync(join(root, name, 'dist')))
    .map((name) => {
      const dist = join(root, name, 'dist');
      const entry = existsSync(join(dist, 'index.html')) ? '' : existsSync(join(dist, 'browser', 'index.html')) ? 'browser/' : '';
      return { name, dir: dist, entry, source: `https://github.com/tastejs/todomvc/tree/master/examples/${name}` };
    });
}

export async function scan(cfg: LoadedConfig, loop: DittoLoop, targets: ScanTarget[], log: (l: string) => void): Promise<ScanFile> {
  const tests = loop.oraclePassing();
  const outDir = cfg.abs(join(cfg.casesDir, `${cfg.case}-scan`));
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, 'scan.json');
  const data: ScanFile = {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    note: `The ${tests.length} behaviours that hold on the ${cfg.legacy.label} reference, replayed from its Kane recordings on other implementations.`,
    tests: tests.map((t) => t.id),
    targets: [],
  };
  const save = () => {
    data.updatedAt = new Date().toISOString();
    writeFileSync(file, JSON.stringify(data, null, 1));
  };
  let port = 7101;
  for (const target of targets) {
    const server: Server = await serveStatic(target.dir, port);
    const url = `http://127.0.0.1:${port}/${target.entry ?? ''}`;
    const row = { name: target.name, source: target.source, results: {} as Record<string, RunSummary> };
    data.targets.push(row);
    log(`scan ${target.name} at ${url}`);
    const queue = [...tests];
    await Promise.all(
      Array.from({ length: cfg.parallel }, async () => {
        while (queue.length) {
          const t = queue.shift()!;
          const stamp = `scan-${target.name}`;
          const r = await runTestmd(join(loop.kaneDir, `${t.id}_test.md`), {
            cwd: loop.kaneDir,
            overrideStartUrl: url,
            noAdaptiveHeal: true,
            local: true,
            bugDetection: 'continue',
            maxSteps: 25,
            timeoutS: 600,
            variables: { ...(cfg.variables ?? {}), start_url: url },
            assetsDir: loop.rec.assetsDir(t.id, stamp),
            assetsRel: `../${cfg.case}/assets/${t.id}/${stamp}`,
          });
          const s = summarize(r, 'replay');
          row.results[t.id] = s;
          log(`  ${target.name.padEnd(16)} ${t.id.padEnd(50)} ${s.outcome} ${s.credits ?? 0}cr`);
          save();
        }
      }),
    );
    server.close();
    port++;
  }
  save();
  return data;
}
