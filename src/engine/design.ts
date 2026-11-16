// Kane's assurance pipeline turns a spec into cited use-cases, acceptance criteria and one _test.md per scenario.
import { spawn } from 'node:child_process';
import { kaneBin, kaneEnv, parseLine } from './kane.js';

function kaneJson(args: string[], cwd: string): Promise<{ code: number; events: Record<string, unknown>[] }> {
  return new Promise((resolve) => {
    const child = spawn(kaneBin(), args, { cwd, env: kaneEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
    const events: Record<string, unknown>[] = [];
    let buf = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (c: string) => {
      buf += c;
      let i: number;
      while ((i = buf.indexOf('\n')) >= 0) {
        const e = parseLine(buf.slice(0, i));
        buf = buf.slice(i + 1);
        if (e) events.push(e);
      }
    });
    child.stderr.resume();
    child.on('close', (code) => resolve({ code: code ?? -1, events }));
  });
}

export async function designSuite(store: string, specFile: string, maxPerUseCase: number, log: (l: string) => void): Promise<void> {
  log(`kane-cli context ingest ${specFile} (use-cases, each claim cited to the spec)`);
  await kaneJson(['context', 'ingest', specFile, '--mode', 'override'], store);

  const list = await kaneJson(['context', 'list', '--mode', 'agent'], store);
  const useCases = list.events.filter((e) => e.label === 'usecase').map((e) => String(e.id));
  log(`found ${useCases.length} use-cases: ${useCases.join(', ')}`);
  if (useCases.length) await kaneJson(['context', 'review', '--approve', ...useCases, '--mode', 'agent'], store);

  let credits = 0;
  for (const uc of useCases) {
    const r = await kaneJson(['design', 'tests', '--use-case', uc, '--max', String(maxPerUseCase), '--mode', 'override', '--json'], store);
    const usage = r.events.filter((e) => e.type === 'usage').at(-1);
    const c = Number(usage?.total_credits ?? 0);
    credits += c;
    const done = r.events.find((e) => e.type === 'done');
    log(`  design ${uc}: ${done?.status ?? `exit ${r.code}`} · ${c.toFixed(1)} credits`);
  }
  log(`design credits: ${credits.toFixed(1)}`);
}
