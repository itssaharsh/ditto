// Turns a recorded case file into what the console draws. Live and replay use the same code path.
import type { CaseEvent, CaseFile, Round, RunSummary } from '../../src/engine/case';
import type { SuiteTest } from '../../src/engine/suite';

export type { CaseEvent, CaseFile, Round, RunSummary, SuiteTest };

export type RowStatus = 'match' | 'differs' | 'unclear' | 'legacy-differs' | 'unverified' | 'spec-met' | 'checking' | 'waiting';

export interface BehaviourRow {
  test: SuiteTest;
  legacy?: RunSummary;
  history: { round: number; result: RunSummary }[];
  latest?: RunSummary;
  status: RowStatus;
  /** The round in which a behaviour that differed first matched again. */
  fixedInRound?: number;
  running?: 'legacy' | 'rewrite';
}

export interface LoopEntry {
  round: number;
  t: string;
  test: string;
  said: string;
  did: string;
}

export interface Derived {
  rows: BehaviourRow[];
  oracleTotal: number;
  matched: number;
  legacyDiffers: number;
  unverified: number;
  specMet: number;
  /** By the old app's own results, before any spec fix: confirmed spec failures, and tests Kane could not run cleanly. */
  oracleFails: number;
  oracleUnclear: number;
  rounds: Round[];
  loop: LoopEntry[];
  fixedRows: BehaviourRow[];
  live: boolean;
}

export function derive(c: CaseFile): Derived {
  const rounds = [...c.rounds].sort((a, b) => a.n - b.n);
  const open = new Map<string, 'legacy' | 'rewrite'>();
  for (const e of c.events) {
    if (e.kind === 'kane_start') open.set(e.test, e.side);
    if (e.kind === 'kane_end') open.delete(e.test);
  }
  const live = !['parity', 'stopped', 'failed'].includes(c.status);
  const rows: BehaviourRow[] = c.suite.tests.map((test) => {
    const legacy = c.oracle[test.id];
    const history = rounds.filter((r) => r.results[test.id]).map((r) => ({ round: r.n, result: r.results[test.id] }));
    const latest = history.at(-1)?.result;
    let fixedInRound: number | undefined;
    let sawFail = false;
    for (const h of history) {
      if (h.result.outcome !== 'pass') sawFail = true;
      else if (sawFail && fixedInRound === undefined) fixedInRound = h.round;
    }
    let status: RowStatus = 'waiting';
    if (legacy && (legacy.outcome === 'mismatch' || legacy.outcome === 'fail') && legacy.confirmed) status = 'legacy-differs';
    else if (legacy?.outcome === 'pass' && legacy.replayVerified === false) status = 'unverified';
    else if (legacy && legacy.outcome !== 'pass') status = 'unverified';
    if (status === 'legacy-differs' || status === 'unverified') {
      // Outside the parity set. Only a spec behaviour that Kane saw fail on the rewrite too, and pass after a fix, counts as a gap closed;
      // anything else keeps its reason for being left out.
      if (latest?.outcome === 'pass' && fixedInRound !== undefined) status = 'spec-met';
    } else if (latest?.outcome === 'pass') status = 'match';
    else if (latest && (latest.outcome === 'mismatch' || latest.outcome === 'fail')) status = 'differs';
    else if (latest) status = 'unclear';
    const running = live ? open.get(test.id) : undefined;
    if (running) status = 'checking';
    return { test, legacy, history, latest, status, fixedInRound, running };
  });
  const oracleRows = rows.filter((r) => r.legacy?.outcome === 'pass');
  const loop: LoopEntry[] = c.events
    .filter((e): e is Extract<CaseEvent, { kind: 'decision' }> => e.kind === 'decision')
    .map((e) => ({ round: e.round, t: e.t, test: e.test, said: e.said, did: e.did }));
  return {
    rows,
    oracleTotal: oracleRows.length,
    matched: oracleRows.filter((r) => r.latest?.outcome === 'pass').length,
    legacyDiffers: rows.filter((r) => r.status === 'legacy-differs').length,
    unverified: rows.filter((r) => r.status === 'unverified').length,
    specMet: rows.filter((r) => r.status === 'spec-met').length,
    oracleFails: rows.filter((r) => r.legacy && (r.legacy.outcome === 'mismatch' || r.legacy.outcome === 'fail') && r.legacy.confirmed).length,
    oracleUnclear: rows.filter(
      (r) =>
        r.legacy &&
        !(r.legacy.outcome === 'pass' && r.legacy.replayVerified !== false) &&
        !((r.legacy.outcome === 'mismatch' || r.legacy.outcome === 'fail') && r.legacy.confirmed),
    ).length,
    rounds,
    loop,
    fixedRows: rows.filter((r) => r.fixedInRound !== undefined),
    live,
  };
}

export async function fetchCase(id: string): Promise<CaseFile> {
  const r = await fetch(`./cases/${id}/case.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`case ${id}: ${r.status}`);
  return (await r.json()) as CaseFile;
}

export function assetUrl(caseId: string, file: string): string {
  return `./cases/${caseId}/${file}`;
}

export function lastShot(s: RunSummary | undefined, prefer: 'annotated' | 'screenshot' = 'screenshot') {
  if (!s) return undefined;
  const shots = s.shots.filter((x) => x.kind === prefer);
  return (shots.length ? shots : s.shots).at(-1);
}
