// Keeps only the screenshots the console shows (last frame of each test step, plus annotated frames
// of failed steps) and deletes the rest. Usage: node scripts/prune-case.mjs cases/<id>
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node scripts/prune-case.mjs cases/<id>');
const file = join(dir, 'case.json');
const c = JSON.parse(readFileSync(file, 'utf8'));

const mdIndex = (step) => {
  const p = step.split('-').map(Number);
  return p.length === 3 ? p[1] : p.length === 2 ? p[0] : undefined;
};
function prune(run) {
  if (!run?.shots?.length) return;
  const lastShot = new Map();
  for (const s of run.shots) if (s.kind === 'screenshot') lastShot.set(mdIndex(s.step), s);
  const keep = new Set(lastShot.values());
  for (const s of run.shots) if (s.kind === 'annotated' && s.status === 'failed') keep.add(s);
  run.shots = run.shots.filter((s) => keep.has(s));
}
Object.values(c.oracle).forEach(prune);
for (const r of c.rounds) Object.values(r.results).forEach(prune);

const referenced = new Set();
const collect = (run) => run?.shots?.forEach((s) => referenced.add(s.file));
Object.values(c.oracle).forEach(collect);
for (const r of c.rounds) Object.values(r.results).forEach(collect);

let removed = 0;
let freed = 0;
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (!referenced.has(relative(dir, p))) {
      freed += statSync(p).size;
      rmSync(p);
      removed++;
    }
  }
};
if (existsSync(join(dir, 'assets'))) walk(join(dir, 'assets'));
writeFileSync(file, JSON.stringify(c, null, 1));
console.log(`${dir}: kept ${referenced.size} screenshots, removed ${removed} (${(freed / 1e6).toFixed(1)} MB)`);
