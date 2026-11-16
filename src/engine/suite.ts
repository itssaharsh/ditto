// A suite is a folder of Kane `_test.md` files. Ditto reads them for display; Kane runs them.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export interface SuiteStep {
  heading: string;
  text: string;
  verifies: string[];
}

export interface SuiteTest {
  id: string; // file stem, stable across both apps
  file: string; // path relative to the repo
  title: string;
  summary?: string;
  assuranceId?: string;
  steps: SuiteStep[];
  /** sha256 of the file: the same bytes run on the legacy app and the rewrite. */
  sha256: string;
}

export function parseTestMd(text: string, file: string): SuiteTest {
  const id = basename(file).replace(/_test\.md$/, '');
  let body = text;
  let assuranceId: string | undefined;
  const fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    body = text.slice(fm[0].length);
    const m = fm[1].match(/^\s*id:\s*(\S+)/m);
    if (m) assuranceId = m[1];
  }
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? id.replace(/-/g, ' ');
  const summary = body.match(/^>\s+(.+)$/m)?.[1]?.trim();
  const steps: SuiteStep[] = [];
  const parts = body.split(/^##\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const headingLine = (nl >= 0 ? part.slice(0, nl) : part).trim();
    const verifies = [...headingLine.matchAll(/\bac-\d+\b/g)].map((m) => m[0]);
    const heading = headingLine.replace(/@verifies.*$/, '').trim();
    const stepText = (nl >= 0 ? part.slice(nl + 1) : '').replace(/```yaml[\s\S]*?```/g, '').trim();
    steps.push({ heading, text: stepText, verifies });
  }
  return {
    id,
    file,
    title,
    summary,
    assuranceId,
    steps,
    sha256: createHash('sha256').update(text).digest('hex'),
  };
}

export function loadSuite(dir: string, relBase = ''): SuiteTest[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('_test.md'))
    .sort()
    .map((f) => parseTestMd(readFileSync(join(dir, f), 'utf8'), relBase ? `${relBase}/${f}` : f));
}

/** Copy the tests Kane designed (in an assurance folder's .testmuai/tests) into the suite folder. */
export function importDesigned(assuranceDir: string, suiteDir: string): string[] {
  const src = join(assuranceDir, '.testmuai', 'tests');
  if (!existsSync(src)) return [];
  mkdirSync(suiteDir, { recursive: true });
  const copied: string[] = [];
  for (const f of readdirSync(src).filter((x) => x.endsWith('_test.md'))) {
    copyFileSync(join(src, f), join(suiteDir, f));
    copied.push(f);
  }
  return copied.sort();
}
