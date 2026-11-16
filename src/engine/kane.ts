// Runs Kane CLI, reads its NDJSON stream, and pulls the useful parts out of the evidence pack.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { unzipSync } from 'fflate';

export type Outcome =
  | 'pass' // Kane ran the test and every check held
  | 'mismatch' // Kane confirmed the app does not behave as the test says (result 740)
  | 'test_issue' // Kane blamed the test itself, not the app (result 710 / automation_bug)
  | 'fail' // failed without a confirmed classification
  | 'error'; // Kane did not start, crashed, or hit an environment problem (e.g. the browser dropped)

export interface KaneVerdict {
  confirmed?: boolean;
  family?: string;
  category?: string;
  severity?: string;
  rootCause?: string;
  bugTitle?: string;
  suggestion?: string;
  oneLiner?: string;
  confidence?: number;
  culpritStep?: string;
}

export interface KaneStepLine {
  step: number;
  status: string;
  remark: string;
  ts?: string;
}

export interface EvidenceShot {
  step: string; // e.g. "0-3"
  kind: 'screenshot' | 'annotated';
  file: string; // path relative to the case folder
  summary?: string;
  status?: string;
}

export interface EvidenceExtract {
  shots: EvidenceShot[];
  consoleErrors: string[];
  /** Every page URL Kane was on, from the per-step records. */
  urls: string[];
  failureMessage?: string;
  culpritStep?: string;
}

export interface KaneRunResult {
  testFile: string;
  url?: string;
  outcome: Outcome;
  exitCode: number;
  durationS?: number;
  credits?: number;
  oneLiner?: string;
  summary?: string;
  reason?: string;
  resultCode?: number;
  verdict?: KaneVerdict;
  shareUrl?: string;
  sessionId?: string;
  sessionDir?: string;
  replayDecisions?: number;
  authorDecisions?: number;
  healTriggered?: boolean;
  committed?: boolean;
  steps: KaneStepLine[];
  evidence?: EvidenceExtract;
  startedAt: string;
  endedAt: string;
}

export interface RunOptions {
  /** Start URL for authoring (and the first step). */
  url?: string;
  /** Retarget a recorded replay at another build. */
  overrideStartUrl?: string;
  /** Fail instead of re-authoring when a cached replay misses. */
  noAdaptiveHeal?: boolean;
  bugDetection?: 'off' | 'stop' | 'continue';
  maxSteps?: number;
  timeoutS?: number;
  /** Values for {{name}} placeholders in the test text (e.g. start_url). */
  variables?: Record<string, string>;
  /** Run without uploading or writing the recording back (keeps the legacy recording intact). */
  local?: boolean;
  /** Folder Kane runs in; evidence copies land under its .testmuai/. */
  cwd: string;
  /** Where screenshots from the evidence pack are copied (absolute). */
  assetsDir?: string;
  /** Prefix for asset paths stored in results (relative to the case folder). */
  assetsRel?: string;
  onLine?: (event: Record<string, unknown>) => void;
}

const DEFAULT_CHROME = join(homedir(), '.local/lib/kane-chrome/chrome');
const NPM_GLOBAL_BIN = join(homedir(), '.local/opt/npm-global/bin');

export function kaneEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const path = env.PATH ?? '';
  if (existsSync(NPM_GLOBAL_BIN) && !path.split(':').includes(NPM_GLOBAL_BIN)) {
    env.PATH = `${NPM_GLOBAL_BIN}:${path}`;
  }
  if (!env.KANE_CLI_CHROME_PATH && existsSync(DEFAULT_CHROME)) env.KANE_CLI_CHROME_PATH = DEFAULT_CHROME;
  return env;
}

export function kaneBin(): string {
  return process.env.DITTO_KANE_BIN ?? 'kane-cli';
}

