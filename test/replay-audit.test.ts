import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { auditChecks, type CompiledCheck } from '../src/engine/replay-audit.js';
import { parseTestMd } from '../src/engine/suite.js';

// The checks below are copied from Kane's recordings on the jQuery TodoMVC (locator, read, expected value, transforms).
const appends = parseTestMd(readFileSync('suites/todomvc/enter-appends-trimmed-todo-and-clears-new-todo-input_test.md', 'utf8'), 'x');
const escape = parseTestMd(readFileSync('suites/todomvc/escape-discards-a-todo-title-edit_test.md', 'utf8'), 'x');

test('a check that finds its element by the text it expects is flagged', () => {
  const checks: CompiledCheck[] = [
    { step: 5, query: 'the title text of the newly appended todo item', expected: 'Call home', locator: 'internal:text="Call home"i', code: 'el(14).textContent', transforms: ['strip'] },
  ];
  const a = auditChecks(appends, checks);
  assert.equal(a.checks, 1);
  assert.equal(a.weak.length, 1);
  assert.match(a.weak[0].why, /finds the element by the text it then checks \("Call home"\)/);
  // Step 5 says "trimmed": the strip transform is flagged too.
  assert.match(a.weak[0].why, /strips spaces/);
});

test('a check located by role or id is not flagged', () => {
  const checks: CompiledCheck[] = [
    { step: 3, query: 'the number of items in the all-todos list', expected: '1', locator: '#todo-list', code: "el(8).querySelectorAll('li').length", transforms: [] },
    { step: 1, query: 'whether the new-todo input is focused', expected: 'true', locator: 'internal:role=textbox[name="What needs to be done?"i]', code: "el(4).matches(':focus')", transforms: [] },
  ];
  assert.deepEqual(auditChecks(appends, checks).weak, []);
});

test('a step that says "focused" with no check reading focus is flagged; "move focus away" is not a check', () => {
  const checks: CompiledCheck[] = [
    { step: 2, query: 'the text in the focused edit input', expected: 'Review proposal', locator: '#todo-list >> internal:role=textbox', code: 'el(10).value', transforms: [] },
    { step: 3, query: 'whether the editing class is present', expected: 'false', locator: 'internal:role=listitem >> internal:has-text="Review proposal"i', code: "el(9).classList.contains('editing')", transforms: [] },
  ];
  const a = auditChecks(escape, checks);
  assert.deepEqual(
    a.weak.map((w) => [w.step, w.query]),
    [[2, 'focus']],
  );
  // The same step with a focus read is fine.
  const withFocus = auditChecks(escape, [...checks, { step: 2, query: 'whether the edit input is focused', expected: 'true', locator: '#todo-list >> internal:role=textbox', code: "el(10).matches(':focus')" }]);
  assert.equal(withFocus.weak.length, 0);
});

test('stripping spaces is only flagged in a step about trimming', () => {
  const plain = parseTestMd('# T\n\n## Step 1\n\nCreate a todo titled \'Pay rent\', then assert the item\'s title equals \'Pay rent\'.\n', 'x');
  const padded = parseTestMd("# T\n\n## Step 1\n\nEnter '  Pay rent  ' and press Enter, then assert the title equals 'Pay rent'.\n", 'x');
  const check: CompiledCheck = { step: 1, query: 'the title', expected: 'Pay rent', locator: '.todo-list li label', code: 'el(1).textContent', transforms: ['strip'] };
  assert.equal(auditChecks(plain, [check]).weak.length, 0);
  assert.equal(auditChecks(padded, [check]).weak.length, 1);
});
