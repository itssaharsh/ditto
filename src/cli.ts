#!/usr/bin/env node
// ditto: let an AI agent rewrite your frontend; Kane CLI runs the same plain-English tests on both apps until they match.
import { existsSync, mkdirSync, readFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from './engine/config.js';
import { designSuite } from './engine/design.js';
import { DittoLoop } from './engine/loop.js';
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

  ditto design [--max 3]        Kane reads your spec and designs plain-English _test.md behaviours
  ditto record                  Run every behaviour on the legacy app (the oracle)
  ditto loop [--only a,b]       Record, let Claude Code port the app, replay on the port, fix until parity
       [--skip-port]            ...resume with the port that already exists
  ditto check                   Replay the suite on the current rewrite once (no agent)
  ditto status                  Print the parity table for the current case

  Options: --config <file> (default ditto.config.json)`);
}

async function main(): Promise<void> {
  if (!cmd || cmd === 'help' || has('help')) return help();
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
