import { useEffect, useRef, useState, type ReactNode } from 'react';
import { assetUrl, type BehaviourRow, type CaseFile, type Derived, type RunSummary } from './data';
import { firstFailingRound, fmtDate, framesByStep, plantedBugs, roundLabel, roundPhrase, verdictText, type EvidenceShot, type StepFrame } from './model';

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
  if (!shot) return <div className="fr none">{passed ? 'Kane opened the app here; no screenshot of it for this step' : `${label}: not reached`}</div>;
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

/** What Kane was doing when it took the frame ("Pressing Enter key", "checks …"), so a mid-action frame reads right. */
function FrameMeta({ shot, children }: { shot?: EvidenceShot; children: ReactNode }) {
  const m = shot?.summary?.match(/^(\w+):\s*(.*)$/);
  const words = m ? (m[1] === 'assert' ? `checks ${m[2]}` : m[2]) : shot?.summary;
  return (
    <div className="fr-meta">
      {children}
      {words && <small title={shot?.summary}>{words}</small>}
    </div>
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
        <span>
          Written by Kane from the spec · same file on both apps
          {row.legacy?.shareUrl && (
            <>
              {' · '}
              <a href={row.legacy.shareUrl} target="_blank" rel="noreferrer">
                Test Manager ↗
              </a>
            </>
          )}
        </span>
      </div>
      <div className="sheet-body">
        <h2 id="t-title" className="t-title">
          <span aria-hidden>#</span> {row.test.title}
        </h2>
        {row.test.summary && <p className="t-sum">&gt; {row.test.summary}</p>}
        <StatusLine c={c} row={row} />
      </div>
      <LoopStrip c={c} row={row} />
      <div className="sheet-body steps-body">

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
                <Frame caseId={c.id} shot={lf.shot} label={`${legacyLabel}, step ${i + 1}`} passed={row.legacy?.outcome === 'pass' || lf.reached} />
                {row.legacy && (
                  <FrameMeta shot={lf.shot}>
                    <Tag ok={legacyOk}>{legacyOk ? 'pass' : lf.failed ? 'fail' : 'not reached'}</Tag>
                  </FrameMeta>
                )}
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
                <Frame caseId={c.id} shot={rf.shot} label={`${rewriteLabel}, step ${i + 1}`} tone={showWas ? 'pass' : undefined} passed={row.latest?.outcome === 'pass' || rf.reached} />
                {row.latest && (
                  <FrameMeta shot={rf.shot}>
                    <Tag ok={rewriteOk}>{rewriteOk ? 'pass' : rf.failed ? 'fail' : 'not reached'}</Tag>
                  </FrameMeta>
                )}
                {!row.latest && row.legacy?.outcome === 'pass' && <Tag ok={undefined}>waiting for Kane</Tag>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatusLine({ c, row }: { c: CaseFile; row: BehaviourRow }) {
  const brokenFirst = c.rounds.find((r) => r.n === row.history[0]?.round)?.agent?.kind === 'mutate';
  const words: Record<BehaviourRow['status'], string> = {
    match:
      row.fixedInRound === undefined
        ? 'Same behaviour on both apps.'
        : brokenFirst
          ? `Same behaviour again. A planted bug changed it, Kane caught it, and it matched after fix round ${row.fixedInRound}.`
          : `Same behaviour. Differed at first, matched after fix round ${row.fixedInRound}.`,
    differs: c.rounds.some((r) => r.agent?.kind === 'fix') ? 'Still different on the rewrite.' : 'Different on this build: Kane confirmed it.',
    unclear: 'Kane could not get a clean verdict on the rewrite for this one, so it is not counted either way.',
    'legacy-differs': 'The old app itself fails this part of the spec, so it is not used to judge the rewrite.',
    unverified:
      row.latest?.outcome === 'pass'
        ? 'Kane could not get a clean run of this test on the old app, so it is not counted. The rewrite passes it.'
        : 'Kane could not get a clean run of this test on the old app, so it is not counted.',
    'spec-met': 'The old app never met this part of the spec. Kane found the gap on the rewrite too, and Claude closed it.',
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
  // The step that failed, in Kane's own screenshots: the broken build then, and the same step on the latest run.
  const steps = row.test.steps.length;
  const failFrames = framesByStep(fail.result, steps);
  const at = failFrames.findIndex((f) => f.failed);
  const failShot = at >= 0 ? failFrames[at].shot : undefined;
  const fixedRun = row.history.find((h) => h.round === row.fixedInRound)?.result;
  const nowShot = at >= 0 && fixedRun ? framesByStep(fixedRun, steps)[at].shot : undefined;
  const rewrite = c.apps.rewrite.label;
  const checkOnly = !agent && ['parity', 'stopped', 'failed'].includes(c.status) && !c.rounds.some((r) => r.agent?.kind === 'fix');
  if (checkOnly)
    return (
      <div className={`strip solo ${failShot ? 'with-frames' : ''}`}>
        <div className="s-kane">
          <small>
            Kane, {roundPhrase(c, fail.round)} ·{' '}
            {fail.result.outcome === 'mismatch' ? 'confirmed difference' : fail.result.outcome === 'fail' ? 'fail' : 'unsure whose fault'}
            {at >= 0 ? ` · step ${at + 1}` : ''}
          </small>
          {failShot && <Frame caseId={c.id} shot={failShot} label={`${rewrite} (rewrite), step ${at + 1}, ${roundPhrase(c, fail.round)}`} tone="fail" />}
          <q>{verdictText(fail.result)}</q>
        </div>
        <div className="s-agent">
          <small>Not sent to an agent</small>
          <span>This run only checks a build. In a loop, this verdict and both screenshots would go to Claude Code.</span>
        </div>
      </div>
    );
  return (
    <div className={`strip ${failShot ? 'with-frames' : ''}`}>
      <div className="s-kane">
        <small>
          Kane, {roundPhrase(c, fail.round)} ·{' '}
          {fail.result.outcome === 'mismatch' ? 'confirmed difference' : fail.result.outcome === 'fail' ? 'fail' : 'unsure whose fault'}
          {at >= 0 ? ` · step ${at + 1}` : ''}
        </small>
        {failShot && <Frame caseId={c.id} shot={failShot} label={`${rewrite} (rewrite), step ${at + 1}, ${roundPhrase(c, fail.round)}`} tone="fail" />}
        <q>{verdictText(fail.result)}</q>
      </div>
      <span className="arrow" aria-hidden>
        →
      </span>
      <div className="s-agent">
        <small>Claude Code · round {agent?.round ?? fail.round + 1}</small>
        <span>{agent ? firstSentence(agent.summary) : 'Working on it'}</span>
        {agent?.diffStat && <code>{agent.diffStat}</code>}
        {agent?.commit && <code>commit {agent.commit}</code>}
      </div>
      <span className="arrow" aria-hidden>
        →
      </span>
      <div className={`s-done ${row.fixedInRound !== undefined ? 'ok' : ''}`}>
        <small>
          {row.fixedInRound !== undefined ? `Kane, round ${row.fixedInRound}` : 'Next round'}
          {nowShot ? ` · step ${at + 1}` : ''}
        </small>
        {nowShot && <Frame caseId={c.id} shot={nowShot} label={`${rewrite} (rewrite), step ${at + 1}, round ${row.fixedInRound}`} tone="pass" />}
        <span>{row.fixedInRound !== undefined ? 'Same test, same step: pass' : 'Kane checks again'}</span>
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
  const refused = d.loop.filter((e) => e.did.startsWith('Did not take the healed pass'));
  return (
    <section className="card loop">
      <h2>Kane said → Claude did</h2>
      {rounds.length === 0 && (
        <p className="muted">
          {d.matched === d.oracleTotal ? 'Nothing to send back: every behaviour matched on the first port.' : 'This run only checks: nothing was sent to an agent.'}
        </p>
      )}
      {rounds.length === 0 && refused.length > 0 && (
        <div className="lr">
          <h3>Healed passes Ditto didn&rsquo;t take</h3>
          {refused.map((e) => {
            const final = d.rows.find((r) => r.test.id === e.test)?.latest;
            return (
              <button className={final?.outcome === 'pass' ? 'cq' : 'kq'} key={e.test + e.t} onClick={() => onPick(e.test)}>
                <b>Kane</b> <span className="ttl">{titles.get(e.test)}:</span> {e.said.replace(/; healing then passed it$/, '').replace(/\.\)$/, ')')}.{' '}
                <b>Fresh run:</b> {final?.outcome === 'pass' ? 'pass' : final?.outcome === 'mismatch' ? 'confirmed difference' : final ? 'unclear' : 'not run'}
              </button>
            );
          })}
        </div>
      )}
      {rounds.map((r) => {
        if (r.agent?.kind === 'mutate') return null;
        if (r.agent?.kind === 'hook') {
          const res = Object.values(r.results);
          const same = res.filter((x) => x.outcome === 'pass').length;
          const blocked = d.loop.filter((e) => e.round === r.n && e.did.startsWith('Blocked'));
          return (
            <div className="lr" key={r.n}>
              <h3>Round {r.n} · Stop hook</h3>
              <div className="cq hookq">
                <b>You</b> {firstSentence(r.agent.prompt)}
              </div>
              <div className={blocked.length ? 'kq' : 'cq'}>
                <b>Kane</b> replayed {res.length} legacy behaviours on the result: {same} the same.{' '}
                {blocked.length ? `Stop blocked; ${blocked.length} sent back.` : 'Stop allowed.'}
              </div>
            </div>
          );
        }
        if (!r.agent) {
          const res = Object.values(r.results);
          const met = res.filter((x) => x.outcome === 'pass').length;
          return (
            <div className="lr" key={r.n}>
              <h3>
                Round {r.n} · {r.label ?? 'Check'}
              </h3>
              <div className={met < res.length ? 'kq' : 'cq'}>
                <b>Kane</b> ran {res.length} behaviours the old app never met, straight from the spec: {met} met, {res.length - met} not.
              </div>
            </div>
          );
        }
        const sent = d.loop.filter((e) => e.round === r.n && (e.did.startsWith('Sent to Claude') || e.did.startsWith('Sent the spec')));
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
            <span role="columnheader" key={n} className="rc">
              {roundLabel(d.rounds.find((r) => r.n === n)!)}
            </span>
          ))}
          <span role="columnheader" className="nowc">
            Rewrite now
          </span>
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
            <span role="cell" className={`o nowc o-${r.latest?.outcome ?? 'none'}`}>
              {r.latest ? outcomeWord(r.latest) : ''}
            </span>
            {rounds.map((n) => {
              const h = r.history.find((x) => x.round === n);
              return (
                <span role="cell" key={n} className={`o rc o-${h?.result.outcome ?? 'none'}`}>
                  {h ? outcomeWord(h.result) : ''}
                  {h?.result.outcome === 'pass' && !h.result.healTriggered && h.result.mode !== 'author' && <small> replay</small>}
                  {h?.result.outcome === 'pass' && h.result.healTriggered && (
                    /assertion_failed/i.test(h.result.reason ?? '') ? (
                      <small className="warn" title="Kane's replay failed at this test's check; healing then re-authored steps and passed it. Ditto now needs a fresh run to agree before it counts a pass like this.">
                        {' '}
                        healed past a failed check
                      </small>
                    ) : (
                      <small title="Kane re-authored steps the old recording could not find on the new markup"> healed</small>
                    )
                  )}
                  {h?.result.outcome === 'pass' && h.result.mode === 'author' && <small title="Kane wrote this run from the plain-English test, without the old recording"> fresh</small>}
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
          const differ = res.filter((x) => x.outcome === 'mismatch' || x.outcome === 'fail').length;
          const unclear = res.length - pass - differ;
          const credits = res.reduce((a, x) => a + (x.credits ?? 0), 0);
          return (
            <li key={r.n}>
              <h3>
                {!r.agent && r.label
                  ? `${r.label} (round ${r.n})`
                  : r.agent?.kind === 'mutate'
                  ? 'A second Claude Code session breaks the port on purpose'
                  : r.n === 0
                  ? 'Port'
                  : r.agent?.kind === 'hook'
                    ? `Your session, checked by the Stop hook (round ${r.n})`
                    : r.agent?.kind === 'spec'
                      ? `Spec gap round ${r.n}`
                      : `Fix round ${r.n}`}
              </h3>
              {r.agent && (
                <p>
                  <b>Claude Code</b> ({r.agent.model ?? 'claude'}
                  {r.agent.turns ? `, ${r.agent.turns} turns` : ''}){' '}
                  {r.agent.kind === 'mutate'
                    ? 'changed behaviour on purpose and wrote down what it did'
                    : r.agent.kind === 'port'
                    ? 'ported the app'
                    : r.agent.kind === 'hook'
                      ? 'worked on your request, then tried to stop'
                      : r.agent.kind === 'spec'
                        ? 'implemented what the spec asks and the old app never did'
                        : 'fixed what Kane found'}
                  {r.agent.filesChanged.length ? `, ${r.agent.filesChanged.length} files changed` : ''}
                  {r.agent.diffStat ? ` (${r.agent.diffStat})` : ''}.{' '}
                  {r.agent.commit && <code>commit {r.agent.commit}</code>}
                </p>
              )}
              {r.agent?.summary && <blockquote>{firstSentence(r.agent.summary)}</blockquote>}
              {r.agent?.prompt && (
                <details className="sent">
                  <summary>
                    {r.agent.kind === 'mutate'
                      ? 'What the breaker session was asked to do'
                      : r.agent.kind === 'port'
                      ? 'The port request Ditto sent Claude Code'
                      : r.agent.kind === 'hook'
                        ? 'What you asked Claude Code'
                        : 'What Ditto sent Claude Code (Kane’s findings)'}
                  </summary>
                  <pre>{r.agent.prompt}</pre>
                </details>
              )}
              <p>
                <b>Kane</b> ran {res.length} {res.length === 1 ? 'test' : 'tests'} on the rewrite: {pass} same, {differ} different
                {unclear ? `, ${unclear} unclear (Kane unsure whose fault)` : ''}
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
        {c.mutations && (
          <li>
            <b>Then a second agent breaks it on purpose.</b> To check the tests would catch a real regression, a separate Claude Code session planted
            bugs and wrote them down outside the repository. A fresh fixer session got only Kane&rsquo;s findings.
          </li>
        )}
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

export interface ScanData {
  createdAt: string;
  note: string;
  tests: string[];
  targets: { name: string; source: string; results: Record<string, RunSummary> }[];
}

export function ScanBlock({ scan, d }: { scan: ScanData; d: Derived }) {
  const titles = new Map(d.rows.map((r) => [r.test.id, r.test.title]));
  const done = scan.targets.filter((t) => Object.keys(t.results).length > 0);
  if (!done.length) return null;
  const runs = done.reduce((a, t) => a + Object.keys(t.results).length, 0);
  const credits = Math.round(done.reduce((a, t) => a + Object.values(t.results).reduce((b, r) => b + (r.credits ?? 0), 0), 0));
  return (
    <section className="block scan" id="scan" aria-labelledby="sh">
      <h2 id="sh">The same tests, on {done.length} other TodoMVCs</h2>
      <p className="lead">
        {scan.note} {runs} replays, {credits} credits in total: a recording made once on the old app judges any build that should behave
        like it.
      </p>
      <div className="scan-rows">
        {done.map((t) => {
          const res = Object.entries(t.results);
          const same = res.filter(([, r]) => r.outcome === 'pass').length;
          const diff = res.filter(([, r]) => r.outcome === 'mismatch');
          const unclear = res.length - same - diff.length;
          return (
            <div className="scan-row" key={t.name}>
              <a className="scan-name" href={t.source}>
                {t.name}
              </a>
              <div className="scan-bar" aria-label={`${same} of ${res.length} the same`}>
                <i style={{ width: `${(same / res.length) * 100}%` }} />
                <span>
                  {same}/{res.length} same{diff.length ? ` · ${diff.length} differ` : ''}
                  {unclear ? ` · ${unclear} unclear` : ''}
                </span>
              </div>
              {diff.length > 0 && (
                <ul className="scan-diff">
                  {diff.map(([id, r]) => (
                    <li key={id}>
                      <b>{titles.get(id) ?? id}:</b> {verdictText(r)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function MutationsBlock({ c, d }: { c: CaseFile; d: Derived }) {
  const bugs = plantedBugs(c);
  if (!bugs.length) return null;
  const titles = new Map(d.rows.map((r) => [r.test.id, r.test.title]));
  const differs = (x: RunSummary) => x.outcome === 'mismatch' || x.outcome === 'fail';
  const broken = d.rounds.find((r) => r.agent?.kind === 'mutate');
  const res0 = Object.entries(broken?.results ?? {});
  const confirmed0 = res0.filter(([, x]) => differs(x));
  const unsure0 = res0.filter(([, x]) => x.outcome === 'test_issue');
  const fixRounds = d.rounds.filter((r) => r.agent?.kind === 'fix');
  return (
    <section className="block mutations" id="mutations" aria-labelledby="mh">
      <h2 id="mh">
        {bugs.length} bugs planted on purpose, and how Kane found them
      </h2>
      <p className="lead">
        A second Claude Code session broke the port and wrote this list outside the repository. The fixer never saw it: it only got Kane&rsquo;s
        findings.
        {c.audit &&
          ` Its own transcript shows ${c.audit.fixerToolCalls} tool calls, ${c.audit.touchedAnswerKey === 0 ? 'none of them' : `${c.audit.touchedAnswerKey} of them`} touching the list or Ditto’s work folder.`}
      </p>
      <ol className="mut-list">
        {bugs.map((b, i) => (
          <li key={i}>
            <span className="mut-n" aria-hidden>
              {i + 1}
            </span>
            <div>
              <b>{b.text}</b> {b.file && <code>{b.file}</code>}
              <small>
                {b.fixRound !== undefined
                  ? `Claude Code changed this file in fix round ${b.fixRound}, after Kane flagged: ${b.sentTests.map((t) => titles.get(t) ?? t).join('; ')}.`
                  : 'No fix round changed this file.'}
              </small>
            </div>
          </li>
        ))}
      </ol>
      <div className="mut-rounds">
        <div>
          <h3>Kane on the broken build</h3>
          <p>
            {confirmed0.length} confirmed {confirmed0.length === 1 ? 'difference' : 'differences'}
            {unsure0.length ? `, and ${unsure0.length} tests where Kane was unsure whose fault it was` : ''}.
          </p>
          <ul>
            {confirmed0.map(([id, x]) => (
              <li key={id}>
                <b>{titles.get(id) ?? id}:</b> {verdictText(x)}
              </li>
            ))}
          </ul>
        </div>
        {fixRounds.map((r) => {
          const res = Object.entries(r.results);
          const still = res.filter(([, x]) => differs(x));
          const same = res.filter(([, x]) => x.outcome === 'pass').length;
          return (
            <div key={r.n}>
              <h3>After fix round {r.n}</h3>
              <p>
                Kane re-ran {res.length} {res.length === 1 ? 'test' : 'tests'}: {same} the same{still.length ? `, ${still.length} still different` : ''}.
              </p>
              {still.length > 0 && (
                <ul>
                  {still.map(([id, x]) => (
                    <li key={id}>
                      <b>{titles.get(id) ?? id}:</b> {verdictText(x)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      {c.followUp && (
        <p className="followup">
          <b>What it changed in Ditto.</b> {c.followUp.text} <a href={`?case=${c.followUp.case}`}>See the re-check&nbsp;→</a>
        </p>
      )}
      {c.caveat && (
        <p className="caveat">
          <b>What the tests could not see.</b> {c.caveat} <a href={`${REPO}/blob/master/docs/testing.md#5-a-behaviour-no-test-covers`}>Kane&rsquo;s two runs</a>
        </p>
      )}
    </section>
  );
}
