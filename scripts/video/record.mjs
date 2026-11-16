// Records the demo video from the real, deployed console and the real run logs, then assembles it with ffmpeg.
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

async function clip(name, fn) {
  const dir = join(out, `${String(++segment).padStart(2, '0')}-${name}`);
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, recordVideo: { dir, size } });
  const page = await ctx.newPage();
  await fn(page);
  await ctx.close();
  console.log(`recorded ${name}`);
}

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

// 1. Title
await clip('title', async (page) => {
  await page.goto(card('Did the rewrite break anything?', 'AI agents can rewrite your frontend in minutes. <b>Ditto</b> makes Kane CLI prove your users won’t notice.'));
  await wait(page, 5500);
});

// 2. The closed loop on one behaviour, in Kane's own screenshots
await clip('hero', async (page) => {
  await page.goto(site, { waitUntil: 'networkidle' });
  await wait(page, 1200);
  await caption(page, 'The old jQuery app (left) and Claude Code’s React port (right), step by step, in Kane’s screenshots.');
  await wait(page, 5500);
  await page.mouse.wheel(0, 520);
  await caption(page, 'Kane caught a real gap on the port: reload the page and your todo is gone. A confirmed difference.');
  await wait(page, 6000);
  await page.mouse.wheel(0, 330);
  await caption(page, 'Kane’s verdict went to Claude Code. Claude added persistence. Kane re-ran the same test: pass.');
  await wait(page, 6500);
});

// 3. The tests: written by Kane from the spec
await clip('tests', async (page) => {
  await page.goto(`${site}?b=escape-discards-a-todo-title-edit`, { waitUntil: 'networkidle' });
  await wait(page, 800);
  await page.mouse.wheel(0, 260);
  await caption(page, 'Kane wrote the tests from the TodoMVC spec: 28 of them, every step linked to an acceptance criterion. No selectors.');
  await wait(page, 6500);
  await caption(page, 'The same test file runs on both apps. Here: Escape discards an edit, on the old app and on the port.');
  await wait(page, 5500);
});

// 4. The oracle
await clip('oracle', async (page) => {
  await page.goto(site, { waitUntil: 'networkidle' });
  await page.locator('#behaviours').scrollIntoViewIfNeeded();
  await wait(page, 600);
  await caption(page, 'First, every test runs on the old app. 18 pass and replay cleanly: they become the referee.');
  await wait(page, 5500);
  await page.mouse.wheel(0, 420);
  await caption(page, 'One fails there too: the old jQuery app never kept todos across a reload. Ditto lists it instead of hiding it.');
  await wait(page, 5500);
});

// 5. The whole run, replayed from the recorded case
const c = JSON.parse(readFileSync('cases/todomvc/case.json', 'utf8'));
const t = (iso) => Date.parse(iso);
const times = c.events.map((e) => t(e.t));
const start = Math.min(...times);
const end = Math.max(...times);
const at = (iso) => ((t(iso) - start) / (end - start)) * 60000;
const roundStart = (n) => {
  const r = c.rounds.find((x) => x.n === n);
  const ts = [r?.agent?.startedAt, ...Object.values(r?.results ?? {}).map((x) => x.startedAt)].filter(Boolean).map(t);
  return new Date(Math.min(...ts)).toISOString();
};
const cues = [
  [0, 'Watch the whole run (116 minutes of real Kane and Claude Code work, sped up).'],
  [at(roundStart(0)), 'Claude Code ports the app. Kane replays the old app’s recordings on the port: 18 of 18 the same.'],
  [at(roundStart(1)), 'A refactor in a Claude Code session: the Stop hook makes Kane check before Claude may stop. 18/18, allowed.'],
  [at(roundStart(2)), 'Spec check: behaviours the old app never met. 3 fail on the port too.'],
  [at(roundStart(3)), 'Claude Code adds persistence from Kane’s findings. Kane: 3/3 pass, and 18/18 still the same.'],
].sort((a, b) => a[0] - b[0]);
await clip('replay', async (page) => {
  await page.goto(site, { waitUntil: 'networkidle' });
  await wait(page, 800);
  await page.getByRole('button', { name: /Watch the whole run/ }).click();
  const t0 = Date.now();
  for (const [ms, text] of cues) {
    const delay = ms - (Date.now() - t0);
    if (delay > 0) await wait(page, delay);
    await caption(page, text);
  }
  await wait(page, Math.max(0, 61500 - (Date.now() - t0)));
  await caption(page, 'Parity: 18 of 18. Every result here is a real Kane run, with its screenshots.');
  await wait(page, 3500);
});

