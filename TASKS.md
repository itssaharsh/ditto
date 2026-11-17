# Tasks

Legend: [x] done and verified · [~] in progress · [ ] to do

## Done
- [x] Event research, idea pick (Ditto; checker 0 FAIL); plan approved by user (16 Nov)
- [x] Kane signed in, Chrome wrapper, 10k credits claimed by user
- [x] TodoMVC jQuery fixture + spec vendored (MIT; app.js byte-identical to upstream dist, storage stubbed upstream)
- [x] Kane assurance: 9 use-cases → 28 designed tests (suites/todomvc), variables supplied
- [x] Engine (kane, case, suite, agent, apps, loop, design, config), CLI (init/doctor/design/record/loop/check/spec-gaps/fix/mutate/scan/index/status/ui/hook)
- [x] Oracle (28 tests; 18 verified, 1 confirmed deviation, 9 not verified)
- [x] Sonnet port 18/18; Haiku port 18/18 (7.4 credits); repos public
- [x] Stop-hook demo (refactor, 18/18 allowed); spec gaps closed (3/3) with a real Kane→Claude→Kane loop
- [x] Mutation check (16 Nov): 3 bugs planted by a second session; Kane confirmed 2 on the broken build and the third after round 1; fixed in 2 rounds from Kane's findings alone, 18/18; branch ditto/mutation-check pushed to the port repo
- [x] Edge check: the fixer's repair also changed an untested quirk (Escape on an emptied title); Kane saw it on both apps (docs/edge-check.json); shown as the run's caveat
- [x] Console: opens on the planted-bug catch with Kane's red/green frames in the strip; honest counts; 390 px layout; mutation section; caveat
- [x] README rewritten (closed loop first, mermaid pipeline, every run, what Ditto can't see, judges' path); docs/testing.md §4–5
- [x] Site deployed (gh-pages) with /legacy, /port, /port-haiku, /port-mutation; fold check PASS on the live URL
- [x] 15 unit tests; typecheck clean; privacy scan clean

- [x] Kane self-test of the redeployed console: 4/4 pass (docs/testing.md, docs/console-selftest.json)
- [x] Red-team 2 (redteam-2.md) → fixes: honest claims, heal rule in the engine, fixer audit, status --loop, LICENSE, OG card
- [x] Re-check of the broken build with the heal rule (case todomvc-recheck): 6 confirmed differences instead of 2, all 3 planted bugs in one check, 539 credits
- [x] Scorecard (scorecard.md), launch drafts updated with the re-check story
- [x] Red-team re-audit (≈7.9/10) → wording fixes; clean-port validation of the heal rule: 18/18, no false alarm

- [x] Video recorded from the live site: qa/video/ditto-demo.mp4 (2:49, opens on the catch), thumbnail qa/video/thumbnail.png
- [x] TestMu Slack read (16 Nov): no new rules for this edition; one rival builds Playwright→Kane suite migration; last edition's plain agent→Kane→fix loops didn't place

## Now
- [x] Hand-off message to the user

## Improvements round (user asked for more, 16 Nov ~19:20 UTC)
- [x] README: 24 s GIF hero, 30-second summary, judges' path first, CI badge (GitHub Actions: typecheck + 17 tests + build, green)
- [x] `ditto report` (PR-ready Markdown; docs/report-example*.md); Ditto's trust rules as a Kane policy (policies/ditto-parity.yaml, lints clean)
- [x] Console: 'Every recorded run' section; unlisted cases; rewrites can be a deployed URL (`rewrite.url`); /port-broken/ published via publishAs
- [x] Official TodoMVC builds (React, ES6, Svelte, Web Components, Lit) judged by the jQuery recordings; pruned, indexed, published
- [x] Answer key (#2309–#2315, 14 claims): hand-reviewed notes checked against recorded outcomes; 13/14 reproduce with Playwright (scripts/recheck-impls.mjs, 17 checks); Kane confirmed 4/10, missed 5, stopped early 1; 1 unreported bug (ES6 mark-all); 2 false alarms
- [x] Rewritten sentences (suites/todomvc-strict): WC caught by replay+heal; ES6 replay passed again, fresh run caught it
- [x] Replay audit (src/engine/replay-audit.ts, default on; check --fresh, --new-round): measured on ES6, Lit, clean port (no false "different"; fresh runs 14–82 credits; some "unclear")
- [x] README section + docs/testing.md §7–8; launch drafts updated; upstream issue draft for ES6 mark-all (private, needs the user's OK)
- [x] Video re-recorded (179 s, audit segment), frames checked; thumbnail re-rendered
- [x] Evidence validation incl. fresh-run packs: 527/528 valid (same invalid pack as before); README updated
- [x] Console: per-step replay-audit notes; check-only rounds labelled correctly; no 404 on scan.json; site republished and verified live
- [ ] Try-it flow (ditto.try.config.json): skipped unless credits allow (441 left at 01:10 UTC 17 Nov); not documented

## Hand-off to the user (only they can)
- [ ] Upload the video to YouTube (unlisted is fine), add the link to README and the submission
- [ ] Two public posts (drafts in hackathon-idea/kanecli-online-nov/launch-drafts.md)
- [ ] Submit the form (repo, live URL, video, description); confirm kaneclihack.sh registration

## Stretch
- [ ] Replay the oracle suite on 2–3 other official TodoMVC implementations (a partial Angular attempt hit Kane's start-page race; moved to .ditto-work/scan-partial, not published)
