// What a pure replay actually re-checks.
// When Kane records a test on the old app, it compiles each sentence's check into a locator, a small read in
// JavaScript and an expected value. A replay re-runs that compiled check on the rewrite, not the sentence.
// Some compiled checks cannot fail on another build in the way the sentence means. Three kinds are easy to spot:
// - the element is found by the very text the check expects (`internal:text="Call home"i`), so the check can't
//   tell where the element is: on a build that puts new todos at the top, "its newly appended item displays
//   'Call home'" still passes;
// - spaces are stripped before comparing, in a step about trimming: a build that doesn't trim still passes;
// - the step says "focused", but no compiled check reads focus (and a replay's typing focuses the field itself).
// Ditto reads these from the recording Kane leaves next to the test (output-<id>/.internal/…/actions.ndjson) and,
// when a replay passes a test with such a check, has Kane author the test fresh on the rewrite before counting it.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SuiteTest } from './suite.js';

export interface CompiledCheck {
  /** The test's markdown step this check belongs to (1-based). */
  step: number;
  query: string;
  expected?: string;
  locator?: string;
  code?: string;
  transforms?: string[];
}

export interface WeakCheck {
  step: number;
  query: string;
  why: string;
}

export interface ReplayAudit {
  /** Value checks in the recording. */
  checks: number;
  weak: WeakCheck[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Values quoted in a step: 'like this', where the opening quote follows a space (so "item's" is not a quote). */
const quoted = (text: string) => [...text.matchAll(/(?:^|[\s(])'([^']*)'(?=[\s,.;)]|$)/g)].map((m) => m[1]);

/** The analyze actions of a recorded test, in step order. Reads only check definitions (no account details). */
export function readCompiledChecks(kaneDir: string, testId: string): CompiledCheck[] | undefined {
  const stepsDir = join(kaneDir, `output-${testId}`, '.internal', 'steps');
  if (!existsSync(stepsDir)) return undefined;
  const out: CompiledCheck[] = [];
  const steps = readdirSync(stepsDir)
    .filter((d) => /^\d+-/.test(d))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  for (const d of steps) {
    const step = parseInt(d, 10);
    const flows = join(stepsDir, d, 'flows');
    if (!existsSync(flows)) continue;
    for (const f of readdirSync(flows).sort()) {
      const file = join(flows, f, 'actions.ndjson');
      if (!existsSync(file)) continue;
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let a: { action_type?: string; action_params?: Record<string, unknown> };
        try {
          a = JSON.parse(line);
        } catch {
          continue;
        }
        if (a.action_type !== 'analyze' || !a.action_params) continue;
        const p = a.action_params as { query?: string; expected_value?: unknown; locators?: string[]; code_js?: string; transforms?: string[] };
        out.push({
          step,
          query: String(p.query ?? ''),
          expected: p.expected_value === null || p.expected_value === undefined ? undefined : String(p.expected_value),
          locator: Array.isArray(p.locators) ? p.locators[0] : undefined,
          code: p.code_js,
          transforms: p.transforms,
        });
      }
    }
  }
  return out;
}

/** Flags the compiled checks a replay can't fail in the way the test's sentence means. */
export function auditChecks(test: SuiteTest, checks: CompiledCheck[]): ReplayAudit {
  const weak: WeakCheck[] = [];
  const stepText = (n: number) => test.steps[n - 1]?.text ?? '';
  let valueChecks = 0;
  for (const c of checks) {
    const exp = c.expected?.trim();
    if (!exp || exp.startsWith('{{')) continue;
    valueChecks++;
    const why: string[] = [];
    if (c.locator && new RegExp(`text=\\\\?"${escapeRe(exp)}\\\\?"`, 'i').test(c.locator)) {
      why.push(`a check finds the element by the text it then checks ("${exp}"), so a replay can't tell where it is`);
    }
    // A step about trimming: it says so, or it types a value with spaces at either end.
    const aboutTrim = /\btrim/i.test(stepText(c.step)) || quoted(stepText(c.step)).some((v) => v !== v.trim());
    if (c.transforms?.includes('strip') && aboutTrim) {
      why.push(why.length ? 'strips spaces before comparing, in a step about trimming' : 'a check strips spaces before comparing, in a step about trimming');
    }
    if (why.length) weak.push({ step: c.step, query: c.query, why: why.join('; it also ') });
  }
  // A step that says "focused" but whose recorded checks never read focus.
  test.steps.forEach((s, i) => {
    const n = i + 1;
    // "its focused edit input …" asserts focus; "move focus away" is an action, not a check.
    if (!/\bfocused\b/i.test(s.text)) return;
    const own = checks.filter((c) => c.step === n);
    if (!own.length) return;
    if (own.some((c) => /:focus|activeElement/.test(c.code ?? ''))) return;
    weak.push({ step: n, query: 'focus', why: 'the step says "focused", but no recorded check reads focus' });
  });
  return { checks: valueChecks, weak };
}

export function auditReplay(kaneDir: string, test: SuiteTest): ReplayAudit | undefined {
  const checks = readCompiledChecks(kaneDir, test.id);
  return checks ? auditChecks(test, checks) : undefined;
}
