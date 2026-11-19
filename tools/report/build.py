#!/usr/bin/env python3
"""The project report for the hackathon: design/report/copy.json laid out in the website's 1930s cartoon
style, A4 portrait, rendered to design/report/fish-all-day-report.pdf with real, selectable text (for judges and for the
AI tools that read entries first). Headless only: nothing opens on screen.

    python3 tools/report/build.py
"""
import html, json, pathlib, re, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
R = ROOT / 'design/report'
C = json.loads((R / 'copy.json').read_text())
SEC = {s['id']: s for s in C['sections']}
URL = 'https://fishallday.pages.dev'
e = lambda s: html.escape(str(s), quote=True)

def linkify(s):
    s = e(s)
    return re.sub(r'(https?://)?fishallday\.pages\.dev', f'<a href="{URL}">fishallday.pages.dev</a>', s)

CSS = r'''
@import url('https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Bowlby+One+SC&family=Shrikhand&family=Bitter:ital,wght@0,400;0,600;0,700;0,800;1,500;1,700&display=block');
@page { size: 210mm 297mm; margin: 0; }
:root { --paper: #f3e6c8; --cream: #fff7e4; --ink: #1c1712; --text: #2e251b; --brown: #5a4632; --navy: #1f2f55; --red: #c7372a; --mustard: #e9a43a; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: var(--paper); }
body { font: 400 10.4pt/1.55 'Bitter', Georgia, serif; color: var(--text); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
a { color: var(--navy); text-decoration: none; border-bottom: .3mm solid currentColor; }
.page { position: relative; width: 210mm; height: 297mm; padding: 19mm 18mm 20mm; overflow: hidden; break-after: page;
  background: var(--paper) radial-gradient(rgba(28,23,18,.07) .5px, transparent .8px) 0 0 / 2.4mm 2.4mm; }
.kicker { font: 400 9pt/1 'Bowlby One SC', 'Arial Black', sans-serif; color: var(--red); margin-bottom: 2.5mm; }
h1 { font: 400 68pt/.95 'Luckiest Guy', sans-serif; color: var(--cream); -webkit-text-stroke: 1.2mm var(--ink); paint-order: stroke fill; text-shadow: 1.6mm 1.9mm 0 var(--ink); }
h2 { font: 400 25pt/1.02 'Luckiest Guy', sans-serif; color: var(--ink); margin-bottom: 5mm; }
h2::after { content: ''; display: block; width: 22mm; height: 1.4mm; background: var(--mustard); border: .35mm solid var(--ink); margin-top: 2.6mm; }
h3 { font: 400 13.5pt/1.1 'Luckiest Guy', sans-serif; color: var(--ink); margin: 0 0 2mm; }
p { max-width: 168mm; } p + p { margin-top: 2.6mm; }
.lead { font-size: 12.6pt; line-height: 1.5; color: var(--ink); }
.sec + .sec { margin-top: 9mm; }
.row { display: grid; gap: 5mm; margin-top: 5mm; }
.r2 { grid-template-columns: 1fr 1fr; } .r3 { grid-template-columns: repeat(3, 1fr); } .r4 { grid-template-columns: repeat(4, 1fr); } .r5 { grid-template-columns: repeat(5, 1fr); }
figure { margin: 0; }
figure .im { border: .55mm solid var(--ink); border-radius: 2mm; box-shadow: 1.3mm 1.3mm 0 var(--ink); overflow: hidden; background: #fff; }
figure img { display: block; width: 100%; height: 100%; object-fit: cover; }
figcaption { font: italic 500 8.6pt/1.4 'Bitter', serif; color: var(--brown); margin-top: 2.4mm; }
figcaption b { font: 400 8.4pt/1 'Bowlby One SC', sans-serif; color: var(--ink); font-style: normal; display: block; margin-bottom: 1mm; }
.note { position: relative; margin-top: 6mm; background: var(--cream); border: .55mm solid var(--ink); border-radius: 4mm; box-shadow: 1.4mm 1.4mm 0 var(--ink);
  padding: 3.6mm 5mm 3.4mm; font: italic 700 10.4pt/1.4 'Bitter', serif; color: var(--ink); max-width: 128mm; }
.note::before { content: ''; position: absolute; left: 10mm; bottom: -3.2mm; width: 5mm; height: 5mm; background: var(--cream); border-right: .55mm solid var(--ink); border-bottom: .55mm solid var(--ink); transform: rotate(45deg); }
.note .sig { display: block; margin-top: 1.2mm; font: 400 9.6pt/1 'Shrikhand', serif; font-style: normal; color: var(--red); }
table { border-collapse: collapse; width: 100%; margin-top: 4mm; }
td, th { text-align: left; vertical-align: top; padding: 2.6mm 3mm 2.6mm 0; border-top: .3mm solid rgba(28,23,18,.35); font-size: 9.8pt; line-height: 1.4; }
th { font: 400 8.4pt/1.2 'Bowlby One SC', sans-serif; color: var(--brown); border-top: 0; padding-top: 0; }
tr:last-child td { border-bottom: .3mm solid rgba(28,23,18,.35); }
.guide td:first-child { width: 44mm; font: 400 11pt/1.2 'Luckiest Guy', sans-serif; color: var(--ink); }
.guide td:last-child { width: 40mm; color: var(--brown); font-style: italic; }
.facts td { padding: 1.8mm 3mm 1.8mm 0; font-size: 9.2pt; }
.facts td:first-child { width: 58mm; font-weight: 700; color: var(--ink); }
.try { list-style: none; counter-reset: n; margin-top: 4mm; display: grid; gap: 2.4mm; }
.try li { counter-increment: n; display: grid; grid-template-columns: 9mm 1fr; align-items: start; }
.try li::before { content: counter(n); display: grid; place-items: center; width: 6.6mm; height: 6.6mm; border-radius: 50%; background: var(--red); color: var(--cream);
  border: .45mm solid var(--ink); font: 400 10pt/1 'Luckiest Guy', sans-serif; padding-top: .6mm; }
.panel { background: var(--cream); border: .55mm solid var(--ink); border-radius: 3mm; box-shadow: 1.6mm 1.6mm 0 var(--ink); padding: 6mm 7mm; margin-top: 6mm; }
.foot { position: absolute; left: 18mm; right: 18mm; bottom: 9mm; display: flex; justify-content: space-between; align-items: center; border-top: .45mm solid var(--ink); padding-top: 2.2mm;
  font: 400 8pt/1 'Bowlby One SC', sans-serif; color: var(--ink); }
.foot span:last-child { color: var(--red); }
.steps { display: grid; gap: 4mm; margin-top: 3mm; }
.arrow-row { display: flex; gap: 2.5mm; align-items: stretch; }
.arrow-row figure { flex: 1; }
.it { margin-top: 7mm; } .it p { font-size: 9.9pt; }

/* cover */
.cover { padding: 0; }
.cover .rays { position: absolute; inset: 0; background: repeating-conic-gradient(from 0deg at 68% 56%, rgba(233,164,58,.30) 0deg 7.5deg, transparent 7.5deg 15deg);
  -webkit-mask: radial-gradient(circle at 68% 56%, #000 0%, rgba(0,0,0,.55) 30%, transparent 62%); }
.cover .in { position: relative; padding: 24mm 18mm 0; }
.cover .ribbon { display: inline-block; background: var(--red); color: var(--cream); font: 400 15pt/1 'Shrikhand', serif; padding: 3mm 8mm 4mm; border-top: .6mm solid var(--ink); border-bottom: .6mm solid var(--ink);
  transform: rotate(-2.5deg); text-shadow: .6mm .6mm 0 var(--ink); margin-bottom: 8mm; }
.cover .sub { font: italic 800 15pt/1.3 'Bitter', serif; color: var(--navy); margin-top: 9mm; max-width: 88mm; }
.cover .uncle { position: absolute; right: 2mm; bottom: 32mm; height: 158mm;
  filter: drop-shadow(.9mm 0 0 var(--ink)) drop-shadow(-.9mm 0 0 var(--ink)) drop-shadow(0 .9mm 0 var(--ink)) drop-shadow(0 -.9mm 0 var(--ink)) drop-shadow(3mm 3.4mm 0 rgba(28,23,18,.85)); }
.cover .bubble { position: absolute; left: 18mm; top: 152mm; max-width: 86mm; background: var(--cream); border: .6mm solid var(--ink); border-radius: 5mm; box-shadow: 1.6mm 1.6mm 0 var(--ink);
  padding: 5mm 6mm; font: italic 800 14pt/1.3 'Bitter', serif; color: var(--ink); }
.cover .bubble::after { content: ''; position: absolute; right: -4.4mm; top: 9mm; width: 7mm; height: 7mm; background: var(--cream); border-top: .6mm solid var(--ink); border-right: .6mm solid var(--ink); transform: rotate(45deg); }
.cover .bubble .sig { display: block; margin-top: 2mm; font: 400 11pt/1 'Shrikhand', serif; font-style: normal; color: var(--red); }
.cover .bottom { position: absolute; left: 18mm; right: 18mm; bottom: 14mm; display: flex; justify-content: space-between; align-items: flex-end; }
.cover .pill { display: inline-block; background: var(--red); color: var(--cream); border: .6mm solid var(--ink); border-radius: 3.5mm; box-shadow: 1.4mm 1.4mm 0 var(--ink);
  font: 400 17pt/1 'Luckiest Guy', sans-serif; padding: 4mm 6mm 3mm; text-shadow: .6mm .6mm 0 var(--ink); border-bottom-width: .6mm; }
.cover .made { font: 400 9pt/1.5 'Bowlby One SC', sans-serif; color: var(--ink); text-align: right; }
.back { display: grid; place-items: center; text-align: center; }
.back h1 { font-size: 54pt; }
.back .line { font: italic 800 15pt/1.4 'Bitter', serif; color: var(--navy); margin-top: 10mm; max-width: 140mm; }
.back img { height: 110mm; margin: 0 auto 10mm; filter: drop-shadow(.9mm 0 0 var(--ink)) drop-shadow(-.9mm 0 0 var(--ink)) drop-shadow(0 .9mm 0 var(--ink)) drop-shadow(0 -.9mm 0 var(--ink)) drop-shadow(3mm 3.4mm 0 rgba(28,23,18,.85)); }
'''

