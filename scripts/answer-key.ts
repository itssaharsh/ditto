// Scores Kane against an independent answer key: the bugs someone else filed upstream against official TodoMVC
// implementations (tastejs/todomvc #2309–#2315, filed 6 Nov 2026 with a different AI browser agent and re-checked with
// Playwright). Each claim is mapped by hand to the suite tests that exercise it and to one deterministic Playwright check
// (scripts/recheck-impls.mjs → docs/impl-recheck.json). Kane's result comes from the recorded case
// (cases/todomvc-impl-<name>/case.json); Kane never saw the issues. Each row also carries a note written by hand after
// reading Kane's verdict and screenshots; the script refuses to print a note whose recorded outcome has since changed.
// Usage: npx tsx scripts/answer-key.ts   → docs/answer-key.json (and a Markdown table on stdout)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { CaseFile, RunSummary } from '../src/engine/case.js';

type Verdict = 'confirmed' | 'missed' | 'stopped earlier on a false alarm' | 'not run (credit cap)' | 'not covered by the suite';

interface Claim {
  issue: number;
  impl: string;
  claim: string;
  /** Suite tests that exercise the claim; empty when none of the 18 parity tests does. */
  tests: string[];
  /** The check in docs/impl-recheck.json that tests the same claim without AI. */
  recheck?: string;
  /** Hand review of Kane's recorded run: what it said and why. `seen` is the Kane outcome the note was written for. */
  review: { verdict: Verdict; seen: string; note: string };
  /** A later run that tested the same claim with a rewritten sentence (suites/todomvc-strict). */
  followUp?: { case: string; test: string; seen: string };
}

