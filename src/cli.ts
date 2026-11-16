#!/usr/bin/env node
// ditto: let an AI agent rewrite your frontend; Kane CLI runs the same plain-English tests on both apps until they match.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from './engine/config.js';
import { designSuite } from './engine/design.js';
import { DittoLoop, writeCasesIndex } from './engine/loop.js';
import { serveConsole } from './engine/apps.js';
import { findTargets, scan } from './engine/scan.js';
import { importDesigned, loadSuite } from './engine/suite.js';
import type { CaseFile } from './engine/case.js';

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name: string) => argv.includes(`--${name}`);

function help(): void {
  console.log(`ditto — rewrite your frontend with an AI agent; Kane CLI proves it behaves the same.

  ditto doctor                  Check Node, Kane CLI (signed in, credits), Chrome, Claude Code and your config
  ditto init --legacy <dir> --spec <file> [--rewrite <repo>]   Write ditto.config.json for your app
  ditto design [--max 3]        Kane reads your spec and designs plain-English _test.md behaviours
  ditto record                  Run every behaviour on the legacy app (the oracle)
  ditto loop [--only a,b]       Record, let Claude Code port the app, replay on the port, fix until parity
       [--skip-port]            ...resume with the port that already exists
  ditto check                   Replay the suite on the current rewrite once (no agent)
  ditto spec-gaps               Behaviours the old app never met: Kane checks them on the rewrite, Claude implements them
  ditto fix                     Continue from the recorded check: send what still differs to Claude Code, round by round
  ditto mutate [--count 3]      Mutation check: a second agent breaks the rewrite on purpose; does Kane catch it?
  ditto ui [--port 4747]        Open the console (live while a loop runs)
  ditto status                  Print the parity table for the current case
  ditto scan [--targets a,b]    Replay the reference recordings on other builds (e.g. every TodoMVC framework)
  ditto hook install            Make your interactive Claude Code session in the rewrite repo
                                check with Ditto (Kane) before it is allowed to stop
  ditto hook stop               (called by the Stop hook) block the stop while behaviour differs

  Options: --config <file> (default ditto.config.json)`);
}

