# Testing Ditto

Three layers, from fastest to most real.

## 1. Unit tests (`npm test`)

`test/kane.test.ts` feeds **real Kane CLI output** (captured NDJSON streams in `test/fixtures/`, home paths scrubbed) through the parser and checks the routing that the loop depends on:

- a confirmed product bug (`result_code 740`, `verdict.family: application_issue`) is a **mismatch**;
- a failure Kane blames on the test (`710`, `automation_bug`) is a **test issue**;
- a dropped browser (`510`, `environment_issue`) is an **error** that is retried, never counted;
- authored vs replayed runs (`author_decisions` / `replay_decisions`) and summed credits across markdown steps;
- Kane-designed `_test.md` files parse into steps with their `@verifies ac-N` links.

`test/console.test.ts` covers the console's logic: parity is counted only over behaviours the old app passes, the behaviour Claude fixed is found, rewinding the case for the replay shows only what had happened by then, and Kane's screenshots are grouped per test step with the failing step marked.

## 2. Type checks (`npm run typecheck`)

Strict TypeScript for the engine and the console.

## 3. Kane on Ditto's own console (`suites/console/`)

The console is checked the same way Ditto checks rewrites: plain-English `_test.md` files that Kane runs in a real browser.

```bash
npm run web:build && npm run ditto -- ui &            # serves http://127.0.0.1:4747
cd suites/console
kane-cli testrun run . --parallel 2 \
  --variables '{"start_url":{"value":"http://127.0.0.1:4747/?case=todomvc","secret":false}}' < /dev/null
```

| Test | What it proves |
|---|---|
| `first-screen-shows-the-verdict` | the question, the parity count and a test file with both apps' screenshots are on the first screen |
| `try-these-switches-behaviour` | picking a behaviour replaces the test file and highlights the chip |
| `screenshot-opens-enlarged` | every screenshot opens full size and closes again |
| `all-behaviours-table` | the table lists every behaviour and opens one at the top |

