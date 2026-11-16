from frames import *
css = """
:root{--bg:#E9F0F8;--bg2:#DCE6F2;--surf:#fff;--ink:#14202E;--ink2:#4B5A6C;--ink3:#8392A5;--line:#D6E0EC;--hl:#FFD84D;--hl2:#FFF1B8;--ok:#15864F;--ok-soft:#E0F4E8;--bad:#D23A2D;--bad-soft:#FCE7E4;
--lit:inset 0 1px 0 #fff;--sh1:0 1px 2px rgba(20,50,90,.07),0 3px 8px rgba(20,50,90,.06);--sh2:0 1px 1px rgba(20,50,90,.05),0 8px 18px rgba(20,50,90,.08),0 30px 60px -16px rgba(20,50,90,.22);
--disp:"Syne","Trebuchet MS",system-ui,sans-serif;--body:"Albert Sans","Segoe UI",system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box;margin:0}
body{background:linear-gradient(180deg,#F2F7FC 0,var(--bg) 360px);color:var(--ink);font:16px/1.5 var(--body);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased;min-height:100vh}
.wrap{max-width:1360px;margin:0 auto;padding:0 32px 32px}
nav{height:52px;display:flex;align-items:center;justify-content:space-between;color:var(--ink2);font-size:14px}
.brand{font:800 21px var(--disp);letter-spacing:-.03em;color:var(--ink)}.brand:after{content:"";display:inline-block;width:10px;height:10px;background:var(--hl);border-radius:3px;margin-left:5px;box-shadow:0 0 0 2px var(--ink)}
h1{font:700 clamp(26px,3vw,40px)/1.1 var(--disp);letter-spacing:-.03em;margin:2px 0 16px;max-width:1000px}
.grid{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:22px;align-items:start}
.sheet{background:var(--surf);border-radius:18px;box-shadow:var(--lit),var(--sh2);padding:0 0 12px;overflow:hidden}
.fn{display:flex;align-items:center;gap:10px;padding:11px 22px;background:linear-gradient(#F8FBFE,#EEF3F9);border-bottom:1px solid var(--line);font:500 13px var(--mono);color:var(--ink2)}
.fn b{font-weight:500;color:var(--ink)}.fn span{margin-left:auto;font:500 12.5px var(--body);color:var(--ink3)}
.doc{padding:14px 22px 6px}
.doc h2{font:500 17px var(--mono);color:var(--ink)}.doc h2 i{color:var(--ink3);font-style:normal;margin-right:8px}
.doc blockquote{font:400 13px var(--mono);color:var(--ink2);margin:4px 0 4px}
.lanes{display:grid;grid-template-columns:minmax(0,1fr) 188px 188px;column-gap:18px;padding:0 22px}
.lh{font:700 13px var(--body);padding:10px 0 8px;color:var(--ink);display:flex;align-items:center;gap:7px;border-bottom:1px solid var(--line)}
.lh small{font-weight:500;color:var(--ink3);font-size:12.5px}
.step{display:contents}
.step>div{padding:12px 0;border-bottom:1px dashed var(--line);position:relative}
.st h3{font:600 12.5px var(--mono);color:var(--ink3);margin-bottom:5px}.st h3 em{font-style:normal;color:var(--ink2);margin-left:6px}
.st p{font:400 13px/1.62 var(--mono);color:var(--ink)}
.st mark{background:linear-gradient(var(--hl),var(--hl)) 0 88%/0 62% no-repeat;color:inherit;padding:0 1px;animation:lit 1s forwards}
.step:nth-of-type(1) mark{animation-delay:.2s}.step:nth-of-type(2) mark{animation-delay:.9s}.step:nth-of-type(3) mark{animation-delay:1.5s}
@keyframes lit{to{background-size:100% 62%}}
.ln{display:flex;flex-direction:column;gap:6px}
.ln .fr{border-radius:8px;box-shadow:0 0 0 1px var(--line),var(--sh1)}
.res{font:700 12px var(--body);display:flex;align-items:center;gap:6px}
.res b{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:11px;color:#fff;background:var(--ok)}
.res.f b{background:var(--bad)}.res.f{color:var(--bad)}.res.p{color:var(--ok)}
.pair{position:relative;height:150px;margin-top:2px}
.pair .fr{position:absolute;width:158px}
.pair .a{left:0;top:16px;transform:rotate(-3deg);opacity:.95;box-shadow:0 0 0 1px #EDB5AD,0 4px 10px rgba(210,58,45,.2)}
.pair .b{left:30px;top:44px;box-shadow:0 0 0 1px var(--line),var(--sh1)}
.pair .tg{position:absolute;font:700 11px var(--body);padding:2px 7px;border-radius:6px;color:#fff;z-index:3}
.pair .t1{left:0;top:-2px;background:var(--bad)}.pair .t2{left:30px;top:134px;background:var(--ok)}
.verdict{margin:12px 22px 4px;padding:10px 14px;border-radius:10px;background:var(--bad-soft);box-shadow:var(--lit);font-size:14px;color:#7B2119;line-height:1.4}
.verdict b{color:var(--bad);margin-right:6px}
.rail{display:flex;flex-direction:column;gap:16px}
.card{background:var(--surf);border-radius:16px;box-shadow:var(--lit),var(--sh1);padding:18px 20px}
.par{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap}.par .n{font:800 84px/.82 var(--disp);letter-spacing:-.06em}.par .n span{font-size:46px;color:var(--ink3);letter-spacing:-.04em}
.par .v{font:700 16px/1.2 var(--disp);margin-bottom:4px;padding:4px 10px;background:var(--hl);border-radius:4px;transform:rotate(-2deg);box-shadow:0 2px 0 rgba(20,32,46,.9);white-space:nowrap}
.facts{margin-top:12px;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:14px;color:var(--ink2)}.facts b{color:var(--ink)}
.card h4{font:700 14px var(--body);margin-bottom:9px}
.chips{display:flex;flex-wrap:wrap;gap:7px}.chip{font:500 14px var(--body);background:#F2F6FB;padding:6px 12px;border-radius:8px;box-shadow:inset 0 0 0 1px var(--line),var(--lit)}
.chip.first{background:var(--hl2);box-shadow:inset 0 0 0 1px #E9C84A,var(--lit);font-weight:600}
.log{font:12.5px/1.55 var(--mono);color:var(--ink2)}
.log .r{font:700 12.5px var(--body);color:var(--ink);margin:10px 0 4px}.log .r:first-of-type{margin-top:0}
.log .l{padding:1px 8px;border-radius:4px;white-space:pre-wrap;word-break:break-word}.log .k{background:#EEF3F9}.log .m{background:var(--bad-soft);color:#8A241A}.log .a{background:var(--ok-soft);color:#0B5E36}
.log .k b{font-family:var(--body);color:var(--ink)}
@media(max-width:1100px){.grid{grid-template-columns:1fr}}
@media(max-width:700px){.wrap{padding:0 14px 28px}nav span{display:none}.lanes{grid-template-columns:1fr 1fr;padding:0 14px}.step>div.st{grid-column:1/-1;border-bottom:0;padding-bottom:4px}.lh.s{display:none}.lh.t{grid-column:1/-1}
.ln{padding-bottom:10px}.pair{height:128px}.pair .fr{width:130px}.doc{padding:12px 14px}.fn{padding:10px 14px}.fn span{display:none}.par .n{font-size:74px}.par .v{font-size:14px}.verdict{margin:12px 14px 4px}.step>div{border-bottom:0}}
"""
def lane(res, frame): return f'<div class="ln">{frame}<div class="res p"><b>&#10003;</b>{res}</div></div>'
html=f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ditto: Did the rewrite break anything? (Daylight terminal)</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Albert+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>{FRAMES_CSS}{css}</style></head><body><div class="wrap">
<nav><div class="brand">Ditto</div><span>todomvc-jquery &rarr; todomvc-react-ts &middot; 3 rounds</span></nav>
<h1>Ditto: Did the rewrite break anything?</h1>
<div class="grid"><section class="sheet">
<div class="fn"><b>escape-discards-a-todo-title-edit_test.md</b><span>one file, run unchanged on both apps</span></div>
<div class="doc"><h2><i>#</i>Escape discards a todo title edit</h2><blockquote>&gt; Escape leaves editing mode without applying the changed title.</blockquote></div>
<div class="lanes">
<div class="lh t">Test steps</div><div class="lh s">Legacy <small>jQuery</small></div><div class="lh s">Rewrite <small>React + TS</small></div>
<div class="step"><div class="st"><h3>## Step 1</h3><p><mark>At {{{{start_url}}}}, create a todo titled 'Review proposal'</mark> using the new-todo input at the top of the todo app.</p></div>
<div>{lane("pass",real("4-0-4.jpg"))}</div><div>{lane("pass",rw("Review proposal"))}</div></div>
<div class="step"><div class="st"><h3>## Step 2<em>@verifies ac-1, ac-3, ac-4, ac-5</em></h3><p>In the todo list, <mark>double-click the newly created 'Review proposal' item's label to edit it</mark>, then assert its item has the editing class, its focused edit input contains 'Review proposal', and its other controls are hidden.</p></div>
<div>{lane("pass",real("7-1-3.jpg"))}</div><div>{lane("pass",rw("Review proposal",edit=True))}</div></div>
<div class="step"><div class="st"><h3>## Step 3<em>@verifies ac-2, ac-7</em></h3><p>In that todo's edit input, replace the title with 'Review contract' and <mark>press Escape</mark>, then assert the item's editing class is absent and <mark>its displayed title remains 'Review proposal'</mark>.</p></div>
<div>{lane("pass",real("12-2-5.jpg"))}</div>
<div><div class="pair"><div class="fr a">{rw("Review contract",annot=True)}</div><span class="tg t1">R1 FAIL</span><div class="fr b">{rw("Review proposal")}</div><span class="tg t2">R2 PASS</span></div></div></div>
</div>
<div class="verdict"><b>Kane, round 1:</b><span>&ldquo;Pressing Escape saved the new title instead of discarding it.&rdquo; Sent to Claude Code with both screenshots.</span></div>
</section>
<aside class="rail">
<div class="card"><div class="par"><div class="n">26<span>/26</span></div><div class="v">Same behaviour</div></div>
<div class="facts"><span><b>0</b> selectors</span><span><b>Same test file</b> on both apps</span><span><b>3</b> rounds</span><span><b>41</b> Kane runs, <b>29</b> pure replays</span></div></div>
<div class="card"><h4>Try these</h4><div class="chips"><span class="chip first">Escape discards a todo title edit</span>{"".join(f'<span class="chip">{c}</span>' for c in CHIPS)}</div></div>
<div class="card"><h4>Kane said &rarr; Claude did</h4><div class="log">
<div class="r">Round 1</div><div class="l k"><b>Kane</b> Escape saved the edit</div><div class="l m">- onBlur={{commit}}</div><div class="l a">+ onBlur={{() =&gt; !escaped.current &amp;&amp; commit()}}   TodoItem.tsx +6 -2</div>
<div class="r">Round 2</div><div class="l k"><b>Kane</b> "1 items left" with one todo</div><div class="l a">+ pluralise the count   Footer.tsx +3 -1</div>
<div class="r">Round 3</div><div class="l k"><b>Kane</b> Filter reset after reload</div><div class="l a">+ read the hash on mount   App.tsx +9 -0</div></div></div>
</aside></div></div></body></html>"""
open("../terminal.html","w").write(html)
