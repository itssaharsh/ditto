import { useEffect, useRef, useState, type ReactNode } from 'react';
import { assetUrl, type BehaviourRow, type CaseFile, type Derived, type RunSummary } from './data';
import { firstFailingRound, fmtDate, framesByStep, verdictText, type EvidenceShot, type StepFrame } from './model';

const REPO = 'https://github.com/itssaharsh/ditto';

/** Quoted values become small chips; the part Kane checks ("then assert …") gets the highlighter. */
function StepText({ text, lit, vars }: { text: string; lit: boolean; vars?: Record<string, string> }) {
  const clean = text
    .replace(/\{\{start_url\}\}/g, 'the app')
    .replace(/\{\{([a-z_]+)\}\}/g, (m, k: string) => (vars?.[k] ? `'${vars[k]}'` : m));
  const m = clean.match(/^(.*?)(,?\s*(?:then\s+)?assert\b[\s\S]*)$/i);
  const parts: [string, boolean][] = m ? [[m[1], false], [m[2], true]] : [[clean, false]];
  return (
    <p className="st-text">
      {parts.map(([chunk, isCheck], i) => (
        <span key={i} className={isCheck && lit ? 'hl' : isCheck ? 'check' : undefined}>
          {chunk.split(/((?<=^|[\s(])'[^']*'(?=[\s.,;:)]|$)|“[^”]+”|\{\{[a-z_]+\}\})/g).map((p, j) =>
            p && /^('|“|\{\{)/.test(p) && p.length > 1 ? (
              <code key={j} className="q">
                {p.replace(/^\{\{|\}\}$/g, '')}
              </code>
            ) : (
              <span key={j}>{p}</span>
            ),
          )}
        </span>
      ))}
    </p>
  );
}

function Frame({ caseId, shot, label, tone, passed }: { caseId: string; shot?: EvidenceShot; label: string; tone?: 'fail' | 'pass'; passed?: boolean }) {
  const dlg = useRef<HTMLDialogElement>(null);
  if (!shot) return <div className="fr none">{passed ? 'No screenshot for this step' : `${label}: not reached`}</div>;
  const src = assetUrl(caseId, shot.file);
  return (
    <>
      <button className={`fr ${tone ?? ''}`} onClick={() => dlg.current?.showModal()} aria-label={`Enlarge: ${label}`}>
        <img src={src} alt={`${label}: ${shot.summary ?? 'Kane screenshot'}`} loading="lazy" />
      </button>
      <dialog ref={dlg} className="zoom" aria-label={label} onClick={(e) => e.target === dlg.current && dlg.current?.close()}>
        <figure>
          <img src={src} alt={`${label}: ${shot.summary ?? 'Kane screenshot'}`} />
          <figcaption>
            <b>{label}</b> · {shot.summary ?? 'Kane screenshot'}
            <button className="close" onClick={() => dlg.current?.close()}>
              Close
            </button>
          </figcaption>
        </figure>
      </dialog>
    </>
  );
}

function Tag({ ok, children }: { ok: boolean | undefined; children: ReactNode }) {
  return <span className={`tag ${ok === undefined ? 'muted' : ok ? 'ok' : 'bad'}`}>{children}</span>;
}

export function TestSheet({ c, row, focus, onFocus }: { c: CaseFile; row: BehaviourRow; focus: number; onFocus: (i: number) => void }) {
  const steps = row.test.steps;
  const legacy = framesByStep(row.legacy, steps.length);
  const latest = framesByStep(row.latest, steps.length);
  const firstFail = firstFailingRound(row);
  const failed = firstFail ? framesByStep(firstFail.result, steps.length) : undefined;
  const fixedRound = row.fixedInRound;
  const [sweep, setSweep] = useState(-1);

  // The signature moment: the highlighter walks the steps once when a behaviour opens.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSweep(steps.length);
      return;
    }
    setSweep(-1);
    const timers = steps.map((_, i) => window.setTimeout(() => setSweep(i), 250 + i * 650));
    timers.push(window.setTimeout(() => setSweep(steps.length), 250 + steps.length * 650));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [row.test.id, steps.length]);

  const legacyLabel = `${c.apps.legacy.label} (old app)`;
  const rewriteLabel = `${c.apps.rewrite.label} (rewrite)`;

  return (
    <section className="sheet" aria-labelledby="t-title">
      <div className="sheet-head">
        <code>{row.test.id}_test.md</code>
        <span>Designed by Kane from the spec · one file, run unchanged on both apps</span>
      </div>
      <div className="sheet-body">
        <h2 id="t-title" className="t-title">
          <span aria-hidden>#</span> {row.test.title}
        </h2>
        {row.test.summary && <p className="t-sum">&gt; {row.test.summary}</p>}
        <StatusLine row={row} />

        <div className="cols" role="presentation">
          <span>Test steps</span>
          <span>
            Old app <i>{c.apps.legacy.label}</i>
          </span>
          <span aria-hidden />
          <span>
            Rewrite <i>{c.apps.rewrite.label}</i>
          </span>
        </div>

        {steps.map((st, i) => {
          const lf = legacy[i];
          const rf = latest[i];
          const was = failed?.[i];
          const rewriteOk = row.latest ? row.latest.outcome === 'pass' || (!rf.failed && rf.reached) : undefined;
          const legacyOk = row.legacy ? row.legacy.outcome === 'pass' || (!lf.failed && lf.reached) : undefined;
          const same = legacyOk !== undefined && rewriteOk !== undefined ? legacyOk === rewriteOk : undefined;
          const showWas = was?.failed && fixedRound !== undefined;
          return (
            <div
              key={i}
              className={`step ${sweep === i ? 'now' : ''} ${focus === i ? 'focus' : ''}`}
              onMouseEnter={() => onFocus(i)}
            >
              <div className="st-left">
                <div className="st-head">
                  ## {st.heading}
                  {st.verifies.length > 0 && <span className="ver"> @verifies {st.verifies.join(', ')}</span>}
                </div>
                <StepText text={st.text} lit={sweep >= i} vars={c.suite.variables} />
              </div>
              <div className="lane">
                <Frame caseId={c.id} shot={lf.shot} label={`${legacyLabel}, step ${i + 1}`} passed={row.legacy?.outcome === 'pass'} />
                {row.legacy && <Tag ok={legacyOk}>{legacyOk ? 'pass' : lf.failed ? 'fail' : 'not reached'}</Tag>}
              </div>
              <div className={`node ${same === undefined ? '' : same ? 'eq' : 'ne'}`} aria-label={same ? 'same' : same === false ? 'different' : 'pending'}>
                {same === false ? '≠' : '='}
              </div>
              <div className="lane">
                {showWas && was?.shot && (
                  <div className="was">
                    <span className="wtag">Round {firstFail!.round} · differed</span>
                    <Frame caseId={c.id} shot={was.shot} label={`${rewriteLabel}, step ${i + 1}, round ${firstFail!.round}`} tone="fail" />
                  </div>
                )}
                <Frame caseId={c.id} shot={rf.shot} label={`${rewriteLabel}, step ${i + 1}`} tone={showWas ? 'pass' : undefined} passed={row.latest?.outcome === 'pass'} />
                {row.latest && <Tag ok={rewriteOk}>{rewriteOk ? 'pass' : rf.failed ? 'fail' : 'not reached'}</Tag>}
                {!row.latest && row.legacy?.outcome === 'pass' && <Tag ok={undefined}>waiting for Kane</Tag>}
              </div>
            </div>
          );
        })}
      </div>
      <LoopStrip c={c} row={row} />
    </section>
  );
}