Latest run, against the deployed console (https://itssaharsh.github.io/ditto/, 2026-11-16, opening on the planted-bug run), saved in [`console-selftest.json`](console-selftest.json):

| Test | Result | Time | Credits | Kane's summary |
|---|---|---|---|---|
| `all-behaviours-table` | pass | 21 s | 0 | replay completed |
| `first-screen-shows-the-verdict` | pass | 20 s | 0 | replay completed |
| `screenshot-opens-enlarged` | pass | 128 s | 32 | The screenshot dialog opened successfully, but the replay's next click targeted another screenshot rather than the visible Close button. |
| `try-these-switches-behaviour` | pass | 70 s | 21 | opened the completed-todos scenario on itssaharsh.github.io |

Two tests replayed their earlier recordings for 0 credits. `try-these-switches-behaviour` was authored again because its text changed (the chip it clicks was already open on the new first screen, so it now picks another). `screenshot-opens-enlarged` healed: the replayed click hit a different screenshot, and Kane re-authored that step. The first run of these tests, earlier on 16 Nov, came back "unclear" on 3 of 4: Kane reported the console did the right thing but its own final check failed, and in one case the test expected "26/26" (a number left over from the design mock-ups) where the page showed the real 18/18. The test wording was fixed and all four passed.

## 4. The end-to-end run

`npm run ditto -- loop` is itself the integration test: Kane designs the suite, records the oracle, Claude Code ports the app, and the loop must end in parity with a final replay of every test on the rewrite. The recorded run is `cases/todomvc/case.json`; `npm run ditto -- status` prints its table.

A port that matches first time doesn't prove the tests would notice a regression, so the method has its own check: `npm run ditto -- mutate --config ditto.mutation.config.json`. A second Claude Code session plants bugs in a copy of the finished port and writes them down in `.ditto-work/` (outside the repository). Ditto then runs the normal loop with a fresh fixer session that sees only Kane's findings. The run passes only if the loop ends at parity again.

Recorded run (`cases/todomvc-mutation/case.json`, 16 Nov 2026): 3 bugs planted (Escape saves the edit; "0 item left"; mark-all looks checked while one todo is active). Kane confirmed differences on 2 behaviours on the broken build. Fix round 1 repaired Escape and the counter; Kane still flagged the counter test, now because mark-all couldn't complete the last todo; fix round 2 found the mark-all bug. Final replay: 18/18. 61 Kane runs, 40 of them pure replays, 480 credits; Claude Code reported $0.71 at API prices for the breaker and both fixer sessions. The commits are on the port's [`ditto/mutation-check`](https://github.com/itssaharsh/todomvc-react-port/commits/ditto/mutation-check) branch.

The run also exposed a flaw in Ditto. On the broken build, Kane's replays of `mark-all-checks-every-todo-in-all` and `two-active-todos-display-a-plural-counter` failed at their checks because of planted bug 3, then Kane's adaptive healing re-authored their steps until they passed, and Ditto took those passes. Ditto now takes a healed pass after a failed check (`assertion_failed`) only if a fresh Kane run, authored from the plain-English test without the old recording, passes too (`failedAtCheck` in `src/engine/loop.ts`, unit-tested in `test/kane.test.ts`).

To measure the change, the same broken build (commit `a150b02`, in a separate worktree) was checked again with `npm run ditto -- check --config ditto.recheck.config.json --label Re-check` (`cases/todomvc-recheck/case.json`): 6 behaviours confirmed different instead of 2 (4 of them from planted bug 3), 1 unsure instead of 3, 11 the same, and all 3 planted bugs confirmed in that one check. This is one re-run of a tool whose verdicts vary between runs: two of the extra differences came from tests that were "unsure" before and were settled by fresh authoring, not by the new rule. 37 Kane runs, 539 credits. Of the three healed passes the rule sent to a fresh run, two came back as confirmed differences (both bug 3) and one (`mark-all-reactivates-every-completed-todo`, whose recording trips on the React markup on every port) passed.

A stricter rule is only useful if it doesn't cry wolf, so it was also run on a build with nothing planted: the clean Sonnet port (`npm run ditto -- check --config ditto.clean-recheck.config.json --label Re-check`, kept out of the console; summary in [`clean-recheck.json`](clean-recheck.json)). Result: 18/18 the same, 24 Kane runs (19 pure replays), 124 credits. The rule doubted one healed pass (`mark-all-reactivates-every-completed-todo`) and its fresh run passed.

The fixer never saw the breaker's list: `npx tsx scripts/audit-fixer.ts cases/todomvc-mutation` reads Claude Code's own transcript of the fixer session and finds 24 tool calls, none of them touching the list or Ditto's work folder.

## 5. A behaviour no test covers

Parity only means something for the behaviours the suite checks. The mutation run showed where that ends. Fixing planted bug 1 (Escape saved the edit), Claude Code also removed a quirk of the old app: in the jQuery app, if you empty a title while editing and press Escape, the todo is deleted ([`app.js`](../fixtures/legacy-todomvc/app.js) checks for an empty value before it checks for Escape). The fixed port keeps the todo. No test in the suite does that, so Kane reported 18/18.

We spotted it reading the fixer's diff (commit `62752c5` on the [`ditto/mutation-check`](https://github.com/itssaharsh/todomvc-react-port/commits/ditto/mutation-check) branch), then asked Kane to look at both apps with one plain-English objective ([`scripts/edge-check.ts`](../scripts/edge-check.ts), results in [`edge-check.json`](edge-check.json)):

> Create a todo titled 'Pay rent' using the new-todo input. Double-click the 'Pay rent' label to edit it. In the edit field, select all of its text and delete it (Ctrl+A, then Backspace) so the field is completely empty, and only then press Escape; then assert that the todo list no longer contains a todo titled 'Pay rent'.

| App | Kane | Credits | Kane's summary |
|---|---|---|---|
| jQuery (old app) | pass | 20 | removed the “Pay rent” todo on the todo list |
| React port after the fixes | test_issue (`710`, Kane blames the check) | 16 | The check expected Escape to save an empty edit and remove the todo, but Escape cancels the edit and keeps the original todo. |

![The old app after the check: the list is empty](edge-check/legacy/10-0-10-screenshot.jpg) ![The fixed port after the check: Pay rent is still there](edge-check/rewrite/13-0-13-screenshot.jpg)

Kane's runs show the difference: the old app deleted the todo, the port kept it. Kane did not call that a bug in the port; it blamed the check (`710`), judging the port's behaviour right by the spec ("If escape is pressed during the edit, the edit state should be left and any changes be discarded"). So the fixer's change is arguably an improvement, but it is still a change users of the old app could notice, and Ditto only caught it because a person read the diff. The fix for the method is the obvious one: add the sentence to the suite, and the oracle decides which behaviour is the reference.

## 6. Kane's own check of the evidence

Every screenshot on the site was copied out of a sealed Kane evidence pack. `npx tsx scripts/validate-evidence.ts` runs `kane-cli evidence validate --json` (profile L1, local, no credits) on every pack Kane wrote during the recorded runs and writes [`evidence-validation.json`](evidence-validation.json): 300 of 301 packs valid. The invalid one (16 Nov 13:06 UTC, `blank-new-todo-submissions-do-not-add-a-todo` on the old app) has no steps: Kane's browser stopped before the first one. Ditto recorded that run as an error ("Kane could not finish"), ran the test again, and never counted it. The warnings Kane lists (mostly `l1.failure.status_disagrees`: a failure record says "broken" where the step says "failed") are about how Kane labels failed steps, not about missing evidence.

## 7. An answer key from someone else

The tests above only use bugs we planted. To score Kane on bugs nobody planted, we took the issues someone else filed against the official TodoMVC implementations on 6 Nov 2026 ([tastejs/todomvc #2309–#2315](https://github.com/tastejs/todomvc/issues/2309), found with a different AI browser agent and re-checked by its author with Playwright). Kane never saw them. Ditto replayed the 18 jQuery recordings on five of those implementations, unchanged at commit `ff43b02` (configs `ditto.impl-*.config.json`, cases `cases/todomvc-impl-*`).

[`scripts/answer-key.ts`](../scripts/answer-key.ts) maps each of the 14 bug claims in the issues to the tests that exercise it and scores Kane's recorded result ([`answer-key.json`](answer-key.json)). Each row also carries a note written by hand after reading Kane's verdict and screenshots; the script refuses to run if a case's outcome no longer matches the note it was written for.

[`scripts/recheck-impls.mjs`](../scripts/recheck-impls.mjs) is the second opinion: 17 plain Playwright checks, no AI, on the same builds ([`impl-recheck.json`](impl-recheck.json)). The jQuery app passes all 17. 13 of the 14 claims reproduce; the 14th ("double-click enters editing only intermittently") entered edit mode 10 times out of 10.

Of the 10 claims the 18 tests reach, Kane confirmed 4 with a matching reason, missed 5, and stopped at an earlier step on a false alarm for 1. It also reported one bug that is not in the issues: in the ES6 build, clicking the mark-all checkbox itself, or pressing Space on it, ticks the box and completes nothing, because the build listens for clicks on the label only. The Playwright check confirms it. Two of Kane's differences were false alarms (Web Components' Completed filter works; Lit's new-todo field is focused, inside its shadow DOM).

## 8. What a replay can't see: the replay audit

Two of Kane's misses on the official builds are visible in its own screenshots (ES6 puts "Call home" above "Buy milk" in the append test; Web Components shows an empty row and "1 item left!" after a spaces-only entry). Rewriting the two sentences to say exactly what to look at ([`suites/todomvc-strict/`](../suites/todomvc-strict), configs `ditto.strict-es6.config.json` and `ditto.strict-wc.config.json`) caught the Web Components bug, but on ES6 the replay passed again: "the upper row reads 'Buy milk' and the lower row reads 'Call home'", with Call home on top.

A replay re-runs the checks Kane compiled when it recorded the test, not the sentence. In the recording (`output-<test>/.internal/steps/*/flows/*/actions.ndjson`, analyze actions), "the lower todo row" was saved with the locator `internal:role=listitem >> internal:has-text="Call home"i` and the expected value "Call home": the row is found by the text the check then compares, so the check can't fail on order. Trimming checks carry a `strip` transform, so they can't fail on untrimmed text. "Its focused edit input contains 'Review proposal'" compiled to `el(10).value`, which never reads focus.

[`src/engine/replay-audit.ts`](../src/engine/replay-audit.ts) reads those compiled checks and flags three patterns: a locator that matches the check's own expected text; `strip` in a step about trimming (it says "trim", or types a value with spaces at either end); a step that says "focused" with no check reading `:focus` or `activeElement`. `npx tsx scripts/replay-audit.ts` prints them: 4 of the 18 parity tests have one (`enter-appends-…`, `enter-saves-a-trimmed-…`, `escape-discards-…`, `empty-edited-titles-…`). Unit tests: [`test/replay-audit.test.ts`](../test/replay-audit.test.ts), with checks copied from the real recordings.

In `checkOne`, a replay's pass on a flagged test only counts once a fresh Kane run, authored from the sentence on the rewrite, agrees (`replayAudit` in the config, on by default). `ditto check --fresh` skips replays altogether, and `--new-round` keeps earlier results in the case.

| Run | Replay | Fresh run | Credits (fresh) |
|---|---|---|---|
| ES6, rewritten order sentence (`check --fresh`) | pass | mismatch: "Adding 'Call home' put it above 'Buy milk' instead of below it." | 18 |
| ES6, original append sentence (audit) | pass | pass | 82 |
| Lit, the 4 flagged tests (audit) | 4 pass | Escape pass; 3 test_issue (Kane blamed its own steps around edit mode) | 162 |
| Clean Sonnet port, 2 flagged edit tests (audit, [`clean-recheck.json`](clean-recheck.json)) | 2 pass | trimmed-title pass; empty-edit test_issue (also test_issue on Lit) | 43 |

No fresh run produced a false "different". The rule costs a fresh run per flagged test and can turn a pass into "unclear"; it finds a wrong order only when the sentence names the order. Untrimmed titles and an unfocused field passed every Kane run, replayed or fresh; the Playwright checks in §7 found them.