/** Parse one NDJSON line from Kane; non-JSON lines are skipped as the contract says. */
export function parseLine(line: string): Record<string, unknown> | null {
  const t = line.trim();
  if (!t.startsWith('{')) return null;
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function toVerdict(raw: unknown): KaneVerdict | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const v = raw as Record<string, unknown>;
  return {
    confirmed: typeof v.confirmed === 'boolean' ? v.confirmed : undefined,
    family: str(v.family),
    category: str(v.category),
    severity: str(v.severity),
    rootCause: str(v.root_cause),
    bugTitle: str(v.bug_title),
    suggestion: str(v.suggestion),
    oneLiner: str(v.one_liner),
    confidence: num(v.confidence),
    culpritStep: str(v.culprit_step),
  };
}

/**
 * Fold the whole NDJSON stream of one `kane-cli run` or `testmd run` into a result.
 * A testmd stream has one run_end per markdown step; the last failing one explains the failure.
 */
export function foldStream(events: Record<string, unknown>[], exitCode: number): Omit<KaneRunResult, 'testFile' | 'startedAt' | 'endedAt'> {
  const steps: KaneStepLine[] = [];
  let lastEnd: Record<string, unknown> | undefined;
  let failedEnd: Record<string, unknown> | undefined;
  let summary: Record<string, unknown> | undefined;
  let done: Record<string, unknown> | undefined;
  let credits = 0;
  let sawCredits = false;
  let duration = 0;

  for (const e of events) {
    const type = e.type;
    if (type === undefined && typeof e.step === 'number') {
      steps.push({ step: e.step, status: String(e.status ?? ''), remark: String(e.remark ?? ''), ts: str(e.ts) });
    } else if (type === 'run_end') {
      lastEnd = e;
      if (e.status !== 'passed') failedEnd = e;
      const c = num(e.credits_consumed) ?? num(e.credits);
      if (c !== undefined) {
        credits += c;
        sawCredits = true;
      }
      const d = num(e.duration);
      if (d !== undefined) duration += d;
    } else if (type === 'test_md_summary') {
      summary = e;
    } else if (type === 'test_md_done') {
      done = e;
    }
  }

  const end = failedEnd ?? lastEnd;
  const verdict = toVerdict(end?.verdict);
  const resultCode = num(end?.result_code);
  const summarySteps = (summary?.steps ?? {}) as Record<string, unknown>;
  const heal = (summary?.adaptive_heal ?? {}) as Record<string, unknown>;
  const commit = (summary?.commit ?? {}) as Record<string, unknown>;

  let passed: boolean;
  if (summary) passed = summary.overall_status === 'passed';
  else passed = lastEnd?.status === 'passed';

  let outcome: Outcome;
  if (!lastEnd && !summary) outcome = 'error';
  else if (passed) outcome = 'pass';
  else if (resultCode === 740 || (verdict?.family === 'application_issue' && verdict.confirmed !== false)) outcome = 'mismatch';
  else if (resultCode === 710 || verdict?.family === 'automation_bug') outcome = 'test_issue';
  else if (verdict?.family === 'environment_issue' || (resultCode !== undefined && resultCode >= 500 && resultCode < 600)) outcome = 'error';
  else outcome = 'fail';
  if (exitCode === 2 && !lastEnd) outcome = 'error';

  return {
    outcome,
    exitCode,
    durationS: duration || num(summary?.duration_s),
    credits: sawCredits ? Math.round(credits * 100) / 100 : undefined,
    oneLiner: str(end?.one_liner) ?? verdict?.oneLiner,
    summary: str(end?.summary),
    reason: str(end?.reason),
    resultCode,
    verdict,
    shareUrl: str(summary?.share_url) ?? str(done?.share_url) ?? str(end?.test_url),
    sessionId: str(done?.session_id) ?? str(end?.session_id),
    sessionDir: str(end?.session_dir),
    replayDecisions: num(summarySteps.replay_decisions),
    authorDecisions: num(summarySteps.author_decisions),
    healTriggered: typeof heal.triggered === 'boolean' ? heal.triggered : undefined,
    committed: typeof commit.committed === 'boolean' ? commit.committed : undefined,
    steps,
  };
}

