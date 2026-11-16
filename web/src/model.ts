// Small helpers that turn Kane's evidence into per-step frames for the console.
import type { BehaviourRow, CaseFile, RunSummary } from './data';

export type EvidenceShot = RunSummary['shots'][number];

/** Kane names step folders <ordinal>-<markdown step>-<sub step>; the middle number is the test step. */
export function mdIndex(shot: EvidenceShot): number | undefined {
  const parts = shot.step.split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) return parts[1];
  if (parts.length === 2 && parts.every((n) => !Number.isNaN(n))) return parts[0];
  return undefined;
}

export interface StepFrame {
  shot?: EvidenceShot;
  failed: boolean;
  reached: boolean;
}

/** One frame per test step: the last screenshot Kane took in that step, and whether that step failed. */
export function framesByStep(run: RunSummary | undefined, steps: number): StepFrame[] {
  const out: StepFrame[] = Array.from({ length: steps }, () => ({ failed: false, reached: false }));
  if (!run) return out;
  for (const s of run.shots) {
    const i = mdIndex(s);
    if (i === undefined || i >= steps) continue;
    out[i].reached = true;
    if (s.status === 'failed') out[i].failed = true;
    if (s.kind === 'screenshot') out[i].shot = s;
    else if (s.status === 'failed') out[i].shot = s; // the annotated frame of a failing step wins
  }
  // Steps after the first failed one were never reached.
  const firstFail = out.findIndex((f) => f.failed);
  if (run.outcome !== 'pass' && firstFail === -1) {
    // The failure record names no step: treat the last reached step as the failing one.
    const last = out.map((f) => f.reached).lastIndexOf(true);
    if (last >= 0) out[last].failed = true;
  }
  return out;
}

export function firstFailingRound(row: BehaviourRow): { round: number; result: RunSummary } | undefined {
  return row.history.find((h) => h.result.outcome !== 'pass');
}

export function verdictText(s: RunSummary | undefined): string | undefined {
  if (!s) return undefined;
  return s.verdict?.oneLiner ?? s.oneLiner ?? s.reason ?? undefined;
}

export function fmtDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
}

export function pickNamed(rows: BehaviourRow[], named?: string): BehaviourRow | undefined {
  const fixed = rows.filter((r) => r.fixedInRound !== undefined).sort((a, b) => (a.fixedInRound ?? 0) - (b.fixedInRound ?? 0));
  return (
    fixed[0] ??
    rows.find((r) => r.status === 'differs') ??
    rows.find((r) => r.test.id === named && r.status === 'match') ??
    rows.find((r) => r.status === 'match') ??
    rows[0]
  );
}

export function tryOrder(rows: BehaviourRow[], named?: string): BehaviourRow[] {
  const rank = (r: BehaviourRow) =>
    r.fixedInRound !== undefined ? 0 : r.test.id === named ? 0.5 : r.status === 'differs' ? 1 : r.status === 'spec-met' ? 1.5 : r.status === 'legacy-differs' ? 2 : r.status === 'match' ? 3 : 4;

  return [...rows].sort((a, b) => rank(a) - rank(b) || (a.fixedInRound ?? 99) - (b.fixedInRound ?? 99));
}

export function roundLabel(r: { n: number; agent?: { kind: string } }): string {
  if (r.n === 0) return 'Port';
  if (r.agent?.kind === 'hook') return `Stop hook ${r.n}`;
  if (r.agent?.kind === 'spec') return `Spec ${r.n}`;
  return `Fix ${r.n}`;
}

export function caseFacts(c: CaseFile) {
  const rounds = c.rounds.filter((r) => r.n > 0 && (r.agent?.kind === 'fix' || r.agent?.kind === 'spec')).length;
  const hookChecks = c.rounds.filter((r) => r.agent?.kind === 'hook').length;
  return {
    rounds,
    hookChecks,
    runs: c.totals.kaneRuns,
    replays: c.totals.replays,
    heals: c.totals.heals ?? 0,
    authored: c.totals.authored ?? 0,
    credits: Math.round(c.totals.credits),
  };
}
