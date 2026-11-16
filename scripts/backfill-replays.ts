// Attaches Kane's screenshots and page URLs to recorded runs that lack them (replays reported their
// evidence pack only on the coverage event, which older Ditto versions did not read).
// Usage: npx tsx scripts/backfill-replays.ts cases/<id>
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CaseFile, RunSummary } from '../src/engine/case.js';
import { extractEvidence, foldStream, parseLine } from '../src/engine/kane.js';

const dir = process.argv[2];
const refresh = process.argv.includes('--refresh');
const c = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8')) as CaseFile;
const sessionsRoot = join(homedir(), '.testmuai/kaneai/sessions');
const sessions = readdirSync(sessionsRoot)
  .map((id) => {
    const f = join(sessionsRoot, id, 'events.ndjson');
    if (!existsSync(f)) return undefined;
    const events = readFileSync(f, 'utf8').split('\n').map(parseLine).filter((e): e is Record<string, unknown> => e !== null);
    const start = events.find((e) => e.type === 'stream_start');
    // One run_start per markdown step: together they identify the test, even when several start alike.
    const objectives = events.filter((e) => e.type === 'run_start').map((e) => String(e.objective ?? ''));
    return { id, events, t: Date.parse(String(start?.ts ?? '')), objectives };
  })
  .filter((s): s is NonNullable<typeof s> => !!s && !Number.isNaN(s.t) && s.objectives.length > 0);

const norm = (s: string) => s.replace(/\{\{global\./g, '{{').replace(/\s+/g, ' ').trim();
let fixed = 0;
function backfill(testId: string, r: RunSummary, stamp: string) {
  if (r.shots.length && !refresh) return;
  const test = c.suite.tests.find((t) => t.id === testId);
  if (!test) return;
  const steps = test.steps.map((st) => norm(st.text));
  const from = Date.parse(r.startedAt) - 2000;
  const to = Date.parse(r.endedAt) + 2000;
  // Every objective the session ran must be this test's step at the same position, and the session must
  // have run more than the shared first step unless the test only has one step.
  const candidates = sessions.filter(
    (s) =>
      s.t >= from &&
      s.t <= to &&
      s.objectives.every((o, i) => norm(o) === steps[i]) &&
      (s.objectives.length > 1 || steps.length === 1 || r.outcome !== 'pass'),
  );
  const start = Date.parse(r.startedAt);
  const match = candidates.sort((a, b) => b.objectives.length - a.objectives.length || Math.abs(a.t - start) - Math.abs(b.t - start))[0];
  if (!match) return;
  if (candidates.length > 1 && candidates[0].objectives.length === candidates[1].objectives.length && candidates[1] !== match) {
    const other = candidates.find((c) => c !== match)!;
    if (Math.abs(other.t - start) === Math.abs(match.t - start)) return; // ambiguous: leave it alone
  }
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
