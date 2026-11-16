// Checks, from Claude Code's own session transcripts, that the fixer in a mutation run never touched the
// breaker's answer key (or anything in Ditto's work folder), and records the counts in the case file.
// Transcripts live in ~/.claude/projects/<folder>/<session>.jsonl on the machine that ran the loop.
// Usage: npx tsx scripts/audit-fixer.ts cases/<id>
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CaseFile } from '../src/engine/case.js';

const dir = process.argv[2];
if (!dir) throw new Error('usage: npx tsx scripts/audit-fixer.ts cases/<id>');
const c = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8')) as CaseFile & { audit?: unknown };
const projects = join(homedir(), '.claude', 'projects');
const findTranscript = (sid: string) => {
  for (const p of existsSync(projects) ? readdirSync(projects) : []) {
    const f = join(projects, p, `${sid}.jsonl`);
    if (existsSync(f)) return f;
  }
  return undefined;
};
// Anything that would reveal the planted bugs: the answer key itself, or Ditto's work folder where it lives.
const forbidden = /answer-key|\.ditto-work|\/mutations\//;

const sessions = [...new Set(c.rounds.filter((r) => r.agent?.kind === 'fix' && r.agent.sessionId).map((r) => r.agent!.sessionId!))];
let toolCalls = 0;
const touches: string[] = [];
for (const sid of sessions) {
  const f = findTranscript(sid);
  if (!f) throw new Error(`no transcript for fixer session ${sid}`);
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    let e: { message?: { content?: unknown } };
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const content = e.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content as { type?: string; name?: string; input?: unknown }[]) {
      if (b.type !== 'tool_use') continue;
      toolCalls += 1;
      const input = JSON.stringify(b.input ?? {});
      if (forbidden.test(input)) touches.push(`${b.name}: ${input.slice(0, 120)}`);
    }
  }
}
c.audit = { fixerSessions: sessions.length, fixerToolCalls: toolCalls, touchedAnswerKey: touches.length, checkedAt: new Date().toISOString() };
writeFileSync(join(dir, 'case.json'), JSON.stringify(c, null, 2) + '\n');
console.log(`${dir}: ${sessions.length} fixer session(s), ${toolCalls} tool calls, ${touches.length} touching the answer key or Ditto's work folder`);
for (const t of touches) console.log(`  ${t}`);