def note(s):
    t = s['note'].strip()
    t = re.sub(r'\s*[—-]?\s*Uncle Farter\.?$', '', t)
    return f'<div class="note">{e(t)}<span class="sig">Uncle Farter</span></div>'

def fig(src, cap, h, alt=None, title=None, pos='center'):
    fit = 'contain' if src in ('it-props3d.jpg', 'it-moves.jpg') else 'cover'
    t = f'<b>{e(title)}</b>' if title else ''
    return (f'<figure><div class="im" style="height:{h}mm"><img src="img/{src}" alt="{e(alt or cap)}" style="object-position:{pos};object-fit:{fit};background:#dedad3"></div>'
            f'<figcaption>{t}{e(cap)}</figcaption></figure>')

def body(s): return ''.join(f'<p>{linkify(p)}</p>' for p in s['body'])
def head(s): return f'<div class="kicker">{e(s["kicker"])}</div><h2>{e(s["title"])}</h2>'
pages, n = [], [1]
def page(inner, cls=''):
    n[0] += 1
    pages.append(f'<section class="page {cls}">{inner}<div class="foot"><span>Fish All Day · fishallday.pages.dev</span><span>{n[0]}</span></div></section>')

# 1 cover
cv = C['cover']
pages.append(f'''<section class="page cover"><div class="rays"></div><div class="in">
<div class="ribbon">{e(cv["kicker"])}</div><div class="kicker" style="margin-bottom:4mm">Project report</div>
<h1>FISH<br>ALL DAY</h1><div class="sub">{e(cv["subtitle"])}</div></div>
<img class="uncle" src="img/uncle-fists.png" alt="Uncle Farter, a grumpy cartoon uncle in a bucket hat and fishing vest, fists up">
<div class="bubble">{e(cv["line"])}<span class="sig">Uncle Farter</span></div>
<div class="bottom"><div><a class="pill" href="{URL}" style="border-bottom:.6mm solid var(--ink)">fishallday.pages.dev</a></div>
<div class="made">A free Mac app and website<br>Modelled, rigged and animated with Aholo Lux3D</div></div></section>''')

