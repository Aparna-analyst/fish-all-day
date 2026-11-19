// The trailer's 1930s cartoon title cards and captions, drawn in the website's type and colours, as 1920x1080 PNGs.
// node tools/trailer/cards.mjs   -> design/launch/trailer/cards/*.png (captions are transparent, for laying over footage)
import { createRequire } from 'module';
import { mkdirSync } from 'node:fs';
const require = createRequire('/Users/sid/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const root = new URL('../../', import.meta.url).pathname, dir = root + 'design/launch/trailer/', out = dir + 'cards/';
mkdirSync(out, { recursive: true });

const css = `
@import url('https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Bowlby+One+SC&family=Shrikhand&family=Bitter:ital,wght@0,600;0,800;1,800&display=block');
:root { --paper: #f3e6c8; --cream: #fff7e4; --ink: #1c1712; --navy: #1f2f55; --red: #c7372a; --mustard: #e9a43a; --brown: #4a3a2a; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1920px; height: 1080px; overflow: hidden; background: transparent; }
.card { position: absolute; inset: 0; background: var(--paper); display: grid; place-items: center; text-align: center; overflow: hidden; }
.card::before { content: ''; position: absolute; left: 50%; top: 50%; width: 3400px; height: 3400px; transform: translate(-50%, -50%);
  background: repeating-conic-gradient(from 0deg, rgba(233, 164, 58, .26) 0deg 7.5deg, transparent 7.5deg 15deg);
  -webkit-mask: radial-gradient(circle, #000 0%, rgba(0,0,0,.6) 20%, transparent 46%); }
.card::after { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(28,23,18,.10) 1.2px, transparent 1.6px); background-size: 7px 7px; }
.card > * { position: relative; z-index: 1; }
.toon { font: 400 150px/.98 'Luckiest Guy', sans-serif; color: var(--cream); -webkit-text-stroke: 6px var(--ink); paint-order: stroke fill; text-shadow: 10px 12px 0 var(--ink); letter-spacing: .01em; }
.toon.s { font-size: 128px; }
.u { color: var(--mustard); } .m { color: var(--red); }
.ribbon { display: inline-block; padding: 18px 56px 24px; background: var(--red); color: var(--cream); font: 400 64px/1 'Shrikhand', serif; border-top: 5px solid var(--ink); border-bottom: 5px solid var(--ink);
  transform: rotate(-2.5deg); text-shadow: 4px 4px 0 var(--ink); margin-bottom: 34px; }
.cap { position: absolute; left: 50%; top: 64px; transform: translateX(-50%) rotate(-1.5deg); padding: 20px 44px 14px; background: var(--navy); border: 5px solid var(--ink); border-radius: 12px;
  box-shadow: 9px 9px 0 var(--ink); font: 400 70px/1 'Luckiest Guy', sans-serif; color: var(--cream); white-space: nowrap; letter-spacing: .02em; }
.cap b { color: var(--mustard); font-weight: 400; }
.panels { display: flex; gap: 46px; align-items: flex-start; margin-top: 40px; }
.panel { width: 420px; background: var(--cream); border: 6px solid var(--ink); border-radius: 10px; box-shadow: 10px 10px 0 var(--ink); overflow: hidden; }
.panel img { display: block; width: 100%; height: 400px; object-fit: cover; background: #dedad2; }
.panel p { padding: 14px 10px 12px; font: 400 32px/1.1 'Luckiest Guy', sans-serif; color: var(--ink); border-top: 6px solid var(--ink); }
.arrow { font: 400 90px/1 'Luckiest Guy'; color: var(--red); -webkit-text-stroke: 4px var(--ink); align-self: center; margin-top: -60px; }
.sub { font: italic 800 46px/1.2 'Bitter', serif; color: var(--navy); margin-top: 26px; }
.end { display: grid; grid-template-columns: 560px 1fr; gap: 40px; align-items: center; width: 1600px; text-align: left; }
.end img { width: 520px; filter: drop-shadow(5px 0 0 var(--ink)) drop-shadow(-5px 0 0 var(--ink)) drop-shadow(0 5px 0 var(--ink)) drop-shadow(0 -5px 0 var(--ink)) drop-shadow(16px 18px 0 rgba(28,23,18,.85)); }
.pill { display: inline-block; margin-top: 30px; padding: 18px 40px 12px; background: var(--red); color: var(--cream); border: 5px solid var(--ink); border-radius: 18px; box-shadow: 8px 8px 0 var(--ink);
  font: 400 64px/1 'Luckiest Guy'; text-shadow: 4px 4px 0 var(--ink); }
.url { margin-top: 34px; font: 400 54px/1 'Bowlby One SC'; color: var(--navy); letter-spacing: .02em; }
.made { margin-top: 22px; font: 400 26px/1 'Bowlby One SC'; color: var(--brown); letter-spacing: .06em; }
`;
const cards = {
  intro: `<div class="card"><div><div class="ribbon">Introducing</div><div class="toon">UNCLE FARTER</div></div></div>`,
  useless1: `<div class="card"><div class="toon">THE MOST<br><span class="u">USELESS</span> UNCLE</div></div>`,
  useless2: `<div class="card"><div class="toon">IN YOUR <span class="m">MAC</span><br>FAMILY</div></div>`,
  sporting: `<div class="card"><div class="toon s">A SPORTING<br>GENTLEMAN!</div></div>`,
  aholo: `<div class="card"><div><div class="toon s" style="font-size:84px">MADE WITH AHOLO LUX3D</div>
    <div class="panels"><div class="panel"><img src="oldman-a.png"><p>Drawn</p></div><div class="arrow">›</div>
    <div class="panel"><img src="oldman-3d-three-quarter.png" style="object-fit:contain;background:#d9d6cf"><p>Modelled</p></div><div class="arrow">›</div>
    <div class="panel"><img src="moves-crop.jpg" style="object-fit:contain;background:#d9d6cf"><p>Rigged &amp; animated</p></div></div></div></div>`,
  break: `<div class="card"><div class="toon s">YOUR BREAK.<br><span class="m">HIS IDEA.</span></div></div>`,
  wild: `<div class="card"><div class="toon s"><span class="m">WILD</span> MANNERS.<br>PROUDLY <span class="u">USELESS.</span></div></div>`,
  end: `<div class="card"><div class="end"><img src="uncle-fists.webp"><div><div class="toon" style="font-size:150px">FISH ALL DAY</div>
    <div class="pill">FREE FOR MAC</div><div class="url">fishallday.pages.dev</div><div class="made">Uncle Farter · made with Aholo Lux3D</div></div></div></div>`,
  wide: `<div class="card"></div>`,
  'cap-wind': `<div class="cap">A FREE MAC APP. <b>WITH WIND.</b></div>`,
  'cap-dock': `<div class="cap">HE LIVES ON YOUR <b>MAC'S DOCK.</b></div>`,
  'cap-cheek': `<div class="cap">PRETEND MONEY. <b>REAL CHEEK.</b></div>`,
  'cap-reel': `<div class="cap">GRAB HIM. <b>HOLD TO REEL.</b></div>`,
  'cap-fish': `<div class="cap">THE FISH <b>DISAGREES.</b></div>`,
};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [name, body] of Object.entries(cards)) {
  await p.goto('file://' + dir + 'blank.html');
  await p.setContent(`<!doctype html><html><head><base href="file://${dir}"><style>${css}</style></head><body>${body}</body></html>`, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
  await p.screenshot({ path: out + name + '.png', omitBackground: name.startsWith('cap-') });
  console.log('card', name);
}
await b.close();