/** Run one saved `_test.md` with Kane and return the folded result plus evidence. */
export function runTestmd(testFile: string, opts: RunOptions): Promise<KaneRunResult> {
  const args = ['testmd', 'run', testFile, '--agent', '--headless'];
  if (opts.url) args.push('--url', opts.url);
  if (opts.overrideStartUrl) args.push('--override-start-url', opts.overrideStartUrl);
  if (opts.noAdaptiveHeal) args.push('--no-adaptive-heal');
  if (opts.bugDetection) args.push('--bug-detection', opts.bugDetection);
  if (opts.maxSteps) args.push('--max-steps', String(opts.maxSteps));
  if (opts.timeoutS) args.push('--timeout', String(opts.timeoutS));
  if (opts.variables) args.push('--variables', JSON.stringify(varsJson(opts.variables)));
  if (opts.local) args.push('--local');
  return spawnKane(args, testFile, opts);
}

function varsJson(v: Record<string, string>): Record<string, { value: string; secret: boolean }> {
  return Object.fromEntries(Object.entries(v).map(([k, value]) => [k, { value, secret: false }]));
}

/** Run a one-off plain-English objective (used to probe an app). */
export function runObjective(objective: string, opts: RunOptions & { name?: string }): Promise<KaneRunResult> {
  const args = ['run', objective, '--agent', '--headless'];
  if (opts.url) args.push('--url', opts.url);
  if (opts.bugDetection) args.push('--bug-detection', opts.bugDetection);
  if (opts.maxSteps) args.push('--max-steps', String(opts.maxSteps));
  if (opts.timeoutS) args.push('--timeout', String(opts.timeoutS));
  if (opts.name) args.push('--name', opts.name);
  return spawnKane(args, opts.name ?? 'objective', opts);
}

