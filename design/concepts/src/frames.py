FRAMES_CSS = """
.fr{position:relative;aspect-ratio:600/322;container-type:inline-size;overflow:hidden;background:#f5f5f5;font-family:"DejaVu Sans","Helvetica Neue",Arial,sans-serif;line-height:1}
.fr img{position:absolute;width:320%;left:-110%;top:0;max-width:none;display:block}
.fr .t{position:absolute;top:2.2cqw;left:0;right:0;text-align:center;font-size:15cqw;color:#b83f45;font-weight:300;letter-spacing:-.2cqw}
.fr .pn{position:absolute;left:4.2cqw;width:91.6cqw;top:21.7cqw;background:#fff;box-shadow:0 .3cqw .7cqw rgba(0,0,0,.2),0 4cqw 8cqw rgba(0,0,0,.1)}
.fr .r1{height:11cqw;border:.25cqw solid #e6a5aa;position:relative}
.fr .r1 .ph{position:absolute;left:10.3cqw;top:50%;transform:translateY(-50%);font-style:italic;font-size:4cqw;color:#aaa;white-space:nowrap}
.fr .r1 .chev{position:absolute;left:2.2cqw;top:3.4cqw;width:1.6cqw;height:1.6cqw;border-right:.5cqw solid #999;border-bottom:.5cqw solid #999;transform:rotate(45deg)}
.fr .r2{height:9.7cqw;position:relative;border-bottom:.15cqw solid #ededed}
.fr .cb{position:absolute;left:1.3cqw;top:2.2cqw;width:4.6cqw;height:4.6cqw;border:.2cqw solid #bbb;border-radius:50%}
.fr .lb{position:absolute;left:10cqw;top:50%;transform:translateY(-50%);font-size:4cqw;color:#444;white-space:nowrap}
.fr .r2.ed:before{content:"";position:absolute;left:5.2cqw;right:0;top:0;bottom:0;border:.3cqw solid #cf7f87;border-right:0}
.fr .x{position:absolute;right:2.7cqw;top:50%;transform:translateY(-50%);font-size:4.4cqw;color:#999}
.fr .r3{height:6.9cqw;display:flex;align-items:center;font-size:2.7cqw;color:#111;padding-left:2.5cqw;position:relative}
.fr .fl{position:absolute;left:27.8cqw;display:flex;gap:2.2cqw}
.fr .fl u{text-decoration:none;padding:.6cqw 1.2cqw;border:.2cqw solid transparent;border-radius:.5cqw}
.fr .fl u.on{border-color:#d0707a}
.fr .inf{position:absolute;left:0;right:0;top:59.5cqw;text-align:center;font-size:2cqw;color:#666}
.fr .kbox{position:absolute;left:4.2cqw;width:91.6cqw;top:32.9cqw;height:9.6cqw;border:.45cqw solid #e5251b;box-shadow:0 0 0 .5cqw rgba(229,37,27,.18)}
"""
def real(src="12-2-5.jpg", cls=""):
    return f'<div class="fr real {cls}"><img src="../refs/legacy-frames/{src}" alt="legacy app"></div>'
def rw(title="Review proposal", annot=False, edit=False, cls="", empty=False):
    R2 = (f'<div class="r2 ed"><span class="lb">{title}</span></div>' if edit else f'<div class="r2"><b class="cb"></b><span class="lb">{title}</span><span class="x">&#x2715;</span></div>')
    k = '<div class="kbox"></div>' if annot else ''
    return (f'<div class="fr rw {cls}"><div class="t">todos</div><div class="pn"><div class="r1"><i class="chev"></i><span class="ph">What needs to be done?</span></div>'
            f'{R2}'
            f'<div class="r3"><span>1 item left</span><span class="fl"><u class="on">All</u><u>Active</u><u>Completed</u></span></div></div>'
            f'<div class="inf">Double-click to edit a todo</div>{k}</div>')
CHIPS = ["Empty edit deletes the todo","1 item left / 2 items left","Filter survives reload","Clear completed"]
