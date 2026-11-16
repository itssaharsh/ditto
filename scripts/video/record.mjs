// Records the demo video from the real console and the real run logs, then assembles it with ffmpeg.
// It opens on the closed loop (a planted bug caught by Kane and fixed by Claude Code), because judges stop around 3:00.
// Usage: node scripts/video/record.mjs [site url]   → qa/video/ditto-demo.mp4
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const site = process.argv[2] ?? 'https://itssaharsh.github.io/ditto/';
const out = resolve('qa/video');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const size = { width: 1600, height: 900 };
const browser = await chromium.launch({ executablePath: join(homedir(), '.local/lib/kane-chrome/chrome'), headless: true });
const here = resolve('scripts/video');
let segment = 0;
// Seconds to cut from the start of each clip: the time its page took to load, so no clip opens on a blank page.
const trims = {};
let current;

async function clip(name, fn) {
  const id = `${String(++segment).padStart(2, '0')}-${name}`;
  const dir = join(out, id);
  current = { id, t0: Date.now(), ready: undefined };
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, recordVideo: { dir, size } });
  const page = await ctx.newPage();
  await fn(page);
  await ctx.close();
  trims[id] = current.ready ? Math.max(0, (current.ready - current.t0) / 1000 - 0.2) : 0;
  console.log(`recorded ${name} (trim ${trims[id].toFixed(1)} s)`);
}
const ready = () => {
  current.ready ??= Date.now();
};

