// Rewinds a recorded case to any moment, so the console can replay the whole run quickly.
import type { CaseEvent, CaseFile, Round, RunSummary } from './data';

const ms = (iso?: string) => (iso ? Date.parse(iso) : NaN);

export interface Phase {
  label: string;
  start: number;
  end: number;
}

export function bounds(c: CaseFile): { start: number; end: number } {
  const times = c.events.map((e) => ms(e.t)).filter((n) => !Number.isNaN(n));
  const start = Math.min(...times, ms(c.createdAt));
  const end = Math.max(...times, start + 1);
  return { start, end };
}

/** The case as it looked at time t: only what had happened by then. */
export function atTime(c: CaseFile, t: number): CaseFile {
  const done = (r: RunSummary) => ms(r.endedAt) <= t;
  const oracle = Object.fromEntries(Object.entries(c.oracle).filter(([, r]) => done(r)));
  const rounds: Round[] = [];
  for (const r of c.rounds) {
    const results = Object.fromEntries(Object.entries(r.results).filter(([, x]) => done(x)));
    const agentStarted = r.agent && ms(r.agent.startedAt) <= t;
    if (!agentStarted && Object.keys(results).length === 0) continue;
    const agent = r.agent && agentStarted ? (ms(r.agent.endedAt) <= t ? r.agent : { ...r.agent, summary: undefined, diffStat: undefined, commit: undefined, endedAt: undefined, filesChanged: [] }) : undefined;
    rounds.push({ ...r, agent, results });
  }
  const events = c.events.filter((e) => ms(e.t) <= t);
  const ends = events.filter((e) => e.kind === 'kane_end').length;
  const allRuns = [...Object.values(oracle), ...rounds.flatMap((r) => Object.values(r.results))];
  const status = t >= bounds(c).end ? c.status : statusAt(events);
  return {
    ...c,
    status,
    oracle,
    rounds,
    events,
    totals: {
      kaneRuns: ends,
      credits: Math.round(allRuns.reduce((a, r) => a + (r.credits ?? 0), 0)),
      agentCostUsd: c.totals.agentCostUsd,
      replays: allRuns.filter((r) => r.mode === 'replay').length,
    },
  };
}

function statusAt(events: CaseEvent[]): CaseFile['status'] {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === 'kane_start') return e.side === 'legacy' ? 'recording' : 'checking';
    if (e.kind === 'agent_start') return e.agentKind === 'port' ? 'porting' : 'fixing';
  }
  return 'recording';
}

/** The behaviour Kane most recently finished at time t (so the replay can follow the action). */
export function latestTest(c: CaseFile): string | undefined {
  for (let i = c.events.length - 1; i >= 0; i--) {
    const e = c.events[i];
    if (e.kind === 'kane_end' || e.kind === 'decision') if (e.test && e.test !== '-') return e.test;
  }
  return undefined;
}

export function phases(c: CaseFile): Phase[] {
  const { start, end } = bounds(c);
  const rounds = [...c.rounds].sort((a, b) => a.n - b.n);
  const startOf = (r: Round) => {
    const times = [ms(r.agent?.startedAt), ...Object.values(r.results).map((x) => ms(x.startedAt))].filter((n) => !Number.isNaN(n));
    return times.length ? Math.min(...times) : NaN;
  };
  const labelOf = (r: Round) =>
    r.n === 0 ? 'Port + check' : r.agent?.kind === 'hook' ? 'Stop hook' : r.agent?.kind === 'spec' ? 'Spec fix + check' : r.label ?? `Fix ${r.n} + check`;
  const marks = rounds.map((r) => ({ label: labelOf(r), start: startOf(r) })).filter((m) => !Number.isNaN(m.start));
  const out: Phase[] = [{ label: 'Record the old app', start, end: marks[0]?.start ?? end }];
  marks.forEach((m, i) => out.push({ label: m.label, start: m.start, end: marks[i + 1]?.start ?? end }));
  return out.filter((p) => p.end > p.start);
}
