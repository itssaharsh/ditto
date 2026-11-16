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
| TestMu AI / Kane CLI | credits | 11,127 on 16 Nov (10k offer claimed by user); ≈6,660 at 19:30 UTC | replays preferred |
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

## Mutation check and edge check (16 Nov, real runs)
- Case `todomvc-mutation` (config `ditto.mutation.config.json`, oracleCase todomvc, worktree `../todomvc-react-port-mutation` on branch `ditto/mutation-check`, port 7004): a breaker Claude Code session planted 3 bugs (answer key in `.ditto-work/mutations/todomvc-mutation/answer-key.md`, outside the repo). Kane on the broken build: 2 confirmed differences (escape, counter-at-zero) + 3 test_issue. Fix round 1 (fresh fixer session) fixed Escape + plural; Kane still flagged counter-at-zero (mark-all couldn't complete the last todo); fix round 2 fixed mark-all (App.tsx). Final replay 18/18. 61 Kane runs, 40 pure replays, 480 credits, $0.71 at API prices. Commits a150b02 (breaker), 62752c5, 40f2c99 (fixer), branch pushed.
- The fixer over-corrected: its Escape repair also dropped the legacy quirk "empty title + Escape deletes the todo" (no test covers it). `scripts/edge-check.ts` ran one objective on both apps: legacy pass (todo deleted, 20 cr); port 710 (Kane: "Escape cancels the edit and keeps the original todo", judged the port right by the spec, 16 cr). First attempt was inconclusive (Kane pressed Escape before clearing); objective made explicit. Shown as the case `caveat` + README + docs/testing.md §5.
- Kane balance 6,696 before the edge check (≈ 6,660 after).

## Lessons (16 Nov evening)
- A plain `1fr` grid column grows to its items' min-content: a nowrap filename with ellipsis still widened the phone layout. Use `minmax(0, 1fr)`.
- Count "spec met" only when the rewrite failed first and passed after a fix; an immediate pass on a test the old app couldn't run proves nothing.
- Kane screenshots a key press before its effect lands: show what Kane was doing under each frame.
- Python Playwright (foldcheck) needs `LD_LIBRARY_PATH=$HOME/.local/lib/kane-chrome/lib` on this machine.

## Red-team 2 (16 Nov ~20:00 UTC, hackathon-idea/kanecli-online-nov/redteam-2.md)
- Scores: Ships 8, Verified 6.5, Closed loop 8.5, Craft 7. Biggest risk: on the broken build Kane's replays of `mark-all-checks` and `two-active-todos` FAILED AT THEIR CHECKS (bug 3's effect, Kane described it), but adaptive heal re-authored steps and passed them; Ditto took the healed pass. So "Kane caught all 3" was overstated: 2 confirmed directly, bug 3 only after round 1 via the counter test.
- Fixed: engine rule (loop.ts checkOne): a healed pass after a replay failed at a check (`reason ~ assertion_failed`) needs a fresh authored run to agree (`failedAtCheck`). Claims reworded ("Kane's findings led Claude Code to all 3"), card shows how the 18 were last checked, table marks "healed past a failed check", Escape note says Kane blamed the check (710), oracle 21→18 explained (replay-verified passes + confirm-twice failures), fixer transcript audit (24 tool calls, 0 touching the answer key; scripts/audit-fixer.ts), status --loop, LICENSE, OG card.
- Re-check DONE (case todomvc-recheck, worktree ../todomvc-react-port-broken at a150b02, port 7005): new rule → 6 confirmed differences (was 2), 1 unclear (was 3), 11 same; all 3 planted bugs in one check; 37 Kane runs, 539 credits. Refused heals: mark-all-checks → fresh mismatch, two-active → fresh mismatch, mark-all-reactivates → fresh pass (legit heal). Published as 4th tab; mutation case has followUp link.
- Clean-port validation of the rule (ditto.clean-recheck.config.json, private casesDir .ditto-work/cases-validate, summary docs/clean-recheck.json): Sonnet port 18/18, 24 Kane runs, 124 credits; the one doubted heal (mark-all-reactivates) passed its fresh run. Red-team re-audit: Ships 8, Verified 7.5, Closed loop 8.5, Craft 7.5.
- `ditto index` used to construct the loop (which saved cases/todomvc/case.json, bumping updatedAt); now runs before the loop opens a case.
- Kane replays vary between runs on the same build (completed-route passed in round 0, failed on re-check replay).

## Evidence integrity (16 Nov ~21:40 UTC)
- `kane-cli evidence validate --json` is local and free (~2.5 s per pack). scripts/validate-evidence.ts: 300/301 packs valid (L1); the invalid one is the 13:06 UTC oracle run whose browser died before step 1 (logged as error, never counted). docs/evidence-validation.json.

## Checkpoint (16 Nov ~21:15 UTC): ready for the user's hand-off
- Video: qa/video/ditto-demo.mp4 (169 s; segments trimmed of page loads), thumbnail qa/video/thumbnail.png (git-ignored; re-record with `node scripts/video/record.mjs`).
- TestMu Slack (#kane-cli-hacakathon C0BS5K131NU, #general) read with the user's OK: no Nov rule changes; previous edition used a SurveyMonkey form and extended its deadline once. Nothing posted.
- Kane credits 5,575 left at 21:15 UTC (11,127 on 16 Nov morning). Waiting on the user: YouTube upload, two posts, form, kaneclihack.sh registration; add the video link to README when given.

## Checkpoint (16 Nov ~19:30 UTC)
- Everything committed and pushed; site redeployed with the mutation case as default; fold check PASS on the live URL.
- Running: Kane self-test of the redeployed console (scripts/selftest-console.ts → qa/console-selftest.json, then copy to docs/).
- Next: re-record the video, fresh red-team + scorecard, launch drafts, hand-off message.

## Next actions
See `TASKS.md`.
