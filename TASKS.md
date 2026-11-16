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
- [x] Mutation check (16 Nov): 3 bugs planted by a second session, all caught, fixed in 2 rounds from Kane's findings alone, 18/18; branch ditto/mutation-check pushed to the port repo
- [x] Edge check: the fixer's repair also changed an untested quirk (Escape on an emptied title); Kane saw it on both apps (docs/edge-check.json); shown as the run's caveat
- [x] Console: opens on the planted-bug catch with Kane's red/green frames in the strip; honest counts; 390 px layout; mutation section; caveat
- [x] README rewritten (closed loop first, mermaid pipeline, every run, what Ditto can't see, judges' path); docs/testing.md §4–5
- [x] Site deployed (gh-pages) with /legacy, /port, /port-haiku, /port-mutation; fold check PASS on the live URL
- [x] 15 unit tests; typecheck clean; privacy scan clean

- [x] Kane self-test of the redeployed console: 4/4 pass (docs/testing.md, docs/console-selftest.json)
- [x] Red-team 2 (redteam-2.md) → fixes: honest claims, heal rule in the engine, fixer audit, status --loop, LICENSE, OG card
- [x] Re-check of the broken build with the heal rule (case todomvc-recheck): 6 confirmed differences instead of 2, all 3 planted bugs in one check, 539 credits
- [x] Scorecard (scorecard.md), launch drafts updated with the re-check story

## Now
- [~] Record the video (scripts/video/record.mjs from the live site) and check it under 3:00
- [ ] Hand-off message to the user

## Hand-off to the user (only they can)
- [ ] Upload the video to YouTube (unlisted is fine), add the link to README and the submission
- [ ] Two public posts (drafts in hackathon-idea/kanecli-online-nov/launch-drafts.md)
- [ ] Submit the form (repo, live URL, video, description); confirm kaneclihack.sh registration

## Stretch
- [ ] Replay the oracle suite on 2–3 other official TodoMVC implementations (a partial Angular attempt hit Kane's start-page race; moved to .ditto-work/scan-partial, not published)