function StatusLine({ row }: { row: BehaviourRow }) {
  const words: Record<BehaviourRow['status'], string> = {
    match: row.fixedInRound !== undefined ? `Same behaviour. Differed at first, matched after fix round ${row.fixedInRound}.` : 'Same behaviour on both apps.',
    differs: 'Still different on the rewrite.',
    'legacy-differs': 'The old app itself fails this part of the spec, so it is not used to judge the rewrite.',
    unverified: 'Kane could not get a clean run of this test on the old app, so it is not counted.',
    checking: 'Kane is running this test now.',
    waiting: 'Waiting for Kane.',
  };
  return <p className={`status s-${row.status}`}>{words[row.status]}</p>;
}

function LoopStrip({ c, row }: { c: CaseFile; row: BehaviourRow }) {
  const fail = firstFailingRound(row);
  if (!fail) return null;
  const fixRound = c.rounds.find((r) => r.n === (row.fixedInRound ?? fail.round + 1));
  const agent = fixRound?.agent;
  return (
    <div className="strip">
      <div className="s-kane">
        <small>Kane, round {fail.round} · {fail.result.outcome === 'mismatch' ? 'confirmed difference' : 'fail'}</small>
        <q>{verdictText(fail.result)}</q>
      </div>
      <span className="arrow" aria-hidden>
        →
      </span>
      <div className="s-agent">
        <small>Claude Code · round {agent?.round ?? fail.round + 1}</small>
        <span>{agent ? firstSentence(agent.summary) : 'Working on it'}</span>
        {agent?.diffStat && <code>{agent.diffStat}</code>}
      </div>
      <span className="arrow" aria-hidden>
        →
      </span>
      <div className={`s-done ${row.fixedInRound !== undefined ? 'ok' : ''}`}>
        <small>{row.fixedInRound !== undefined ? `Round ${row.fixedInRound}` : 'Next round'}</small>
        <span>{row.fixedInRound !== undefined ? 'Same test, rewrite: pass' : 'Kane checks again'}</span>
      </div>
    </div>
  );
}