const KEY: Claim[] = [
  {
    issue: 2309, impl: 'react', claim: 'Escape does not leave editing mode', tests: ['escape-discards-a-todo-title-edit'], recheck: 'Escape leaves edit mode and keeps the title',
    review: { verdict: 'confirmed', seen: 'mismatch', note: 'Kane: "Pressing Escape does not leave edit mode or restore the todo\'s original title." Same bug, same reason.' },
  },
  {
    issue: 2309, impl: 'react', claim: 'after Escape, the discarded edit is saved on blur', tests: [], recheck: 'Escape then blur keeps the old title',
    review: { verdict: 'not covered by the suite', seen: '', note: 'No parity test blurs after Escape.' },
  },
  {
    issue: 2311, impl: 'javascript-es6', claim: 'new todos are prepended instead of appended', tests: ['enter-appends-trimmed-todo-and-clears-new-todo-input'], recheck: 'new todos are appended',
    review: { verdict: 'missed', seen: 'pass', note: 'Visible in Kane\'s own last screenshot: "Call home" sits above "Buy milk". The sentence says "its newly appended item displays \'Call home\'" without saying where, and the recorded check finds the item by its text. A fresh run of the same sentence (the replay audit) passed too. Rewritten to name the order, the sentence caught it in a fresh run: "Adding \'Call home\' put it above \'Buy milk\' instead of below it."' },
    followUp: { case: 'todomvc-strict-javascript-es6', test: 'new-todos-go-to-the-bottom-of-the-list', seen: 'mismatch' },
  },
  {
    issue: 2313, impl: 'lit', claim: 'the edit input is not focused after double-click', tests: ['escape-discards-a-todo-title-edit', 'enter-saves-a-trimmed-todo-title', 'empty-edited-titles-destroy-the-todo-on-enter-or-blur'], recheck: 'double-click focuses the edit input',
    review: { verdict: 'missed', seen: 'pass', note: 'Focus does not show in a screenshot, and the recorded check for "its focused edit input contains \'Review proposal\'" reads only the field\'s value; the replay\'s typing focuses the field itself. Fresh runs (the replay audit): Escape passed; the other two came back unclear, Kane blaming its own steps around edit mode.' },
  },
  {
    issue: 2313, impl: 'lit', claim: 'a whitespace-only new todo is created', tests: ['blank-new-todo-submissions-do-not-add-a-todo'], recheck: 'whitespace-only new todo is not added',
    review: { verdict: 'stopped earlier on a false alarm', seen: 'mismatch', note: 'Kane flagged step 1 ("the new-todo field … is not the active field"), so it never reached the whitespace step. The field is focused, inside Lit\'s shadow DOM (deterministic check: input.new-todo is the active element).' },
  },
  {
    issue: 2313, impl: 'lit', claim: 'new todos are not trimmed', tests: ['enter-appends-trimmed-todo-and-clears-new-todo-input'], recheck: 'new todo is trimmed',
    review: { verdict: 'missed', seen: 'unclear', note: 'Spaces at the ends of a title do not show on screen ("  Buy milk  " renders as "Buy milk"), and the recorded check strips them before comparing. The replay passed; a fresh run (the replay audit) came back unclear for an unrelated reason (a missing baseline count).' },
  },
  {
    issue: 2314, impl: 'web-components', claim: 'a whitespace-only new todo is created', tests: ['blank-new-todo-submissions-do-not-add-a-todo'], recheck: 'whitespace-only new todo is not added',
    review: { verdict: 'missed', seen: 'pass', note: 'Visible in Kane\'s own screenshot after the step: an empty row and "1 item left!". Kane counted rows with a title and found none. Rewritten to say "no todo rows at all, not even an empty one, and no \'item left\' counter", the sentence caught it: "Submitting three spaces creates an invisible todo and leaves the item counter on screen."' },
    followUp: { case: 'todomvc-strict-web-components', test: 'spaces-only-entry-adds-no-row-and-no-counter', seen: 'mismatch' },
  },
  {
    issue: 2314, impl: 'web-components', claim: 'Clear completed shows with nothing completed', tests: ['hide-clear-completed-without-completed-todos', 'clear-completed-preserves-active-todos-in-a-mixed-list'], recheck: 'Clear completed hidden with nothing completed',
    review: { verdict: 'confirmed', seen: 'mismatch', note: 'Kane: "After completed todos are cleared, the Clear completed control still appears even though there are no completed items left." Same bug, found by the Clear-completed test.' },
  },
  {
    issue: 2314, impl: 'web-components', claim: 'an edit is lost on blur', tests: [], recheck: 'edit is saved on blur',
    review: { verdict: 'not covered by the suite', seen: '', note: 'The blur-saves test is not in the parity set: Kane could not run it cleanly on the jQuery app.' },
  },
  {
    issue: 2314, impl: 'web-components', claim: 'a whitespace-only edit leaves an empty todo', tests: ['empty-edited-titles-destroy-the-todo-on-enter-or-blur'], recheck: 'whitespace-only edit removes the todo',
    review: { verdict: 'confirmed', seen: 'mismatch', note: 'Kane: "Changing \'Review proposal\' to spaces and leaving the field did not remove the todo; it remained in the list with its old title." The todo is not removed, as claimed; the old title is the blur bug in the same issue.' },
  },
  {
    issue: 2314, impl: 'web-components', claim: 'double-click enters editing only intermittently', tests: [], recheck: 'double-click enters editing (10 tries)',
    review: { verdict: 'not covered by the suite', seen: '', note: 'A flaky behaviour, not a single check.' },
  },
  {
    issue: 2315, impl: 'svelte', claim: 'a whitespace-only edit leaves an empty todo', tests: ['empty-edited-titles-destroy-the-todo-on-enter-or-blur'], recheck: 'whitespace-only edit removes the todo',
    review: { verdict: 'confirmed', seen: 'mismatch', note: 'Kane: "Submitting an edited todo containing only spaces leaves an active item with no visible title." Same bug, same reason.' },
  },
  {
    issue: 2315, impl: 'svelte', claim: 'edits are not trimmed', tests: ['enter-saves-a-trimmed-todo-title'], recheck: 'edit is trimmed',
    review: { verdict: 'missed', seen: 'pass', note: 'Trailing spaces do not show on screen, and the recorded check strips them before comparing. The replay audit flags this test; its fresh run on Svelte was not done (credit budget).' },
  },
  {
    issue: 2315, impl: 'svelte', claim: 'the filter is not restored on reload', tests: [], recheck: 'Completed filter kept on reload',
    review: { verdict: 'not covered by the suite', seen: '', note: 'No parity test reloads a filtered view.' },
  },
];

