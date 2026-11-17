// Prints what each recorded test's pure replay can't see (src/engine/replay-audit.ts) for one Kane working folder.
// Usage: npx tsx scripts/replay-audit.ts [kane dir] [suite dir]   (defaults: the TodoMVC oracle)
import { relative } from 'node:path';
import { auditReplay } from '../src/engine/replay-audit.js';
import { loadSuite } from '../src/engine/suite.js';

const kaneDir = process.argv[2] ?? '.ditto-work/kane/todomvc';
const suiteDir = process.argv[3] ?? 'suites/todomvc';
let checks = 0;
let weakTests = 0;
for (const t of loadSuite(suiteDir, relative('.', suiteDir))) {
  const a = auditReplay(kaneDir, t);
  if (!a) continue;
  checks += a.checks;
  if (!a.weak.length) continue;
  weakTests++;
  console.log(`${t.id}`);
  for (const w of a.weak) console.log(`  step ${w.step} · ${w.query}: ${w.why}`);
}
console.log(`\n${weakTests} tests have a check a replay can't fail as written (${checks} value checks read).`);
