// A pull-request-ready parity report (Markdown) from a recorded case: paste it into a PR description,
// post it with `gh pr comment <n> --body-file`, or append it to $GITHUB_STEP_SUMMARY in CI.
import type { CaseFile, RunSummary } from './case.js';

const SITE = 'https://itssaharsh.github.io/ditto/';

function latest(c: CaseFile, id: string): RunSummary | undefined {
  let s: RunSummary | undefined;
  for (const r of [...c.rounds].sort((a, b) => a.n - b.n)) if (r.results[id]) s = r.results[id];
  return s;
}

const word = (s?: RunSummary) =>
  !s ? '—' : s.outcome === 'pass' ? 'same' : s.outcome === 'mismatch' || s.outcome === 'fail' ? '**different**' : s.outcome === 'test_issue' ? 'unclear' : 'not run';

const how = (s?: RunSummary) =>
  !s ? '' : s.mode === 'author' ? 'written fresh by Kane' : s.healTriggered ? 'replay, healed' : s.mode === 'replay' || s.mode === 'replay+heal' ? "replay of the old app's recording" : s.mode;

const one = (t?: string) => (t ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();

/** Whole sentences up to about n characters, never cut mid-word. */
function sentences(t: string, n: number): string {
  // A sentence ends at . ! or ? followed by a space or the end, so "Footer.tsx" or "active.length" never split one.
  const parts = one(t).replace(/[*`#]/g, '').match(/[\s\S]*?[.!?](?=\s|$)\s*/g) ?? [one(t)];
  let out = '';
  for (const p of parts) {
    if (out && (out + p).length > n) break;
    out += p;
  }
  return out.trim();
}

export function reportMarkdown(c: CaseFile, opts: { site?: string } = {}): string {
  const site = opts.site ?? SITE;
  const oracle = c.suite.tests.filter((t) => c.oracle[t.id]?.outcome === 'pass' && c.oracle[t.id]?.replayVerified !== false);
  const rows = oracle.map((t) => ({ t, s: latest(c, t.id) }));
  const same = rows.filter((r) => r.s?.outcome === 'pass').length;
  const differ = rows.filter((r) => r.s && (r.s.outcome === 'mismatch' || r.s.outcome === 'fail'));
  const unclear = rows.length - same - differ.length;
  const left = c.suite.tests.length - oracle.length;
  const date = (c.updatedAt ?? c.createdAt).slice(0, 10);
  const L = c.apps.legacy.label;
  const R = c.apps.rewrite.label;
  const out: string[] = [];

  out.push(`## Ditto: did the rewrite break anything?`);
  out.push('');
  out.push(
    differ.length === 0 && unclear === 0
      ? `**No.** ${same} of ${rows.length} behaviours act the same on the ${R} rewrite as on the ${L} app, checked by Kane CLI (${date}).`
      : `**Yes.** Kane CLI confirmed ${differ.length} of ${rows.length} behaviours act differently on the ${R} rewrite${unclear ? `, and could not tell on ${unclear}` : ''} (${date}).`,
  );
  out.push('');
  if (differ.length) {
    out.push('### What changed');
    for (const { t, s } of differ) out.push(`- **${t.title}**: ${one(s?.verdict?.oneLiner ?? s?.oneLiner ?? s?.reason)}`);
    out.push('');
  }
  out.push(`| Behaviour | ${L} | ${R} | How Kane checked |`);
  out.push('|---|---|---|---|');
  for (const { t, s } of rows) out.push(`| ${one(t.title)} | same | ${word(s)} | ${how(s)} |`);
  out.push('');

  const loop = c.events.filter((e) => e.kind === 'decision' && e.did.startsWith('Sent to Claude')) as Extract<CaseFile['events'][number], { kind: 'decision' }>[];
  if (loop.length) {
    out.push('<details><summary>Kane said → Claude Code fixed</summary>');
    out.push('');
    const title = new Map(c.suite.tests.map((t) => [t.id, t.title]));
    for (const r of [...c.rounds].filter((x) => x.agent?.kind === 'fix').sort((a, b) => a.n - b.n)) {
      out.push(`**Round ${r.n}**${r.agent?.commit ? ` (commit \`${r.agent.commit}\`)` : ''}`);
      for (const e of loop.filter((x) => x.round === r.n)) out.push(`- Kane on "${title.get(e.test) ?? e.test}": ${one(e.said)}`);
      if (r.agent?.summary) out.push(`- Claude Code: ${sentences(r.agent.summary, 320)}`);
      out.push('');
    }
    out.push('</details>');
    out.push('');
  }
  out.push(
    `${left} of the ${c.suite.tests.length} tests Kane designed from the spec are not counted: the ${L} app fails them or Kane could not run them cleanly on it, so they cannot judge the rewrite.`,
  );
  out.push('');
  out.push(
    `Kane runs: ${c.totals.kaneRuns} (${c.totals.replays} pure replays), ${Math.round(c.totals.credits)} credits. Every result, with Kane's screenshots of both apps: ${site}?case=${c.id}`,
  );
  return out.join('\n') + '\n';
}
