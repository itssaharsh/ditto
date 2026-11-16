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

## 4. The end-to-end run

`npm run ditto -- loop` is itself the integration test: Kane designs the suite, records the oracle, Claude Code ports the app, and the loop must end in parity with a final replay of every test on the rewrite. The recorded run is `cases/todomvc/case.json`; `npm run ditto -- status` prints its table.
