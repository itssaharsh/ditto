// The Ditto loop: record the legacy app's behaviour with Kane, let Claude Code port it,
// replay the same tests on the port, and send every difference back to Claude until they match.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { dirname, join, relative } from 'node:path';
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
    this.kaneDir = cfg.abs(join(cfg.workDir, 'kane', cfg.oracleCase ?? cfg.case));
    this.rec = new CaseRecorder(cfg.abs(join(cfg.casesDir, cfg.case)), () => this.initCase());
    if (cfg.oracleCase && !Object.keys(this.rec.data.oracle).length) this.adoptOracle(cfg.oracleCase);
    this.rec.data.suite.tests = this.tests;
    this.rec.data.suite.variables = cfg.variables;
    this.rec.data.suite.spec = cfg.spec;
    if (cfg.namedExample) this.rec.data.named = cfg.namedExample;
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

  /** Start from another case's oracle: same legacy app, same suite, same Kane recordings. */
  private adoptOracle(from: string): void {
    const srcDir = this.cfg.abs(join(this.cfg.casesDir, from));
    const src = JSON.parse(readFileSync(join(srcDir, 'case.json'), 'utf8')) as CaseFile;
    for (const [id, run] of Object.entries(src.oracle)) {
      for (const shot of run.shots) {
        const from = join(srcDir, shot.file);
        const to = join(this.rec.dir, shot.file);
        if (existsSync(from)) {
          mkdirSync(dirname(to), { recursive: true });
          copyFileSync(from, to);
        }
      }
      this.rec.data.oracle[id] = run;
    }
    this.rec.data.totals.credits = 0;
    this.rec.event({ kind: 'note', text: `Using the oracle recorded for "${src.title}" (${src.createdAt.slice(0, 10)}): the same legacy app, tests and Kane recordings.` });
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
    if (cfg.legacy.dir && !(await isUp(cfg.legacyUrl))) {
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

  private async kane(test: SuiteTest, side: AppSide, round: number, phase: 'author' | 'replay' | 'heal' | 'fresh'): Promise<RunSummary> {
    const url = side === 'legacy' ? this.cfg.legacyUrl : this.cfg.rewriteUrl;
    // 'fresh' authors the test from scratch on the rewrite, in its own copy, without the legacy recording.
    // One folder per case and round, emptied first, so a fresh run can never replay an older recording.
    const freshDir = join(this.kaneDir, 'rewrite-fresh', this.cfg.case, `r${round}`, test.id);
    if (phase === 'fresh') {
      rmSync(freshDir, { recursive: true, force: true });
      mkdirSync(freshDir, { recursive: true });
      copyFileSync(this.cfg.abs(test.file), join(freshDir, `${test.id}_test.md`));
    }
    const file = phase === 'fresh' ? join(freshDir, `${test.id}_test.md`) : join(this.kaneDir, `${test.id}_test.md`);
    const mode: RunSummary['mode'] = phase === 'author' || phase === 'fresh' ? 'author' : phase === 'replay' ? 'replay' : 'replay+heal';
    const stamp = `${side}-r${round}-${phase}`;
    this.rec.event({ kind: 'kane_start', side, test: test.id, round, mode });
    const r: KaneRunResult = await runTestmd(file, {
      cwd: phase === 'fresh' ? freshDir : this.kaneDir,
      url: side === 'legacy' || phase === 'fresh' ? url : undefined,
      overrideStartUrl: side === 'rewrite' && phase !== 'fresh' ? url : undefined,
      noAdaptiveHeal: phase === 'replay',
      bugDetection: 'continue',
      maxSteps: 25,
      timeoutS: 900,
      variables: { ...(this.cfg.variables ?? {}), start_url: url },
      local: side === 'rewrite' && phase !== 'fresh',
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
    // A replay on the rewrite must never touch the legacy app (an absolute URL in a recorded step would).
    if (side === 'rewrite' && s.urls?.some((u) => u.startsWith(this.cfg.legacyUrl.replace(/\/$/, '')))) {
      s.outcome = 'error';
      s.reason = `The replay left the rewrite and opened the legacy app (${s.urls.find((u) => u.includes(String(this.cfg.legacy.port)))}); not counted.`;
    }
    this.rec.addRun(s);
    this.rec.event({ kind: 'kane_end', side, test: test.id, round, outcome: s.outcome, oneLiner: s.oneLiner ?? s.reason });
    this.log(`  kane ${side.padEnd(7)} ${test.id.padEnd(48)} ${s.outcome.padEnd(10)} ${s.mode} ${s.credits ?? 0}cr ${Math.round(s.durationS ?? 0)}s`);
    return s;
  }

  private async pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
    const queue = [...items];
    // Kane runs that start in the same instant can race each other at start-up: stagger the workers.
    const workers = Array.from({ length: Math.min(n, queue.length) }, async (_, w) => {
      if (w > 0) await new Promise((r) => setTimeout(r, w * 12_000));
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
    // Only tests with no clean verdict yet run again: passes are recorded and legacy deviations are settled.
    const todo = this.tests.filter((t) => {
      const prev = this.rec.data.oracle[t.id];
      return (
        !prev ||
        prev.outcome === 'error' ||
        prev.outcome === 'test_issue' ||
        ((prev.outcome === 'mismatch' || prev.outcome === 'fail') && !prev.confirmed) ||
        (prev.outcome === 'pass' && !prev.replayVerified)
      );
    });
    await this.pool(todo, this.cfg.parallel, async (t) => {
      if (!this.creditsLeft()) return;
      const prevPass = this.rec.data.oracle[t.id];
      if (prevPass?.outcome === 'pass' && !prevPass.replayVerified) {
        this.rec.data.oracle[t.id] = await this.verifyReplay(t, prevPass);
        this.rec.save();
        return;
      }
      let s = await this.kane(t, 'legacy', 0, 'author');
      if (s.outcome === 'error' || s.outcome === 'fail') {
        this.rec.event({ kind: 'decision', round: 0, test: t.id, said: `Kane could not finish: ${s.oneLiner ?? s.reason ?? s.outcome}`, did: 'Ran it again' });
        s = await this.kane(t, 'legacy', 0, 'author');
      }
      if (s.outcome === 'test_issue') {
        this.rec.event({ kind: 'decision', round: 0, test: t.id, said: `Kane blamed the test, not the app: ${s.oneLiner ?? s.reason ?? ''}`, did: 'Ran it once more from scratch' });
        s = await this.kane(t, 'legacy', 0, 'author');
      }
      if (s.outcome === 'mismatch' || s.outcome === 'fail') {
        // A deviation of the old app must reproduce: run it once more before believing it.
        const prevEntry = this.rec.data.oracle[t.id];
        const first = prevEntry && (prevEntry.outcome === 'mismatch' || prevEntry.outcome === 'fail') && !prevEntry.confirmed ? prevEntry : s;
        const second = first === s ? await this.kane(t, 'legacy', 0, 'author') : s;
        if (second.outcome === 'pass') {
          this.rec.event({
            kind: 'decision',
            round: 0,
            test: t.id,
            said: `Kane's first run said the old app fails "${t.title}" (${first.oneLiner ?? first.reason ?? ''}), but the second run passed`,
            did: 'Kept it in the parity set: a deviation has to reproduce',
          });
          s = second;
        } else if (second.outcome === 'mismatch' || second.outcome === 'fail') {
          s = { ...second, confirmed: true };
          this.rec.event({
            kind: 'decision',
            round: 0,
            test: t.id,
            said: `The old app fails "${t.title}" twice: ${second.oneLiner ?? second.reason ?? second.outcome}`,
            did: 'Left out of parity and listed as a place where the old app already differs from its spec',
          });
        } else {
          s = second;
        }
      }
      if (s.outcome !== 'pass' && s.outcome !== 'mismatch' && s.outcome !== 'fail') {
        this.rec.event({
          kind: 'decision',
          round: 0,
          test: t.id,
          said: `Kane could not get a clean run of "${t.title}" (${s.outcome === 'test_issue' ? 'it judged the test itself unreliable' : 'browser or environment problem'}): ${s.oneLiner ?? s.reason ?? ''}`,
          did: 'Left out of parity and marked as not verified',
        });
      }
      if (s.outcome === 'pass' && !s.replayVerified) s = await this.verifyReplay(t, s);
      this.rec.data.oracle[t.id] = s;
      this.rec.save();
    });
    const pass = this.oraclePassing().length;
    this.rec.event({ kind: 'note', text: `Oracle ready: ${pass} of ${this.tests.length} behaviours hold on the legacy app.` });
  }

  /** A pass only counts if Kane's recording of it replays cleanly on the old app (no re-authoring). */
  private async verifyReplay(t: SuiteTest, authored: RunSummary): Promise<RunSummary> {
    const r = await this.kane(t, 'legacy', 0, 'replay');
    if (r.outcome === 'pass' && (r.authorDecisions ?? 0) === 0) {
      return { ...authored, replayVerified: true, replaySeconds: r.durationS };
    }
    this.rec.event({
      kind: 'decision',
      round: 0,
      test: t.id,
      said: `The recorded run of "${t.title}" did not replay cleanly on the old app: ${r.oneLiner ?? r.reason ?? r.outcome}`,
      did: 'Left out of parity as not verified: an unstable recording cannot judge the rewrite',
    });
    return { ...authored, outcome: 'test_issue', reason: `Recording did not replay cleanly: ${r.oneLiner ?? r.reason ?? r.outcome}` };
  }

  oraclePassing(): SuiteTest[] {
    return this.tests.filter((t) => this.rec.data.oracle[t.id]?.outcome === 'pass');
  }

  // ---------- Stage 2: the agent ports the app ----------

  async port(): Promise<boolean> {
    const { cfg } = this;
    const repo = cfg.abs(cfg.rewrite.repo);
    mkdirSync(repo, { recursive: true });
    if (!existsSync(join(repo, '.git'))) {
      writeFileSync(join(repo, '.gitignore'), 'node_modules/\ndist/\n');
      await sh('git init -q && git add .gitignore && git commit -q -m "Empty repository for the port"', repo);
    }
    this.rec.data.status = 'porting';
    const round = this.newRound(0);
    const prompt = cfg.agent.portPrompt.replaceAll('{legacyDir}', cfg.legacy.dir ? cfg.abs(cfg.legacy.dir) : cfg.legacyUrl);
    round.agent = { kind: 'port', round: 0, prompt, startedAt: now(), filesChanged: [] };
    this.rec.event({ kind: 'agent_start', round: 0, agentKind: 'port', prompt });
    const res = await runClaude({
      cwd: repo,
      prompt,
      model: cfg.agent.model,
      addDirs: cfg.legacy.dir ? [cfg.abs(cfg.legacy.dir)] : [],
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
    const msgFile = join(this.cfg.abs(this.cfg.workDir), `commit-msg-${n}.txt`);
    writeFileSync(msgFile, commitMsg + '\n');
    await sh(`git commit -q -F ${JSON.stringify(msgFile)} || true`, repo);
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
    a.commit = head.output.trim().split('\n').filter((l) => /^[0-9a-f]{7,40}$/.test(l.trim())).at(-1)?.trim();
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
    // A replay that never reached the rewrite (or crashed) says nothing about it: run it again before healing.
    const origin = this.cfg.rewriteUrl.replace(/\/$/, '');
    const reached = (x: RunSummary) => (x.urls ?? []).some((u) => u.startsWith(origin));
    if (s.outcome === 'error' || (s.outcome !== 'pass' && !reached(s))) s = await this.kane(t, 'rewrite', n, 'replay');
    if (s.outcome !== 'pass' && this.creditsLeft()) {
      this.rec.event({
        kind: 'decision',
        round: n,
        test: t.id,
        said: `Replaying the legacy recording on the rewrite missed: ${s.oneLiner ?? s.reason ?? s.outcome}`,
        did: 'Let Kane re-author the missed steps on the new markup and judge again',
      });
      s = await this.kane(t, 'rewrite', n, 'heal');
      if (s.outcome === 'error') s = await this.kane(t, 'rewrite', n, 'heal');
      if ((s.outcome === 'error' || s.outcome === 'test_issue') && this.creditsLeft()) {
        this.rec.event({
          kind: 'decision',
          round: n,
          test: t.id,
          said: `Still no clean verdict: ${s.oneLiner ?? s.reason ?? s.outcome}`,
          did: 'Had Kane author the same test from scratch on the rewrite, without the legacy recording',
        });
        s = await this.kane(t, 'rewrite', n, 'fresh');
      }
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
    // Only differences Kane confirmed on the rewrite go to the agent; unclear results are never blamed on it.
    const failing = scope.filter((t) => {
      const o = round.results[t.id]?.outcome;
      return o === 'mismatch' || o === 'fail';
    });
    const matched = this.matchedCount(n);
    this.rec.event({ kind: 'parity', round: n, matched, total: this.oraclePassing().length });
    return failing;
  }

  /** Behaviours whose latest rewrite result is neither a pass nor a confirmed difference. */
  unclear(upTo = Infinity): SuiteTest[] {
    return this.oraclePassing().filter((t) => {
      const o = this.latest(t.id, upTo)?.outcome;
      return o === 'test_issue' || o === 'error' || o === undefined;
    });
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

  /** Copies one screenshot into a per-round folder the agent may read (it never gets the case folder). */
  private feedbackFile(n: number, testId: string, side: string, file: string): string {
    const dir = this.feedbackDir(n);
    const ext = file.endsWith('.png') ? 'png' : 'jpg';
    const target = join(dir, `${testId}-${side}.${ext}`);
    copyFileSync(join(this.rec.dir, file), target);
    return target;
  }

  private feedbackDir(n: number): string {
    const dir = this.cfg.abs(join(this.cfg.workDir, 'feedback', this.cfg.case, `round-${n + 1}`));
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  private fillVars(text: string): string {
    return text
      .replace(/\{\{start_url\}\}/g, 'the app')
      .replace(/\{\{([a-z_]+)\}\}/g, (m, k: string) => (this.cfg.variables?.[k] ? `'${this.cfg.variables[k]}'` : m));
  }

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
      t.steps.forEach((st, j) => lines.push(`   - Step ${j + 1}: ${this.fillVars(st.text)}`));
      if (s?.verdict?.oneLiner || s?.oneLiner) lines.push(`   Kane's verdict on your port: ${s?.verdict?.oneLiner ?? s?.oneLiner}`);
      if (s?.verdict?.rootCause) lines.push(`   Kane's root cause: ${s.verdict.rootCause}`);
      if (s?.reason) lines.push(`   Failed check: ${s.reason}`);
      if (s?.failureMessage && s.failureMessage !== s.reason) lines.push(`   Failure record: ${s.failureMessage}`);
      const failedShot = s?.shots.find((x) => x.status === 'failed' && x.kind === 'annotated') ?? s?.shots.find((x) => x.status === 'failed');
      const shot = failedShot ?? s?.shots.filter((x) => x.kind === 'screenshot').at(-1);
      const mdStep = shot ? Number(shot.step.split('-')[1]) : NaN;
      const legacyShot =
        legacy?.shots.filter((x) => x.kind === 'screenshot' && Number(x.step.split('-')[1]) === mdStep).at(-1) ??
        legacy?.shots.filter((x) => x.kind === 'screenshot').at(-1);
      if (!Number.isNaN(mdStep)) lines.push(`   It went wrong in step ${mdStep + 1}.`);
      if (shot) lines.push(`   Screenshot of your port at that step: ${this.feedbackFile(n, t.id, 'rewrite', shot.file)}`);
      if (legacyShot) lines.push(`   Screenshot of the legacy app at the same step: ${this.feedbackFile(n, t.id, 'legacy', legacyShot.file)}`);
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
      addDirs: [...(this.cfg.legacy.dir ? [this.cfg.abs(this.cfg.legacy.dir)] : []), this.feedbackDir(n - 1)],
      maxTurns: this.cfg.agent.maxTurnsFix ?? 60,
      onTool: (tool, detail) => this.rec.event({ kind: 'agent_tool', round: n, tool, detail }),
      onText: (text) => this.rec.event({ kind: 'agent_text', round: n, text: text.slice(0, 600) }),
    });
    if (res.sessionId) this.agentSession = res.sessionId;
    await this.finishAgentTurn(n, res, `Round ${n}: fix ${failing.length} behaviour(s) Kane flagged\n\n${failing.map((t) => `- ${t.title}`).join('\n')}`);
  }

  // ---------- Hand-over: the suite becomes the rewrite's own regression tests ----------

  async promote(): Promise<void> {
    const repo = this.cfg.abs(this.cfg.rewrite.repo);
    const dir = join(repo, 'tests', 'kane');
    mkdirSync(dir, { recursive: true });
    for (const t of this.oraclePassing()) copyFileSync(this.cfg.abs(t.file), join(dir, `${t.id}_test.md`));
    const vars = Object.fromEntries(
      Object.entries({ ...(this.cfg.variables ?? {}), start_url: `http://127.0.0.1:${this.cfg.rewrite.port}/` }).map(([k, v]) => [k, { value: v, secret: false }]),
    );
    mkdirSync(join(repo, '.testmuai', 'variables'), { recursive: true });
    writeFileSync(join(repo, '.testmuai', 'variables', 'ditto.json'), JSON.stringify(vars, null, 2) + '\n');
    writeFileSync(
      join(dir, 'README.md'),
      [
        '# Behaviour tests (Kane CLI)',
        '',
        `These ${this.oraclePassing().length} plain-English tests were designed by Kane CLI from the TodoMVC spec, passed on the original jQuery app, and were used by [Ditto](https://github.com/itssaharsh/ditto) to check this port until every one passed here too.`,
        '',
        'Run them against a local build:',
        '',
        '```bash',
        'npm run build && npx serve -l 7002 dist   # or any static server on port 7002',
        'kane-cli testrun run tests/kane --parallel 3 < /dev/null',
        '```',
        '',
        'The start URL and test values come from `.testmuai/variables/ditto.json`.',
        '',
      ].join('\n'),
    );
    const wf = this.cfg.abs('examples/ci/kane-behaviour-tests.yml');
    if (existsSync(wf)) {
      mkdirSync(join(repo, '.github', 'workflows'), { recursive: true });
      copyFileSync(wf, join(repo, '.github', 'workflows', 'kane-behaviour-tests.yml'));
    }
    const gi = join(repo, '.gitignore');
    const extra = '\n# Kane CLI: recordings and evidence hold account details\n.testmuai/evidence/\n**/output-*/.internal/\n*.evidence\n';
    const cur = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
    if (!cur.includes('output-*/.internal')) writeFileSync(gi, cur + extra);
    await sh('git add -A && git commit -q -m "Add the Kane behaviour tests Ditto used as this port\u0027s regression suite" || true', repo);
    this.rec.event({ kind: 'note', text: `Copied the ${this.oraclePassing().length} tests into the rewrite repo (tests/kane) as its regression suite.` });
  }

  // ---------- Spec gaps: what the spec asks and the old app never did ----------

  /** Behaviours the old app fails (or Kane could not verify on it for reasons other than an unstable recording). */
  specGaps(): SuiteTest[] {
    return this.tests.filter((t) => {
      const o = this.rec.data.oracle[t.id];
      if (!o || o.outcome === 'pass' || o.outcome === 'error') return false;
      return !(o.reason ?? '').startsWith('Recording did not replay cleanly');
    });
  }

  async closeSpecGaps(maxRounds = 3): Promise<void> {
    const gaps = this.specGaps();
    if (!gaps.length) return this.log('No spec gaps: the old app passes every behaviour Kane designed.');
    await this.startApps();
    try {
      let n = Math.max(0, ...this.rec.data.rounds.map((r) => r.n)) + 1;
      this.rec.event({ kind: 'note', text: `Checking ${gaps.length} behaviour(s) the old app never met against the rewrite, straight from the spec.` });
      if (!(await this.build(n))) return;
      const check = async (round: number, scope: SuiteTest[]) => {
        const r = this.newRound(round);
        if (!r.agent) r.label = 'Spec check';
        this.rec.data.status = 'checking';
        await this.pool(scope, this.cfg.parallel, async (t) => {
          // No legacy recording exists for these: Kane authors them fresh on the rewrite.
          r.results[t.id] = await this.kane(t, 'rewrite', round, 'fresh');
          this.rec.save();
        });
        return scope.filter((t) => r.results[t.id]?.outcome !== 'pass');
      };
      let failing = await check(n, gaps);
      let rounds = 0;
      while (failing.length && rounds < maxRounds && this.creditsLeft()) {
        rounds++;
        n++;
        const round = this.newRound(n);
        const prompt = this.specFeedback(failing, n - 1);
        for (const t of failing) {
          const s = this.latest(t.id, n - 1);
          this.rec.event({ kind: 'decision', round: n, test: t.id, said: s?.verdict?.oneLiner ?? s?.oneLiner ?? s?.reason ?? 'not met', did: `Sent the spec requirement to Claude Code with Kane's findings (round ${n})` });
        }
        round.agent = { kind: 'spec', round: n, prompt, startedAt: now(), filesChanged: [] };
        this.rec.event({ kind: 'agent_start', round: n, agentKind: 'spec', prompt });
        this.rec.data.status = 'fixing';
        const res = await runClaude({
          cwd: this.cfg.abs(this.cfg.rewrite.repo),
          prompt,
          model: this.cfg.agent.model,
          addDirs: [this.cfg.abs(dirname(this.cfg.spec)), this.feedbackDir(n - 1)],
          maxTurns: this.cfg.agent.maxTurnsFix ?? 60,
          onTool: (tool, detail) => this.rec.event({ kind: 'agent_tool', round: n, tool, detail }),
          onText: (text) => this.rec.event({ kind: 'agent_text', round: n, text: text.slice(0, 600) }),
        });
        if (res.sessionId) this.agentSession = res.sessionId;
        await this.finishAgentTurn(n, res, `Close ${failing.length} spec gap(s) Kane found\n\n${failing.map((t) => `- ${t.title}`).join('\n')}`);
        if (!(await this.build(n))) break;
        failing = await check(n, failing);
        // The parity set must still hold after the change: replay it (cheap).
        const broken = await this.check(n, this.oraclePassing());
        if (broken.length) {
          this.rec.event({ kind: 'note', text: `${broken.length} parity behaviour(s) changed while closing spec gaps; they go into the next round.` });
          failing = [...failing, ...broken];
        }
      }
      this.rec.data.status = this.unclear().length || failing.some((t) => this.oraclePassing().includes(t)) ? 'stopped' : 'parity';
      const closed = gaps.filter((t) => this.latest(t.id)?.outcome === 'pass').length;
      this.rec.event({ kind: 'note', text: `Spec gaps: ${closed} of ${gaps.length} now met on the rewrite; parity ${this.matchedCount()}/${this.oraclePassing().length}.` });
    } finally {
      this.rec.save();
      this.stopApps();
    }
  }

  specFeedback(failing: SuiteTest[], n: number): string {
    const lines: string[] = [
      `The app's spec is ${this.cfg.abs(this.cfg.spec)}. Kane CLI designed plain-English tests from it and ran them in a real browser.`,
      `These ${failing.length} behaviour(s) are required by the spec but fail on this app (the original jQuery app never met them either):`,
      '',
    ];
    failing.forEach((t, i) => {
      const s = this.latest(t.id, n);
      lines.push(`${i + 1}. ${t.title}${t.summary ? ` (${t.summary})` : ''}`);
      lines.push('   The test, step by step:');
      t.steps.forEach((st, j) => lines.push(`   - Step ${j + 1}${st.verifies.length ? ` [${st.verifies.join(', ')}]` : ''}: ${this.fillVars(st.text)}`));
      if (s?.verdict?.oneLiner || s?.oneLiner) lines.push(`   Kane's verdict: ${s?.verdict?.oneLiner ?? s?.oneLiner}`);
      if (s?.reason) lines.push(`   Failed check: ${s.reason}`);
      const shot = s?.shots.find((x) => x.status === 'failed') ?? s?.shots.at(-1);
      if (shot) lines.push(`   Screenshot when it failed: ${this.feedbackFile(n, t.id, 'rewrite', shot.file)}`);
      lines.push('');
    });
    lines.push(
      'Read the relevant parts of the spec and implement what it requires, keeping every other behaviour exactly as it is.',
      'Run the build and make sure it passes. Finish with two or three sentences saying what you changed.',
    );
    return lines.join('\n');
  }

  // ---------- Hook mode: an interactive Claude Code session asks Ditto before it stops ----------

  /** Build, replay every oracle behaviour on the rewrite, and return what still differs. */
  async hookCheck(session?: { request?: string; finalText?: string }): Promise<{ ok: boolean; message: string; round: number }> {
    await this.startApps();
    try {
      const n = Math.max(0, ...this.rec.data.rounds.map((r) => r.n)) + 1;
      const round = this.newRound(n);
      round.agent = {
        kind: 'hook',
        round: n,
        prompt: session?.request ?? '(your Claude Code session)',
        summary: session?.finalText,
        startedAt: now(),
        filesChanged: [],
      };
      const repo = this.cfg.abs(this.cfg.rewrite.repo);
      const names = await sh('git status --porcelain', repo);
      round.agent.filesChanged = names.output.split('\n').map((l) => l.slice(3).trim()).filter(Boolean);
      this.rec.event({ kind: 'agent_end', round: n, summary: 'Claude Code says it is done; the Stop hook asks Ditto first.', filesChanged: round.agent.filesChanged });
      const build = await sh(this.cfg.rewrite.build, repo, 600_000);
      round.build = { ok: build.code === 0, output: build.code === 0 ? undefined : build.output.slice(-1500) };
      if (build.code !== 0) {
        this.rec.event({ kind: 'decision', round: n, test: '-', said: 'The port does not build', did: 'Blocked the stop and sent the build error back' });
        return { ok: false, round: n, message: `Ditto: the build fails, so Kane cannot check behaviour yet.\n\n${build.output.slice(-2500)}` };
      }
      await this.ensureRewriteServed();
      const failing = await this.check(n, this.oraclePassing());
      const total = this.oraclePassing().length;
      if (!failing.length) {
        this.rec.data.status = 'parity';
        this.rec.event({ kind: 'note', text: `Parity: all ${total} behaviours that hold on the legacy app hold on the rewrite.` });
        return { ok: true, round: n, message: `Ditto: parity ${total}/${total}. Kane replayed every legacy behaviour on your port.` };
      }
      for (const t of failing) {
        const s = this.latest(t.id, n);
        this.rec.event({ kind: 'decision', round: n, test: t.id, said: s?.verdict?.oneLiner ?? s?.oneLiner ?? s?.reason ?? 'behaviour differs', did: 'Blocked the stop and sent it back to the Claude Code session' });
      }
      this.rec.data.status = 'fixing';
      return { ok: false, round: n, message: `Ditto (parity ${total - failing.length}/${total}):\n${this.feedback(failing, n)}` };
    } finally {
      this.rec.save();
      this.stopApps();
    }
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
      while (failing.length && n < this.cfg.maxRounds) {
        if (!this.creditsLeft()) {
          this.rec.event({ kind: 'note', text: `Stopped: the credit cap (${this.cfg.creditCap}) was reached.` });
          break;
        }
        n += 1;
        await this.fix(n, failing);
        if (!(await this.build(n))) break;
        const justChecked = failing;
        failing = await this.check(n, justChecked);
        if (!failing.length) {
          // A fix can break something that passed before: replay everything else once more (cheap).
          failing = await this.check(n, scopeAll.filter((t) => !justChecked.includes(t)));
        }
      }
      // Unclear results get one more chance before the verdict.
      const unclear = this.unclear(n);
      if (!failing.length && unclear.length && this.creditsLeft()) {
        this.rec.event({ kind: 'note', text: `${unclear.length} behaviour(s) had no clean verdict on the rewrite; checking them once more.` });
        failing = await this.check(n, unclear);
      }
      const stillUnclear = this.unclear(n);
      const parity = !failing.length && !stillUnclear.length;
      if (parity) await this.promote();
      this.rec.data.status = parity ? 'parity' : 'stopped';
      this.rec.event({
        kind: 'note',
        text: parity
          ? `Parity: all ${scopeAll.length} behaviours that hold on the legacy app hold on the rewrite.`
          : `Stopped after round ${n}: ${failing.length} behaviour(s) still differ and ${stillUnclear.length} have no clean verdict.`,
      });
      return this.rec.data;
    } finally {
      this.rec.save();
      this.stopApps();
    }
  }
}

/** cases/index.json: what the console lists in its case switcher, and which case it opens first. */
export function writeCasesIndex(casesDir: string): void {
  const items = listCases(casesDir).map((id) => {
    const c = JSON.parse(readFileSync(join(casesDir, id, 'case.json'), 'utf8')) as CaseFile;
    const oracle = c.suite.tests.filter((t) => c.oracle[t.id]?.outcome === 'pass');
    const latest = (tid: string) => [...c.rounds].sort((a, b) => a.n - b.n).reduce<RunSummary | undefined>((acc, r) => r.results[tid] ?? acc, undefined);
    return {
      id,
      title: c.title,
      rewrite: c.apps.rewrite.framework,
      status: c.status,
      matched: oracle.filter((t) => latest(t.id)?.outcome === 'pass').length,
      total: oracle.length,
      fixRounds: c.rounds.filter((r) => r.n > 0 && r.agent?.kind === 'fix').length,
      createdAt: c.createdAt,
    };
  });
  const best = [...items].sort((a, b) => b.fixRounds - a.fixRounds)[0];
  writeFileSync(join(casesDir, 'index.json'), JSON.stringify({ default: best?.id, cases: items }, null, 1));
}

export function listCases(casesDir: string): string[] {
  return existsSync(casesDir) ? readdirSync(casesDir).filter((d) => existsSync(join(casesDir, d, 'case.json'))) : [];
}
