import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { CaseFile, RunSummary } from '../src/engine/case.js';
import { derive } from '../web/src/data.ts';
import { framesByStep } from '../web/src/model.ts';
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
