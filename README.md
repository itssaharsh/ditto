# Ditto: Did the rewrite break anything?

**Let an AI agent rewrite your frontend. Kane CLI runs the same plain-English tests on the old app and on the rewrite, and sends every difference back to the agent until the two behave the same.**

[Live replay of the run](https://itssaharsh.github.io/ditto/) · [The React port Claude wrote](https://github.com/itssaharsh/todomvc-react-port) · [How it works](docs/how-it-works.md) · [Testing](docs/testing.md)

![Ditto console: the Kane test file with screenshots of the old app and the rewrite for every step](docs/console.png)

## What happened when we ran it (16 Nov 2026, all real runs)

| Step | Result |
|---|---|
| Kane designs the tests from the [TodoMVC spec](fixtures/app-spec.md) | **28 tests** from 9 use-cases, each step tagged with the acceptance criteria it checks |
| Kane runs them on the official jQuery app (the oracle) | **18** pass and replay cleanly · **1** confirmed spec deviation: the jQuery app loses every todo on reload · 9 not verified (Kane judged the test or its recording unreliable) |
| Claude Code (Sonnet 5.5) ports the app to React | **18/18 the same** on the first port: 17 pure replays of the jQuery recordings, 1 healed, **18.5 credits** |
| Claude Code (Haiku 5.5, 40-turn budget) ports it again | **18/18 the same**: 22 of 24 Kane runs were pure replays, **7.4 credits** for the whole check |
| A refactor in a Claude Code session, guarded by the Stop hook | Claude said "it type-checks, but I haven't run it in a browser"; Kane replayed all 18 behaviours before it could stop: **18/18, stop allowed** |
| Spec gaps: what the spec asks and the old app never did | Kane ran those 5 tests on the port: **3 failed** (one a confirmed difference: "reloading does not restore the saved todo"). Claude Code added localStorage persistence from Kane's findings; Kane re-checked: **3/3 pass**, and the 18 parity behaviours still **18/18** |

The whole TodoMVC case used 151 Kane runs (80 pure replays) and about 2,300 credits, most of it recording the oracle once.


## The idea: the old app is the test oracle

Rewrites and big refactors are where users get hurt: the Escape key that used to cancel an edit now saves it, a filter forgets itself on reload. AI agents make rewrites cheap, so they happen more, and review can't keep up.

Ditto turns "nothing changed for users" into something you can check:

1. **Kane writes the tests from your spec.** `kane-cli context ingest` + `design tests` turn the spec into plain-English `_test.md` files, each step tagged with the acceptance criterion it verifies. No selectors.
2. **The old app is the reference.** Every test runs on the legacy app first. Only tests the old app passes judge the rewrite, so a wrong test can never blame the new code. Kane records each passing test so it replays in seconds.
3. **The same recording judges the rewrite.** Claude Code ports the app without seeing the tests. Kane replays the legacy recordings on the port (`--override-start-url --local`). Same behaviour and same markup: a pass in seconds for about zero credits. Different markup: Kane re-authors just those steps and judges again. Different behaviour: a confirmed difference with a verdict and screenshots.
4. **Every confirmed difference goes back to the agent.** Ditto resumes the same Claude Code session with that test's steps, Kane's verdict word for word, the rewrite's screenshot and the legacy app's screenshot at the same step, and the browser console. Results Kane can't call cleanly are never sent as failures. Claude fixes; Kane re-checks; repeat until parity, then one more full replay to catch regressions.

## For judges (60 seconds)

1. Open the [live replay](https://itssaharsh.github.io/ditto/). It opens on the behaviour Kane caught on the rewrite: the old app failing it, Kane's red screenshot of the port (round 2), Claude's fix, the same step green.
2. Click any chip under **Try these**, or any row in **All behaviours**: every screenshot is Kane's, from the recorded run. Click a screenshot to enlarge it.
3. **Kane said → Claude did** (right rail) is the closed loop, round by round. **What each round did** lists every commit.
4. Press **Watch the whole run in 60 seconds** to see it happen in order, or switch to the Haiku 5.5 run.
5. Try the apps yourself: [the original jQuery app](https://itssaharsh.github.io/ditto/legacy/), [the Sonnet port](https://itssaharsh.github.io/ditto/port/) (reload it: your todos stay) and [the Haiku port](https://itssaharsh.github.io/ditto/port-haiku/).

To run it on your machine, see [Run it](#run-it).

## How Kane and the agent talk

| Kane says | Ditto does |
|---|---|
| pass | nothing; the behaviour matches |
| `740` confirmed application difference on the rewrite | sends it to Claude Code (`claude -p --resume`) with the verdict, root cause, failing check, both screenshots and console errors |
| `710` Kane blames the test | re-runs with healing; never reported to the agent as an app bug |
| `510` environment problem (e.g. the browser dropped) | re-runs; never counted |
| the port does not build | sends the build error to Claude before spending Kane credits |

Every decision is saved in the case file and shown in the console as **Kane said → Claude did**.

Also: `ditto hook install` puts the same check on your own interactive Claude Code session as a Stop hook.

## Kane CLI features Ditto uses

- **Assurance pipeline:** `context ingest` → `context review --approve` → `design tests` (use-cases cited to the spec, acceptance criteria, scenarios, one `_test.md` per scenario).
- **`testmd run`** with variables (`{{start_url}}`), **replay from cache**, **`--override-start-url`** to retarget a recording at another build, **`--local`** so the legacy recording is never overwritten, **`--no-adaptive-heal`** for pure replays and adaptive healing when markup changed.
- **`--bug-detection continue`** verdicts (740 vs 710 vs 510) to route each result.
- **Evidence packs:** per-step screenshots, annotated frames, failure records and console logs, copied into the case (account details are never copied).
- **Test Manager**: every authored run is uploaded; the case keeps its share link.

## Run it

You need Node 22, [Kane CLI](https://www.testmuai.com/support/docs/kane-cli-introduction/) (`npm i -g @testmuai/kane-cli`, then `kane-cli login`), Google Chrome, and [Claude Code](https://code.claude.com) signed in.

```bash
git clone https://github.com/itssaharsh/ditto && cd ditto && npm install
npm run ditto -- doctor     # checks Node, Kane CLI (signed in, credits), Chrome, Claude Code

npm run ditto -- design     # Kane designs the tests from fixtures/app-spec.md (≈200 credits)
npm run ditto -- record     # run them on the legacy app (the oracle)
npm run ditto -- loop       # Claude Code ports the app; Kane checks; differences go back until parity
npm run ditto -- status     # the parity table in your terminal

npm run web:build && npm run ditto -- ui    # the console, live while a loop runs
```

Point it at your own app by editing `ditto.config.json` (legacy folder or URL, spec, rewrite repo, build command, ports). On Linux without Google Chrome, set `KANE_CLI_CHROME_PATH` to any Chromium binary.

## Keep the suite: CI on the rewrite

At parity Ditto copies the tests into the rewrite repo (`tests/kane/`), writes the start URL and test values to `.testmuai/variables/ditto.json`, and adds a workflow ([`examples/ci/kane-behaviour-tests.yml`](examples/ci/kane-behaviour-tests.yml)) that runs them with TestMu's official `kane-cli-browser-run` action. The checks that judged the rewrite keep guarding it.

## What's real

| Part | Status |
|---|---|
| The legacy app | Real: the official [TodoMVC jQuery example](https://github.com/tastejs/todomvc/tree/master/examples/jquery) (MIT), vendored unchanged in `fixtures/` |
| The spec | Real: TodoMVC's `app-spec.md` |
| The tests | Designed by Kane CLI from the spec; not edited by hand |
| The port and every fix | Written by Claude Code (Sonnet 5.5) in [todomvc-react-port](https://github.com/itssaharsh/todomvc-react-port); one commit per round |
| Every pass, fail, verdict and screenshot | Real Kane CLI runs, recorded in `cases/todomvc/case.json` |
| Live mode on the website | Not hosted: the site replays the recorded run. Live runs need Kane and Claude Code on your machine. |

## Built with

Ditto itself was built with **Claude Code**. Its console is checked by Kane too: [`suites/console/`](suites/console) holds the plain-English tests Kane runs against it.
