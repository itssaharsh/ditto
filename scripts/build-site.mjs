// Builds the published site: the console (replaying recorded cases) plus both apps it compares.
//   /          the Ditto console
//   /cases/    recorded case files and Kane screenshots
//   /legacy/   the original TodoMVC jQuery app
//   /port/     the React port Claude Code wrote
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const cfg = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync('ditto.config.json', 'utf8')));
execSync('npx vite build --config web/vite.config.ts', { stdio: 'inherit' });
const out = 'web/dist';
if (existsSync('cases')) cpSync('cases', join(out, 'cases'), { recursive: true });
if (cfg.legacy.dir) cpSync(cfg.legacy.dir, join(out, 'legacy'), { recursive: true });
const portDist = join(cfg.rewrite.repo, cfg.rewrite.dist);
if (existsSync(portDist)) cpSync(portDist, join(out, 'port'), { recursive: true });
// Other recorded rewrites (e.g. a second agent's port), published beside the first.
for (const extra of ['ditto.haiku.config.json', 'ditto.mutation.config.json']) {
  if (!existsSync(extra)) continue;
  const c2 = JSON.parse(readFileSync(extra, 'utf8'));
  const d2 = join(c2.rewrite.repo, c2.rewrite.dist);
  if (existsSync(d2)) cpSync(d2, join(out, `port-${c2.case.replace(/^.*-/, '')}`), { recursive: true });
}
writeFileSync(join(out, '.nojekyll'), '');
console.log(`site built in ${out} (console, cases, legacy${existsSync(portDist) ? ', port' : ''})`);
