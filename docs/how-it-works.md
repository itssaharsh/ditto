# How Ditto works

Ditto answers one question before you merge an AI rewrite: **does the new app behave like the old one, everywhere your users can tell?**

It does that with three actors:

| Actor | Job |
|---|---|
| **Kane CLI** (TestMu AI) | Turns the spec into plain-English tests, runs them in a real Chrome, and judges every result (pass, confirmed app difference, or "the test itself was wrong"). |
| **Claude Code** (headless, `claude -p`) | Ports the app without seeing the suite, then fixes whatever Kane says differs. For each difference it gets that test's steps, Kane's verdict and two screenshots, never the rest of the suite. |
| **Ditto** | The loop between them: it schedules Kane runs, routes every Kane result to the right next step, and records everything in one case file. |

## 1. Design: Kane writes the tests from your spec

```
kane-cli context ingest spec.md --mode override     # every use-case is cited back to the spec
kane-cli context review --approve uc-1 … uc-9       # approve the extracted use-cases
kane-cli design tests --use-case uc-4 --mode override --json   # criteria → scenarios → one _test.md each
```

`ditto design` runs these for every use-case. For the TodoMVC spec Kane found 9 use-cases and wrote 28 tests. Every step says which acceptance criterion it verifies:

```markdown
## Step 3 @verifies ac-2, ac-7
In that todo's edit input, replace the title with 'Review contract' and press Escape,
then assert the item's editing class is absent and its displayed title remains 'Review proposal'.
```

No selectors, no framework code. The start URL is a variable (`{{start_url}}`), so the **same file** runs on both apps.

## 2. Record: the legacy app is the oracle

`ditto record` runs every test on the legacy app. A test only joins the parity set once the old app passes it. That protects the rewrite from tests that are simply wrong.

Kane authors each test the first time (an AI works out the steps in the browser) and commits a recording. From then on the test **replays from cache in seconds at about zero credits**.

When the legacy app fails a test, Ditto runs it once more before believing it: Kane's judgement can be wrong once, so a deviation of the reference has to reproduce. If it does, Ditto lists it as a place where the old app already differs from its own spec and leaves it out of parity (you decide what's right). If the second run passes, the behaviour stays in. Tests that Kane itself calls unreliable (`710`) or could not run (`510`) get another chance and are otherwise marked "not verified", never blamed on either app.

A pass has to hold up too: Ditto replays every passing test from its own recording on the old app once more. A recording that doesn't replay cleanly on the app it was made on can't judge another app, so that test is left out as "not verified".

These two rules are why the TodoMVC referee is 18 tests and not 21. The first recording of the old app (16 Nov, 13:04–13:39 UTC, logged in `cases/todomvc/case.json`) counted 21 passes before the rules were in place. Recording again with them: 5 tests that had passed once did not replay cleanly, and 2 that had failed once passed on both reruns (Kane's first verdict was wrong). 21 − 5 + 2 = 18.

## 3. Port: Claude Code rewrites the app

`ditto loop` asks Claude Code to port the app (jQuery → React + TypeScript + Vite here). The prompt is what a developer would type: keep the look and the behaviour. The agent reads the legacy code; it does not see the suite.

## 4. Check: the same recording, replayed on the rewrite

For every oracle test Ditto runs:

```
kane-cli testmd run <test>_test.md --override-start-url <rewrite> --local --no-adaptive-heal --bug-detection continue
```

- `--override-start-url` points the **legacy recording** at the new app.
- `--local` keeps the legacy recording untouched (nothing is written back or uploaded).
- `--no-adaptive-heal` makes this a pure replay: if the new app behaves the same and keeps the same markup, it passes in seconds for about zero credits.

If the pure replay misses, Ditto runs the same test again with Kane's adaptive healing on: Kane re-authors only the steps that missed on the new markup and judges again. A pass after healing means "different markup, same behaviour". A fail is a real difference. If Kane still can't give a clean verdict, it authors the same test from scratch on the rewrite, without the legacy recording.

Every rewrite run is also checked for where it went: if any step's page was on the legacy app's address (an absolute URL recorded in a step would do that), the run is not counted.

## 5. Route every Kane result (the closed loop)

| Kane says | Ditto does |
|---|---|
| `pass` | Behaviour matches. Nothing to do. |
| `740` confirmed application issue on the rewrite | Sends it to the **same Claude Code session** (`--resume`) with Kane's verdict word for word, its root cause, the failing check, the rewrite's screenshot, the legacy app's screenshot and the console errors. |
| `710` Kane blames the test | Re-runs with healing, then has Kane author the test fresh on the rewrite. Still unclear: shown as unclear and never counted. `ditto fix` can send it to the agent under a separate heading, "Kane unsure whose fault; the old app passes this test", never as a confirmed bug. |
| `510` / environment issue (e.g. the browser dropped) | Re-runs; never counted as a difference. |
| The replay failed at a check, then healing passed it | Doesn't take the healed pass on its own: Kane authors the test fresh on the rewrite, without the old recording, and that run decides. Healing is for markup that moved; the planted-bug run showed it can also step around a real regression. |
| The build fails | Sends the build error to Claude before spending any Kane credits. |

After each fix round Ditto re-checks only what failed, then replays everything once more to catch regressions (cheap, because passing tests replay from cache). It stops at parity or after `maxRounds`.

Every decision is written to the case file as **"Kane said → Ditto did"**, and the console shows that list.

## 6. Interactive mode: a Stop hook

`ditto hook install` adds a Stop hook to the rewrite repo's `.claude/settings.local.json` (local, never committed). When your own Claude Code session tries to finish, Ditto builds the app and has Kane replay the legacy behaviours first. If anything differs, the stop is blocked and the findings go back into your session; after four blocks it lets go and asks for a person.

## 7. Checking the checker: plant bugs on purpose

A port that matches first time doesn't show the tests would notice a regression. `ditto mutate` asks a second Claude Code session to break a copy of the finished port in a few ways a user would notice, and to write down what it changed in `.ditto-work/` (outside the repository, so the fixer can't read it). Ditto then runs the normal check and fix rounds with a fresh Claude Code session that sees only Kane's findings. In the recorded run Kane confirmed 2 of the 3 planted bugs on the broken build and the third after the first fix round, and the fixer repaired all 3 in 2 rounds; the console shows the breaker's list beside what Kane reported each round. With the healing rule below, a re-check of the same broken build confirmed all 3 in one check.

The same run showed the method's edge: the fixer's repair also changed a behaviour no test covers. See [Testing §5](testing.md#5-a-behaviour-no-test-covers).

## The case file

`cases/<case>/case.json` holds the suite, the oracle, every round (agent turn, build, Kane results with screenshots copied from Kane's evidence packs), every decision and the totals. The console renders it live (polling) and the published site replays the same file with no backend.

Ditto copies only screenshots, step summaries, failure messages and console errors out of Kane's evidence packs. It never copies `result.yaml` or the replay recordings, which contain account details.
