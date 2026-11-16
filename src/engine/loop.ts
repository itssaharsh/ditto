// The Ditto loop: record the legacy app's behaviour with Kane, let Claude Code port it,
// replay the same tests on the port, and send every difference back to Claude until they match.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import type { Server } from 'node:http';
import { join, relative } from 'node:path';
import { runClaude } from './agent.js';
import { isUp, serveStatic, sh } from './apps.js';
import { CaseRecorder, summarize, type AppSide, type CaseFile, type Round, type RunSummary } from './case.js';
import type { LoadedConfig } from './config.js';
import { runTestmd, type KaneRunResult } from './kane.js';
import { loadSuite, type SuiteTest } from './suite.js';

export interface LoopOptions {
  only?: string[]; // limit to these test ids (development)
  skipPort?: boolean; // rewrite already exists (resume a case)
  log?: (line: string) => void;
}

const now = () => new Date().toISOString();

export class DittoLoop {
  readonly cfg: LoadedConfig;
  readonly rec: CaseRecorder;
  readonly kaneDir: string;
  tests: SuiteTest[];
  private servers: Server[] = [];
  private agentSession?: string;
  private log: (line: string) => void;

  constructor(cfg: LoadedConfig, opts: LoopOptions = {}) {
    this.cfg = cfg;
    this.log = opts.log ?? ((l) => console.log(l));
    const suiteDir = cfg.abs(cfg.suite);
    this.tests = loadSuite(suiteDir, relative(cfg.root, suiteDir));
    if (opts.only?.length) this.tests = this.tests.filter((t) => opts.only!.includes(t.id));
    this.kaneDir = cfg.abs(join(cfg.workDir, 'kane', cfg.case));
    this.rec = new CaseRecorder(cfg.abs(join(cfg.casesDir, cfg.case)), () => this.initCase());
    this.rec.data.suite.tests = this.tests;
    this.rec.save();
    this.prepareRunCopies();
  }

  private initCase(): CaseFile {
    const c = this.cfg;
    return {
      id: c.case,
      title: c.title,
      createdAt: now(),
      updatedAt: now(),
      status: 'recording',
      apps: {
        legacy: { label: c.legacy.label, url: this.cfg.legacyUrl, framework: c.legacy.framework, source: c.legacy.source },
        rewrite: { label: c.rewrite.label, url: this.cfg.rewriteUrl, framework: c.rewrite.framework, source: c.rewrite.source },
      },
      suite: { name: c.case, designedBy: 'Kane CLI (context ingest → extract → design tests)', spec: undefined, tests: [] },
      oracle: {},
      rounds: [],
      events: [],
      totals: { kaneRuns: 0, credits: 0, agentCostUsd: 0, replays: 0 },
    };
  }

  /** Kane keeps each test's recording next to the file it ran; keep those copies out of the repo. */
  private prepareRunCopies(): void {
    mkdirSync(this.kaneDir, { recursive: true });
    for (const t of this.tests) {
      const target = join(this.kaneDir, `${t.id}_test.md`);
      if (!existsSync(target)) copyFileSync(this.cfg.abs(t.file), target);
    }
  }

  async startApps(): Promise<void> {
    const { cfg } = this;
    if (!(await isUp(cfg.legacyUrl))) {
      this.servers.push(await serveStatic(cfg.abs(cfg.legacy.dir), cfg.legacy.port));
      this.log(`serving legacy app on ${cfg.legacyUrl}`);
    }
    const dist = join(cfg.abs(cfg.rewrite.repo), cfg.rewrite.dist);
    if (existsSync(dist) && !(await isUp(cfg.rewriteUrl))) {
      this.servers.push(await serveStatic(dist, cfg.rewrite.port));
      this.log(`serving rewrite on ${cfg.rewriteUrl}`);
    }
  }

  async ensureRewriteServed(): Promise<void> {
    if (await isUp(this.cfg.rewriteUrl)) return;
    const dist = join(this.cfg.abs(this.cfg.rewrite.repo), this.cfg.rewrite.dist);
    this.servers.push(await serveStatic(dist, this.cfg.rewrite.port));
  }

  stopApps(): void {
    for (const s of this.servers) s.close();
    this.servers = [];
  }

