// Records the console for the demo video: the first screen, one behaviour's proof, and the 60-second replay.
// Usage: node scripts/capture-console.mjs <console url> <out dir>
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://127.0.0.1:4747/?case=todomvc';
const out = process.argv[3] ?? 'qa/video';
mkdirSync(out, { recursive: true });
const executablePath = process.env.CHROME_PATH ?? join(homedir(), '.local/lib/kane-chrome/chrome');

const browser = await chromium.launch({ executablePath, headless: true });
async function clip(name, fn, size = { width: 1600, height: 1000 }) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, recordVideo: { dir: join(out, name), size } });
  const page = await ctx.newPage();
  await fn(page);
  await ctx.close();
  console.log(`recorded ${name}`);
}

// 1. First screen: the question, the verdict, the named example with its red-then-green step.
await clip('01-first-screen', async (page) => {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(6000);
  await page.mouse.wheel(0, 380);
  await page.waitForTimeout(4000);
  await page.mouse.wheel(0, -380);
  await page.waitForTimeout(1500);
});

// 2. Enlarge the rewrite's failing frame, then the fixed one.
await clip('02-proof', async (page) => {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const failing = page.locator('.was .fr').first();
  if (await failing.count()) {
    await failing.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await failing.click();
    await page.waitForTimeout(3500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(1500);
});

// 3. Watch the whole run in 60 seconds.
await clip('03-replay', async (page) => {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Watch the whole run/ }).click();
  await page.waitForTimeout(63000);
  await page.waitForTimeout(3000);
});

// 4. The behaviours table and the rounds.
await clip('04-table', async (page) => {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('#behaviours').scrollIntoViewIfNeeded();
  await page.waitForTimeout(4000);
  await page.locator('#rounds').scrollIntoViewIfNeeded();
  await page.waitForTimeout(4000);
});

await browser.close();
