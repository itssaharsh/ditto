# Ditto console, first-screen concepts

Static mockups, no app code. Source generators are in `src/` (`python3 src/<name>.py` rebuilds the HTML, `src/shoot.sh <name>` reshoots). Frames: left is a real Kane screenshot of the legacy app; right is an HTML re-creation of the TodoMVC UI (a "React port" stand-in) because no rewrite screenshot exists yet. All test text is from `escape-discards-a-todo-title-edit_test.md`; numbers (26/26, 3 rounds, 41/29 runs) and the round 2/3 findings are illustrative.

Final shots (`shots/`): `mirror-1440.png`, `mirror-390.png`, `ledger-1440.png`, `ledger-390.png`, `terminal-1440.png`, `terminal-390.png`.

## (a) Mirror
- **Idea:** two identical-looking apps side by side, joined by one sentence-test, stamped "Same behaviour".
- **Palette:** canvas #ECF0EE, surface #FFFFFF, ink #0F1B16, accent/pass green #0B8A5B (job: parity and "same"), fail #D6402A (only for the failing round).
- **Type:** Bricolage Grotesque (headline, numerals) + Hanken Grotesk (body); mono only for the test's quoted values.
- **Layout move:** dark sentence-test bar on top with two drop-lines into the twin frames; green "=" between them; stamp pinned top-right of the stage; rail on the right with the 26/26 number, facts, chips.
- **Signature moment:** drop-lines draw, "=" pops, then the stamp thunks in (scale 2.1 to 1, rotated, multiply-blended like ink).
- **Items:** 1 headline; 2 twin pair + test + PASS/PASS + round-1 FAIL thumbnail with Kane quote; 3 26/26, stamp, facts; 4 chips, named one first; 5 three-column Kane said / Claude did strip.

## (b) Ledger
- **Idea:** the parity matrix is the product; open one row and the twin frames unfold.
- **Palette:** canvas #F3F5F9, surface #FFFFFF, ink #111827, accent cobalt #2358F2 (job: the selected row and Kane's voice), pass = ink check, fail = #D63A2F.
- **Type:** Big Shoulders Display (the 26/26 total, with an accountant's double rule under it) + Public Sans.
- **Layout move:** big total top right, chips as row selectors, ruled table with legacy/rewrite columns and per-round dots, first row expanded into frames + sentence + Kane to Claude exchange, side column with proof facts and log.
- **Signature moment:** rewrite check marks tick in down the column, then the double rule draws under the total.
- **Items:** all five, but the twins are small (about 230px) inside an expanded row.

## (c) Daylight terminal
- **Idea:** the real `_test.md` is the hero; each step lights up with a highlighter and has a screenshot per app in two lanes, so the sentence literally joins the twins at every step.
- **Palette:** canvas #E9F0F8 fading from #F2F7FC, sheet #FFFFFF, ink #14202E, accent highlighter #FFD84D (job: what Kane is asserting right now, and "Same behaviour"), pass #15864F, fail #D23A2D.
- **Type:** Syne (headline, numerals) + Albert Sans (body) + IBM Plex Mono (file text and diffs only).
- **Layout move:** file sheet with three columns (step text, legacy lane, rewrite lane), "=" nodes between lanes, step 3 shows the round-1 FAIL frame under the round-2 PASS frame, bottom strip Kane quote, Claude fix, PASS; right rail with 26/26 + sticker, chips, diff-style log.
- **Signature moment:** highlighter sweeps each step in turn; at step 3 the "=" turns from red to green as the PASS frame slides over the FAIL frame and the R2 PASS tag pops.
- **Items:** all five; the log is a literal diff (red removed line, green added line).

## Scores (1 to 10)
| Concept | Distinctive | Hierarchy | Craft | Clear in 5s | Wow | Rounds |
|---|---|---|---|---|---|---|
| Mirror | 7 | 8 | 8 | 8 | 7 | 3 |
| Ledger | 6 | 7 | 7 | 7 | 6 | 2 |
| Daylight terminal | 9 | 8 | 8 | 8 | 9 | 3 |

Honest notes. Mirror: closest to the brief and the strongest single hero, but the two frames look the same by design, so the "wow" is the stamp, and the card-plus-rail layout is familiar. Ledger: very legible, reads as a table; the twin frames are small and the proof of the loop is secondary. Terminal: only this product could be this page (the test file is the artifact Kane actually authors), the per-step lanes show the same text running on both apps, and it makes the no-selectors claim visible; risk is density of mono text and thumbnails of 200px, so it needs a click-to-enlarge on a frame.

## Recommendation: Daylight terminal, with Mirror's stamp idea borrowed
Reasons: it is the only concept whose hero is the real Kane artifact, so judges who build Kane CLI see their own test file unchanged and lit up on two apps; the twin pair appears at every step, not once; the Kane to Claude loop is a literal diff. Fallback if the real rewrite screenshots are visually identical to legacy (they will be, when it works): the lanes still read because the FAIL frame in step 3 carries the story.

## Token set (Daylight terminal)
Colours
- canvas #E9F0F8 (page gradient from #F2F7FC), sheet/surface #FFFFFF, line #D6E0EC
- ink #14202E, ink-2 #4B5A6C, ink-3 #8392A5
- highlighter (the one accent) #FFD84D, highlighter-soft #FFF1B8
- pass #15864F / soft #E0F4E8, fail #D23A2D / soft #FCE7E4 (semantic only)

Fonts: Syne 700/800 (headline, 26/26), Albert Sans 400-700 (body, 16px), IBM Plex Mono 400-600 (test file, diff only). Tabular numerals on.

Radii: 18 (sheet), 16 (cards), 10 (verdict blocks, chips 8), 8 (thumbnails), 4-6 (tags, highlights).

Shadows
- hairline highlight: `inset 0 1px 0 #fff`
- card: `0 1px 2px rgba(20,50,90,.07), 0 3px 8px rgba(20,50,90,.06)`
- sheet: `0 1px 1px rgba(20,50,90,.05), 0 8px 18px rgba(20,50,90,.08), 0 30px 60px -16px rgba(20,50,90,.22)`
- thumbnail ring: `0 0 0 1px #D6E0EC` plus card shadow

Spacing scale (px): 4, 6, 8, 12, 16, 22, 32; page gutter 32 (16 on phones); rail 372; lane 204 with 30 gap.

Motion: highlighter sweep 1s per step (0.2s, 0.9s, 1.5s); PASS frame slide 0.7s at 2.1s; tag pop 0.4s at 2.6s; all end in the resolved state.