async function main(): Promise<void> {
  if (!cmd || cmd === 'help' || has('help')) return help();
  if (cmd === 'init') return init();
  if (cmd === 'doctor') return doctor(flag('config') ?? 'ditto.config.json');
  const cfg = loadConfig(flag('config') ?? 'ditto.config.json');
  const only = flag('only')?.split(',').map((s) => s.trim()).filter(Boolean);

  if (cmd === 'design') {
    const spec = cfg.abs(cfg.spec);
    const store = cfg.abs(join(cfg.workDir, 'assurance', cfg.case));
    mkdirSync(store, { recursive: true });
    copyFileSync(spec, join(store, 'spec.md'));
    await designSuite(store, 'spec.md', Number(flag('max') ?? 3), (l) => console.log(l));
    const copied = importDesigned(store, cfg.abs(cfg.suite));
    console.log(`\n${copied.length} tests in ${cfg.suite}`);
    return;
  }

  if (cmd === 'ui') {
    const dist = cfg.abs('web/dist');
    if (!existsSync(join(dist, 'index.html'))) {
      console.log('Build the console first: npm run web:build');
      process.exitCode = 2;
      return;
    }
    const port = Number(flag('port') ?? 4747);
    await serveConsole(dist, cfg.abs(cfg.casesDir), port);
    console.log(`Ditto console: http://127.0.0.1:${port}/?case=${cfg.case}  (Ctrl-C to stop)`);
    return new Promise<void>(() => {});
  }

  if (cmd === 'hook') {
    const sub = argv[1];
    if (sub === 'install') return installHook(cfg.abs(cfg.rewrite.repo), cfg.root, cfg.abs(flag('config') ?? 'ditto.config.json'));
    if (sub === 'stop') return hookStop();
  }

  if (cmd === 'status') {
    const file = cfg.abs(join(cfg.casesDir, cfg.case, 'case.json'));
    if (!existsSync(file)) return console.log('No case yet. Run `ditto record` or `ditto loop`.');
    printStatus(JSON.parse(readFileSync(file, 'utf8')) as CaseFile);
    return;
  }

  const loop = new DittoLoop(cfg, { only });
  if (cmd === 'record') {
    await loop.startApps();
    try {
      await loop.recordOracle();
    } finally {
      loop.stopApps();
    }
    printStatus(loop.rec.data);
    return;
  }
  if (cmd === 'check') {
    await loop.startApps();
    try {
      const n = Math.max(0, ...loop.rec.data.rounds.map((r) => r.n));
      await loop.check(n, loop.oraclePassing());
    } finally {
      loop.stopApps();
    }
    printStatus(loop.rec.data);
    return;
  }
  if (cmd === 'scan') {
    const root = flag('impls') ?? cfg.abs(join(cfg.workDir, 'impls', 'todomvc', 'examples'));
    const only = flag('targets')?.split(',');
    const targets = findTargets(root).filter((t) => !only || only.includes(t.name));
    if (!targets.length) return console.log(`No builds found under ${root}`);
    await loop.startApps();
    try {
      const res = await scan(cfg, loop, targets, (l) => console.log(l));
      for (const t of res.targets) {
        const vals = Object.values(t.results);
        console.log(`${t.name.padEnd(16)} ${vals.filter((v) => v.outcome === 'pass').length}/${vals.length} same as the reference`);
      }
    } finally {
      loop.stopApps();
    }
    return;
  }
  if (cmd === 'loop') {
    const data = await loop.run({ skipPort: has('skip-port') });
    writeCasesIndex(cfg.abs(cfg.casesDir));
    printStatus(data);
    return;
  }
  if (cmd === 'fix') {
    const data = await loop.resumeFix();
    writeCasesIndex(cfg.abs(cfg.casesDir));
    printStatus(data);
    return;
  }
  if (cmd === 'mutate') {
    const data = await loop.mutate(Number(flag('count') ?? 3));
    writeCasesIndex(cfg.abs(cfg.casesDir));
    printStatus(data);
    return;
  }
  if (cmd === 'spec-gaps') {
    await loop.closeSpecGaps(Number(flag('rounds') ?? 3));
    writeCasesIndex(cfg.abs(cfg.casesDir));
    printStatus(loop.rec.data);
    return;
  }
  if (cmd === 'index') {
    writeCasesIndex(cfg.abs(cfg.casesDir));
    console.log(readFileSync(join(cfg.abs(cfg.casesDir), 'index.json'), 'utf8'));
    return;
  }
  help();
  process.exitCode = 2;
}