# 2 summary + guide
sm, gd = C['summary'], C['guide']
page(f'''<div class="kicker">The one-minute version</div><h2>{e(sm["title"])}</h2><p class="lead">{linkify(sm["lead"])}</p>
<ol class="try">{''.join(f"<li><span>{linkify(t)}</span></li>" for t in sm["try"])}</ol>
<div class="sec" style="margin-top:11mm"><h3>{e(gd["title"])}</h3>
<table class="guide"><tr><th>What to look for</th><th>In short</th><th>Where</th></tr>
{''.join(f"<tr><td>{e(a)}</td><td>{e(b)}</td><td>{e(c)}</td></tr>" for a, b, c in gd["rows"])}</table></div>
<div class="row r2" style="margin-top:9mm">{fig("desktop.jpg", SEC["play"]["caps"]["desktop"], 52, "A Mac desktop with the Sonoma wallpaper; Uncle Farter fishes on a small grass island on top of the Dock")}
{fig("ask.jpg", SEC["meet"]["caps"]["beg"], 52, "Close-up: Uncle Farter beside his cooler with a speech bubble asking for five dollars and a Give him $5 button")}</div>''')

# 3 meet
s = SEC['meet']; c = s['caps']
page(f'''{head(s)}{body(s)}
<div class="row r2">{fig("beg.jpg", c["beg"], 50, title="Asks for beer money")}{fig("fart.jpg", c["fart"], 50, title="Farts, blames you")}
{fig("dance.jpg", c["dance"], 50, title="Lands a fish")}{fig("stone.jpg", c["stone"], 50, title="Throws a stone")}</div>{note(s)}''')

