from frames import *
rows=[
("Escape discards a todo title edit","Double-click a title, change it, press Escape: the old title stays.","p","p","fpp"),
("Empty edit deletes the todo","Clear the title and press Enter: the todo is removed.","p","p","ppp"),
("1 item left / 2 items left","The counter reads &ldquo;1 item left&rdquo;, then &ldquo;2 items left&rdquo;.","p","p","pfp"),
("Filter survives reload","Select Active, reload: Active is still selected.","p","p","pfp"),
("Clear completed","Removes only the completed todos and hides itself when none are left.","p","p","ppp"),
("Toggle all marks every todo done","The chevron completes all, then reactivates all.","p","p","ppp"),
("Edit saves on Enter and on blur","Both commit the new, trimmed title.","p","p","ppp"),
("Completed todos are struck through","Checking a todo strikes it and lowers the count.","p","p","ppp"),
]
def dots(h):
    return "".join(f'<i class="d {c}"></i>' for c in h)
tr=""
for i,(t,s,a,b,h) in enumerate(rows):
    sel = i==0
    tr+=f'<div class="row{" sel" if sel else ""}"><div class="n">{i+1:02d}</div><div class="bt"><b>{t}</b><span>{s}</span></div><div class="m"><span class="ok">&#10003;</span></div><div class="m"><span class="ok">&#10003;</span></div><div class="h">{dots(h)}</div></div>'
    if sel:
        tr+=f'''<div class="open"><div class="tw"><figure>{real("12-2-5.jpg")}<figcaption><em>&#10003; PASS</em> Legacy</figcaption></figure><div class="join"><span>=</span></div>
<figure>{rw("Review proposal")}<figcaption><em>&#10003; PASS</em> Rewrite <s>was FAIL</s></figcaption></figure></div>
<div class="tx"><div class="sent"><span class="k">Kane&rsquo;s test</span>&ldquo;Double-click <code>Review proposal</code>, change it to <code>Review contract</code>, press Escape &mdash; the title stays <code>Review proposal</code>.&rdquo;</div>
<div class="said"><div><span class="k">Round 1 &middot; Kane said</span>&ldquo;Pressing Escape saved the new title instead of discarding it.&rdquo;</div><div><span class="k">Claude did</span>Stop saving on blur after Escape <code>TodoItem.tsx +6 &minus;2</code></div></div></div></div>'''
css = """
:root{--bg:#F3F5F9;--surf:#fff;--ink:#111827;--ink2:#4A5568;--ink3:#8591A5;--line:#E1E6EE;--acc:#2358F2;--acc-soft:#E8EEFE;--bad:#D63A2F;--bad-soft:#FCE6E3;
--hl:inset 0 1px 0 #fff;--sh1:0 1px 2px rgba(22,40,90,.06),0 3px 8px rgba(22,40,90,.05);--sh2:0 1px 1px rgba(22,40,90,.05),0 6px 14px rgba(22,40,90,.07),0 24px 48px -12px rgba(22,40,90,.18);
--num:"Big Shoulders Display","Arial Narrow",Impact,sans-serif;--body:"Public Sans","Segoe UI",system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--ink);font:15.5px/1.45 var(--body);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
.wrap{max-width:1340px;margin:0 auto;padding:0 32px 36px}
nav{height:54px;display:flex;align-items:center;justify-content:space-between;color:var(--ink2);font-size:14px}
.brand{font:800 19px var(--body);letter-spacing:-.03em;color:var(--ink)}.brand b{color:var(--acc)}
.top{display:grid;grid-template-columns:1fr auto;gap:30px;align-items:end;margin:0 0 14px}
h1{font:700 clamp(30px,3.4vw,48px)/1.04 var(--body);letter-spacing:-.04em;max-width:880px}
.sub{color:var(--ink2);margin-top:8px;max-width:640px;font-size:16px}
.total{text-align:right;position:relative;padding-bottom:12px}
.total .num{font:700 120px/.8 var(--num);letter-spacing:-.01em;color:var(--ink);display:flex;justify-content:flex-end;align-items:baseline;gap:4px}
.total .num i{font-style:normal;color:var(--acc)}.total .num span{font-size:74px;color:var(--ink3)}
.total:after{content:"";position:absolute;left:0;right:0;bottom:0;height:7px;border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);animation:rule .6s 1.6s both}
@keyframes rule{from{transform:scaleX(0);transform-origin:right}}
.total p{font:600 15px var(--body);margin:0 0 10px;color:var(--ink)}
.cols{display:grid;grid-template-columns:minmax(0,1fr) 318px;gap:22px;align-items:start}
.try{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:12px;font-size:14px;color:var(--ink2)}
.chip{padding:5px 10px;border-radius:8px;background:var(--surf);box-shadow:var(--hl),0 0 0 1px var(--line);color:var(--ink);font-weight:500;font-size:14px}
.chip.first{background:var(--acc);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 4px 10px -3px rgba(35,88,242,.55)}
.led{background:var(--surf);border-radius:16px;box-shadow:var(--hl),var(--sh2);overflow:hidden}
.hd,.row{display:grid;grid-template-columns:38px minmax(0,1fr) 84px 84px 94px;align-items:center;padding:0 18px}
.hd{height:38px;font-size:13px;color:var(--ink3);font-weight:600;border-bottom:1px solid var(--line);background:linear-gradient(#FAFBFD,#F5F7FA)}
.hd div:nth-child(n+3){text-align:center}
.row{min-height:52px;border-bottom:1px solid var(--line);position:relative}
.row .n{font:600 13px var(--body);color:var(--ink3)}
.bt b{display:block;font-weight:650;font-size:15.5px}.bt span{display:block;font-size:13.5px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m{text-align:center}.ok{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--ink);color:#fff;font-size:13px;font-weight:700}
.row .m:nth-child(4) .ok{animation:tick .35s both}
.row:nth-child(2) .m:nth-child(4) .ok{animation-delay:.5s}.row:nth-child(4) .m:nth-child(4) .ok{animation-delay:.7s}.row:nth-child(5) .m:nth-child(4) .ok{animation-delay:.8s}.row:nth-child(6) .m:nth-child(4) .ok{animation-delay:.9s}
@keyframes tick{from{transform:scale(0)}}
.h{display:flex;gap:5px;justify-content:center}.d{width:9px;height:9px;border-radius:50%;background:var(--ink);display:block}.d.f{background:var(--bad)}
.row.sel{background:linear-gradient(90deg,var(--acc-soft),#fff 70%);border-bottom:0}.row.sel:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--acc)}
.row.sel .n{color:var(--acc)}
.open{background:linear-gradient(#fff,#F7F9FF);border-bottom:1px solid var(--line);padding:4px 22px 18px 56px;display:grid;grid-template-columns:minmax(0,1.9fr) minmax(0,1fr);gap:20px;align-items:start}.tx{display:grid;gap:10px}
.k{display:block;font:600 12.5px var(--body);color:var(--acc);margin-bottom:3px}
.sent{font:500 14.5px/1.4 var(--body);padding:10px 14px;border-radius:10px;background:#fff;box-shadow:var(--hl),0 0 0 1px #D6E0FB,var(--sh1)}
code{font:500 13.5px var(--mono);background:#EEF2FC;padding:1px 5px;border-radius:4px}
.tw{display:grid;grid-template-columns:1fr 30px 1fr;margin-top:6px;align-items:center}
figure{margin:0}figure .fr{border-radius:10px;box-shadow:0 0 0 1px var(--line),var(--sh1)}
figcaption{font-size:13.5px;color:var(--ink2);margin-top:7px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
figcaption em{font-style:normal;font-weight:700;font-size:12.5px;background:var(--ink);color:#fff;padding:2px 8px;border-radius:6px}
figcaption s{text-decoration:none;color:var(--bad);font-size:12px;font-weight:600;background:var(--bad-soft);padding:2px 7px;border-radius:6px;margin-left:auto}
.join{display:grid;place-items:center}.join span{width:28px;height:28px;border-radius:50%;background:var(--acc);color:#fff;display:grid;place-items:center;font:700 17px var(--body);box-shadow:var(--hl),0 4px 10px -2px rgba(35,88,242,.5)}
.said{display:grid;gap:8px;font-size:13.5px;color:var(--ink2);padding:2px 0 0 12px;border-left:2px solid var(--acc)}.said .ar{color:var(--ink3);font-size:20px;text-align:center}
.said code{display:inline-block;margin-top:3px}
.side{display:flex;flex-direction:column;gap:16px}
.card{background:var(--surf);border-radius:16px;box-shadow:var(--hl),var(--sh1);padding:18px 20px}
.card h4{font:700 14.5px var(--body);margin-bottom:10px}
.facts{list-style:none;padding:0;display:grid;gap:7px;font-size:14.5px;color:var(--ink2)}.facts b{color:var(--ink)}
.log div{padding:0 0 12px 14px;border-left:2px solid var(--line);font-size:13.5px;color:var(--ink2);position:relative;line-height:1.4}.log div:before{content:"";position:absolute;left:-5px;top:3px;width:8px;height:8px;border-radius:50%;background:var(--acc)}
.log b{color:var(--ink)}.log em{font-style:normal;color:var(--bad)}.log code{font-size:12px}
.verd{font:700 15px var(--body);color:var(--ink);display:flex;align-items:center;gap:8px}
.leg{font-size:12.5px;color:var(--ink3);margin-top:12px;display:flex;gap:14px}.leg .d{display:inline-block;margin-right:5px}
@media(max-width:1080px){.cols{grid-template-columns:1fr}.top{grid-template-columns:1fr}.total{text-align:left}.total .num{justify-content:flex-start}}
@media(max-width:700px){.wrap{padding:0 16px 30px}nav span{display:none}.total .num{font-size:104px}.total .num span{font-size:64px}
.hd{display:none}.row{grid-template-columns:26px 1fr 60px;padding:10px 14px}.row .m:nth-child(3){display:none}.row .m:nth-child(4)::before{content:none}.row .h{display:none}.bt span{white-space:normal}
.open{padding:8px 12px 16px}.tw{grid-template-columns:1fr;gap:10px}.join{display:none}.said{grid-template-columns:1fr}.said .ar{display:none}.open{grid-template-columns:1fr}}
"""
html=f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ditto: Did the rewrite break anything? (Ledger)</title>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=Public+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>{FRAMES_CSS}{css}</style></head><body><div class="wrap">
<nav><div class="brand">Ditto<b>.</b></div><span>todomvc-jquery &rarr; todomvc-react-ts</span></nav>
<div class="top"><div><h1>Ditto: Did the rewrite break anything?</h1><p class="sub">Every behaviour users rely on, checked on the old app and the rewrite with the same plain-English test.</p></div>
<div class="total"><p>Parity &middot; Same behaviour</p><div class="num"><i>26</i><span>/ 26</span></div></div></div>
<div class="cols"><div>
<div class="try">Try these<span class="chip first">Escape discards a todo title edit</span>{"".join(f'<span class="chip">{c}</span>' for c in CHIPS)}</div>
<div class="led"><div class="hd"><div>#</div><div>Behaviour</div><div>Legacy</div><div>Rewrite</div><div>Rounds</div></div>{tr}</div>
</div><aside class="side">
<div class="card"><h4>The proof</h4><ul class="facts"><li><b>0</b> selectors</li><li><b>Same test file</b> on both apps</li><li><b>3</b> rounds</li><li><b>41</b> Kane runs, <b>29</b> pure replays</li></ul><div class="leg"><span><i class="d f"></i>fail</span><span><i class="d"></i>pass</span><span>one dot per round</span></div></div>
<div class="card log"><h4>Kane said &rarr; Claude did</h4>
<div><b>Round 1</b> Kane: <em>Escape saved the edit</em><br>Claude: stop saving on blur after Escape <code>TodoItem.tsx +6 &minus;2</code></div>
<div><b>Round 2</b> Kane: <em>&ldquo;1 items left&rdquo;</em><br>Claude: pluralise the count <code>Footer.tsx +3 &minus;1</code></div>
<div><b>Round 3</b> Kane: <em>Filter reset on reload</em><br>Claude: read the hash on mount <code>App.tsx +9 &minus;0</code></div></div>
</aside></div></div></body></html>"""
open("../ledger.html","w").write(html)
