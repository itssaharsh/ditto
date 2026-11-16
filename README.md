# Ditto: Did the rewrite break anything?

**Let an AI agent rewrite your frontend. Kane CLI runs the same plain-English tests on the old app and on the rewrite, and sends every difference back to the agent until the two behave the same.**

[Live replay of the runs](https://itssaharsh.github.io/ditto/) · [The React port Claude wrote](https://github.com/itssaharsh/todomvc-react-port) · [The planted-bug commits](https://github.com/itssaharsh/todomvc-react-port/commits/ditto/mutation-check) · [How it works](docs/how-it-works.md) · [Testing](docs/testing.md)

![Ditto console: a planted bug, Kane's verdict, Claude's fix and the same test passing, with Kane's screenshots of both apps](docs/console.png)

```mermaid
flowchart LR
  spec[App spec] -->|kane-cli design tests| tests[28 plain-English tests]
  tests -->|Kane runs them on the old app| ref[18 the old app passes:<br/>the referee]
  ref -->|Kane replays them on the rewrite| rw[Claude Code's rewrite]
  rw -->|a difference: Kane's verdict<br/>and both screenshots| fix[Same Claude Code session fixes]
  fix -->|Kane checks again| rw
  rw -->|18 of 18 the same| done[Parity]
```

## The closed loop, on bugs nobody told it about

A rewrite that matches first time doesn't show the tests would catch a regression. So a second Claude Code session broke the finished React port on purpose and wrote down what it did, outside the repository. A fresh Claude Code session then got only what Kane found:

| Planted bug (the breaker's words) | What Kane reported | Fixed |
|---|---|---|
| Pressing Escape while editing a todo saves the edited text instead of discarding it | **Escape discards a todo title edit**, a confirmed difference on the broken build: "Pressing Escape left edit mode but kept the replacement title instead of restoring the original title." | round 1, `TodoItem.tsx` |
| Counter reads "0 item left" instead of "0 items left" | **Completed todos leave the active counter at zero**, a confirmed difference: "After all todos are completed, the footer does not meet the required zero-item counter format." | round 1, `Footer.tsx` |
| Toggle-all shows as checked while one todo is still active | The same counter test, still different after round 1: "The mark-all control does not complete the remaining 'Book the dentist' todo, so the list cannot reach zero items." (On the broken build, Kane's replays of two other tests had already failed at their checks because of this bug, but healing passed them. See [what the run taught Ditto](#what-the-planted-bugs-taught-ditto).) | round 2, `App.tsx` |

Kane then replayed all 18 behaviours on the fixed port: **18 of 18 the same**. 61 Kane runs (40 pure replays of the old app's recordings), 480 credits. The commits are on the [`ditto/mutation-check`](https://github.com/itssaharsh/todomvc-react-port/commits/ditto/mutation-check) branch: `a150b02` (breaker), `62752c5` and `40f2c99` (fixer).

### What the planted bugs taught Ditto

On the broken build, Kane's replays of two tests the third bug breaks failed at their checks. Kane said so in plain words: "After the mark-all action, the All list still shows two incomplete todos". Then Kane's adaptive healing re-authored the steps until those tests passed, and Ditto counted the healed passes. The bug still surfaced one round later, through the counter test, but a healed pass had hidden a real regression.

So Ditto changed one rule: when a replay fails at a check and healing then passes it, the pass only counts if a fresh Kane run, written from the plain-English test without the old recording, passes too. The console marks the old healed passes "healed past a failed check" so you can see which ones they were.

Then we checked the same broken build (commit `a150b02`) again with the new rule ([live](https://itssaharsh.github.io/ditto/?case=todomvc-recheck)):

| The broken build, first check | Old rule (planted-bug run) | New rule (re-check) |
|---|---|---|
| Confirmed differences | 2 | **6** |
| Kane unsure | 3 | 1 |
| Same | 13 | 11 |
| Planted bugs confirmed in the first check | 2 of 3 | **3 of 3** |
| Credits | 331 | 539 |

Kane's verdicts now name the third bug directly: "Using Mark all as complete did not complete every todo in the All list." Where healing had been right (`mark-all-reactivates`, whose old recording trips on the new markup on every port), the fresh run passed, so the stricter rule added no false failures. It costs one fresh Kane run per doubtful heal.

## Everything we ran (16 Nov 2026, all real runs)

| Run | Result |
|---|---|
| Kane designs the tests from the [TodoMVC spec](fixtures/app-spec.md) | **28 tests** from 9 use-cases, each step tagged with the acceptance criteria it checks |
| Kane runs them on the official jQuery app (the referee) | **18** pass and replay cleanly · **1** confirmed spec deviation: the official jQuery build ships with storage switched off, so every todo vanishes on reload · 9 not verified (Kane judged the test or its recording unreliable on the old app) |
| Claude Code (Sonnet 5.5) ports the app to React | **18/18 the same** on the first port: 17 pure replays of the jQuery recordings, 1 healed, **18.5 credits** |
| Claude Code (Haiku 5.5, 40-turn budget) ports it again | **18/18 the same**: 22 of 24 Kane runs were pure replays, **7.4 credits** for the whole check |
| A refactor in a Claude Code session, guarded by the Stop hook | Claude said "it type-checks, but I haven't run it in a browser"; Kane replayed all 18 behaviours before it could stop: **18/18, stop allowed** |
| Spec gaps: what the spec asks and the old app never did | Kane ran those tests on the port: **3 failed** (one a confirmed difference: "reloading does not restore the saved todo"). Claude Code added localStorage persistence from Kane's findings; Kane re-checked: **3/3 pass**, and the 18 parity behaviours still **18/18** |
| Bugs planted on purpose (above) | Kane confirmed 2 on the broken build and the third after the first fix; Claude Code fixed all 3 from Kane's findings alone in 2 rounds, **18/18** again |
| The same broken build, re-checked with the new heal rule | **6 confirmed differences** covering all 3 planted bugs in one check (was 2), 1 unsure, 539 credits |

The four recorded runs together: 273 Kane runs and about 3,300 credits, most of it recording the old app once.

## What Ditto can't see

- **Behaviour no test covers.** Fixing planted bug 1, Claude also dropped a quirk of the old app: empty a title while editing and press Escape, and the jQuery app deletes the todo, while the fixed port keeps it. No test does that, so Kane reported 18/18. We spotted it reading the fixer's diff, then ran Kane on both apps: its two runs show the old app deleting the todo and the port keeping it, and Kane blamed the check rather than the port, since the spec says Escape discards changes ([both runs, with screenshots](docs/testing.md#5-a-behaviour-no-test-covers)). Parity is only as wide as the suite.
- **Tests Kane can't run cleanly on the old app** (9 of 28 here) are left out, never guessed. A wrong test can't blame the new code, but it can't protect it either.
- **The old app has to run.** Ditto needs a working build of it to record the referee.
- **Kane is sometimes unsure whose fault a failure is** (`710`). Ditto retries, heals, then has Kane author the test fresh on the rewrite; whatever is still unclear is shown as unclear, not counted as a pass or a fail.

## For judges (60 seconds)

1. Open the [live replay](https://itssaharsh.github.io/ditto/). It opens on a planted bug: Kane's verdict on the broken build, Claude's fix, and the same test passing, with Kane's screenshot of both apps at every step. Click a screenshot to enlarge it.
2. Scroll to **3 bugs planted on purpose**: the breaker's list beside what Kane reported each round, and the rule this run made Ditto change. The **Broken build, re-checked** tab shows that rule at work on the same broken build.
3. Press **Watch the whole run in 60 seconds** to see it happen in order.
4. Switch to **Sonnet 5.5 port** for the first port, the Stop-hook round and the spec-gap fix, or **Haiku 5.5 port** for a second agent judged by the same tests.
5. Try the apps yourself: [the original jQuery app](https://itssaharsh.github.io/ditto/legacy/), [the Sonnet port](https://itssaharsh.github.io/ditto/port/) (reload it: your todos stay) and [the Haiku port](https://itssaharsh.github.io/ditto/port-haiku/).

To run it on your machine, see [Run it](#run-it).

## The idea: the old app is the test oracle

Rewrites and big refactors are where users get hurt: the Escape key that used to cancel an edit now saves it, a filter forgets itself on reload. AI agents make rewrites cheap, so they happen more, and review can't keep up.

Ditto turns "nothing changed for users" into something you can check:

1. **Kane writes the tests from your spec.** `kane-cli context ingest` + `design tests` turn the spec into plain-English `_test.md` files, each step tagged with the acceptance criterion it verifies. No selectors.
2. **The old app is the reference.** Every test runs on the legacy app first. Only tests the old app passes judge the rewrite, so a wrong test can never blame the new code. Kane records each passing test so it replays in seconds.
3. **The same recording judges the rewrite.** Claude Code ports the app without seeing the tests. Kane replays the legacy recordings on the port (`--override-start-url --local`). Same behaviour and same markup: a pass in seconds for about zero credits. Different markup: Kane re-authors just those steps and judges again. Different behaviour: a confirmed difference with a verdict and screenshots.
4. **Every confirmed difference goes back to the agent.** Ditto resumes the same Claude Code session with that test's steps, Kane's verdict word for word, the rewrite's screenshot and the legacy app's screenshot at the same step, and the browser console. Claude fixes; Kane re-checks; repeat until parity, then one more full replay to catch regressions.

## How Kane and the agent talk

| Kane says | Ditto does |
|---|---|
| pass | nothing; the behaviour matches |
| `740` confirmed application difference on the rewrite | sends it to Claude Code (`claude -p --resume`) with the verdict, root cause, failing check, both screenshots and console errors |
| `710` Kane blames the test | re-runs with healing, then has Kane author the test fresh on the rewrite; never sent to the agent as a confirmed bug (`ditto fix` can send it labelled "Kane unsure whose fault") |
| `510` environment problem (e.g. the browser dropped) | re-runs; never counted |
| the replay failed at a check, then healing passed it | a fresh Kane run, written from the plain-English test without the old recording, decides (healing can step around a real regression) |
| the port does not build | sends the build error to Claude before spending Kane credits |

Every decision is saved in the case file and shown in the console as **Kane said → Claude did**.

Also: `ditto hook install` puts the same check on your own interactive Claude Code session as a Stop hook.

## Kane CLI features Ditto uses

- **Assurance pipeline:** `context ingest` → `context review --approve` → `design tests` (use-cases cited to the spec, acceptance criteria, scenarios, one `_test.md` per scenario).
- **`testmd run`** with variables (`{{start_url}}`), **replay from cache**, **`--override-start-url`** to retarget a recording at another build, **`--local`** so the legacy recording is never overwritten, **`--no-adaptive-heal`** for pure replays and adaptive healing when markup changed.
- **`--bug-detection continue`** verdicts (740 vs 710 vs 510) to route each result.
- **Evidence packs:** per-step screenshots, annotated frames, failure records and console logs, copied into the case (account details are never copied).
- **Test Manager**: every authored run is uploaded; the case keeps its share link.

## Look around without Kane or credits

Every recorded run is in the repository, so you can read it in a terminal or open the console locally with nothing but Node:

```bash
git clone https://github.com/itssaharsh/ditto && cd ditto && npm install
npm run ditto -- status --config ditto.mutation.config.json --loop   # the planted-bug run: every round, what Kane said, what Ditto did
npm run web:build && npm run ditto -- ui                             # the console on http://127.0.0.1:4747, replaying the same runs
npm test                                                             # unit tests, fed with real Kane CLI output
```

## Run it

You need Node 22, [Kane CLI](https://www.testmuai.com/support/docs/kane-cli-introduction/) (`npm i -g @testmuai/kane-cli`, then `kane-cli login`), Google Chrome, and [Claude Code](https://code.claude.com) signed in.

```bash
git clone https://github.com/itssaharsh/ditto && cd ditto && npm install
npm run ditto -- doctor     # checks Node, Kane CLI (signed in, credits), Chrome, Claude Code

npm run ditto -- design     # Kane designs the tests from fixtures/app-spec.md (≈200 credits)
npm run ditto -- record     # run them on the legacy app (the oracle): the expensive step, done once
                            #   (here 74 Kane runs, ≈1,000–2,000 credits); later checks mostly replay for ≈0
npm run ditto -- loop       # Claude Code ports the app; Kane checks; differences go back until parity
npm run ditto -- status     # the parity table in your terminal

npm run ditto -- spec-gaps  # behaviours the spec asks for that the old app never met
npm run ditto -- mutate --config ditto.mutation.config.json   # plant bugs in a copy of the port; the loop must catch them
npm run ditto -- fix        # continue fixing from the last recorded check

npm run web:build && npm run ditto -- ui    # the console, live while a loop runs
```

Point it at your own app by editing `ditto.config.json` (legacy folder or URL, spec, rewrite repo, build command, ports). On Linux without Google Chrome, set `KANE_CLI_CHROME_PATH` to any Chromium binary.

## Keep the suite: CI on the rewrite

At parity Ditto copies the tests into the rewrite repo (`tests/kane/`), writes the start URL and test values to `.testmuai/variables/ditto.json`, and adds a workflow ([`examples/ci/kane-behaviour-tests.yml`](examples/ci/kane-behaviour-tests.yml)) that runs them with TestMu's official `kane-cli-browser-run` action. The checks that judged the rewrite keep guarding it.

## What's real

| Part | Status |
|---|---|
| The legacy app | Real: the official [TodoMVC jQuery example](https://github.com/tastejs/todomvc/tree/master/examples/jquery) (MIT), vendored byte for byte from its `dist/` in `fixtures/` |
| The spec | Real: TodoMVC's `app-spec.md` |
| The tests | Designed by Kane CLI from the spec; not edited by hand |
| The ports and every fix | Written by Claude Code (Sonnet 5.5, and Haiku 5.5 for the second port) in [todomvc-react-port](https://github.com/itssaharsh/todomvc-react-port); one commit per round |
| The planted bugs | Written by a separate Claude Code session; its list was kept outside the repository until the run ended |
| Every pass, fail, verdict and screenshot | Real Kane CLI runs, recorded in `cases/*/case.json` |
| The note about the untested Escape quirk | Found by a person reading the diff, then looked at with two Kane runs ([`docs/edge-check.json`](docs/edge-check.json)): a pass on the old app, and a `710` on the port, where Kane blamed the check |
| Live mode on the website | Not hosted: the site replays the recorded runs. Live runs need Kane and Claude Code on your machine. |

## Built with

Ditto itself was built with **Claude Code**. Its console is checked by Kane too: [`suites/console/`](suites/console) holds the plain-English tests Kane runs against it ([results](docs/testing.md#3-kane-on-dittos-own-console-suitesconsole)).
