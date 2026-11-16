// Interactive-mode demo: a Claude Code session in the rewrite repo, guarded by Ditto's Stop hook.
// Claude gets an ordinary refactor request; when it tries to finish, the hook has Kane replay every
// legacy behaviour on the rebuilt app. A difference blocks the stop and goes back into the session.
// Usage: node scripts/hook-demo.mjs "<request>"   (writes qa/hook-demo.jsonl and prints a transcript)
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cfg = JSON.parse(readFileSync('ditto.config.json', 'utf8'));
const repo = resolve(cfg.rewrite.repo);
const request =
  process.argv[2] ??
  'Refactor the todo app so all todo state lives in one useReducer with typed actions, and simplify TodoItem so it no longer needs refs. Keep the behaviour the same.';

mkdirSync('qa', { recursive: true });
const log = createWriteStream('qa/hook-demo.jsonl');
const env = { ...process.env };
delete env.ANTHROPIC_API_KEY;
const args = ['-p', request, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits', '--model', cfg.agent.model ?? 'sonnet',
  '--allowedTools', 'Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash(npm install:*)', 'Bash(npm run build:*)', 'Bash(npx tsc:*)',
  '--setting-sources', 'project,local', '--strict-mcp-config', '--disable-slash-commands', '--max-turns', '80'];
const child = spawn('claude', args, { cwd: repo, env, stdio: ['ignore', 'pipe', 'inherit'] });
let buf = '';
child.stdout.on('data', (c) => {
  buf += c;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    log.write(line + '\n');
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const stamp = new Date().toISOString().slice(11, 19);
    if (e.type === 'assistant') {
      for (const b of e.message?.content ?? []) {
        if (b.type === 'text' && b.text.trim()) console.log(`${stamp} claude  ${b.text.trim().split('\n')[0].slice(0, 160)}`);
        if (b.type === 'tool_use') console.log(`${stamp} tool    ${b.name} ${String(b.input?.file_path ?? b.input?.command ?? '').replace(/^\/home\/[^/]+\//, '~/')}`);
      }
    } else if (e.type === 'system' && e.subtype !== 'init') {
      console.log(`${stamp} system  ${JSON.stringify(e).slice(0, 220)}`);
    } else if (e.type === 'user') {
      for (const b of e.message?.content ?? []) {
        if (typeof b.text === 'string' && /Ditto|Stop hook|parity/i.test(b.text)) console.log(`${stamp} HOOK    ${b.text.split('\n')[0].slice(0, 200)}`);
      }
    } else if (e.type === 'result') {
      console.log(`${stamp} done    ${e.subtype} · ${e.num_turns} turns · ${(e.result ?? '').split('\n')[0].slice(0, 160)}`);
    }
  }
});
child.on('close', (code) => {
  log.end();
  console.log(`claude exited ${code}; full stream in qa/hook-demo.jsonl`);
});
