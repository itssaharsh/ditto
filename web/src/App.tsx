import { useEffect, useMemo, useRef, useState } from 'react';
import { derive, type BehaviourRow, type CaseFile, type Derived } from './data';
import { caseFacts, pickNamed, plantedBugs, tryOrder } from './model';
import { Behaviours, HowItWorks, LoopRail, MutationsBlock, Rounds, ScanBlock, TestSheet, type ScanData } from './parts';
import { atTime, bounds, latestTest, phases } from './timeline';
import { useCase, useParam } from './useCase';

const DEFAULT_CASE = 'todomvc';

export interface CasesIndex {
  default?: string;
  cases: {
    id: string;
    title: string;
    /** Short name for the run switcher. */
    tab?: string;
    /** Bugs a breaker session planted (mutation check runs only). */
    planted?: number;
    rewrite: string;
    status: string;
    matched: number;
    total: number;
    fixRounds: number;
    createdAt: string;
  }[];
}

function useIndex(): { loaded: boolean; index?: CasesIndex } {
  const [state, setState] = useState<{ loaded: boolean; index?: CasesIndex }>({ loaded: false });
  useEffect(() => {
    fetch('./cases/index.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : undefined))
      .then((index) => setState({ loaded: true, index }))
      .catch(() => setState({ loaded: true }));
  }, []);
  return state;
}

export function App() {
  const [caseParam] = useParam('case');
  const { loaded, index } = useIndex();
  if (!loaded && !caseParam) return <Shell><Skeleton /></Shell>;
  return <CaseLoader id={caseParam ?? index?.default ?? DEFAULT_CASE} index={index} />;
}

function CaseLoader({ id, index }: { id: string; index?: CasesIndex }) {
  const { data, error } = useCase(id);
  if (!data) return <Shell>{error ? <NoCase error={error} /> : <Skeleton />}</Shell>;
  return <CaseView c={data} index={index} />;
}

function CaseTabs({ index, current }: { index?: CasesIndex; current: string }) {
  if (!index || index.cases.length < 2) return null;
  return (
    <nav className="cases" aria-label="Runs">
      {index.cases.map((k) => (
        <a key={k.id} href={`?case=${k.id}`} className={k.id === current ? 'on' : ''} aria-current={k.id === current ? 'page' : undefined}>
          <b>{k.tab ?? k.title.replace(/^.*ported by /, '')}</b>
          <span>
            {k.planted ? `${k.planted} planted · ` : ''}
            {k.matched}/{k.total} same{k.fixRounds ? ` after ${k.fixRounds} fix ${k.fixRounds === 1 ? 'round' : 'rounds'}` : ' on the first port'}
          </span>
        </a>
      ))}
    </nav>
  );
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

/** How long the full-run replay lasts; ?replay=30 shortens it (used when recording the demo video). */
const REPLAY_SECONDS = (() => {
  const n = Number(new URLSearchParams(window.location.search).get('replay'));
  return Number.isFinite(n) && n >= 10 && n <= 300 ? n : 60;
})();

/** Plays the recorded run back from the start in about a minute. */
function useReplay(full: CaseFile) {
  const span = useMemo(() => bounds(full), [full]);
  const [t, setT] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const rate = (span.end - span.start) / (REPLAY_SECONDS * 1000);
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setT((cur) => {
        const next = (cur ?? span.start) + dt * rate;
        if (next >= span.end) {
          setPlaying(false);
          return null;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, span]);
  const start = () => {
    setT(span.start);
    setPlaying(true);
  };
  const stop = () => {
    setPlaying(false);
    setT(null);
  };
  return { t, playing, start, stop, toggle: () => setPlaying((p) => !p), span, speed: Math.round((span.end - span.start) / (REPLAY_SECONDS * 1000)) };
}

function CaseView({ c: full, index }: { c: CaseFile; index?: CasesIndex }) {
  const replay = useReplay(full);
  const c = useMemo(() => (replay.t === null ? full : atTime(full, replay.t)), [full, replay.t]);
  const d: Derived = useMemo(() => derive(c), [c]);
  const [bParam, setB] = useParam('b');
  const named = pickNamed(d.rows, full.named);
  const following = replay.t !== null ? latestTest(c) : undefined;
  const selected: BehaviourRow | undefined = d.rows.find((r) => r.test.id === (following ?? bParam)) ?? named;
  const facts = caseFacts(c);
  const [focus, setFocus] = useState(0);
  const [scan, setScan] = useState<ScanData>();
  useEffect(() => {
    fetch(`./cases/${full.id}-scan/scan.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : undefined))
      .then((j) => j && setScan(j as ScanData))
      .catch(() => undefined);
  }, [full.id]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('autoplay') === '1' && ['parity', 'stopped'].includes(full.status)) replay.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="wrap">
      <Nav c={c} />
      <header className="hero">
        <h1>Ditto: Did the rewrite break anything?</h1>
        <Answer c={c} d={d} />
        <CaseTabs index={index} current={full.id} />
        {full.note && (
          <p className="case-note">
            {full.note}{' '}
            {full.mutations && <a href="#mutations">See the list, and how Kane found each bug&nbsp;↓</a>}
          </p>
        )}
        <ReplayBar full={full} replay={replay} />
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
              {d.matched > 0 && (
                <span>
                  Last check of the {d.matched}: <b>{d.lastCheck.replayed}</b> replays of the old app&rsquo;s recordings
                  {d.lastCheck.healed > 0 && (
                    <>
                      , <b>{d.lastCheck.healed}</b> healed
                    </>
                  )}
                  {d.lastCheck.fresh > 0 && (
                    <>
                      , <b>{d.lastCheck.fresh}</b> written fresh by Kane
                    </>
                  )}
                </span>
              )}
              <span>
                <b>{facts.rounds}</b> fix {facts.rounds === 1 ? 'round' : 'rounds'}
                {facts.rounds === 0 ? ' needed' : ''}
              </span>
              {facts.specFixes > 0 && (
                <span>
                  <b>{facts.specFixes}</b> spec-gap {facts.specFixes === 1 ? 'fix' : 'fixes'}
                </span>
              )}
              {facts.hookChecks > 0 && (
                <span>
                  <b>{facts.hookChecks}</b> Stop-hook {facts.hookChecks === 1 ? 'check' : 'checks'}
                </span>
              )}
              <span>
                <b>{facts.runs}</b> Kane runs: <b>{facts.replays}</b> pure replays, <b>{facts.heals}</b> healed, <b>{facts.authored}</b> authored
              </span>
              <span>
                <b>{facts.credits}</b> credits
              </span>
            </p>
            {(d.oracleFails > 0 || d.oracleUnclear > 0) && (
              <p className="aside-note">
                Not counted: {d.oracleFails > 0 && `${d.oracleFails} ${d.oracleFails === 1 ? 'behaviour' : 'behaviours'} from the spec the old app itself fails`}
                {d.oracleFails > 0 && d.oracleUnclear > 0 && ', and '}
                {d.oracleUnclear > 0 && `${d.oracleUnclear} ${d.oracleUnclear === 1 ? 'test' : 'tests'} Kane could not run cleanly on the old app`}.
                {d.specMet > 0 && ` ${d.specMet} of them now pass on the rewrite after a spec fix.`}
              </p>
            )}
          </section>

          <section className="card try">
            <h2>Try these</h2>
            <div className="chips">
              {tryOrder(d.rows, full.named)
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
      <MutationsBlock c={c} d={d} />
      <Rounds c={c} d={d} />
      {scan && <ScanBlock scan={scan} d={d} />}
      <HowItWorks c={c} d={d} />
    </div>
  );
}

function ReplayBar({ full, replay }: { full: CaseFile; replay: ReturnType<typeof useReplay> }) {
  const final = ['parity', 'stopped', 'failed'].includes(full.status);
  if (!final) return null;
  const ph = phases(full);
  const total = replay.span.end - replay.span.start;
  const pos = replay.t === null ? 1 : (replay.t - replay.span.start) / total;
  const recorded = new Date(full.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className={`replay ${replay.t !== null ? 'on' : ''}`}>
      {replay.t === null ? (
        <button className="rp-btn" onClick={replay.start}>
          <span aria-hidden>▶</span> Watch the whole run in {REPLAY_SECONDS} seconds
        </button>
      ) : (
        <>
          <button className="rp-btn" onClick={replay.toggle} aria-label={replay.playing ? 'Pause replay' : 'Resume replay'}>
            {replay.playing ? '❚❚ Pause' : '▶ Resume'}
          </button>
          <button className="rp-btn ghost" onClick={replay.stop}>
            Skip to the end
          </button>
        </>
      )}
      <div className="rp-track" aria-label="Phases of the run">
        {ph.map((p) => (
          <span key={p.label + p.start} style={{ flexGrow: Math.max(1, p.end - p.start) }} className="rp-ph">
            {p.label}
          </span>
        ))}
        <i className="rp-pos" style={{ left: `${pos * 100}%` }} aria-hidden />
      </div>
      <small className="rp-note">
        {replay.t === null ? `Recorded on ${recorded}, over ${Math.round(total / 60000)} minutes of Kane and Claude Code runs.` : `Replaying at ${replay.speed}× speed.`}
      </small>
    </div>
  );
}

function Answer({ c, d }: { c: CaseFile; d: Derived }) {
  const fixed = d.fixedRows.filter((r) => r.legacy?.outcome === 'pass');
  const confirmed = fixed.filter((r) => r.history.some((h) => h.result.outcome === 'mismatch' || h.result.outcome === 'fail'));
  const unsure = fixed.length - confirmed.length;
  const planted = plantedBugs(c);
  const rounds = caseFacts(c).rounds;
  if (c.status === 'parity' && planted.length > 0) {
    const found = planted.filter((b) => b.fixRound !== undefined).length;
    return (
      <p className="ans">
        <b>It did: a second Claude Code session planted {planted.length} bugs.</b> Kane&rsquo;s findings led Claude Code to{' '}
        {found === planted.length ? `all ${found}` : `${found} of ${planted.length}`} in {rounds} {rounds === 1 ? 'round' : 'rounds'}, and now{' '}
        {d.matched} of {d.oracleTotal} behaviours act the same again.
      </p>
    );
  }
  if (c.status === 'parity' && fixed.length > 0)
    return (
      <p className="ans">
        <b>Yes, and Claude Code fixed it.</b> Kane confirmed {confirmed.length} {confirmed.length === 1 ? 'behaviour' : 'behaviours'} that changed, and
        Claude Code fixed {confirmed.length === 1 ? 'it' : 'them'} from Kane&rsquo;s findings
        {unsure > 0 ? `; ${unsure} more that Kane was unsure about pass now too` : ''}. Now {d.matched} of {d.oracleTotal} act the same.
      </p>
    );
  if (c.status === 'parity')
    return (
      <p className="ans">
        <b>No.</b> {d.matched} of {d.oracleTotal} behaviours act the same on the old app and the rewrite. Here is the proof for one of them.
        {d.specMet > 0 &&
          ` Kane also found ${d.specMet} ${d.specMet === 1 ? 'thing' : 'things'} the spec asks for that neither app did; Claude Code added ${d.specMet === 1 ? 'it' : 'them'} from Kane’s findings.`}
      </p>
    );
  if (c.status === 'stopped' || c.status === 'failed')
    return (
      <p className="ans">
        <b>{rounds > 0 ? 'Yes, still.' : 'Yes.'}</b> {d.oracleTotal - d.matched} of {d.oracleTotal} behaviours act differently on the rewrite. Here is one
        of them.
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
