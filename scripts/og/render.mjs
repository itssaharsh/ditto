// Renders the social preview card (web/public/og.png, 1200×630) from Kane's own screenshots in the planted-bug run.
// Usage: node scripts/og/render.mjs
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const c = JSON.parse(readFileSync('cases/todomvc-mutation/case.json', 'utf8'));
const t = 'escape-discards-a-todo-title-edit';
const shot = (n, status) => c.rounds.find((r) => r.n === n).results[t].shots.find((s) => s.step.startsWith('14-2') && s.status === status && s.kind === 'screenshot').file;
const file = (rel) => pathToFileURL(resolve('cases/todomvc-mutation', rel)).href;
const url = `${pathToFileURL(resolve('scripts/og/card.html')).href}?bad=${encodeURIComponent(file(shot(0, 'failed')))}&ok=${encodeURIComponent(file(shot(1, 'passed')))}`;
const browser = await chromium.launch({ executablePath: join(homedir(), '.local/lib/kane-chrome/chrome'), headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: 'web/public/og.png' });
await browser.close();
console.log('web/public/og.png');
