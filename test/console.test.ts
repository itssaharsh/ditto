import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { CaseFile, RunSummary } from '../src/engine/case.js';
import { derive } from '../web/src/data.ts';
import { framesByStep, plantedBugs, roundLabel } from '../web/src/model.ts';
import { atTime, bounds, phases } from '../web/src/timeline.ts';

const run = (outcome: RunSummary['outcome'], endedAt: string, shots: RunSummary['shots'] = []): RunSummary => ({
  outcome,
  shots,
  consoleErrors: [],
  mode: 'author',
  startedAt: endedAt,
  endedAt,
});

const tests = ['a', 'b', 'c'].map((id) => ({ id, file: `${id}_test.md`, title: id.toUpperCase(), steps: [{ heading: 'Step 1', text: 'x', verifies: [] }], sha256: id }));

const c: CaseFile = {
  id: 'x',
  title: 'x',
  createdAt: '2026-11-16T10:00:00Z',
  updatedAt: '2026-11-16T11:00:00Z',
  status: 'parity',
  apps: { legacy: { label: 'old', url: 'u', framework: 'f' }, rewrite: { label: 'new', url: 'v', framework: 'g' } },
  suite: { name: 'x', designedBy: 'Kane', tests },
  oracle: { a: run('pass', '2026-11-16T10:05:00Z'), b: run('pass', '2026-11-16T10:06:00Z'), c: { ...run('mismatch', '2026-11-16T10:07:00Z'), confirmed: true } },
  rounds: [
    { n: 0, results: { a: run('pass', '2026-11-16T10:20:00Z'), b: run('mismatch', '2026-11-16T10:21:00Z') } },
    { n: 1, results: { b: run('pass', '2026-11-16T10:40:00Z') } },
  ],
  events: [
    { t: '2026-11-16T10:00:00Z', kind: 'kane_start', side: 'legacy', test: 'a', round: 0, mode: 'author' },
    { t: '2026-11-16T10:10:00Z', kind: 'agent_start', round: 0, agentKind: 'port', prompt: 'p' },
    { t: '2026-11-16T10:30:00Z', kind: 'agent_start', round: 1, agentKind: 'fix', prompt: 'f' },
    { t: '2026-11-16T10:30:00Z', kind: 'decision', round: 1, test: 'b', said: 'Escape saved the edit', did: 'Sent to Claude Code with both screenshots (round 1)' },
    { t: '2026-11-16T10:45:00Z', kind: 'note', text: 'Parity' },
  ],
  totals: { kaneRuns: 6, credits: 100, agentCostUsd: 1, replays: 1 },
};

test('derive counts parity over behaviours the old app passes, and finds the fixed one', () => {
  const d = derive(c);
  assert.equal(d.oracleTotal, 2);
  assert.equal(d.matched, 2);
  assert.equal(d.legacyDiffers, 1);
  assert.deepEqual(d.fixedRows.map((r) => r.test.id), ['b']);
  assert.equal(d.rows.find((r) => r.test.id === 'b')?.fixedInRound, 1);
  assert.equal(d.loop.length, 1);
});

test('rewinding the case shows only what had happened by then', () => {
  const mid = atTime(c, Date.parse('2026-11-16T10:25:00Z'));
  assert.equal(Object.keys(mid.oracle).length, 3);
  assert.equal(mid.rounds.length, 1);
  assert.deepEqual(Object.keys(mid.rounds[0].results).sort(), ['a', 'b']);
  assert.notEqual(mid.status, 'parity');
  const d = derive(mid);
  assert.equal(d.matched, 1);
  const end = atTime(c, bounds(c).end);
  assert.equal(end.status, 'parity');
});

test('phases follow the agent turns', () => {
  assert.deepEqual(phases(c).map((p) => p.label), ['Record the old app', 'Port + check', 'Fix 1 + check']);
});

test('frames are grouped by test step and a failing step is marked', () => {
  const r = run('mismatch', '2026-11-16T10:21:00Z', [
    { step: '3-0-3', kind: 'screenshot', file: 'a.jpg', status: 'passed' },
    { step: '7-1-4', kind: 'screenshot', file: 'b.jpg', status: 'failed' },
    { step: '7-1-4', kind: 'annotated', file: 'b.png', status: 'failed' },
  ]);
  const f = framesByStep(r, 3);
  assert.equal(f[0].shot?.file, 'a.jpg');
  assert.equal(f[1].failed, true);
  assert.equal(f[1].shot?.file, 'b.png');
  assert.equal(f[2].reached, false);
});

