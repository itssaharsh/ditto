// Scores Kane against an independent answer key: the bugs someone else filed upstream against official TodoMVC
// implementations (tastejs/todomvc #2309–#2315, filed 6 Nov 2026 with a different AI browser agent and re-checked with
// Playwright). Each bug claim is mapped by hand to the suite tests that exercise it; Kane's result on that implementation
// comes from the recorded case (cases/todomvc-impl-<name>/case.json). Kane never saw the issues.
// Usage: npx tsx scripts/answer-key.ts   → docs/answer-key.json (and a Markdown table on stdout)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { CaseFile, RunSummary } from '../src/engine/case.js';

interface Claim {
  issue: number;
  impl: string;
  claim: string;
  /** Suite tests that exercise the claim; empty when none of the 18 parity tests does. */
  tests: string[];
  why?: string;
}

const KEY: Claim[] = [
  { issue: 2309, impl: 'react', claim: 'Escape does not leave editing mode', tests: ['escape-discards-a-todo-title-edit'] },
  { issue: 2309, impl: 'react', claim: 'after Escape, the discarded edit is saved on blur', tests: [], why: 'no parity test blurs after Escape' },
  { issue: 2311, impl: 'javascript-es6', claim: 'new todos are prepended instead of appended', tests: ['enter-appends-trimmed-todo-and-clears-new-todo-input'] },
  { issue: 2313, impl: 'lit', claim: 'the edit input is not focused after double-click', tests: ['escape-discards-a-todo-title-edit', 'enter-saves-a-trimmed-todo-title', 'empty-edited-titles-destroy-the-todo-on-enter-or-blur'] },
  { issue: 2313, impl: 'lit', claim: 'a whitespace-only new todo is created', tests: ['blank-new-todo-submissions-do-not-add-a-todo'] },
  { issue: 2313, impl: 'lit', claim: 'new todos are not trimmed', tests: ['enter-appends-trimmed-todo-and-clears-new-todo-input'] },
  { issue: 2314, impl: 'web-components', claim: 'a whitespace-only new todo is created', tests: ['blank-new-todo-submissions-do-not-add-a-todo'] },
  { issue: 2314, impl: 'web-components', claim: 'Clear completed shows with nothing completed', tests: ['hide-clear-completed-without-completed-todos'] },
  { issue: 2314, impl: 'web-components', claim: 'an edit is lost on blur', tests: [], why: 'the blur-saves test is not in the parity set (Kane could not run it cleanly on the jQuery app)' },
  { issue: 2314, impl: 'web-components', claim: 'a whitespace-only edit leaves an empty todo', tests: ['empty-edited-titles-destroy-the-todo-on-enter-or-blur'] },
  { issue: 2314, impl: 'web-components', claim: 'double-click enters editing only intermittently', tests: [], why: 'a flaky behaviour, not a single check' },
  { issue: 2315, impl: 'svelte', claim: 'a whitespace-only edit leaves an empty todo', tests: ['empty-edited-titles-destroy-the-todo-on-enter-or-blur'] },
  { issue: 2315, impl: 'svelte', claim: 'edits are not trimmed', tests: ['enter-saves-a-trimmed-todo-title'] },
  { issue: 2315, impl: 'svelte', claim: 'the filter is not restored on reload', tests: [], why: 'no parity test reloads a filtered view (the jQuery app keeps no state across reloads)' },
];

const differs = (s?: RunSummary) => s?.outcome === 'mismatch' || s?.outcome === 'fail';
function latest(c: CaseFile, id: string): RunSummary | undefined {
  let s: RunSummary | undefined;
  for (const r of [...c.rounds].sort((a, b) => a.n - b.n)) if (r.results[id]) s = r.results[id];
  return s;
}

const rows = KEY.map((k) => {
  const file = `cases/todomvc-impl-${k.impl}/case.json`;
  if (!existsSync(file)) return { ...k, result: 'not checked yet' as const, evidence: [] as { test: string; outcome: string; kane?: string }[] };
  const c = JSON.parse(readFileSync(file, 'utf8')) as CaseFile;
  const evidence = k.tests.map((t) => {
    const s = latest(c, t);
    return { test: t, outcome: s?.outcome ?? 'not run', kane: s?.verdict?.oneLiner ?? s?.oneLiner ?? undefined };
  });
  const result = !k.tests.length
    ? ('not covered by the suite' as const)
    : evidence.some((e) => e.outcome === 'mismatch' || e.outcome === 'fail')
      ? ('Kane confirmed a difference' as const)
      : evidence.some((e) => e.outcome === 'test_issue' || e.outcome === 'error')
        ? ('Kane unsure' as const)
        : ('missed (all passed)' as const);
  return { ...k, result, evidence };
});

const covered = rows.filter((r) => r.tests.length);
const tally = (x: string) => covered.filter((r) => r.result === x).length;
const summary = {
  what: 'Bug claims from upstream issues tastejs/todomvc #2309–#2315 (filed 6 Nov 2026 by someone else, with a different AI browser agent, re-checked with Playwright), scored against what Kane reported when replaying the jQuery recordings on each official implementation. Kane never saw the issues.',
  claims: rows.length,
  coveredBySuite: covered.length,
  confirmed: tally('Kane confirmed a difference'),
  unsure: tally('Kane unsure'),
  missed: tally('missed (all passed)'),
  notCheckedYet: tally('not checked yet'),
  rows,
};
writeFileSync('docs/answer-key.json', JSON.stringify(summary, null, 2) + '\n');
// silence unused helper warnings in strict builds
void differs;

console.log(`| Issue | App | Bug claim | Kane |`);
console.log(`|---|---|---|---|`);
for (const r of rows) console.log(`| [#${r.issue}](https://github.com/tastejs/todomvc/issues/${r.issue}) | ${r.impl} | ${r.claim} | ${r.tests.length ? r.result : `not covered: ${r.why}`} |`);
console.log(`\n${summary.confirmed} of ${summary.coveredBySuite} covered claims confirmed, ${summary.unsure} unsure, ${summary.missed} missed, ${summary.notCheckedYet} not checked yet; ${rows.length - covered.length} claims outside the suite.`);