async function doctor(configFile: string): Promise<void> {
  const { spawnSync } = await import('node:child_process');
  const { kaneBin, kaneEnv } = await import('./engine/kane.js');
  const { isUp } = await import('./engine/apps.js');
  const env = kaneEnv();
  const line = (ok: boolean, what: string, hint = '') => console.log(`${ok ? 'ok  ' : 'FIX '} ${what}${ok || !hint ? '' : `\n      ${hint}`}`);
  const run = (cmd: string, args: string[]) => spawnSync(cmd, args, { env, encoding: 'utf8' });
  const node = Number(process.versions.node.split('.')[0]);
  line(node >= 22, `Node ${process.versions.node}`, 'Ditto needs Node 22 or newer.');
  const kv = run(kaneBin(), ['--version']);
  line(kv.status === 0, `Kane CLI ${kv.stdout?.trim() ?? ''}`.trim(), 'npm install -g @testmuai/kane-cli');
  if (kv.status === 0) {
    const who = run(kaneBin(), ['whoami']);
    line(!/Not logged in/.test(who.stdout ?? ''), 'Kane CLI signed in', 'kane-cli login');
    const bal = run(kaneBin(), ['balance']).stdout?.match(/credits:\s*([\d.]+)/i)?.[1];
    line(bal !== undefined && Number(bal) > 0, `Kane credits: ${bal ? Math.round(Number(bal)) : 'unknown'}`, 'Claim credits at testmuai.com/kane-cli');
  }
  const chrome = env.KANE_CLI_CHROME_PATH ?? ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => existsSync(p));
  line(Boolean(chrome && existsSync(chrome)), `Chrome for Kane: ${chrome ?? 'not found'}`, 'Install Google Chrome, or set KANE_CLI_CHROME_PATH to a Chromium binary.');
  const cv = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  line(cv.status === 0, `Claude Code ${cv.stdout?.trim() ?? ''}`.trim(), 'Install Claude Code and sign in (only needed for `ditto loop` and hook mode).');
  if (existsSync(configFile)) {
    const cfg = loadConfig(configFile);
    line(existsSync(cfg.abs(cfg.suite)), `Suite folder ${cfg.suite}`, 'Run `ditto design` to have Kane write the tests from your spec.');
    for (const [name, url] of [['legacy', cfg.legacyUrl], ['rewrite', cfg.rewriteUrl]] as const) {
      const up = await isUp(url);
      console.log(`info ${name} app ${url} ${up ? 'is up' : 'is not running (Ditto serves it when it runs)'}`);
    }
  } else line(false, `${configFile}`, 'Run `ditto init --legacy <dir> --spec <file>` first.');
}

function init(): void {
  const file = flag('config') ?? 'ditto.config.json';
  if (existsSync(file) && !has('force')) {
    console.log(`${file} already exists (use --force to overwrite).`);
    return;
  }
  const legacy = flag('legacy');
  const spec = flag('spec');
  const rewrite = flag('rewrite') ?? '../rewrite';
  if (!legacy || !spec) {
    console.log('Usage: ditto init --legacy <folder with the built old app> --spec <requirements .md> [--rewrite <repo folder>] [--name <case>]');
    process.exitCode = 2;
    return;
  }
  const name = flag('name') ?? 'app';
  const cfg = {
    case: name,
    title: `${name}: old app → rewrite`,
    spec,
    suite: `suites/${name}`,
    legacy: { label: 'Old app', framework: '', dir: legacy, port: 7001 },
    rewrite: { label: 'Rewrite', framework: '', repo: rewrite, build: 'npm install --no-audit --no-fund && npm run build', dist: 'dist', port: 7002 },
    agent: {
      model: 'sonnet',
      portPrompt:
        'Port the app in {legacyDir} to <your target stack> in the current directory. Keep the same look and the same behaviour, so users do not notice the switch. Make `npm run build` write a static site to dist/ with relative asset paths. Do not add features.',
      maxTurnsPort: 120,
      maxTurnsFix: 60,
    },
    parallel: 3,
    maxRounds: 4,
    creditCap: 3000,
    workDir: '.ditto-work',
    casesDir: 'cases',
    variables: {},
  };
  writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`Wrote ${file}. Edit the port prompt, then: ditto design → ditto record → ditto loop`);
}

function installHook(repo: string, root: string, configFile: string): void {
  const dir = join(repo, '.claude');
  mkdirSync(dir, { recursive: true });
  // Local settings: the command holds machine paths, so it must not be committed to the repo.
  const file = join(dir, 'settings.local.json');
  const settings = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, any>) : {};
  const command = `cd ${JSON.stringify(root)} && npx tsx src/cli.ts hook stop --config ${JSON.stringify(configFile)}`;
  settings.hooks ??= {};
  settings.hooks.Stop = [{ hooks: [{ type: 'command', command, timeout: 1800 }] }];
  writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  const gi = join(repo, '.gitignore');
  const cur = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
  if (!cur.includes('.claude/settings.local.json')) writeFileSync(gi, cur + (cur.endsWith('\n') || !cur ? '' : '\n') + '.claude/settings.local.json\n');
  console.log(`Stop hook written to ${file}.\nOpen Claude Code in ${repo}; each time it tries to finish, Kane replays the legacy behaviours first.`);
}