function spawnKane(args: string[], testFile: string, opts: RunOptions): Promise<KaneRunResult> {
  mkdirSync(opts.cwd, { recursive: true });
  const startedAt = new Date().toISOString();
  return new Promise((resolve) => {
    const child = spawn(kaneBin(), args, { cwd: opts.cwd, env: kaneEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
    const events: Record<string, unknown>[] = [];
    let buf = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buf += chunk;
      let i: number;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        const e = parseLine(line);
        if (e) {
          events.push(e);
          opts.onLine?.(e);
        }
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (c: string) => {
      stderr += c;
      if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });
    child.on('error', (err) => {
      resolve({
        testFile,
        url: opts.url ?? opts.overrideStartUrl,
        outcome: 'error',
        exitCode: -1,
        reason: `could not start kane-cli: ${err.message}`,
        steps: [],
        startedAt,
        endedAt: new Date().toISOString(),
      });
    });
    child.on('close', (code) => {
      const tail = parseLine(buf);
      if (tail) events.push(tail);
      const folded = foldStream(events, code ?? -1);
      const result: KaneRunResult = {
        testFile,
        url: opts.url ?? opts.overrideStartUrl,
        ...folded,
        startedAt,
        endedAt: new Date().toISOString(),
      };
      if (result.outcome === 'error' && !result.reason) {
        const last = stderr.trim().split('\n').filter(Boolean).slice(-2).join(' ');
        result.reason = last || `kane-cli exited ${code}`;
      }
      if (opts.assetsDir && result.sessionDir) {
        try {
          result.evidence = extractEvidence(result.sessionDir, opts.assetsDir, opts.assetsRel ?? '');
        } catch {
          // Evidence is a bonus for the UI; a missing pack never fails the run.
        }
      }
      resolve(result);
    });
  });
}

/** Newest sealed evidence pack in a Kane session folder. */
export function findPack(sessionDir: string): string | undefined {
  const dir = join(sessionDir, 'evidence');
  if (!existsSync(dir)) return undefined;
  const packs = readdirSync(dir).filter((f) => f.endsWith('.evidence'));
  return packs.length ? join(dir, packs.sort().at(-1)!) : undefined;
}

/**
 * Copy step screenshots, the failure record and console errors out of the pack.
 * Never copies result.yaml or any file with account details.
 */
export function extractEvidence(sessionDir: string, assetsDir: string, assetsRel: string): EvidenceExtract {
  const pack = findPack(sessionDir);
  const out: EvidenceExtract = { shots: [], consoleErrors: [], urls: [] };
  if (!pack) return out;
  const files = unzipSync(readFileSync(pack));
  mkdirSync(assetsDir, { recursive: true });
  const dec = new TextDecoder();

  const stepJson = new Map<string, Record<string, unknown>>();
  for (const [name, data] of Object.entries(files)) {
    const m = name.match(/steps\/([^/]+)\/step\.json$/);
    if (m) {
      try {
        stepJson.set(m[1], JSON.parse(dec.decode(data)) as Record<string, unknown>);
      } catch {
        /* ignore */
      }
    }
  }

  out.urls = [...new Set([...stepJson.values()].map((j) => (typeof j.url === 'string' ? j.url : '')).filter(Boolean))];

  // Step folders are named <ordinal>-<markdown step>-<sub step>. Keep the last frame of each markdown
  // step, plus the annotated frame of any step that failed: that is what the console shows.
  const frames = Object.keys(files)
    .map((n) => n.match(/steps\/((\d+)-(\d+)-(\d+))\/(screenshot\.jpg|annotated\.png)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .sort((a, b) => Number(a[2]) - Number(b[2]));
  const lastPerMdStep = new Map<string, RegExpMatchArray>();
  for (const m of frames) if (m[5] === 'screenshot.jpg') lastPerMdStep.set(m[3], m);
  const keep = new Set([...lastPerMdStep.values()].map((m) => m[0]));
  for (const m of frames) {
    const sj = stepJson.get(m[1]);
    if (m[5] === 'annotated.png' && sj?.status === 'failed') keep.add(m[0]);
  }
  for (const m of frames.filter((x) => keep.has(x[0]))) {
    const stepDir = m[1];
    const kind = m[5] === 'annotated.png' ? 'annotated' : 'screenshot';
    const target = `${stepDir}-${kind}${kind === 'annotated' ? '.png' : '.jpg'}`;
    const entry = Object.keys(files).find((n) => n.endsWith(`steps/${stepDir}/${m[5]}`))!;
    writeFileSync(join(assetsDir, target), files[entry]);
    const sj = stepJson.get(stepDir);
    out.shots.push({
      step: stepDir,
      kind,
      file: assetsRel ? `${assetsRel}/${target}` : target,
      summary: typeof sj?.summary === 'string' ? sj.summary : undefined,
      status: typeof sj?.status === 'string' ? sj.status : undefined,
    });
  }

  for (const [name, data] of Object.entries(files)) {
    if (/steps\/[^/]+\/failure\.yaml$/.test(name)) {
      const text = dec.decode(data);
      const msg = text.match(/message:\s*'?([\s\S]*?)'?\n\S/);
      if (msg) out.failureMessage = msg[1].replace(/\s+/g, ' ').trim();
      const step = text.match(/^step:\s*(\S+)/m);
      if (step) out.culpritStep = step[1];
    }
    if (/logs\/\d+-console\.ndjson$/.test(name)) {
      for (const line of dec.decode(data).split('\n')) {
        const e = parseLine(line);
        if (e && (e.level === 'error' || e.level === 'warning') && typeof e.text === 'string') {
          out.consoleErrors.push(String(e.text).slice(0, 300));
        }
      }
    }
  }
  out.consoleErrors = [...new Set(out.consoleErrors)].slice(0, 12);
  return out;
}

export function shortName(testFile: string): string {
  return basename(testFile).replace(/_test\.md$/, '');
}
