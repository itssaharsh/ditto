// A deterministic second opinion on what Kane reported about the official TodoMVC implementations:
// plain Playwright, no AI, on the same builds. Each check is one behaviour from the TodoMVC spec.
// Usage: node scripts/recheck-impls.mjs [names...]   → docs/impl-recheck.json
import { createReadStream, existsSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = '.ditto-work/impls/todomvc/examples';
const names = process.argv.slice(2).length ? process.argv.slice(2) : ['jquery', 'react', 'javascript-es6', 'svelte', 'web-components', 'lit'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function serve(dir, port) {
  const root = resolve(dir);
  return new Promise((ok) => {
    const s = createServer((req, res) => {
      let f = normalize(join(root, decodeURIComponent(req.url.split('?')[0].split('#')[0])));
      if (!f.startsWith(root)) return res.writeHead(403).end();
      if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
      if (!existsSync(f)) return res.writeHead(404).end();
      res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' });
      createReadStream(f).pipe(res);
    });
    s.listen(port, '127.0.0.1', () => ok(s));
  });
}

// TodoMVC's spec fixes the class names; the web-components example uses its own, inside nested shadow roots.
const STD = { newTodo: '.new-todo', item: '.todo-list li', label: '.todo-list li label', toggle: '.todo-list li .toggle', toggleIn: '.toggle', toggleAll: '.toggle-all', toggleAllLabel: 'label[for="toggle-all"]', clear: '.clear-completed', edit: '.todo-list li .edit', filter: '.filters a', selected: '.filters a.selected' };
const SELECTORS = {
  'web-components': { newTodo: '.new-todo-input', item: 'li.todo-item', label: '.todo-item-text', toggle: '.toggle-todo-input', toggleIn: '.toggle-todo-input', toggleAll: '.toggle-all-input', toggleAllLabel: '.toggle-all-label', clear: '.clear-completed-button', edit: '.edit-todo-input', filter: 'a.filter-link', selected: 'a.filter-link.selected' },
};
const dirOf = (n) => (n === 'jquery' ? 'fixtures/legacy-todomvc' : existsSync(join(ROOT, n, 'dist', 'browser')) ? join(ROOT, n, 'dist', 'browser') : join(ROOT, n, 'dist'));
const browser = await chromium.launch({ executablePath: join(homedir(), '.local/lib/kane-chrome/chrome'), headless: true });
const out = {};
let port = 7301;

for (const name of names) {
  const server = await serve(dirOf(name), port);
  const url = `http://127.0.0.1:${port++}/`;
  const results = {};
  const S = SELECTORS[name] ?? STD;
  const fresh = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    return page;
  };
  const add = async (page, text) => {
    await page.locator(S.newTodo).click();
    await page.keyboard.type(text);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  };
  const labels = (page) => page.locator(S.label).evaluateAll((ls) => ls.map((l) => l.textContent));
  const visibleCount = (page, sel) => page.locator(sel).evaluateAll((xs) => xs.filter((x) => x.checkVisibility()).length);
  const checkedCount = (page) => page.locator(S.toggle).evaluateAll((xs) => xs.filter((x) => x.checked).length);
  const startEdit = async (page, text) => {
    await page.locator(S.label, { hasText: text }).first().dblclick();
    await page.waitForTimeout(150);
  };
  const deepActive = (page) =>
    page.evaluate(() => {
      let a = document.activeElement;
      while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
      return a ? `${a.tagName.toLowerCase()}.${[...a.classList].join('.')}` : null;
    });
  const check = async (id, fn) => {
    const page = await fresh();
    try {
      results[id] = await fn(page);
    } catch (e) {
      results[id] = { error: String(e.message).split('\n')[0].slice(0, 160) };
    }
    await page.close();
  };

  await check('new-todo focused on load', async (p) => ({ active: await deepActive(p), ok: /new-todo/.test((await deepActive(p)) ?? '') }));
  await check('new todos are appended', async (p) => {
    await add(p, 'a');
    await add(p, 'b');
    const l = await labels(p);
    return { labels: l, ok: l.join(',') === 'a,b' };
  });
  await check('whitespace-only new todo is not added', async (p) => {
    await add(p, '   ');
    const n = await p.locator(S.item).count();
    return { todos: n, ok: n === 0 };
  });
  await check('new todo is trimmed', async (p) => {
    await add(p, '  lead  ');
    const l = await labels(p);
    return { label: JSON.stringify(l[0]), ok: l[0] === 'lead' };
  });
  await check('mark-all (clicking its visible control) completes the only todo', async (p) => {
    await add(p, 'only');
    await p.locator(S.toggleAllLabel).first().click().catch(async () => p.locator(S.toggleAll).click({ force: true }));
    await p.waitForTimeout(150);
    const done = await checkedCount(p);
    return { completed: done, ok: done === 1 };
  });
  await check('mark-all by clicking the checkbox itself', async (p) => {
    await add(p, 'only');
    await p.locator(S.toggleAll).first().click({ force: true });
    await p.waitForTimeout(150);
    const done = await checkedCount(p);
    const allChecked = await p.locator(S.toggleAll).first().isChecked();
    return { completed: done, markAllChecked: allChecked, ok: done === 1 };
  });
  await check('mark-all by keyboard (Space on the checkbox)', async (p) => {
    await add(p, 'only');
    await p.locator(S.toggleAll).first().focus();
    await p.keyboard.press('Space');
    await p.waitForTimeout(150);
    const done = await checkedCount(p);
    return { completed: done, ok: done === 1 };
  });
  await check('Clear completed hidden with nothing completed', async (p) => {
    await add(p, 'x');
    const visible = (await visibleCount(p, S.clear)) > 0;
    return { visible, ok: !visible };
  });
  await check('Escape leaves edit mode and keeps the title', async (p) => {
    await add(p, 'buy milk');
    await startEdit(p, 'buy milk');
    await p.keyboard.press('Control+a');
    await p.keyboard.type('changed');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(150);
    const editing = await visibleCount(p, S.edit);
    const l = await labels(p);
    return { editing, label: l[0], ok: editing === 0 && l[0] === 'buy milk' };
  });
  await check('whitespace-only edit removes the todo', async (p) => {
    await add(p, 'a');
    await startEdit(p, 'a');
    await p.keyboard.press('Control+a');
    await p.keyboard.type('   ');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(150);
    const n = await p.locator(S.item).count();
    return { todos: n, ok: n === 0 };
  });
  await check('edit is trimmed', async (p) => {
    await add(p, 'a');
    await startEdit(p, 'a');
    await p.keyboard.press('Control+a');
    await p.keyboard.type('  spaced  ');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(150);
    const l = await labels(p);
    return { label: JSON.stringify(l[0]), ok: l[0] === 'spaced' };
  });
  await check('edit is saved on blur', async (p) => {
    await add(p, 'a');
    await startEdit(p, 'a');
    await p.keyboard.press('Control+a');
    await p.keyboard.type('blurred');
    await p.locator('h1').click();
    await p.waitForTimeout(150);
    const l = await labels(p);
    return { label: l[0], ok: l[0] === 'blurred' };
  });
  await check('Completed filter shows only completed', async (p) => {
    await add(p, 'open');
    await add(p, 'done');
    await p.locator(S.item, { hasText: 'done' }).locator(S.toggleIn).click({ force: true });
    await p.locator(S.filter, { hasText: 'Completed' }).click();
    await p.waitForTimeout(200);
    const shown = await p.locator(S.label).evaluateAll((ls) => ls.filter((l) => l.checkVisibility()).map((l) => l.textContent));
    const selected = (await p.locator(S.selected).first().textContent())?.trim();
    return { shown, selected, ok: shown.join(',') === 'done' && selected === 'Completed' };
  });
  await check('double-click focuses the edit input', async (p) => {
    await add(p, 'a');
    await startEdit(p, 'a');
    const active = await deepActive(p);
    return { active, ok: /^input\.edit/.test(active ?? '') };
  });
  await check('Escape then blur keeps the old title', async (p) => {
    await add(p, 'buy milk');
    await startEdit(p, 'buy milk');
    await p.keyboard.press('Control+a');
    await p.keyboard.type('changed');
    await p.keyboard.press('Escape');
    await p.locator('h1').click();
    await p.waitForTimeout(150);
    const l = await labels(p);
    return { label: l[0], ok: l[0] === 'buy milk' };
  });
  await check('double-click enters editing (10 tries)', async (p) => {
    await add(p, 'a');
    let entered = 0;
    for (let i = 0; i < 10; i++) {
      await p.locator(S.label, { hasText: 'a' }).first().dblclick({ timeout: 3000 });
      await p.waitForTimeout(150);
      if ((await visibleCount(p, S.edit)) > 0) entered++;
      // Leave edit mode the way a user would: click into the field, then press Escape.
      if ((await visibleCount(p, S.edit)) > 0) {
        await p.locator(S.edit).first().click();
        await p.keyboard.press('Escape');
      }
      // A build whose Escape keeps edit mode (React, #2309) still leaves it on blur.
      if ((await visibleCount(p, S.edit)) > 0) await p.locator('h1').click();
      await p.waitForTimeout(150);
    }
    return { entered, tries: 10, ok: entered === 10 };
  });
  await check('Completed filter kept on reload', async (p) => {
    await add(p, 'open');
    await add(p, 'done');
    await p.locator(S.item, { hasText: 'done' }).locator(S.toggleIn).click({ force: true });
    await p.locator(S.filter, { hasText: 'Completed' }).click();
    await p.waitForTimeout(200);
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    // Not every build keeps todos across a reload; add one so the footer (and its filters) is on screen either way.
    if (!(await p.locator(S.item).count())) await add(p, 'after reload');
    const selected = (await p.locator(S.selected).first().textContent({ timeout: 5000 }))?.trim();
    return { url: p.url().replace(/^https?:\/\/[^/]+/, ''), selected, ok: selected === 'Completed' };
  });
  out[name] = results;
  const bad = Object.entries(results).filter(([, r]) => !r.ok).map(([k]) => k);
  console.log(`${name.padEnd(15)} ${Object.keys(results).length - bad.length}/${Object.keys(results).length} as the spec says${bad.length ? ` · differs: ${bad.join('; ')}` : ''}`);
  server.close();
}
await browser.close();
writeFileSync('docs/impl-recheck.json', JSON.stringify({ what: 'Deterministic Playwright checks (no AI) of single TodoMVC-spec behaviours on the same builds Kane checked.', checkedAt: new Date().toISOString(), results: out }, null, 2) + '\n');
