// A one-off Kane check of a behaviour no suite test covers, on the old app and on a rewrite.
// Written after the mutation run: reading the fixer's diff showed its repair of Escape also changed what
// happens when the edit field is emptied first. This asks Kane to look at both apps, so the claim rests on
// Kane's runs rather than on reading code.
// Usage: npx tsx scripts/edge-check.ts   → docs/edge-check.json and docs/edge-check/<side>/ screenshots
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { isUp, serveStatic } from '../src/engine/apps.js';
import { runObjective } from '../src/engine/kane.js';

const OBJECTIVE =
  "Create a todo titled 'Pay rent' using the new-todo input. Double-click the 'Pay rent' label to edit it. In the edit field, select all of its text and delete it (Ctrl+A, then Backspace) so the field is completely empty, and only then press Escape; then assert that the todo list no longer contains a todo titled 'Pay rent'.";

const SIDES = [
  { side: 'legacy', label: 'jQuery TodoMVC (the old app)', dir: 'fixtures/legacy-todomvc', port: 7001 },
  { side: 'rewrite', label: 'React port after the mutation run’s fixes (commit 40f2c99)', dir: '../todomvc-react-port-mutation/dist', port: 7004 },
];

const servers: Server[] = [];
const runs = [];
for (const s of SIDES) {
  const url = `http://127.0.0.1:${s.port}/`;
  if (!(await isUp(url))) servers.push(await serveStatic(s.dir, s.port));
  rmSync(`docs/edge-check/${s.side}`, { recursive: true, force: true });
  mkdirSync(`docs/edge-check/${s.side}`, { recursive: true });
  console.log(`kane ${s.side} ${url}`);
  const r = await runObjective(OBJECTIVE, {
    url,
    bugDetection: 'continue',
    maxSteps: 25,
    name: `edge-check-${s.side}`,
    cwd: `.ditto-work/edge-check/${s.side}`,
    assetsDir: `docs/edge-check/${s.side}`,
    assetsRel: `edge-check/${s.side}`,
  });
  console.log(`  ${r.outcome} ${r.resultCode ?? ''} ${Math.round(r.credits ?? 0)}cr · ${r.oneLiner ?? r.reason ?? ''}`);
  runs.push({
    side: s.side,
    app: s.label,
    outcome: r.outcome,
    resultCode: r.resultCode,
    oneLiner: r.oneLiner,
    summary: r.summary,
    verdict: r.verdict,
    credits: r.credits,
    durationS: r.durationS,
    shareUrl: r.shareUrl,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    urls: r.urls,
    shots: r.evidence?.shots ?? [],
  });
}
for (const sv of servers) sv.close();
writeFileSync(
  'docs/edge-check.json',
  JSON.stringify(
    {
      why: 'Not in the 28-test suite. Found by reading the fixer’s diff after the mutation run; checked here with Kane on both apps.',
      objective: OBJECTIVE,
      runs,
    },
    null,
    2,
  ) + '\n',
);
console.log('wrote docs/edge-check.json');