test('a spec behaviour counts as met only after Kane saw it fail on the rewrite and pass after a fix', () => {
  const spec: CaseFile = {
    ...c,
    oracle: { ...c.oracle, c: { ...run('mismatch', '2026-11-16T10:07:00Z'), confirmed: true } },
    rounds: [
      { n: 0, results: { a: run('pass', '2026-11-16T10:20:00Z'), b: run('pass', '2026-11-16T10:21:00Z'), c: run('mismatch', '2026-11-16T10:22:00Z') } },
      { n: 1, results: { c: run('pass', '2026-11-16T10:40:00Z') } },
    ],
  };
  assert.equal(derive(spec).specMet, 1);
  // Passing on the rewrite straight away says nothing about a gap: it stays out of the count.
  const straight: CaseFile = { ...spec, rounds: [{ n: 0, results: { a: run('pass', '2026-11-16T10:20:00Z'), c: run('pass', '2026-11-16T10:22:00Z') } }] };
  const d = derive(straight);
  assert.equal(d.specMet, 0);
  assert.equal(d.rows.find((r) => r.test.id === 'c')?.status, 'legacy-differs');
});

test('planted bugs are matched to the fix round that changed their file, with the findings sent that round', () => {
  const agent = (kind: 'mutate' | 'fix', round: number, filesChanged: string[]) => ({ kind, round, prompt: 'p', startedAt: '2026-11-16T10:10:00Z', filesChanged });
  const m: CaseFile = {
    ...c,
    mutations: '1. Escape saves the edit — src/components/TodoItem.tsx\n2. Toggle-all looks checked — src/App.tsx\n3. Nobody touched this — src/Other.tsx\n',
    rounds: [
      { n: 0, agent: agent('mutate', 0, ['src/App.tsx', 'src/components/TodoItem.tsx', 'src/Other.tsx']), results: {} },
      { n: 1, agent: agent('fix', 1, ['src/components/TodoItem.tsx']), results: {} },
      { n: 2, agent: agent('fix', 2, ['src/App.tsx']), results: {} },
    ],
    events: [
      { t: '2026-11-16T10:30:00Z', kind: 'decision', round: 1, test: 'b', said: 's', did: 'Sent to Claude Code with both screenshots (round 1)' },
      { t: '2026-11-16T10:31:00Z', kind: 'decision', round: 1, test: 'a', said: 's', did: 'Let Kane re-author the missed steps' },
      { t: '2026-11-16T10:50:00Z', kind: 'decision', round: 2, test: 'a', said: 's', did: 'Sent to Claude Code with both screenshots (round 2)' },
    ],
  };
  const bugs = plantedBugs(m);
  assert.deepEqual(bugs.map((b) => [b.file, b.fixRound]), [['src/components/TodoItem.tsx', 1], ['src/App.tsx', 2], ['src/Other.tsx', undefined]]);
  assert.deepEqual(bugs[0].sentTests, ['b']);
  assert.deepEqual(bugs[1].sentTests, ['a']);
  assert.equal(bugs[0].text, 'Escape saves the edit');
  assert.equal(roundLabel(m.rounds[0]), 'Broken');
});

test('the pull-request report says No at parity and lists confirmed differences otherwise', async () => {
  const { reportMarkdown } = await import('../src/engine/report.js');
  const parity = reportMarkdown({ ...c, oracle: { a: run('pass', 'x'), b: run('pass', 'x'), c: c.oracle.c } });
  assert.match(parity, /\*\*No\.\*\* 2 of 2 behaviours act the same/);
  const broken: CaseFile = {
    ...c,
    oracle: { a: run('pass', 'x'), b: run('pass', 'x'), c: c.oracle.c },
    rounds: [{ n: 0, results: { a: run('pass', 'x'), b: { ...run('mismatch', 'x'), oneLiner: 'Escape kept the edit' } } }],
  };
  const md = reportMarkdown(broken);
  assert.match(md, /\*\*Yes\.\*\* Kane CLI confirmed 1 of 2 behaviours act differently/);
  assert.match(md, /- \*\*B\*\*: Escape kept the edit/);
  assert.match(md, /1 of the 3 tests Kane designed from the spec are not counted/);
});
