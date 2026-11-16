// Kane CLI checks Ditto's own console: the plain-English tests in suites/console, run in a real browser
// against a deployed or local console. Writes qa/console-selftest.json (screenshots in qa/console-selftest/).
// Usage: npx tsx scripts/selftest-console.ts <console url>
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { runTestmd } from '../src/engine/kane.js';

const url = process.argv[2] ?? 'https://itssaharsh.github.io/ditto/';
const suite = resolve('suites/console');
const work = resolve('.ditto-work/kane/console');
mkdirSync(work, { recursive: true });
const results: Record<string, unknown>[] = [];
for (const f of readdirSync(suite).filter((x) => x.endsWith('_test.md'))) {
  copyFileSync(join(suite, f), join(work, f));
  const id = f.replace(/_test\.md$/, '');
  const r = await runTestmd(join(work, f), {
    cwd: work,
    url,
    variables: { start_url: url },
    bugDetection: 'continue',
    maxSteps: 25,
    timeoutS: 600,
    assetsDir: resolve('qa/console-selftest', id),
    assetsRel: `console-selftest/${id}`,
  });
  console.log(`${id.padEnd(40)} ${r.outcome} ${r.credits ?? 0}cr ${Math.round(r.durationS ?? 0)}s ${r.oneLiner ?? r.reason ?? ''}`);
  results.push({ id, outcome: r.outcome, credits: r.credits, durationS: r.durationS, oneLiner: r.oneLiner, reason: r.reason, verdict: r.verdict, shareUrl: r.shareUrl, shots: r.evidence?.shots.length ?? 0 });
}
writeFileSync('qa/console-selftest.json', JSON.stringify({ url, at: new Date().toISOString(), results }, null, 1).split(homedir()).join('~'));
