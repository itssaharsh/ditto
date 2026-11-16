import { useMemo, useState } from 'react';
import { derive, type BehaviourRow, type CaseFile, type Derived } from './data';
import { caseFacts, pickNamed, tryOrder } from './model';
import { Behaviours, HowItWorks, LoopRail, Rounds, TestSheet } from './parts';
import { useCase, useParam } from './useCase';

const DEFAULT_CASE = 'todomvc';

export function App() {
  const [caseParam] = useParam('case');
  const caseId = caseParam ?? DEFAULT_CASE;
  const { data, error } = useCase(caseId);
  if (!data) return <Shell>{error ? <NoCase error={error} /> : <Skeleton />}</Shell>;
  return <CaseView c={data} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap">
      <Nav />
      {children}
    </div>
  );
}

function Nav({ c }: { c?: CaseFile }) {
  return (
    <nav>
      <a className="brand" href="./" aria-label="Ditto home">
        <Mark />
        Ditto
      </a>
      {c && (
        <span className="navmeta">
          {c.apps.legacy.label} → {c.apps.rewrite.label}
          <span className="sep" aria-hidden>
            ·
          </span>
          <a href="#how">How it works</a>
          <span className="sep" aria-hidden>
            ·
          </span>
          <a href="https://github.com/itssaharsh/ditto">GitHub</a>
        </span>
      )}
    </nav>
  );
}

/** The ditto mark (〃): "the same as above". */
function Mark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="11" fill="#147a52" />
      <path d="M19 13 L14 29 M33 13 L28 29" stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function CaseView({ c }: { c: CaseFile }) {
  const d: Derived = useMemo(() => derive(c), [c]);
  const [bParam, setB] = useParam('b');
  const named = pickNamed(d.rows);
  const selected: BehaviourRow | undefined = d.rows.find((r) => r.test.id === bParam) ?? named;
  const facts = caseFacts(c);
  const [focus, setFocus] = useState(0);

  return (
    <div className="wrap">
      <Nav c={c} />
      <header className="hero">
        <h1>Ditto: Did the rewrite break anything?</h1>
        <Answer c={c} d={d} />
      </header>

      <div className="grid">
        <main className="main" aria-label="Proof for one behaviour">
          {selected ? (
            <TestSheet c={c} row={selected} focus={focus} onFocus={setFocus} />
          ) : (
            <div className="sheet empty">No behaviours yet. Run <code>ditto design</code> first.</div>
          )}
        </main>

        <aside className="rail" aria-label="Parity">
          <section className="card parity" aria-live="polite">
            <div className="num">
              <b>{d.matched}</b>
              <span>/{d.oracleTotal}</span>
            </div>
            <Sticker c={c} d={d} />
            <p className="facts">
              <span>
                <b>0</b> selectors
              </span>
              <span>
                <b>Same test file</b> on both apps
              </span>
              <span>
                <b>{facts.rounds}</b> fix {facts.rounds === 1 ? 'round' : 'rounds'}
              </span>
              <span>
                <b>{facts.runs}</b> Kane runs, <b>{facts.replays}</b> pure replays
              </span>
            </p>
            {(d.legacyDiffers > 0 || d.unverified > 0) && (
              <p className="aside-note">
                {d.legacyDiffers > 0 && (
                  <>
                    {d.legacyDiffers} of the spec's behaviours already fail on the old app, so they're left out.{' '}
                  </>
                )}
                {d.unverified > 0 && <>{d.unverified} could not be run cleanly by Kane and are not counted.</>}
              </p>
            )}
          </section>

          <section className="card try">
            <h2>Try these</h2>
            <div className="chips">
              {tryOrder(d.rows)
                .slice(0, 7)
                .map((r) => (
                  <button
                    key={r.test.id}
                    className={`chip ${selected?.test.id === r.test.id ? 'on' : ''} ${r.status}`}
                    onClick={() => {
                      setB(r.test.id);
                      setFocus(0);
                    }}
                    aria-pressed={selected?.test.id === r.test.id}
                  >
                    {r.test.title}
                  </button>
                ))}
              <a className="chip more" href="#behaviours">
                All {d.rows.length} behaviours
              </a>
            </div>
          </section>

          <LoopRail c={c} d={d} onPick={(id) => setB(id)} />
        </aside>
      </div>

      <Behaviours c={c} d={d} selected={selected?.test.id} onPick={(id) => {
        setB(id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }} />
      <Rounds c={c} d={d} />
      <HowItWorks c={c} d={d} />
    </div>
  );
}

function Answer({ c, d }: { c: CaseFile; d: Derived }) {
  if (c.status === 'parity')
    return (
      <p className="ans">
        <b>No.</b> {d.matched} of {d.oracleTotal} behaviours act the same on the old app and the rewrite. Here is the proof for one of them.
      </p>
    );
  if (c.status === 'stopped' || c.status === 'failed')
    return (
      <p className="ans">
        <b>Yes, still.</b> {d.oracleTotal - d.matched} of {d.oracleTotal} behaviours act differently on the rewrite. Here is one of them.
      </p>
    );
  if (c.status === 'recording') {
    const done = Object.keys(c.oracle).length;
    return (
      <p className="ans live">
        <span className="dot" aria-hidden /> Recording the old app first: Kane has run {done} of {c.suite.tests.length} behaviours on it.
      </p>
    );
  }
  return (
    <p className="ans live">
      <span className="dot" aria-hidden /> Checking. {d.matched} of {d.oracleTotal} behaviours match so far.
    </p>
  );
}

function Sticker({ c, d }: { c: CaseFile; d: Derived }) {
  if (c.status === 'parity') return <div className="sticker">Same behaviour</div>;
  if (c.status === 'stopped' || c.status === 'failed') return <div className="sticker bad">{d.oracleTotal - d.matched} still differ</div>;
  return <div className="sticker live">{statusWords(c.status)}</div>;
}

function statusWords(s: CaseFile['status']): string {
  switch (s) {
    case 'recording':
      return 'Recording the old app';
    case 'porting':
      return 'Claude Code is porting';
    case 'checking':
      return 'Kane is checking';
    case 'fixing':
      return 'Claude Code is fixing';
    default:
      return 'Working';
  }
}

function Skeleton() {
  return (
    <div className="grid" aria-busy="true">
      <div className="sheet skel" />
      <div className="rail">
        <div className="card skel" style={{ height: 180 }} />
        <div className="card skel" style={{ height: 160 }} />
      </div>
    </div>
  );
}

function NoCase({ error }: { error: string }) {
  return (
    <div className="sheet empty">
      <h2>No run to show yet</h2>
      <p>
        Run <code>ditto loop</code> and this page fills in as Kane and Claude Code work. ({error})
      </p>
    </div>
  );
}
