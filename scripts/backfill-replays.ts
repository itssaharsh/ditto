// Attaches Kane's screenshots and page URLs to recorded runs that lack them (replays reported their
// evidence pack only on the coverage event, which older Ditto versions did not read).
// Usage: npx tsx scripts/backfill-replays.ts cases/<id>
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CaseFile, RunSummary } from '../src/engine/case.js';
import { extractEvidence, foldStream, parseLine } from '../src/engine/kane.js';

const dir = process.argv[2];
const c = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8')) as CaseFile;
const sessionsRoot = join(homedir(), '.testmuai/kaneai/sessions');
const sessions = readdirSync(sessionsRoot)
  .map((id) => {
    const f = join(sessionsRoot, id, 'events.ndjson');
    if (!existsSync(f)) return undefined;
    const events = readFileSync(f, 'utf8').split('\n').map(parseLine).filter((e): e is Record<string, unknown> => e !== null);
    const start = events.find((e) => e.type === 'stream_start');
    const runStart = events.find((e) => e.type === 'run_start');
    return { id, events, t: Date.parse(String(start?.ts ?? '')), objective: String(runStart?.objective ?? '') };
  })
  .filter((s): s is NonNullable<typeof s> => !!s && !Number.isNaN(s.t));

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 80);
let fixed = 0;
function backfill(testId: string, r: RunSummary, stamp: string) {
  if (r.shots.length) return;
  const test = c.suite.tests.find((t) => t.id === testId);
  if (!test) return;
  const first = norm(test.steps[0]?.text ?? '');
  const from = Date.parse(r.startedAt) - 2000;
  const to = Date.parse(r.endedAt) + 2000;
  const match = sessions.find((s) => s.t >= from && s.t <= to && norm(s.objective) === first);
  if (!match) return;
  const folded = foldStream(match.events, 0);
  const pack = folded.pack;
  if (!pack || !existsSync(pack)) return;
  const ev = extractEvidence(pack, join(dir, 'assets', testId, stamp), `assets/${testId}/${stamp}`);
  r.shots = ev.shots;
  r.urls = [...new Set([...(folded.urls ?? []), ...ev.urls])];
  if (folded.overrideApplied !== undefined) r.overrideApplied = folded.overrideApplied;
  if (!r.consoleErrors.length) r.consoleErrors = ev.consoleErrors;
  fixed++;
}
for (const [id, r] of Object.entries(c.oracle)) backfill(id, r, 'legacy-r0-replay');
for (const round of c.rounds) for (const [id, r] of Object.entries(round.results)) backfill(id, r, `rewrite-r${round.n}-${r.mode === 'replay' ? 'replay' : r.mode === 'replay+heal' ? 'heal' : 'author'}`);
const text = JSON.stringify(c, null, 1).split(homedir()).join('~');
writeFileSync(join(dir, 'case.json'), text);
console.log(`${dir}: attached evidence to ${fixed} runs`);