// 6. The real logs
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const home = homedir();
const scrub = (l) => l.split(home).join('~').replace(/\/home\/[^/\s]+\//g, '~/');
const hookRaw = readFileSync('qa/hook-demo.log', 'utf8').split('\n').map(scrub);
const hookTools = hookRaw.filter((l) => /^\d\d:\d\d:\d\d tool/.test(l) && !/<<|cat >/.test(l)).slice(0, 8);
const hookClaude = hookRaw.filter((l) => /^\d\d:\d\d:\d\d claude/.test(l)).slice(-1);
const hookStop = hookRaw.filter((l) => /Stop says/.test(l)).slice(-1);
const hookLines = [...hookTools, ...hookClaude, ...hookStop].map((l) => {
  const m = l.match(/^(\S+) (\S+)\s+(.*)$/);
  if (!m) return esc(l);
  const [, ts, kind, rest] = m;
  if (kind === 'system' && /Stop says/.test(rest)) return `<span class="dim">${ts}</span> <span class="k">Stop hook</span> <span class="ok">${esc(rest.match(/Ditto:[^"]*/)?.[0] ?? rest)}</span>`;
  return `<span class="dim">${ts}</span> <span class="${kind === 'claude' ? 'c' : 'dim'}">${kind}</span> ${esc(rest.slice(0, 130))}`;
});
const specLines = readFileSync('.ditto-work/spec-gaps.log', 'utf8')
  .split('\n')
  .filter((l) => /kane rewrite|agent round|parity|Spec gaps/.test(l))
  .slice(0, 16)
  .map((l) => {
    const s = esc(l.trim());
    if (/ pass /.test(s)) return s.replace(/ pass /, ' <span class="ok">pass</span> ');
    if (/mismatch|test_issue|error/.test(s)) return s.replace(/(mismatch|test_issue|error)/, '<span class="bad">$1</span>');
    if (/agent round/.test(s)) return `<span class="k">${s}</span>`;
    return s;
  });
await clip('terminal', async (page) => {
  await page.goto(pathToFileURL(join(here, 'terminal.html')).href);
  await wait(page, 500);
  await page.evaluate(
    ([lines]) => window.play('claude -p · Stop hook → ditto hook stop', 'Your own Claude Code session: when it tries to stop, Ditto has Kane replay every legacy behaviour first.', lines, 420),
    [hookLines],
  );
  await wait(page, 2000);
  await page.evaluate(
    ([lines]) => window.play('npm run ditto -- spec-gaps', 'The closed loop in the log: Kane fails 3 spec behaviours → Claude Code fixes → Kane passes them, then replays the rest.', lines, 520),
    [specLines],
  );
  await wait(page, 2500);
});

// 7. A second agent, same referee
await clip('haiku', async (page) => {
  await page.goto(`${site}?case=todomvc-haiku`, { waitUntil: 'networkidle' });
  await wait(page, 800);
  await caption(page, 'Same oracle, a second agent: Haiku 5.5’s port, 18/18 the same. 22 of 24 Kane runs were pure replays: 7 credits.');
  await wait(page, 6500);
});

// 8. End
await clip('end', async (page) => {
  await page.goto(
    card(
      'Rewrite with an agent. Kane makes sure nobody notices.',
      'Kane designs the tests from your spec, the old app referees, every difference goes back to Claude Code until there are none.',
      'itssaharsh.github.io/ditto · github.com/itssaharsh/ditto',
    ),
  );
  await wait(page, 6500);
});
await browser.close();

// Assemble: each segment to 1920×1080 H.264, then concatenate.
const parts = [];
for (const d of readdirSync(out).filter((x) => /^\d\d-/.test(x)).sort()) {
  const webm = readdirSync(join(out, d)).find((f) => f.endsWith('.webm'));
  if (!webm) continue;
  const mp4 = join(out, `${d}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(out, d, webm), '-vf', 'scale=1920:1080:flags=lanczos,fps=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', mp4]);
  parts.push(mp4);
}
writeFileSync(join(out, 'list.txt'), parts.map((p) => `file '${p}'`).join('\n'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(out, 'list.txt'), '-c', 'copy', join(out, 'ditto-demo.mp4')]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(out, 'ditto-demo.mp4')]).toString().trim();
console.log(`qa/video/ditto-demo.mp4 · ${Math.round(Number(dur))} s`);
