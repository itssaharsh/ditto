// The case file is the single source of truth: the live console and the published replay both render it.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { EvidenceShot, KaneRunResult, KaneVerdict, Outcome } from './kane.js';
import type { SuiteTest } from './suite.js';

export type AppSide = 'legacy' | 'rewrite';

export interface RunSummary {
  outcome: Outcome;
  durationS?: number;
  credits?: number;
  oneLiner?: string;
  reason?: string;
  resultCode?: number;
  verdict?: KaneVerdict;
  shareUrl?: string;
  replayDecisions?: number;
  authorDecisions?: number;
  healTriggered?: boolean;
  shots: EvidenceShot[];
  consoleErrors: string[];
  urls?: string[];
  failureMessage?: string;
  /** On the old app, a failure only counts once Kane reproduces it on a second run. */
  confirmed?: boolean;
  mode: 'author' | 'replay' | 'replay+heal';
  startedAt: string;
  endedAt: string;
}

export interface AgentTurn {
  kind: 'port' | 'fix';
  round: number;
  sessionId?: string;
  model?: string;
  prompt: string;
  startedAt: string;
  endedAt?: string;
  costUsd?: number;
  turns?: number;
  summary?: string;
  filesChanged: string[];
  diffStat?: string;
  commit?: string;
  ok?: boolean;
}

export interface Round {
  n: number;
  agent?: AgentTurn;
  build?: { ok: boolean; output?: string };
  results: Record<string, RunSummary>;
}

export type CaseEvent =
  | { t: string; kind: 'note'; text: string }
  | { t: string; kind: 'kane_start'; side: AppSide; test: string; round: number; mode: RunSummary['mode'] }
  | { t: string; kind: 'kane_step'; side: AppSide; test: string; round: number; step: number; status: string; remark: string }
  | { t: string; kind: 'kane_end'; side: AppSide; test: string; round: number; outcome: Outcome; oneLiner?: string }
  | { t: string; kind: 'agent_start'; round: number; agentKind: 'port' | 'fix'; prompt: string }
  | { t: string; kind: 'agent_tool'; round: number; tool: string; detail: string }
  | { t: string; kind: 'agent_text'; round: number; text: string }
  | { t: string; kind: 'agent_end'; round: number; summary?: string; filesChanged: string[]; costUsd?: number }
  | { t: string; kind: 'build'; round: number; ok: boolean; detail?: string }
  | { t: string; kind: 'decision'; round: number; test: string; said: string; did: string }
  | { t: string; kind: 'parity'; round: number; matched: number; total: number };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewCaseEvent = DistributiveOmit<CaseEvent, 't'> & { t?: string };

export interface CaseFile {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: 'recording' | 'porting' | 'checking' | 'fixing' | 'parity' | 'stopped' | 'failed';
  apps: Record<AppSide, { label: string; url: string; framework: string; source?: string }>;
  suite: { name: string; designedBy: string; spec?: string; variables?: Record<string, string>; tests: SuiteTest[] };
  oracle: Record<string, RunSummary>;
  rounds: Round[];
  events: CaseEvent[];
  totals: { kaneRuns: number; credits: number; agentCostUsd: number; replays: number };
}

export function summarize(r: KaneRunResult, mode: RunSummary['mode']): RunSummary {
  return {
    outcome: r.outcome,
    durationS: r.durationS,
    credits: r.credits,
    oneLiner: r.oneLiner,
    reason: r.reason,
    resultCode: r.resultCode,
    verdict: r.verdict,
    shareUrl: r.shareUrl,
    replayDecisions: r.replayDecisions,
    authorDecisions: r.authorDecisions,
    healTriggered: r.healTriggered,
    shots: r.evidence?.shots ?? [],
    consoleErrors: r.evidence?.consoleErrors ?? [],
    urls: r.evidence?.urls,
    failureMessage: r.evidence?.failureMessage,
    mode: mode === 'replay' && (r.authorDecisions ?? 0) > 0 ? 'replay+heal' : mode,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
  };
}

/** Writes the case atomically after every change so a polling UI never reads half a file. */
export class CaseRecorder {
  readonly dir: string;
  readonly file: string;
  data: CaseFile;

  constructor(dir: string, init: () => CaseFile) {
    this.dir = dir;
    this.file = join(dir, 'case.json');
    mkdirSync(join(dir, 'assets'), { recursive: true });
    this.data = existsSync(this.file) ? (JSON.parse(readFileSync(this.file, 'utf8')) as CaseFile) : init();
    this.save();
  }

  assetsDir(...parts: string[]): string {
    const p = join(this.dir, 'assets', ...parts);
    mkdirSync(p, { recursive: true });
    return p;
  }

  event(e: NewCaseEvent): void {
    this.data.events.push({ ...e, t: e.t ?? new Date().toISOString() } as CaseEvent);
    this.save();
  }

  addRun(summary: RunSummary): void {
    this.data.totals.kaneRuns += 1;
    this.data.totals.credits = Math.round((this.data.totals.credits + (summary.credits ?? 0)) * 100) / 100;
    if (summary.mode === 'replay') this.data.totals.replays += 1;
  }

  save(): void {
    this.data.updatedAt = new Date().toISOString();
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    renameSync(tmp, this.file);
  }
}