/** Differences Kane reported that are not in the upstream issues, each checked without AI. */
const EXTRA: { impl: string; tests: string[]; recheck?: string; kind: 'new bug' | 'false alarm' | 'wording difference'; seen: string; note: string }[] = [
  {
    impl: 'javascript-es6', tests: ['mark-all-checks-every-todo-in-all', 'completed-todos-leave-the-active-counter-at-zero'], recheck: 'mark-all by clicking the checkbox itself', kind: 'new bug', seen: 'mismatch',
    note: 'Not in the upstream reports. Kane: "The mark-all control changes its own appearance but does not apply the completed state to the todo." The build binds its click handler to the label (`$toggleAll = $(".toggle-all-label")`), so clicking the checkbox itself, or pressing Space on it, ticks the box and leaves every todo active.',
  },
  {
    impl: 'web-components', tests: ['completed-route-displays-only-completed-todos'], recheck: 'Completed filter shows only completed', kind: 'false alarm', seen: 'mismatch',
    note: 'Kane: "Selecting Completed leaves the Todo list on the All filter instead of activating Completed." Clicking Completed selects it and shows only the completed todo.',
  },
  {
    impl: 'lit', tests: ['blank-new-todo-submissions-do-not-add-a-todo'], recheck: 'new-todo focused on load', kind: 'false alarm', seen: 'mismatch',
    note: 'Kane: "the new-todo field is visible but is not the active field." It is the active field, inside Lit\'s shadow DOM.',
  },
  {
    impl: 'web-components', tests: ['completed-todos-leave-the-active-counter-at-zero'], kind: 'wording difference', seen: 'mismatch',
    note: 'The footer reads "0 items left!" where the jQuery app reads "0 items left". (The React build writes the same "!"; there Kane called its own check unclear.)',
  },
];

/** The outcome Kane recorded for a claim as a whole: any difference wins, then any pass, then unclear. */
function claimOutcome(evidence: { outcome: string }[]): string {
  if (evidence.some((e) => e.outcome === 'mismatch' || e.outcome === 'fail')) return 'mismatch';
  if (evidence.some((e) => e.outcome === 'pass')) return 'pass';
  if (evidence.some((e) => e.outcome === 'test_issue' || e.outcome === 'error')) return 'unclear';
  return 'not run';
}

/** Every result a test has in a case, oldest first: the replay, then any fresh run the replay audit asked for. */
function history(c: CaseFile, id: string) {
  return [...c.rounds]
    .sort((a, b) => a.n - b.n)
    .filter((r) => r.results[id])
    .map((r) => ({ round: r.label ?? `round ${r.n}`, mode: r.results[id].mode, outcome: r.results[id].outcome, kane: r.results[id].verdict?.oneLiner ?? r.results[id].oneLiner }));
}

function latest(c: CaseFile, id: string): RunSummary | undefined {
  let s: RunSummary | undefined;
  for (const r of [...c.rounds].sort((a, b) => a.n - b.n)) if (r.results[id]) s = r.results[id];
  return s;
}
const recheck = JSON.parse(readFileSync('docs/impl-recheck.json', 'utf8')) as { checkedAt: string; results: Record<string, Record<string, { ok?: boolean; error?: string }>> };