  private creditsLeft(): boolean {
    return this.rec.data.totals.credits < this.cfg.creditCap;
  }

  // ---------- Kane runs ----------

  private async kane(test: SuiteTest, side: AppSide, round: number, phase: 'author' | 'replay' | 'heal'): Promise<RunSummary> {
    const url = side === 'legacy' ? this.cfg.legacyUrl : this.cfg.rewriteUrl;
    const file = join(this.kaneDir, `${test.id}_test.md`);
    const mode: RunSummary['mode'] = phase === 'author' ? 'author' : phase === 'replay' ? 'replay' : 'replay+heal';
    const stamp = `${side}-r${round}-${phase}`;
    this.rec.event({ kind: 'kane_start', side, test: test.id, round, mode });
    const r: KaneRunResult = await runTestmd(file, {
      cwd: this.kaneDir,
      url: side === 'legacy' ? url : undefined,
      overrideStartUrl: side === 'rewrite' ? url : undefined,
      noAdaptiveHeal: phase === 'replay',
      bugDetection: 'continue',
      maxSteps: 25,
      timeoutS: 900,
      variables: { start_url: url },
      local: side === 'rewrite',
      assetsDir: this.rec.assetsDir(test.id, stamp),
      assetsRel: `assets/${test.id}/${stamp}`,
      onLine: (e) => {
        if (e.type === 'step_end') {
          this.rec.event({
            kind: 'kane_step',
            side,
            test: test.id,
            round,
            step: Number(e.ordinal ?? e.index ?? 0),
            status: String(e.status ?? ''),
            remark: String(e.summary ?? ''),
          });
        }
      },
    });
    const s = summarize(r, mode);
    this.rec.addRun(s);
    this.rec.event({ kind: 'kane_end', side, test: test.id, round, outcome: s.outcome, oneLiner: s.oneLiner ?? s.reason });
    this.log(`  kane ${side.padEnd(7)} ${test.id.padEnd(48)} ${s.outcome.padEnd(10)} ${s.mode} ${s.credits ?? 0}cr ${Math.round(s.durationS ?? 0)}s`);
    return s;
  }

