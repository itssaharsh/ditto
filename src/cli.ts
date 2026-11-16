#!/usr/bin/env node
// ditto: let an AI agent rewrite your frontend; Kane CLI runs the same plain-English tests on both apps until they match.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from './engine/config.js';
import { designSuite } from './engine/design.js';
import { DittoLoop } from './engine/loop.js';
import { serveConsole } from './engine/apps.js';
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

  ditto init --legacy <dir> --spec <file> [--rewrite <repo>]   Write ditto.config.json for your app
  ditto design [--max 3]        Kane reads your spec and designs plain-English _test.md behaviours
  ditto record                  Run every behaviour on the legacy app (the oracle)
  ditto loop [--only a,b]       Record, let Claude Code port the app, replay on the port, fix until parity
       [--skip-port]            ...resume with the port that already exists
  ditto check                   Replay the suite on the current rewrite once (no agent)
  ditto ui [--port 4747]        Open the console (live while a loop runs)
  ditto status                  Print the parity table for the current case
  ditto hook install            Make your interactive Claude Code session in the rewrite repo
                                check with Ditto (Kane) before it is allowed to stop
  ditto hook stop               (called by the Stop hook) block the stop while behaviour differs

  Options: --config <file> (default ditto.config.json)`);
}

async function main(): Promise<void> {
  if (!cmd || cmd === 'help' || has('help')) return help();
  if (cmd === 'init') return init();
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
  if (cmd === 'loop') {
    const data = await loop.run({ skipPort: has('skip-port') });
    printStatus(data);
    return;
  }
  help();
  process.exitCode = 2;
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
  const file = join(dir, 'settings.json');
  const settings = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, any>) : {};
  const command = `cd ${JSON.stringify(root)} && npx tsx src/cli.ts hook stop --config ${JSON.stringify(configFile)}`;
  settings.hooks ??= {};
  settings.hooks.Stop = [{ hooks: [{ type: 'command', command, timeout: 1800 }] }];
  writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
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
  const res = await loop.hookCheck();
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