# 4 play + mac
s, m = SEC['play'], SEC['mac']
page(f'''<div class="sec">{head(s)}{body(s)}<div class="row r2">{fig("reel.jpg", s["caps"]["reel"], 44, title="A bite")}{fig("controls.jpg", "Hover him for his toolbar: mute his voice, the sound, or send him home.", 44, title="His toolbar")}</div>{note(s)}</div>
<div class="sec">{head(m)}{body(m)}</div>''')

# 5 aholo
s = SEC['aholo']; c = s['caps']
page(f'''{head(s)}{body(s)}
<div class="row r3">{fig("it-tpose.jpg", c["sheet"], 52, title="Aholo image tool", pos="center 40%")}{fig("it-model.jpg", c["model"], 52, title="Lux3D G1 model")}{fig("it-props3d.jpg", c["props"], 52, title="Lux3D G1-Turbo props", pos="left center")}</div>
<div class="row" style="margin-top:6mm">{fig("it-moves.jpg", c["moves"], 30, title="Lux3D auto-rig and move library")}</div>{note(s)}''')

# 6 + 7 iterations
its = C['iterations']; s = SEC['iterations']
def strip(imgs, steps, h):
    cells = ''.join(fig(src, lab, h, title=f'Step {i + 1}', pos=p) for i, ((src, p), lab) in enumerate(zip(imgs, steps)))
    return f'<div class="arrow-row">{cells}</div>'
