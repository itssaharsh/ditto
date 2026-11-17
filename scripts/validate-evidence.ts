// Runs Kane CLI's own integrity check on every sealed evidence pack behind the recorded runs
// (`kane-cli evidence validate --json`, profile L1; local and free) and writes a summary with no account data.
// The packs themselves stay in .ditto-work (they hold account details); the console shows screenshots copied from them.
// It also has Kane judge each pack against Ditto's policy (policies/ditto-parity.yaml) with `kane-cli evidence verdict`.
// Usage: npx tsx scripts/validate-evidence.ts   → docs/evidence-validation.json
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { kaneBin, kaneEnv } from '../src/engine/kane.js';

const run = promisify(execFile);
const root = '.ditto-work/kane';
const packs: { folder: string; file: string }[] = [];
// Each Kane working folder keeps its packs in .testmuai/evidence; fresh runs on a rewrite have their own folders
// further down (rewrite-fresh/<case>/r<n>/<test>/), so walk the whole tree.
function collect(dir: string, folder: string): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'node_modules' || e.name.startsWith('output-')) continue;
    const sub = join(dir, e.name);
    if (e.name === 'evidence' && dir.endsWith('.testmuai')) {
      for (const f of readdirSync(sub)) if (f.endsWith('.evidence')) packs.push({ folder, file: join(sub, f) });
    } else collect(sub, folder);
  }
}
for (const folder of existsSync(root) ? readdirSync(root) : []) if (statSync(join(root, folder)).isDirectory()) collect(join(root, folder), folder);

type Result = { folder: string; id: string; valid: boolean; status?: string; codes: string[]; error?: string; policy?: string; gates?: Record<string, string> };
const POLICY = 'policies/ditto-parity.yaml';

/** Kane's own verdict on the pack under Ditto's policy: overall result and each gate's status. */
async function policyVerdict(file: string): Promise<{ result?: string; gates?: Record<string, string> }> {
  try {
    const { stdout } = await run(kaneBin(), ['evidence', 'verdict', file, '--policy', POLICY, '--json'], { env: kaneEnv(), maxBuffer: 1 << 24 });
    return parseVerdict(stdout);
  } catch (e) {
    return parseVerdict((e as { stdout?: string }).stdout ?? '');
  }
}
function parseVerdict(out: string): { result?: string; gates?: Record<string, string> } {
  const line = out.split('\n').find((l) => l.trim().startsWith('{'));
  if (!line) return {};
  const j = JSON.parse(line) as { result?: string; verdicts?: { gates?: { id: string; status: string }[] }[] };
  const gates = Object.fromEntries((j.verdicts?.[0]?.gates ?? []).map((g) => [g.id, g.status]));
  return { result: j.result, gates };
}
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
      const v = await policyVerdict(p.file);
      results.push({ folder: p.folder, id, valid: j.valid === true, status: j.status, codes: (j.diagnostics ?? []).map((d) => `${d.severity}:${d.code}`), policy: v.result, gates: v.gates });
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
  what: 'kane-cli evidence validate --json (profile L1) on every sealed evidence pack Kane wrote during the recorded runs, including fresh runs on rewrites (folder todomvc: the TodoMVC runs and the official builds; datepicker; todomvc-strict-*: the rewritten sentences; console: Kane checking Ditto’s own console).',
  checkedAt: new Date().toISOString(),
  packs: results.length,
  valid: results.filter((r) => r.valid).length,
  statuses: count(results.map((r) => r.status ?? 'unknown')),
  byFolder,
  diagnostics: count(results.flatMap((r) => r.codes)),
  invalid: results.filter((r) => !r.valid).map((r) => ({ folder: r.folder, id: r.id, status: r.status, codes: r.codes, error: r.error })),
  policy: {
    file: POLICY,
    command: 'kane-cli evidence verdict <pack> --policy policies/ditto-parity.yaml --json',
    results: count(results.map((r) => r.policy ?? 'no verdict')),
    gates: Object.fromEntries(
      [...new Set(results.flatMap((r) => Object.keys(r.gates ?? {})))].map((g) => [g, count(results.map((r) => r.gates?.[g] ?? 'n/a'))]),
    ),
  },
};
writeFileSync('docs/evidence-validation.json', JSON.stringify(summary, null, 2) + '\n');
console.log(`${summary.valid}/${summary.packs} packs valid · statuses ${JSON.stringify(summary.statuses)} · diagnostics ${JSON.stringify(summary.diagnostics)}`);
console.log(`policy ${POLICY}: ${JSON.stringify(summary.policy.results)} · gates ${JSON.stringify(summary.policy.gates)}`);
