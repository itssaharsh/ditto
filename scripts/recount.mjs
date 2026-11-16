// Recomputes a case's run counts from its own events (credits stay as spent).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.argv[2];
const file = join(dir, 'case.json');
const c = JSON.parse(readFileSync(file, 'utf8'));
const starts = c.events.filter((e) => e.kind === 'kane_start');
const ends = c.events.filter((e) => e.kind === 'kane_end');
c.totals.kaneRuns = ends.length;
c.totals.replays = starts.filter((e) => e.mode === 'replay').length;
c.totals.heals = starts.filter((e) => e.mode === 'replay+heal').length;
c.totals.authored = starts.filter((e) => e.mode === 'author').length;
writeFileSync(file, JSON.stringify(c, null, 1));
console.log(dir, c.totals);
