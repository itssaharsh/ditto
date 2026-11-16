---
name: Ditto   scope: standard   one_line: "Ditto proves an AI rewrite of your app behaves like the old one"   title: "Ditto: Did the rewrite break anything?"
concept: "Daylight terminal: the real Kane _test.md is the hero; each step's legacy and rewrite frames sit beside it; a highlighter marks what Kane is asserting."
references: [design/concepts/shots/terminal-1440.png, design/concepts/shots/terminal-390.png, design/concepts/shots/mirror-1440.png]
target: design/concepts/terminal.html
tokens: { canvas: "#E9F0F8 (gradient from #F2F7FC)", surface: "#FFFFFF", ink: "#14202E", muted: "#4B5A6C", accent: "#FFD84D highlighter (soft #FFF1B8)", pass: "#15864F / #E0F4E8", fail: "#D23A2D / #FCE7E4", display: Syne 700/800, body: Albert Sans 400–700, mono: IBM Plex Mono (test text and diffs only), radius: [18, 16, 10, 8, 4], motion: precise }
signature: "The highlighter sweeps the test's steps one by one; at the step that differed, the rewrite's red round-1 frame slides under the green final frame and the '=' node flips from red to green."
imagery: "Real Kane screenshots of both apps, cropped to the app; nothing drawn."
stack: "Vite + React (routes: none; one page with anchors). No UI kit, no motion library: CSS transitions only."
first_screen: { question: "Ditto: Did the rewrite break anything?", named_example: "the behaviour Claude got wrong first and fixed (from the recorded run)", sponsor_visual: "Kane's _test.md with @verifies links + Kane's screenshots of both apps per step", verdict: "N/N Same behaviour", try_these: "other behaviours, fixed ones first", replay: ./cases/todomvc/case.json }
demo: { seed: cases/todomvc, state_param: "?b=<behaviour id>", reset: "reload", record: "?record=1 (hides nothing; larger type)" }
whats_real: ["Every Kane run, verdict and screenshot comes from a real run (dates and Test Manager links shown)", "The port and every fix were written by Claude Code (commits linked)", "The tests were designed by Kane from the official TodoMVC spec", "The legacy app is the official TodoMVC jQuery example (MIT)"]
deviations: ["Mono used beyond code only for the test file body, because the test file is the product's hero object."]
---

## Brief
- **One line:** Ditto proves an AI rewrite of your app behaves like the old one.
- **User and moment:** a developer at a laptop, about to merge an agent's rewrite or big refactor, wondering what users will notice.
- **Hero object:** the behaviour test (Kane's `_test.md`) with the legacy and rewrite frames for each step.
- **Primary action:** pick a behaviour ("Try these") and see the proof; secondary: read the Kane → Claude loop.
- **Artifact:** the suite (committed to the new repo), the parity table, the commits.
- **The moment:** the step that differed: Kane's red frame of the rewrite, Claude's fix, the same step green.

## Screens
- `/` (one page): header · question + one-line answer · left: the selected behaviour's test file with per-step lanes (legacy | = | rewrite) · right rail: parity card (big N/N, sticker), Try these, Kane said → Claude did.
- `#behaviours`: every behaviour, legacy and rewrite status per round, the steps on demand.
- `#rounds`: each agent turn: what Ditto sent, what Claude changed (files, diff stat, commit), what Kane found next.
- `#how`: three steps on the product, What's real line, links.

## States
- Loading: skeleton of the sheet and rail (≥300 ms).
- Live (case still running): rail says "Kane is checking N behaviours…", lanes fill as results land; polling every 2.5 s.
- No case: "No run yet. Run `ditto loop` and this page fills in."
- Legacy differs from spec: grey "legacy differs" tag, rewrite lane shows what the port does, excluded from parity count with a note.
- Not verified (Kane could not run it): neutral tag "not verified", never red.

## Copy
- H1: "Ditto: Did the rewrite break anything?"
- Answer line (final): "**No.** {matched} of {total} behaviours act the same on the old app and the rewrite. Here is the proof for one of them."
- Answer line (live): "Checking. {matched} of {total} behaviours match so far."
- Sheet header right: "one file, run unchanged on both apps"
- Parity facts: "0 selectors · Same test file on both apps · {rounds} rounds · {runs} Kane runs, {replays} pure replays"
- Loop strip: "Kane, round {n} · FAIL" → "Claude Code · fixed" → "Round {m} · Same test, rewrite: PASS"

## Checks
- value: shows the proof a reviewer needs before merging · clarity: one behaviour at a time, list one click away · trust: every frame is Kane's, every claim links to Test Manager or a commit · feedback: selection updates instantly, URL keeps it · failure: a failed load keeps the last good case · 10× data: list virtualisation not needed below 200 rows; rows truncate cleanly · maintainability: one page, plain CSS, no UI kit.