  private async pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
    const queue = [...items];
    const workers = Array.from({ length: Math.min(n, queue.length) }, async () => {
      while (queue.length) {
        const item = queue.shift()!;
        await fn(item);
      }
    });
    await Promise.all(workers);
  }

  // ---------- Stage 1: the legacy app is the oracle ----------

  async recordOracle(): Promise<void> {
    this.rec.data.status = 'recording';
    this.rec.event({ kind: 'note', text: `Recording ${this.tests.length} behaviours on the legacy app (${this.cfg.legacy.label}).` });
    await this.pool(this.tests, this.cfg.parallel, async (t) => {
      if (!this.creditsLeft()) return;
      const prev = this.rec.data.oracle[t.id];
      // A recorded pass replays from cache; anything else authors.
      const phase = prev?.outcome === 'pass' ? 'replay' : 'author';
      let s = await this.kane(t, 'legacy', 0, phase);
      if (s.outcome === 'test_issue') {
        this.rec.event({ kind: 'decision', round: 0, test: t.id, said: `Kane blamed the test, not the app: ${s.oneLiner ?? s.reason ?? ''}`, did: 'Ran it once more from scratch' });
        s = await this.kane(t, 'legacy', 0, 'author');
      }
      if (s.outcome !== 'pass') {
        this.rec.event({
          kind: 'decision',
          round: 0,
          test: t.id,
          said: `The legacy app fails "${t.title}": ${s.oneLiner ?? s.reason ?? s.outcome}`,
          did: 'Left out of parity and listed as a place where the legacy app already differs from its spec',
        });
      }
      this.rec.data.oracle[t.id] = s;
      this.rec.save();
    });
    const pass = this.oraclePassing().length;
    this.rec.event({ kind: 'note', text: `Oracle ready: ${pass} of ${this.tests.length} behaviours hold on the legacy app.` });
  }

  oraclePassing(): SuiteTest[] {
    return this.tests.filter((t) => this.rec.data.oracle[t.id]?.outcome === 'pass');
  }

  // ---------- Stage 2: the agent ports the app ----------

  async port(): Promise<boolean> {
    const { cfg } = this;
    const repo = cfg.abs(cfg.rewrite.repo);
    mkdirSync(repo, { recursive: true });
    if (!existsSync(join(repo, '.git'))) await sh('git init -q && git commit -q --allow-empty -m "Empty repository for the port"', repo);
    this.rec.data.status = 'porting';
    const round = this.newRound(0);
    const prompt = cfg.agent.portPrompt.replaceAll('{legacyDir}', cfg.abs(cfg.legacy.dir));
    round.agent = { kind: 'port', round: 0, prompt, startedAt: now(), filesChanged: [] };
    this.rec.event({ kind: 'agent_start', round: 0, agentKind: 'port', prompt });
    const res = await runClaude({
      cwd: repo,
      prompt,
      model: cfg.agent.model,
      addDirs: [cfg.abs(cfg.legacy.dir)],
      maxTurns: cfg.agent.maxTurnsPort ?? 120,
      onTool: (tool, detail) => this.rec.event({ kind: 'agent_tool', round: 0, tool, detail }),
      onText: (text) => this.rec.event({ kind: 'agent_text', round: 0, text: text.slice(0, 600) }),
    });
    this.agentSession = res.sessionId;
    await this.finishAgentTurn(round.n, res, 'Port the jQuery app to React (Claude Code)');
    return res.ok;
  }

  private newRound(n: number): Round {
    const existing = this.rec.data.rounds.find((r) => r.n === n);
    if (existing) return existing;
    const r: Round = { n, results: {} };
    this.rec.data.rounds.push(r);
    this.rec.save();
    return r;
  }

  private async finishAgentTurn(n: number, res: Awaited<ReturnType<typeof runClaude>>, commitMsg: string): Promise<void> {
    const repo = this.cfg.abs(this.cfg.rewrite.repo);
    const round = this.newRound(n);
    await sh('git add -A', repo);
    const stat = await sh('git diff --cached --stat', repo);
    const names = await sh('git diff --cached --name-only', repo);
    await sh(`git commit -q -m ${JSON.stringify(commitMsg)} || true`, repo);
    const head = await sh('git rev-parse --short HEAD', repo);
    const a = round.agent!;
    a.endedAt = now();
    a.sessionId = res.sessionId;
    a.model = res.model;
    a.costUsd = res.costUsd;
    a.turns = res.turns;
    a.summary = res.finalText?.slice(0, 1500) ?? res.error;
    a.ok = res.ok;
    a.filesChanged = names.output.split('\n').map((s) => s.trim()).filter(Boolean).filter((f) => !f.startsWith('node_modules'));
    a.diffStat = stat.output.trim().split('\n').at(-1)?.trim();
    a.commit = head.output.trim();
    this.rec.data.totals.agentCostUsd = Math.round((this.rec.data.totals.agentCostUsd + (res.costUsd ?? 0)) * 100) / 100;
    this.rec.event({ kind: 'agent_end', round: n, summary: a.summary, filesChanged: a.filesChanged, costUsd: res.costUsd });
    this.log(`agent round ${n}: ${res.ok ? 'done' : 'error'} · ${a.diffStat ?? ''} · $${res.costUsd?.toFixed(2) ?? '?'}`);
  }

  async build(n: number): Promise<boolean> {
    const repo = this.cfg.abs(this.cfg.rewrite.repo);
    let out = await sh(this.cfg.rewrite.build, repo, 600_000);
    let tries = 0;
    while (out.code !== 0 && tries < 2) {
      tries++;
      const detail = out.output.slice(-3000);
      this.rec.event({ kind: 'build', round: n, ok: false, detail: detail.slice(-600) });
      this.rec.event({ kind: 'decision', round: n, test: '-', said: 'The port does not build', did: 'Sent the build error to Claude Code' });
      const res = await runClaude({
        cwd: repo,
        prompt: `The build command \`${this.cfg.rewrite.build}\` fails:\n\n${detail}\n\nFix it so the build passes. Do not change behaviour.`,
        model: this.cfg.agent.model,
        resume: this.agentSession,
        maxTurns: this.cfg.agent.maxTurnsFix ?? 40,
        onTool: (tool, d) => this.rec.event({ kind: 'agent_tool', round: n, tool, detail: d }),
      });
      if (res.sessionId) this.agentSession = res.sessionId;
      out = await sh(this.cfg.rewrite.build, repo, 600_000);
    }
    const round = this.newRound(n);
    round.build = { ok: out.code === 0, output: out.code === 0 ? undefined : out.output.slice(-1500) };
    this.rec.event({ kind: 'build', round: n, ok: out.code === 0 });
    if (out.code === 0) await this.ensureRewriteServed();
    return out.code === 0;
  }

  // ---------- Stage 3: replay the same tests on the rewrite ----------

  /** Replay the legacy recording on the rewrite; only re-author (heal) when the pure replay misses. */
  private async checkOne(t: SuiteTest, n: number): Promise<RunSummary> {
    let s = await this.kane(t, 'rewrite', n, 'replay');
    if (s.outcome !== 'pass' && this.creditsLeft()) {
      this.rec.event({
        kind: 'decision',
        round: n,
        test: t.id,
        said: `Replaying the legacy recording on the rewrite missed: ${s.oneLiner ?? s.reason ?? s.outcome}`,
        did: 'Let Kane re-author the missed steps on the new markup and judge again',
      });
      s = await this.kane(t, 'rewrite', n, 'heal');
    }
    return s;
  }

  async check(n: number, scope: SuiteTest[]): Promise<SuiteTest[]> {
    this.rec.data.status = 'checking';
    const round = this.newRound(n);
    await this.pool(scope, this.cfg.parallel, async (t) => {
      if (!this.creditsLeft()) return;
      round.results[t.id] = await this.checkOne(t, n);
      this.rec.save();
    });
    const failing = scope.filter((t) => round.results[t.id]?.outcome !== 'pass');
    const matched = this.matchedCount(n);
    this.rec.event({ kind: 'parity', round: n, matched, total: this.oraclePassing().length });
    return failing;
  }

  /** Latest result per oracle test across rounds up to n. */
  latest(testId: string, upTo = Infinity): RunSummary | undefined {
    let found: RunSummary | undefined;
    for (const r of [...this.rec.data.rounds].sort((a, b) => a.n - b.n)) {
      if (r.n > upTo) break;
      if (r.results[testId]) found = r.results[testId];
    }
    return found;
  }

  matchedCount(upTo = Infinity): number {
    return this.oraclePassing().filter((t) => this.latest(t.id, upTo)?.outcome === 'pass').length;
  }

  // ---------- Stage 4: feed differences back to the agent ----------

  feedback(failing: SuiteTest[], n: number): string {
    const lines: string[] = [];
    lines.push(
      'Kane CLI ran the same plain-English behaviour tests on the legacy jQuery app (the reference) and on your React port in a real browser.',
      `These ${failing.length} behaviour(s) pass on the legacy app but fail on your port:`,
      '',
    );
    failing.forEach((t, i) => {
      const s = this.latest(t.id, n);
      const legacy = this.rec.data.oracle[t.id];
      lines.push(`${i + 1}. ${t.title}${t.summary ? ` (${t.summary})` : ''}`);
      lines.push('   The test, step by step:');
      t.steps.forEach((st, j) => lines.push(`   - Step ${j + 1}: ${st.text.replace(/\{\{start_url\}\}/g, 'the app')}`));
      if (s?.verdict?.oneLiner || s?.oneLiner) lines.push(`   Kane's verdict on your port: ${s?.verdict?.oneLiner ?? s?.oneLiner}`);
      if (s?.verdict?.rootCause) lines.push(`   Kane's root cause: ${s.verdict.rootCause}`);
      if (s?.reason) lines.push(`   Failed check: ${s.reason}`);
      if (s?.failureMessage && s.failureMessage !== s.reason) lines.push(`   Failure record: ${s.failureMessage}`);
      const shot = s?.shots.filter((x) => x.kind === 'screenshot').at(-1);
      const legacyShot = legacy?.shots.filter((x) => x.kind === 'screenshot').at(-1);
      if (shot) lines.push(`   Screenshot of your port when it failed: ${join(this.rec.dir, shot.file)}`);
      if (legacyShot) lines.push(`   Screenshot of the legacy app at the end of the same test: ${join(this.rec.dir, legacyShot.file)}`);
      if (s?.consoleErrors.length) lines.push(`   Browser console on your port: ${s.consoleErrors.slice(0, 4).join(' | ')}`);
      lines.push('');
    });
    lines.push(
      'Read the screenshots, compare with the legacy code, and fix the port so it behaves exactly like the legacy app for these behaviours.',
      'Do not change anything unrelated. Run the build and make sure it passes.',
      'Finish with two or three sentences saying what you changed and why.',
    );
    return lines.join('\n');
  }

  async fix(n: number, failing: SuiteTest[]): Promise<void> {
    this.rec.data.status = 'fixing';
    const round = this.newRound(n);
    const prompt = this.feedback(failing, n - 1);
    for (const t of failing) {
      const s = this.latest(t.id, n - 1);
      this.rec.event({ kind: 'decision', round: n, test: t.id, said: s?.verdict?.oneLiner ?? s?.oneLiner ?? s?.reason ?? 'behaviour differs', did: `Sent to Claude Code with both screenshots (round ${n})` });
    }
    round.agent = { kind: 'fix', round: n, prompt, startedAt: now(), filesChanged: [] };
    this.rec.event({ kind: 'agent_start', round: n, agentKind: 'fix', prompt });
    const res = await runClaude({
      cwd: this.cfg.abs(this.cfg.rewrite.repo),
      prompt,
      model: this.cfg.agent.model,
      resume: this.agentSession,
      addDirs: [this.cfg.abs(this.cfg.legacy.dir), this.rec.dir],
      maxTurns: this.cfg.agent.maxTurnsFix ?? 60,
      onTool: (tool, detail) => this.rec.event({ kind: 'agent_tool', round: n, tool, detail }),
      onText: (text) => this.rec.event({ kind: 'agent_text', round: n, text: text.slice(0, 600) }),
    });
    if (res.sessionId) this.agentSession = res.sessionId;
    await this.finishAgentTurn(n, res, `Round ${n}: fix ${failing.length} behaviour(s) Kane flagged\n\n${failing.map((t) => `- ${t.title}`).join('\n')}`);
  }

  // ---------- Everything ----------

  async run(opts: LoopOptions = {}): Promise<CaseFile> {
    await this.startApps();
    try {
      if (!Object.keys(this.rec.data.oracle).length || this.tests.some((t) => !this.rec.data.oracle[t.id])) {
        await this.recordOracle();
      }
      const scopeAll = this.oraclePassing();
      if (!opts.skipPort) {
        const ok = await this.port();
        if (!ok) this.rec.event({ kind: 'note', text: 'The agent stopped early; checking what it built.' });
      } else {
        this.agentSession = [...this.rec.data.rounds].reverse().find((r) => r.agent?.sessionId)?.agent?.sessionId;
      }
      let n = Math.max(0, ...this.rec.data.rounds.map((r) => r.n));
      if (!(await this.build(n))) {
        this.rec.data.status = 'failed';
        this.rec.event({ kind: 'note', text: 'The port does not build; stopping.' });
        return this.rec.data;
      }
      let failing = await this.check(n, scopeAll);
      while (failing.length && n < this.cfg.maxRounds && this.creditsLeft()) {
        n += 1;
        await this.fix(n, failing);
        if (!(await this.build(n))) break;
        const retest = await this.check(n, failing);
        failing = retest;
        if (!failing.length) {
          // A fix can break something that passed before: replay everything once more (cheap).
          const regress = await this.check(n, scopeAll.filter((t) => !retest.includes(t)));
          failing = regress;
        }
      }
      this.rec.data.status = failing.length ? 'stopped' : 'parity';
      this.rec.event({
        kind: 'note',
        text: failing.length
          ? `Stopped after round ${n} with ${failing.length} behaviour(s) still different.`
          : `Parity: all ${scopeAll.length} behaviours that hold on the legacy app hold on the rewrite.`,
      });
      return this.rec.data;
    } finally {
      this.rec.save();
      this.stopApps();
    }
  }
}

export function listCases(casesDir: string): string[] {
  return existsSync(casesDir) ? readdirSync(casesDir).filter((d) => existsSync(join(casesDir, d, 'case.json'))) : [];
}