function firstSentence(s?: string): string {
  if (!s) return '';
  const t = s.replace(/\s+/g, ' ').replace(/[*`#]/g, '').trim();
  const m = t.match(/^(.{20,220}?[.!])(\s|$)/);
  return m ? m[1] : t.slice(0, 220);
}

export function LoopRail({ c, d, onPick }: { c: CaseFile; d: Derived; onPick: (id: string) => void }) {
  const rounds = d.rounds.filter((r) => r.n > 0);
  const titles = new Map(d.rows.map((r) => [r.test.id, r.test.title]));
  return (
    <section className="card loop">
      <h2>Kane said → Claude did</h2>
      {rounds.length === 0 && <p className="muted">No fix rounds yet.</p>}
      {rounds.map((r) => {
        const sent = d.loop.filter((e) => e.round === r.n && e.did.startsWith('Sent to Claude'));
        return (
          <div className="lr" key={r.n}>
            <h3>Round {r.n}</h3>
            {sent.map((e) => (
              <button className="kq" key={e.test} onClick={() => onPick(e.test)}>
                <b>Kane</b> <span className="ttl">{titles.get(e.test)}:</span> {e.said}
              </button>
            ))}
            {r.agent && (
              <div className="cq">
                <b>Claude</b> {firstSentence(r.agent.summary)}{' '}
                {r.agent.diffStat && <code>{r.agent.diffStat}</code>}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function outcomeWord(s?: RunSummary): string {
  if (!s) return '—';
  return { pass: 'pass', mismatch: 'differs', test_issue: 'unclear', fail: 'fail', error: 'not run' }[s.outcome];
}

export function Behaviours({ c, d, selected, onPick }: { c: CaseFile; d: Derived; selected?: string; onPick: (id: string) => void }) {
  const rounds = d.rounds.map((r) => r.n);
  return (
    <section className="block" id="behaviours" aria-labelledby="bh">
      <h2 id="bh">All {d.rows.length} behaviours</h2>
      <p className="lead">
        Kane designed these from the {c.suite.spec ? 'spec' : 'TodoMVC spec'}; each step cites the acceptance criteria it checks. The old app is the
        reference: only behaviours it passes count toward parity.
      </p>
      <div className="table" role="table" aria-label="Behaviours" style={{ ['--cols' as string]: rounds.length + 1 }}>
        <div className="tr th" role="row">
          <span role="columnheader">Behaviour</span>
          <span role="columnheader">Old app</span>
          {rounds.map((n) => (
            <span role="columnheader" key={n}>
              {n === 0 ? 'Port' : `Fix ${n}`}
            </span>
          ))}
        </div>
        {d.rows.map((r) => (
          <button key={r.test.id} role="row" className={`tr ${selected === r.test.id ? 'sel' : ''} s-${r.status}`} onClick={() => onPick(r.test.id)}>
            <span role="cell" className="bt">
              {r.test.title}
              <small>{r.test.steps.length} steps</small>
            </span>
            <span role="cell" className={`o o-${r.legacy?.outcome ?? 'none'}`}>
              {outcomeWord(r.legacy)}
            </span>
            {rounds.map((n) => {
              const h = r.history.find((x) => x.round === n);
              return (
                <span role="cell" key={n} className={`o o-${h?.result.outcome ?? 'none'}`}>
                  {h ? outcomeWord(h.result) : ''}
                  {h?.result.mode === 'replay' && h.result.outcome === 'pass' && <small> replay</small>}
                </span>
              );
            })}
          </button>
        ))}
      </div>
    </section>
  );
}

export function Rounds({ c, d }: { c: CaseFile; d: Derived }) {
  return (
    <section className="block" id="rounds" aria-labelledby="rh">
      <h2 id="rh">What each round did</h2>
      <ol className="rounds">
        {d.rounds.map((r) => {
          const res = Object.values(r.results);
          const pass = res.filter((x) => x.outcome === 'pass').length;
          const credits = res.reduce((a, x) => a + (x.credits ?? 0), 0);
          return (
            <li key={r.n}>
              <h3>{r.n === 0 ? 'Port' : `Fix round ${r.n}`}</h3>
              {r.agent && (
                <p>
                  <b>Claude Code</b> ({r.agent.model ?? 'claude'}
                  {r.agent.turns ? `, ${r.agent.turns} turns` : ''}) {r.agent.kind === 'port' ? 'ported the app' : 'fixed what Kane found'}
                  {r.agent.filesChanged.length ? `, ${r.agent.filesChanged.length} files changed` : ''}
                  {r.agent.diffStat ? ` (${r.agent.diffStat})` : ''}.{' '}
                  {r.agent.commit && <code>commit {r.agent.commit}</code>}
                </p>
              )}
              {r.agent?.summary && <blockquote>{firstSentence(r.agent.summary)}</blockquote>}
              <p>
                <b>Kane</b> ran {res.length} {res.length === 1 ? 'test' : 'tests'} on the rewrite: {pass} same, {res.length - pass} different
                {credits ? ` · ${Math.round(credits)} credits` : ''} · {fmtDate(r.agent?.endedAt ?? res[0]?.endedAt)}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function HowItWorks({ c, d }: { c: CaseFile; d: Derived }) {
  return (
    <section className="block how" id="how" aria-labelledby="hh">
      <h2 id="hh">How it works</h2>
      <ol className="how3">
        <li>
          <b>Kane writes the tests from your spec.</b> <code>kane-cli design tests</code> turned the TodoMVC spec into {d.rows.length} plain-English
          tests. No selectors: each step says what a person does and what they should see.
        </li>
        <li>
          <b>The old app is the reference.</b> Kane runs every test on the {c.apps.legacy.label} app first. {d.oracleTotal} pass and become the
          parity set, recorded so they replay in seconds.
        </li>
        <li>
          <b>The same tests judge the rewrite.</b> Claude Code ports the app without seeing the tests. Kane replays the old app's recordings on the
          port; every difference goes back to Claude with Kane's verdict and screenshots, until nothing differs.
        </li>
      </ol>
      <p className="real">
        What's real: every run, verdict and screenshot here comes from Kane CLI, and every change from Claude Code, recorded {fmtDate(c.createdAt)}.{' '}
        <a href={`${REPO}#whats-real`}>Details</a> · <a href={REPO}>Code</a> ·{' '}
        <a href={c.apps.legacy.source ?? 'https://github.com/tastejs/todomvc'}>Old app source (TodoMVC, MIT)</a>
      </p>
    </section>
  );
}

export type { StepFrame };
