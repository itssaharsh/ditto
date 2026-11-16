import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { foldStream, parseLine } from '../src/engine/kane.js';
import { parseTestMd } from '../src/engine/suite.js';

const load = (f: string) =>
  readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8')
    .split('\n')
    .map(parseLine)
    .filter((e): e is Record<string, unknown> => e !== null);

test('a run Kane confirms as a product bug is a mismatch (740)', () => {
  const r = foldStream(load('run-740.ndjson'), 1);
  assert.equal(r.outcome, 'mismatch');
  assert.equal(r.resultCode, 740);
  assert.equal(r.verdict?.family, 'application_issue');
  assert.match(r.oneLiner ?? '', /ethiopia/i);
});

test('a failure Kane blames on the test is a test issue (710)', () => {
  const r = foldStream(load('testmd-710.ndjson'), 1);
  assert.equal(r.outcome, 'test_issue');
  assert.equal(r.verdict?.family, 'automation_bug');
});

test('an authored three-step test that passes sums credits across steps', () => {
  const r = foldStream(load('testmd-author-pass.ndjson'), 0);
  assert.equal(r.outcome, 'pass');
  assert.equal(r.authorDecisions, 3);
  assert.ok((r.credits ?? 0) > 30);
  assert.equal(r.committed, true);
});

test('a cached replay authors nothing', () => {
  const r = foldStream(load('testmd-replay-pass.ndjson'), 0);
  assert.equal(r.outcome, 'pass');
  assert.equal(r.replayDecisions, 3);
  assert.equal(r.authorDecisions, 0);
});

test('a replay retargeted at the buggy build fails as a confirmed mismatch', () => {
  const r = foldStream(load('replay-740.ndjson'), 1);
  assert.equal(r.outcome, 'mismatch');
  assert.equal(r.replayDecisions, 1);
});

test('no stream at all is an error', () => {
  assert.equal(foldStream([], 2).outcome, 'error');
});

test('parses a Kane-designed test file with criteria links', () => {
  const t = parseTestMd(
    `---\nassurance:\n  id: t-2\n---\n# Escape discards a todo title edit\n\n> Escape leaves editing mode.\n\n## Step 1\n\nAt {{start_url}}, create a todo.\n\n## Step 2 @verifies ac-1, ac-3\n\nDouble-click it.\n`,
    'suites/x/escape_test.md',
  );
  assert.equal(t.id, 'escape');
  assert.equal(t.assuranceId, 't-2');
  assert.equal(t.title, 'Escape discards a todo title edit');
  assert.equal(t.steps.length, 2);
  assert.deepEqual(t.steps[1].verifies, ['ac-1', 'ac-3']);
  assert.equal(t.steps[1].heading, 'Step 2');
});

test('a browser that dropped mid-run is an environment error, not an app difference', () => {
  const r = foldStream(
    [
      { type: 'run_end', status: 'failed', result_code: 510, verdict: { family: 'environment_issue', confirmed: false } },
      { type: 'test_md_summary', overall_status: 'failed', steps: { author_decisions: 1 } },
    ],
    1,
  );
  assert.equal(r.outcome, 'error');
});