let stale = 0;
const rows = KEY.map((k) => {
  const file = `cases/todomvc-impl-${k.impl}/case.json`;
  const c = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as CaseFile) : undefined;
  const evidence = k.tests.map((t) => {
    const s = c ? latest(c, t) : undefined;
    return { test: t, outcome: s?.outcome ?? 'not run', kane: s?.verdict?.oneLiner ?? s?.oneLiner ?? undefined, shareUrl: s?.shareUrl, history: c ? history(c, t) : [] };
  });
  const outcome = !k.tests.length ? '' : claimOutcome(evidence);
  if (outcome !== k.review.seen) {
    stale++;
    console.error(`REVIEW STALE: #${k.issue} ${k.impl} "${k.claim}": note written for "${k.review.seen}", case now says "${outcome}"`);
  }
  let followUp: { case: string; test: string; outcome: string; kane?: string } | undefined;
  if (k.followUp) {
    const fc = JSON.parse(readFileSync(`cases/${k.followUp.case}/case.json`, 'utf8')) as CaseFile;
    const fs = latest(fc, k.followUp.test);
    followUp = { case: k.followUp.case, test: k.followUp.test, outcome: fs?.outcome ?? 'not run', kane: fs?.verdict?.oneLiner ?? fs?.oneLiner };
    if (followUp.outcome !== k.followUp.seen) {
      stale++;
      console.error(`REVIEW STALE: follow-up ${k.followUp.case}/${k.followUp.test}: written for "${k.followUp.seen}", case now says "${followUp.outcome}"`);
    }
  }
  const r = k.recheck ? recheck.results[k.impl]?.[k.recheck] : undefined;
  const reproduced = r ? (r.ok === false && !r.error ? true : r.ok === true ? false : null) : null;
  return { issue: k.issue, impl: k.impl, claim: k.claim, tests: k.tests, kaneOutcome: outcome, verdict: k.review.verdict, note: k.review.note, recheck: k.recheck, reproducedWithoutAI: reproduced, evidence, followUp };
});
const extra = EXTRA.map((x) => {
  const c = JSON.parse(readFileSync(`cases/todomvc-impl-${x.impl}/case.json`, 'utf8')) as CaseFile;
  const evidence = x.tests.map((t) => {
    const s = latest(c, t);
    return { test: t, outcome: s?.outcome ?? 'not run', kane: s?.verdict?.oneLiner ?? s?.oneLiner ?? undefined, shareUrl: s?.shareUrl };
  });
  const outcome = claimOutcome(evidence);
  if (outcome !== x.seen) {
    stale++;
    console.error(`REVIEW STALE: extra ${x.impl} ${x.tests.join(',')}: note written for "${x.seen}", case now says "${outcome}"`);
  }
  const r = x.recheck ? recheck.results[x.impl]?.[x.recheck] : undefined;
  const confirmedWithoutAI = r ? (x.kind === 'false alarm' ? r.ok === true : r.ok === false && !r.error) : null;
  return { impl: x.impl, kind: x.kind, note: x.note, recheck: x.recheck, recheckAgrees: confirmedWithoutAI, evidence };
});
if (stale) process.exit(1);

const count = (v: Verdict) => rows.filter((r) => r.verdict === v).length;
const summary = {
  what: 'Bug claims from upstream issues tastejs/todomvc #2309–#2315 (filed 6 Nov 2026 by someone else, with a different AI browser agent, re-checked with Playwright), scored against what Kane reported when replaying the jQuery recordings on each official implementation. Kane never saw the issues. Each claim is also re-checked without AI (docs/impl-recheck.json).',
  recheckedAt: recheck.checkedAt,
  claims: rows.length,
  reproducedWithoutAI: rows.filter((r) => r.reproducedWithoutAI === true).length,
  coveredBySuite: rows.filter((r) => r.tests.length).length,
  confirmed: count('confirmed'),
  missed: count('missed'),
  stoppedEarlier: count('stopped earlier on a false alarm'),
  notRun: count('not run (credit cap)'),
  notCovered: count('not covered by the suite'),
  /** Misses that a rewritten sentence then caught (suites/todomvc-strict). */
  caughtAfterRewrite: rows.filter((r) => r.followUp?.outcome === 'mismatch').length,
  rows,
  beyondTheKey: extra,
};
writeFileSync('docs/answer-key.json', JSON.stringify(summary, null, 2) + '\n');

const yes = (v: boolean | null) => (v === true ? 'yes' : v === false ? 'no' : '—');
console.log(`| Issue | App | Bug claim | Reproduced without AI | Kane | Why |`);
console.log(`|---|---|---|---|---|---|`);
for (const r of rows) console.log(`| [#${r.issue}](https://github.com/tastejs/todomvc/issues/${r.issue}) | ${r.impl} | ${r.claim} | ${yes(r.reproducedWithoutAI)} | ${r.verdict} | ${r.note.replace(/\|/g, '\\|')} |`);
console.log(`\nBeyond the key:`);
for (const x of extra) console.log(`- ${x.impl}: ${x.kind} (${x.recheck ? `check without AI ${x.recheckAgrees ? 'agrees' : 'DISAGREES'}` : 'no check'}): ${x.note}`);
console.log(`\nRewritten sentences caught ${summary.caughtAfterRewrite} of the ${summary.missed} misses.`);
console.log(`\n${summary.reproducedWithoutAI} of ${summary.claims} claims reproduced without AI. Of the ${summary.coveredBySuite} the suite covers, Kane confirmed ${summary.confirmed}, missed ${summary.missed}, stopped earlier on a false alarm ${summary.stoppedEarlier}, not run ${summary.notRun}.`);
