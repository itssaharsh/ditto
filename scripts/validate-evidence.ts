// Runs Kane CLI's own integrity check on every sealed evidence pack behind the recorded runs
// (`kane-cli evidence validate --json`, profile L1; local and free) and writes a summary with no account data.
// The packs themselves stay in .ditto-work (they hold account details); the console shows screenshots copied from them.
// Usage: npx tsx scripts/validate-evidence.ts   → docs/evidence-validation.json
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { kaneBin, kaneEnv } from '../src/engine/kane.js';

const run = promisify(execFile);
const root = '.ditto-work/kane';
const packs: { folder: string; file: string }[] = [];
for (const folder of existsSync(root) ? readdirSync(root) : []) {
  const dir = join(root, folder, '.testmuai', 'evidence');
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) if (f.endsWith('.evidence')) packs.push({ folder, file: join(dir, f) });
}

type Result = { folder: string; id: string; valid: boolean; status?: string; codes: string[]; error?: string };
const results: Result[] = [];
let next = 0;
async function worker() {
  while (next < packs.length) {
    const p = packs[next++];
    const id = p.file.split('/').pop()!.replace(/\.evidence$/, '');
    try {
      const { stdout } = await run(kaneBin(), ['evidence', 'validate', p.file, '--json'], { env: kaneEnv(), maxBuffer: 1 << 24 });
      const line = stdout.split('\n').find((l) => l.trim().startsWith('{'));
      const j = JSON.parse(line ?? '{}') as { valid?: boolean; status?: string; diagnostics?: { code: string; severity: string }[] };
      results.push({ folder: p.folder, id, valid: j.valid === true, status: j.status, codes: (j.diagnostics ?? []).map((d) => `${d.severity}:${d.code}`) });
    } catch (e) {
      const out = (e as { stdout?: string }).stdout ?? '';
      const line = out.split('\n').find((l) => l.trim().startsWith('{'));
      let j: { valid?: boolean; status?: string; diagnostics?: { code: string; severity: string }[] } = {};
      try {
        j = JSON.parse(line ?? '{}');
      } catch {
        // not JSON: keep the error text below
      }
      results.push({
        folder: p.folder,
        id,
        valid: j.valid === true,
        status: j.status,
        codes: (j.diagnostics ?? []).map((d) => `${d.severity}:${d.code}`),
        error: line ? undefined : String((e as Error).message).slice(0, 200),
      });
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

const count = <T extends string>(xs: T[]) => xs.reduce<Record<string, number>>((a, x) => ((a[x] = (a[x] ?? 0) + 1), a), {});
const byFolder: Record<string, { packs: number; valid: number }> = {};
for (const r of results) {
  const f = (byFolder[r.folder] ??= { packs: 0, valid: 0 });
  f.packs += 1;
  if (r.valid) f.valid += 1;
}
const summary = {
  what: 'kane-cli evidence validate --json (profile L1) on every sealed evidence pack Kane wrote during the recorded runs (folder todomvc: the TodoMVC runs; console: Kane checking Ditto’s own console).',
  checkedAt: new Date().toISOString(),
  packs: results.length,
  valid: results.filter((r) => r.valid).length,
  statuses: count(results.map((r) => r.status ?? 'unknown')),
  byFolder,
  diagnostics: count(results.flatMap((r) => r.codes)),
  invalid: results.filter((r) => !r.valid).map((r) => ({ folder: r.folder, id: r.id, status: r.status, codes: r.codes, error: r.error })),
};
writeFileSync('docs/evidence-validation.json', JSON.stringify(summary, null, 2) + '\n');
console.log(`${summary.valid}/${summary.packs} packs valid · statuses ${JSON.stringify(summary.statuses)} · diagnostics ${JSON.stringify(summary.diagnostics)}`);
