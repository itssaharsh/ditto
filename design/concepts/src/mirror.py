from frames import *
css = """
:root{--bg:#ECF0EE;--bg2:#E3E9E6;--surf:#FFFFFF;--ink:#0F1B16;--ink2:#46544D;--ink3:#79867F;--line:#D5DDD9;
--ok:#0B8A5B;--ok-soft:#DDF3E9;--bad:#D6402A;--bad-soft:#FBE4DE;--hl:inset 0 1px 0 rgba(255,255,255,.9);
--sh1:0 1px 2px rgba(14,60,42,.06),0 2px 6px rgba(14,60,42,.05);
--sh2:0 1px 1px rgba(14,60,42,.05),0 4px 10px rgba(14,60,42,.06),0 18px 40px -8px rgba(14,60,42,.14);
--disp:"Bricolage Grotesque","Avenir Next","Trebuchet MS",system-ui,sans-serif;--body:"Hanken Grotesk","Segoe UI",system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box;margin:0}
body{background:radial-gradient(1200px 500px at 30% -10%,#F6F9F7,transparent 70%),var(--bg);color:var(--ink);font:16px/1.5 var(--body);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
.wrap{max-width:1320px;margin:0 auto;padding:0 32px 40px}
nav{display:flex;justify-content:space-between;align-items:center;height:56px;font-size:14px;color:var(--ink2)}
.brand{font:700 20px var(--disp);color:var(--ink);letter-spacing:-.02em;display:flex;align-items:center;gap:9px}
.brand i{display:inline-flex;width:22px;height:22px;position:relative}.brand i:before,.brand i:after{content:"";position:absolute;width:13px;height:17px;border-radius:4px;border:2px solid var(--ink);top:2px}
.brand i:before{left:0}.brand i:after{right:0;background:var(--ok);border-color:var(--ok)}
h1{font:600 clamp(32px,3.9vw,54px)/1.05 var(--disp);letter-spacing:-.035em;margin:6px 0 4px;max-width:900px}
h1 span{color:var(--ink3);font-weight:500}
.lede{color:var(--ink2);max-width:760px;margin-bottom:20px;font-size:17px}
.grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;align-items:start}
.stage{position:relative;background:var(--surf);border-radius:22px;box-shadow:var(--hl),var(--sh2);padding:22px 26px 22px}
.test{position:relative;border-radius:14px;background:linear-gradient(#0F1B16,#16261F);color:#EAF3EE;padding:14px 20px 15px;box-shadow:0 1px 0 rgba(255,255,255,.12) inset,0 8px 18px -6px rgba(15,27,22,.5);margin-right:150px}
.test small{display:block;font-size:13px;color:#8FB3A2;margin-bottom:2px}
.test b{font:600 21px/1.2 var(--disp);letter-spacing:-.015em}
.test p{margin-top:6px;font-size:15px;color:#D5E4DC;line-height:1.45}
.test code{font:500 13.5px var(--mono);background:rgba(255,255,255,.1);padding:1px 6px;border-radius:5px;color:#fff}
.legs{height:30px;position:relative;margin-right:150px}.legs i{position:absolute;top:0;width:2px;height:30px;background:var(--ink);transform-origin:top;animation:drop .5s .3s ease-out both}.legs i:after{content:"";position:absolute;bottom:-3px;left:-3px;width:8px;height:8px;border-radius:50%;background:var(--ink)}
@keyframes drop{from{transform:scaleY(0)}}
.twins{display:grid;grid-template-columns:1fr 1fr;gap:56px;position:relative}
.eq{position:absolute;left:50%;top:33%;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:50%;background:var(--ok);color:#fff;display:grid;place-items:center;font:700 26px/1 var(--disp);box-shadow:var(--hl),0 0 0 6px #fff,0 6px 16px rgba(11,138,91,.4);z-index:2;animation:pop .5s 1.25s cubic-bezier(.3,1.6,.5,1) both}
@keyframes pop{from{transform:translate(-50%,-50%) scale(0)}}
.side .tag{display:flex;align-items:center;justify-content:space-between;font-size:13.5px;color:var(--ink2);margin-bottom:8px}
.side .tag b{color:var(--ink);font-weight:650}
.side .tag span{font-size:12.5px;color:var(--ink3)}
.side .fr{border-radius:12px;box-shadow:0 0 0 1px var(--line),var(--sh1)}
.verdict{display:flex;align-items:center;gap:10px;margin-top:12px;padding:10px 12px;border-radius:12px;background:var(--ok-soft);box-shadow:inset 0 1px 0 rgba(255,255,255,.7);font-size:14.5px}
.verdict .p{font:700 12.5px var(--body);letter-spacing:.06em;background:var(--ok);color:#fff;border-radius:7px;padding:3px 9px}
.verdict em{font-style:normal;color:#0A5F40}
.was{margin-top:10px;display:grid;grid-template-columns:128px 1fr;gap:12px;align-items:center;font-size:13.5px;color:var(--ink2);line-height:1.4}
.was .fr{border-radius:7px;box-shadow:0 0 0 1px #EBB4A9,0 2px 6px rgba(214,64,42,.18)}
.was b{color:var(--bad);font-weight:650}
.stamp{position:absolute;right:18px;top:12px;width:140px;height:140px;border-radius:50%;color:var(--ok);display:grid;place-content:center;text-align:center;transform:rotate(-8deg);animation:thunk .55s 1.5s cubic-bezier(.2,1.3,.4,1) both;mix-blend-mode:multiply}
.stamp:before{content:"";position:absolute;inset:0;border-radius:50%;border:3px solid currentColor;box-shadow:inset 0 0 0 5px #fff,inset 0 0 0 7px currentColor;opacity:.9}
.stamp b{font:800 40px/.95 var(--disp);letter-spacing:-.03em}.stamp svg{margin:0 auto 4px}.stamp i{font:800 15px/1.1 var(--disp);font-style:normal;letter-spacing:.08em;text-transform:uppercase}
.stamp u{text-decoration:none;font:700 12px var(--body);margin-top:5px;opacity:.85}
@keyframes thunk{0%{transform:rotate(-24deg) scale(2.1);opacity:0}55%{opacity:1}75%{transform:rotate(-6deg) scale(.94)}100%{transform:rotate(-8deg) scale(1);opacity:1}}
.rail{display:flex;flex-direction:column;gap:18px}
.card{background:var(--surf);border-radius:18px;box-shadow:var(--hl),var(--sh1);padding:20px 22px}
.big{font:700 104px/.9 var(--disp);letter-spacing:-.05em;color:var(--ok);display:flex;align-items:baseline;gap:6px}
.big span{font-size:48px;color:var(--ink3);font-weight:500;letter-spacing:-.03em}
.card h3{font:600 17px var(--body);margin:6px 0 12px;color:var(--ink)}
.facts{list-style:none;padding:0;display:grid;gap:6px;font-size:14.5px;color:var(--ink2)}
.facts b{color:var(--ink);font-weight:650}
.try h4{font:650 15px var(--body);margin-bottom:10px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{font:500 14px var(--body);background:#F4F7F5;border-radius:999px;padding:7px 13px;color:var(--ink);box-shadow:inset 0 0 0 1px var(--line),inset 0 1px 0 #fff;cursor:pointer}
.chip.first{background:var(--ink);color:#fff;box-shadow:0 4px 10px -2px rgba(15,27,22,.4),inset 0 1px 0 rgba(255,255,255,.25)}
.loop{margin-top:22px;display:grid;grid-template-columns:repeat(3,1fr);gap:0;font-size:14.5px;color:var(--ink2)}
.loop h5{grid-column:1/-1;font:650 14px var(--body);color:var(--ink);margin-bottom:10px}
.loop div{padding:0 22px 0 14px;border-left:2px solid var(--ok);line-height:1.45}
.loop div b{color:var(--ink);font-weight:650;display:block;margin-bottom:2px}
.loop em{font-style:normal;color:var(--bad)}.loop code{font:12.5px var(--mono);color:var(--ink)}
@media(max-width:1100px){.grid{grid-template-columns:1fr}.rail{display:grid;grid-template-columns:1fr 1fr}.rail .try{grid-column:1/-1}}
@media(max-width:700px){.wrap{padding:0 16px 32px}nav span{display:none}.stage{padding:16px;border-radius:18px}.test{margin-right:0;margin-top:74px}.legs{display:none}
.twins{grid-template-columns:1fr;gap:22px;margin-top:16px}.eq{display:none}.stamp{width:100px;height:100px;right:10px;top:6px}.stamp b{font-size:28px}.stamp b{font-size:32px}.big{font-size:84px}.rail{display:flex}.loop{grid-template-columns:1fr;gap:12px}h1{font-size:34px}}
"""
html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ditto: Did the rewrite break anything? (Mirror)</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>{FRAMES_CSS}{css}</style></head><body><div class="wrap">
<nav><div class="brand"><i></i>Ditto</div><span>todomvc-jquery &rarr; todomvc-react-ts &middot; round 3 of 3</span></nav>
<h1>Ditto: Did the rewrite break anything?</h1>
<p class="lede">No. Kane replayed the same plain-English tests on the old app and on the agent&rsquo;s rewrite, and Claude Code fixed every difference until there were none.</p>
<div class="grid"><div>
<section class="stage">
<div class="stamp"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg><i>Same<br>behaviour</i><u>26 of 26</u></div>
<div class="test"><small>One behaviour, one sentence, run on both apps</small><b>Escape discards a todo title edit</b>
<p>Double-click <code>Review proposal</code>, change it to <code>Review contract</code>, press Escape &mdash; the title stays <code>Review proposal</code>.</p></div>
<div class="legs"><i style="left:calc(25% * 1.2 - 14px)"></i><i style="left:calc(75% * 1.2 - 14px)"></i></div>
<div class="twins"><div class="eq">=</div>
<div class="side"><div class="tag"><b>Legacy &middot; jQuery</b><span>the oracle</span></div>{real("12-2-5.jpg")}
<div class="verdict"><span class="p">PASS</span><em>Title stayed &ldquo;Review proposal&rdquo;</em></div></div>
<div class="side"><div class="tag"><b>Rewrite &middot; React + TypeScript</b><span>agent&rsquo;s port</span></div>{rw("Review proposal")}
<div class="verdict"><span class="p">PASS</span><em>Fixed after one round</em></div>
<div class="was">{rw("Review contract", annot=True)}<div><b>Round 1 &middot; FAIL</b><br>&ldquo;Pressing Escape saved the new title instead of discarding it.&rdquo;</div></div></div>
</div></section>
<div class="loop"><h5>Kane said &rarr; Claude did</h5>
<div><b>Round 1</b><em>Escape saved the edit</em> &rarr; stop saving on blur after Escape <code>TodoItem.tsx +6 &minus;2</code></div>
<div><b>Round 2</b><em>&ldquo;1 items left&rdquo; with one todo</em> &rarr; pluralise the count <code>Footer.tsx +3 &minus;1</code></div>
<div><b>Round 3</b><em>Filter reset after reload</em> &rarr; read the hash on mount <code>App.tsx +9 &minus;0</code></div></div>
</div>
<aside class="rail">
<div class="card"><div class="big">26<span>/ 26</span></div><h3>behaviours the same on both apps</h3>
<ul class="facts"><li><b>0</b> selectors written</li><li><b>Same test file</b> on both apps</li><li><b>3</b> rounds &middot; <b>41</b> Kane runs, <b>29</b> pure replays</li></ul></div>
<div class="card try"><h4>Try these</h4><div class="chips"><span class="chip first">Escape discards a todo title edit</span>{"".join(f'<span class="chip">{c}</span>' for c in CHIPS)}</div></div>
</aside></div></div></body></html>"""
open("../mirror.html","w").write(html)