async function caption(page, text) {
  await page.evaluate((t) => {
    let el = document.getElementById('vcap');
    if (!el) {
      el = document.createElement('div');
      el.id = 'vcap';
      el.style.cssText =
        'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);max-width:1350px;width:max-content;padding:14px 24px;border-radius:12px;background:rgba(20,32,46,.92);color:#fff;font:600 27px/1.35 "Albert Sans",system-ui,sans-serif;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,.25);text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = t;
    el.style.display = t ? 'block' : 'none';
  }, text);
}

const card = (h, p, l = '') => `${pathToFileURL(join(here, 'card.html'))}?h=${encodeURIComponent(h)}&p=${encodeURIComponent(p)}&l=${encodeURIComponent(l)}`;
const wait = (page, ms) => page.waitForTimeout(ms);
const open = async (page, query = '') => {
  await page.goto(`${site}${query}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete && i.loading !== 'lazy').map((i) => new Promise((r) => (i.onload = i.onerror = r)))));
  await wait(page, 400);
  ready();
};
const scrollTo = (page, sel, offset = -90) =>
  page.evaluate(([s, o]) => {
    const el = document.querySelector(s);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + o, behavior: 'smooth' });
  }, [sel, offset]);

// Numbers for the captions come from the recorded cases, not from memory.
const mut = JSON.parse(readFileSync('cases/todomvc-mutation/case.json', 'utf8'));
const planted = (mut.mutations.match(/^\s*\d+[.)]\s/gm) ?? []).length;
const fixRounds = mut.rounds.filter((r) => r.agent?.kind === 'fix').length;

// 1. Title
await clip('title', async (page) => {
  await page.goto(card('Did the rewrite break anything?', 'AI agents rewrite frontends in minutes. <b>Ditto</b> makes Kane CLI prove your users won’t notice, and sends every difference back to the agent.'));
  await wait(page, 300);
  ready();
  await wait(page, 4200);
});

// 2. The closed loop on one behaviour: a planted bug, Kane's verdict, Claude's fix, the same test green
await clip('catch', async (page) => {
  await open(page);
  await caption(page, `A second Claude Code session planted ${planted} bugs in Claude’s React port of TodoMVC, and wrote them down outside the repo.`);
  await wait(page, 5500);
  await page.mouse.wheel(0, 260);
  await caption(page, 'Kane replayed the old app’s recordings on the broken build. Escape kept the edited title: a confirmed difference.');
  await wait(page, 6000);
  await caption(page, 'A fresh Claude Code session got only Kane’s verdict and both screenshots. It fixed the code; Kane re-ran the test: pass.');
  await wait(page, 6500);
});

// 3. Every planted bug, and how Kane found it
await clip('planted', async (page) => {
  await open(page);
  await scrollTo(page, '#mutations', -30);
  await wait(page, 900);
  await caption(page, `Kane’s findings led Claude to all ${planted}, in ${fixRounds} rounds. The third hid behind the second: Kane kept flagging the counter until Claude found the mark-all bug.`);
  await wait(page, 8000);
});

// 3b. What the run taught Ditto, and the re-check that measures it
const rc = JSON.parse(readFileSync('cases/todomvc-recheck/case.json', 'utf8'));
const rc0 = Object.values(rc.rounds.find((r) => r.n === 0).results);
const rcDiffer = rc0.filter((x) => x.outcome === 'mismatch' || x.outcome === 'fail').length;
await clip('lesson', async (page) => {
  await open(page, '?case=todomvc-recheck');
  await caption(page, 'The run also caught a flaw in Ditto: Kane’s healing had passed two tests the third bug broke. Now a fresh Kane run has to agree.');
  await wait(page, 7000);
  await caption(page, `Same broken build, re-checked with that rule: ${rcDiffer} behaviours confirmed different instead of 2. All 3 planted bugs, in one check.`);
  await wait(page, 6500);
});

// 4. The whole planted-bug run, replayed from the recorded case
const t = (iso) => Date.parse(iso);
const times = mut.events.map((e) => t(e.t));
const start = Math.min(...times, t(mut.createdAt));
const end = Math.max(...times);
const REPLAY = 24;
const at = (iso) => ((t(iso) - start) / (end - start)) * REPLAY * 1000;
const roundStart = (n) => {
  const r = mut.rounds.find((x) => x.n === n);
  const ts = [r?.agent?.startedAt, ...Object.values(r?.results ?? {}).map((x) => x.startedAt)].filter(Boolean).map(t);
  return new Date(Math.min(...ts)).toISOString();
};
const minutes = Math.round((end - start) / 60000);
const cues = [
  [0, `The whole run, sped up: ${minutes} minutes of real Kane and Claude Code work.`],
  [at(roundStart(0)), 'The breaker session changes 3 files. Kane checks all 18 behaviours on the broken build.'],
  [at(roundStart(1)), 'Fix round 1: Claude repairs Escape and the counter. Kane: Escape matches again; the counter still differs.'],
  [at(roundStart(2)), 'Fix round 2: Claude finds the mark-all bug. Kane re-checks all 18.'],
].sort((a, b) => a[0] - b[0]);
await clip('replay', async (page) => {
  await open(page, `?replay=${REPLAY}`);
  await page.getByRole('button', { name: /Watch the whole run/ }).click();
  const t0 = Date.now();
  for (const [ms, text] of cues) {
    const delay = ms - (Date.now() - t0);
    if (delay > 0) await wait(page, delay);
    await caption(page, text);
  }
  await wait(page, Math.max(0, REPLAY * 1000 + 1200 - (Date.now() - t0)));
  await caption(page, '18 of 18 the same again. Every result here is a real Kane run, with its screenshots.');
  await wait(page, 3500);
});

// 5. The tests: written by Kane from the spec
await clip('tests', async (page) => {
  await open(page, '?case=todomvc&b=escape-discards-a-todo-title-edit');
  await page.mouse.wheel(0, 300);
  await caption(page, 'Kane wrote the tests itself from the TodoMVC spec: 28 of them, each step tied to an acceptance criterion. No selectors.');
  await wait(page, 6500);
  await caption(page, 'The same test file runs on both apps. Kane’s screenshot of every step: the old jQuery app left, the rewrite right.');
  await wait(page, 5500);
});

// 6. The oracle
await clip('oracle', async (page) => {
  await open(page, '?case=todomvc');
  await scrollTo(page, '#behaviours');
  await wait(page, 700);
  await caption(page, 'First, every test runs on the old app. The 18 it passes, and that replay cleanly, become the referee.');
  await wait(page, 5500);
  await page.mouse.wheel(0, 420);
  await caption(page, 'Tests Kane could not run cleanly on the old app are listed, not counted. A wrong test can never blame the new code.');
  await wait(page, 5500);
});

// 7. Two ports, same referee
await clip('port-sonnet', async (page) => {
  await open(page, '?case=todomvc');
  await caption(page, 'Claude Sonnet 5.5’s React port: 18 of 18 the same on the first try. 17 of the 18 checks were pure replays, for 18.5 credits.');
  await wait(page, 6500);
});
await clip('port-haiku', async (page) => {
  await open(page, '?case=todomvc-haiku');
  await caption(page, 'Same referee, a second agent: Haiku 5.5’s port, 18 of 18 too. 22 of 24 Kane runs were replays: 7 credits.');
  await wait(page, 5500);
});

// 8. A real gap: what the spec asks and the old app never did
await clip('spec', async (page) => {
  await open(page, '?case=todomvc&b=reload-retains-a-newly-created-active-todo');
  await caption(page, 'Kane also caught what the spec asks and neither app did: todos must survive a reload. Claude Code added it from Kane’s findings. Kane: 3 of 3.');
  await wait(page, 7500);
});

// 9. The real logs
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const home = homedir();
const scrub = (l) => l.split(home).join('~').replace(/\/home\/[^/\s]+\//g, '~/');
const colour = (s) => {
  if (/ pass /.test(s)) return s.replace(/ pass /, ' <span class="ok">pass</span> ');
  if (/mismatch|test_issue|error| fail /.test(s)) return s.replace(/(mismatch|test_issue|error| fail )/, '<span class="bad">$1</span>');
  return s;
};
const mutLines = readFileSync('.ditto-work/mutate.log', 'utf8')
  .split('\n')
  .map(scrub)
  .filter((l) => /agent round|parity 18/.test(l) || (/escape-discards|counter-at-zero/.test(l) && /mismatch|pass/.test(l)))
  .map((l) => {
    const s = esc(l.trim());
    if (/^agent round 0/.test(s)) return `<span class="dim">[breaker]</span> <span class="k">${s}</span>`;
    if (/^agent round/.test(s)) return `<span class="dim">[fixer]</span> <span class="k">${s}</span>`;
    if (/^parity/.test(s)) return `<span class="ok">${s}</span>`;
    return colour(s);
  });
const hookRaw = existsSync('qa/hook-demo.log') ? readFileSync('qa/hook-demo.log', 'utf8').split('\n').map(scrub) : [];
const hookTools = hookRaw.filter((l) => /^\d\d:\d\d:\d\d tool/.test(l) && !/<<|cat >/.test(l)).slice(0, 6);
const hookClaude = hookRaw.filter((l) => /^\d\d:\d\d:\d\d claude/.test(l)).slice(-1);
const hookStop = hookRaw.filter((l) => /Stop says/.test(l)).slice(-1);
const hookLines = [...hookTools, ...hookClaude, ...hookStop].map((l) => {
  const m = l.match(/^(\S+) (\S+)\s+(.*)$/);
  if (!m) return esc(l);
  const [, ts, kind, rest] = m;
  if (kind === 'system' && /Stop says/.test(rest)) return `<span class="dim">${ts}</span> <span class="k">Stop hook</span> <span class="ok">${esc(rest.match(/Ditto:[^"]*/)?.[0] ?? rest)}</span>`;
  return `<span class="dim">${ts}</span> <span class="${kind === 'claude' ? 'c' : 'dim'}">${kind}</span> ${esc(rest.slice(0, 130))}`;
});
await clip('terminal', async (page) => {
  await page.goto(pathToFileURL(join(here, 'terminal.html')).href);
  await wait(page, 300);
  ready();
  await page.evaluate(
    ([lines]) => window.play('npm run ditto -- mutate   (key lines of the real log)', 'The loop in the log: Kane flags, the fixer changes code, Kane re-checks, until all 18 match.', lines, 650),
    [mutLines],
  );
  await wait(page, 2500);
  if (hookLines.length) {
    await page.evaluate(
      ([lines]) => window.play('claude -p · Stop hook → ditto hook stop', 'Your own Claude Code session: before it can stop, Kane replays every legacy behaviour on its work.', lines, 520),
      [hookLines],
    );
    await wait(page, 2500);
  }
});

// 10. The limit, said plainly
const edge = existsSync('docs/edge-check.json') ? JSON.parse(readFileSync('docs/edge-check.json', 'utf8')) : undefined;
// Kane passed the old app (todo deleted) and did not pass the port (todo kept): it saw the difference on both apps.
const edgeConfirmed = edge?.runs?.find((r) => r.side === 'legacy')?.outcome === 'pass' && edge?.runs?.find((r) => r.side === 'rewrite')?.outcome !== 'pass';
await clip('limit', async (page) => {
  await page.goto(
    card(
      'What Ditto can’t see',
      edgeConfirmed
        ? 'Behaviour no test covers. Fixing bug 1, Claude also changed an edge the suite never checks: the old app deletes a todo on Escape after you empty it; the port keeps it. We found it in the diff, and Kane’s runs on both apps show it.'
        : 'Behaviour no test covers. Fixing bug 1, Claude also changed an edge the suite never checks. We found it reading the diff. It’s in the README.',
    ),
  );
  await wait(page, 300);
  ready();
  await wait(page, 6200);
});

// 11. End
await clip('end', async (page) => {
  await page.goto(
    card(
      'Rewrite with an agent. Kane makes sure nobody notices.',
      'Kane designs the tests from your spec, the old app referees, and every difference goes back to Claude Code until there are none.',
      'itssaharsh.github.io/ditto · github.com/itssaharsh/ditto',
    ),
  );
  await wait(page, 300);
  ready();
  await wait(page, 5700);
});
await browser.close();

// Assemble: each segment to 1920×1080 H.264, then concatenate.
const parts = [];
for (const d of readdirSync(out).filter((x) => /^\d\d-/.test(x)).sort()) {
  const webm = readdirSync(join(out, d)).find((f) => f.endsWith('.webm'));
  if (!webm) continue;
  const mp4 = join(out, `${d}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(trims[d] ?? 0), '-i', join(out, d, webm), '-vf', 'scale=1920:1080:flags=lanczos,fps=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', mp4]);
  parts.push(mp4);
}
writeFileSync(join(out, 'list.txt'), parts.map((p) => `file '${p}'`).join('\n'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(out, 'list.txt'), '-c', 'copy', join(out, 'ditto-demo.mp4')]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(out, 'ditto-demo.mp4')]).toString().trim();
console.log(`qa/video/ditto-demo.mp4 · ${Math.round(Number(dur))} s`);
