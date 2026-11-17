// Prints what each recorded test's pure replay can't see (src/engine/replay-audit.ts).
// Usage: npx tsx scripts/replay-audit.ts [kane dir] [suite dir]   (defaults: the TodoMVC oracle)
//        npx tsx scripts/replay-audit.ts --write   → stores the audit in every case file, for the console
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { CaseFile } from '../src/engine/case.js';
import { auditReplay, type ReplayAudit } from '../src/engine/replay-audit.js';
import { loadSuite, type SuiteTest } from '../src/engine/suite.js';

if (process.argv[2] === '--write') {
  // Which Kane folder holds each case's recordings: its own, or the oracle case it borrows them from.
  const kaneDirOf = new Map<string, string>();
  for (const f of readdirSync('.').filter((x) => /^ditto.*\.config\.json$/.test(x))) {
    const c = JSON.parse(readFileSync(f, 'utf8')) as { case: string; oracleCase?: string; workDir?: string };
    kaneDirOf.set(c.case, join(c.workDir ?? '.ditto-work', 'kane', c.oracleCase ?? c.case));
  }
  for (const id of readdirSync('cases').filter((d) => existsSync(join('cases', d, 'case.json')))) {
    const file = join('cases', id, 'case.json');
    const c = JSON.parse(readFileSync(file, 'utf8')) as CaseFile;
    const dir = kaneDirOf.get(id);
    if (!dir || !existsSync(dir)) continue;
    const audit: Record<string, ReplayAudit> = {};
    for (const t of c.suite.tests as SuiteTest[]) {
      const a = auditReplay(dir, t);
      if (a?.weak.length) audit[t.id] = a;
    }
    c.replayAudit = Object.keys(audit).length ? audit : undefined;
    writeFileSync(file, JSON.stringify(c, null, 1));
    console.log(`${id}: ${Object.keys(audit).length} tests with a check a replay can't fail as written`);
  }
} else {
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
}