async function hookStop(): Promise<void> {
  const input = await new Promise<string>((ok) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => ok(data));
  });
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(input || '{}');
  } catch {
    /* ignore */
  }
  const cfg = loadConfig(flag('config') ?? 'ditto.config.json');
  const stateFile = join(cfg.abs(cfg.workDir), 'hook-blocks.json');
  const state = existsSync(stateFile) ? (JSON.parse(readFileSync(stateFile, 'utf8')) as { session?: string; blocks: number }) : { blocks: 0 };
  if (state.session !== payload.session_id) Object.assign(state, { session: payload.session_id, blocks: 0 });
  const loop = new DittoLoop(cfg, { log: (l) => console.error(l) });
  const res = await loop.hookCheck(readTranscript(typeof payload.transcript_path === 'string' ? payload.transcript_path : undefined));
  if (res.ok || state.blocks >= 4) {
    state.blocks = 0;
    writeFileSync(stateFile, JSON.stringify(state));
    const msg = res.ok ? res.message : `${res.message}\n\nDitto stopped blocking after 4 rounds; a person should look at what still differs.`;
    process.stdout.write(JSON.stringify({ systemMessage: msg }));
    return;
  }
  state.blocks += 1;
  writeFileSync(stateFile, JSON.stringify(state));
  process.stdout.write(JSON.stringify({ decision: 'block', reason: res.message }));
}

/** The request that started the session and Claude's latest message, from the Stop hook's transcript. */
function readTranscript(path?: string): { request?: string; finalText?: string } {
  if (!path || !existsSync(path)) return {};
  let request: string | undefined;
  let finalText: string | undefined;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let e: Record<string, any>;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const content = e.message?.content;
    const text = typeof content === 'string' ? content : Array.isArray(content) ? content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n') : '';
    if (e.type === 'user' && !request && text.trim() && !text.startsWith('Ditto')) request = text.trim().slice(0, 1200);
    if (e.type === 'assistant' && text.trim()) finalText = text.trim().slice(0, 1200);
  }
  return { request, finalText };
}

function printStatus(c: CaseFile): void {
  const rounds = [...c.rounds].sort((a, b) => a.n - b.n);
  const latest = (id: string) => {
    let s;
    for (const r of rounds) if (r.results[id]) s = r.results[id];
    return s;
  };
  const icon = (o?: string) => (o === 'pass' ? 'PASS' : o ? o.toUpperCase() : '—');
  console.log(`\n${c.title}  [${c.status}]`);
  console.log(`${'behaviour'.padEnd(58)} ${'legacy'.padEnd(10)} rewrite`);
  for (const t of c.suite.tests) {
    console.log(`${t.title.slice(0, 57).padEnd(58)} ${icon(c.oracle[t.id]?.outcome).padEnd(10)} ${icon(latest(t.id)?.outcome)}`);
  }
  const oraclePass = c.suite.tests.filter((t) => c.oracle[t.id]?.outcome === 'pass');
  const matched = oraclePass.filter((t) => latest(t.id)?.outcome === 'pass').length;
  console.log(`\nparity ${matched}/${oraclePass.length} · Kane runs ${c.totals.kaneRuns} (${c.totals.replays} pure replays) · ${c.totals.credits} credits · agent $${c.totals.agentCostUsd}`);
}

// Keep suite parsing reachable for scripts: `tsx src/cli.ts suite`
if (cmd === 'suite') {
  const cfg = loadConfig(flag('config') ?? 'ditto.config.json');
  for (const t of loadSuite(cfg.abs(cfg.suite))) console.log(`${t.id}  ${t.steps.length} steps  ${t.title}`);
} else {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
