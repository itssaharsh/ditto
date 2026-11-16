# Project memory

## What we are building
**Ditto**: let an AI agent rewrite your frontend; Kane CLI proves your users won't notice.
1. `ditto design`: Kane's assurance pipeline reads the spec (`context ingest` → `extract` → `review --approve` → `design tests`) and writes plain-English `_test.md` behaviours, each step tagged `@verifies ac-N`.
2. `ditto record`: every behaviour runs on the legacy app (the oracle). Failures are listed as places the legacy app already differs from its spec and left out of parity.
3. `ditto loop`: Claude Code ports the app (never sees the tests) → build → Kane replays the legacy recording on the port (`--override-start-url --local --no-adaptive-heal`), and re-authors only on a miss (heal) → each difference (Kane verdict, both screenshots, console) goes back to the same Claude session (`--resume`) → repeat until parity, then replay everything once more.
Entry for the KaneCLI Online Hackathon (TestMu AI), deadline 19 Nov 2026 23:59 IST. Criteria 25% each: Ships, Verified, Closed loop, Craft. Strategy notes: `hackathon-idea/` (git-ignored). Earlier idea "Reproduced" (bug report → repro → fix on a Brewline demo shop) was dropped on 16 Nov; its files are in `hackathon-idea/kanecli-online-nov/shelved/` and `~/contri/brewline`.

## Kane CLI facts learned from real runs (16 Nov)
- `run "<objective>" --agent` streams `{step,status,remark}` lines + `run_end`. `testmd run` streams `test_md_step_start`, `run_start`, `step_start`/`step_event`/`step_end` (with `summary`, `ordinal`, `kind`), one `run_end` per markdown step, then `test_md_summary` (overall_status, steps.replay_decisions/author_decisions, adaptive_heal.triggered, commit.committed, share_url) and `test_md_done`.
- `result_code 740` + `verdict.family=application_issue` = confirmed product bug; `710` + `automation_bug` = Kane blames the test.
- A failed run is not committed to the replay cache. Authoring a 3-step test ≈ 42 credits, 2.6 min; the cached replay ≈ 16 s, 0 credits.
- `--variables '{"start_url":{"value":"…","secret":false}}'` fills `{{start_url}}` in designed tests (recorded as `{{global.start_url}}`).
- `--local` = no upload / no write-back (keeps the legacy recording intact while replaying on the rewrite). `--push` fails under OAuth.
- `--override-start-url` retargets a replay; replay on another build re-checked the assertion and failed with 740 where behaviour differed.
- Kane design: 9 use-cases from the TodoMVC spec; ~15–20 credits and ~1 min per use-case for 3–4 tests.
- Kane's design declares extra variables (`active_todo_title`, `completed_todo_title` in `.testmuai/variables/assurance.json`, names only). Without values Kane types empty text and blames the test (710). Values live in `ditto.config.json` → `variables`.
- A Chrome flake shows as `result_code 510` / `verdict.family environment_issue`: retry, never count it as a difference.
- Recordings (`output-*/.internal/`) and evidence `result.yaml` contain the account email + org id: never publish; `.gitignore` covers them.
- Evidence pack zip: `tests/<stem>/steps/<i>-0-<i>/{step.json,screenshot.jpg,annotated.png,failure.yaml}`, `logs/0-console.ndjson`.

## Legacy app facts (real findings)
- The current official jQuery TodoMVC `util.store` returns `[]`: todos are NOT persisted to localStorage (the spec says they should be).
- In `update`, an empty value destroys the todo before the Escape-abort check, so Escape after clearing the text deletes the todo (spec: Escape discards changes).

## Architecture
- `src/engine/kane.ts` spawn + NDJSON fold + evidence extraction; `suite.ts` test parsing; `design.ts` Kane assurance; `loop.ts` oracle → port → check → fix rounds; `agent.ts` Claude Code headless; `apps.ts` static servers + shell; `case.ts` case file; `config.ts`; `src/cli.ts`.
- Case file `cases/<case>/case.json` (+ `assets/` screenshots) is the source of truth for the console UI (live polling and published replay).
- Kane runs in `.ditto-work/kane/<case>/` (git-ignored) holding run copies of the suite and their recordings.

## Resource inventory (no secret values here)
| Resource | Type | Balance / status | Decision |
|---|---|---|---|
| TestMu AI / Kane CLI | credits | 11,127 on 16 Nov (10k offer claimed by user) | ~2–4k planned; replays preferred |
| Claude Code CLI | user's subscription | 2.1.318 | port + fix agent (`--model sonnet`) |
| Anthropic API key | env `ANTHROPIC_API_KEY` | paid | not used (removed from agent env) |
| GitHub (gh) | itssaharsh | signed in | user approved public repos |
| Vercel | MCP | needs team-access approval | GitHub Pages instead |

## Credits log
- 16 Nov: probes ≈ 49; assurance ingest+design ≈ 200 (28 tests); escape test author 42; first oracle attempt aborted (missing variables) ≈ 120. Balance 10,697 at 13:06 UTC.

## Failed approaches
- `testmd run --push` under OAuth; split verify step (710); Playwright MCP browser (no Chrome) → use kane-chrome wrapper.

## Results so far (16 Nov, real runs)
- Kane design: 28 tests (9 use-cases) from fixtures/app-spec.md.
- Oracle (jQuery): 18 pass + replay-verified; 1 confirmed deviation (reload loses todos); 9 not verified.
- Case `todomvc` (Sonnet 5.5): port 18/18 first try (17 pure replays); round 1 = Stop-hook-guarded refactor (18/18, stop allowed); round 2 = spec check (5 gaps: 2 met, 3 failed incl. one 740); round 3 = Claude added localStorage persistence (commit c202eb6) → 3/3 met, parity replay 18/18. 151 Kane runs, ~2,304 credits.
- Case `todomvc-haiku` (Haiku 5.5, 40 turns): 18/18, 22/24 pure replays, 7.36 credits.
- Repos: github.com/itssaharsh/ditto, /todomvc-react-port, /todomvc-react-port-haiku. Site: https://itssaharsh.github.io/ditto/ (gh-pages via scripts/publish-pages.sh, no force pushes).

## Lessons (engine)
- Replays report the evidence pack only on the `coverage` event; `run_start` has `override_applied`; `step_event` screenshot `detail` = page URL.
- Parallel Kane runs launched together can fail their first navigate: workers are staggered 12 s.
- A recorded absolute navigation can send a replay to the legacy app: the URL guard marks it error; heal/fresh follow.
- Backfill must match Kane sessions on ALL step objectives (normalize `{{global.x}}` → `{{x}}`), never on the first step alone.
- `sh()` must not use a login shell (profile noise leaked into commit fields).
- Force pushes are blocked by the auto-mode classifier: publish with normal pushes only.

## Checkpoint (16 Nov ~15:10 UTC)
- Console served locally by `ditto ui` (4747); legacy 7001 and Sonnet port 7002 (python http.server); everything committed and pushed.
- Running: Kane self-test of the deployed console (scripts/selftest-console.ts → qa/console-selftest.json).
- Next: scan of other TodoMVC implementations (stretch), video, second red-team, scorecard, launch drafts with real numbers.

## Next actions
See `TASKS.md`.