it1, it2, it3, it4 = its
page(f'''{head(s)}{body(s)}
<div class="it"><h3>1. {e(it1["title"])}</h3><p>{e(it1["text"])}</p><div class="row r4" style="gap:3mm">
{''.join(fig(src, lab, 46, title=f"Step {i + 1}", pos=p) for i, ((src, p), lab) in enumerate(zip([("it-concept.jpg", "center 30%"), ("it-apose.jpg", "center"), ("it-tpose.jpg", "center"), ("it-model.jpg", "center")], it1["steps"])))}</div>
<div class="row" style="margin-top:4mm">{fig("it-moves.jpg", it1["steps"][4] if len(it1["steps"]) > 4 else "Rigged and moving", 24, title="Step 5")}</div></div>
<div class="it"><h3>2. {e(it2["title"])}</h3><p>{e(it2["text"])}</p><div class="row r3" style="gap:4mm">
{fig("it-cooler-real.jpg", it2["steps"][0], 44, title="Step 1")}{fig("it-cooler-toy.jpg", it2["steps"][1], 44, title="Step 2")}{fig("it-cooler-3d.jpg", it2["steps"][2], 44, title="Step 3")}</div></div>''')
page(f'''<div class="it" style="margin-top:0"><h3>3. {e(it3["title"])}</h3><p>{e(it3["text"])}</p><div class="row r2" style="grid-template-columns: 1fr 1fr; gap:4mm">
{fig("it-face.jpg", it3["steps"][1] if len(it3["steps"]) > 1 else "Aholo close-up repaint", 70, title="Aholo repaint")}{fig("it-face-app.jpg", it3["steps"][2] if len(it3["steps"]) > 2 else "On the 3D model", 70, title="On his 3D model", pos="center 20%")}</div></div>
<div class="it"><h3>4. {e(it4["title"])}</h3><p>{e(it4["text"])}</p>
<div class="row" style="grid-template-columns: 1fr 2fr; gap:4mm">{fig("it-seat-before.jpg", it4["steps"][0] + ": " + it4["steps"][1].lower(), 40, title="Before")}{fig("it-seat-after.jpg", it4["steps"][2], 40, title="After")}</div></div>{note(s)}''')

# 8 craft + voice
s, v = SEC['craft'], SEC['voice']
page(f'''<div class="sec">{head(s)}{body(s)}{note(s)}</div><div class="sec" style="margin-top:12mm">{head(v)}{body(v)}{note(v)}</div>''')

# 9 shipped + facts
s = SEC['shipped']; c = s['caps']
page(f'''{head(s)}{body(s)}
<div class="row r2">{fig("site.jpg", c["site"], 36, title="The website", pos="center top")}{fig("trailer-aholo.jpg", c["trailer"], 36, title="The trailer")}</div>
<div class="sec" style="margin-top:8mm"><h3>The numbers</h3><table class="facts">{''.join(f"<tr><td>{e(a)}</td><td>{e(b)}</td></tr>" for a, b in C["facts"])}</table></div>''')

# 10 credits + back
s = SEC['credits']; b = C['back']
page(f'''{head(s)}{body(s)}{note(s)}
<div class="back" style="margin-top:16mm"><img src="img/uncle-fists.png" alt="Uncle Farter with his fists up"><h1 style="font-size:40pt">{e(b["title"]).upper()}</h1><div class="line">{linkify(b["line"])}</div></div>''')

doc = f'''<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Fish All Day: project report (Uncle Farter, a free Mac app made with Aholo Lux3D)</title>
<meta name="description" content="{e(C["summary"]["lead"])}">
<meta name="keywords" content="Fish All Day, Uncle Farter, Aholo, Lux3D, Manycore hackathon, Mac app, desktop pet, three.js">
<style>{CSS}</style></head><body>{''.join(pages)}</body></html>'''
(R / 'report.html').write_text(doc)

JS = r'''
import { createRequire } from 'module';
const require = createRequire('/Users/sid/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const [src, out] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://' + src, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
await p.pdf({ path: out, width: '210mm', height: '297mm', printBackground: true, preferCSSPageSize: true });
await b.close(); console.log('pdf', out);
'''
js = R / 'render.mjs'; js.write_text(JS)
subprocess.run(['node', str(js), str(R / 'report.html'), str(R / 'fish-all-day-report.pdf')], check=True)
print(f'{n[0]} pages')
