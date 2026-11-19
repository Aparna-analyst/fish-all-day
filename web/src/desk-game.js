// The game on the edge of the screen, and the useless old man's character. Bites come on the wall clock: a "!" over his
// head, ten seconds to put the mouse on him and hold to reel, a gauge above him while the fish fights, a card for the
// catch. Between bites he is himself: he forgets his beer and asks you for money, scolds you for nothing, talks
// nonsense, sulks when nothing bites, calls for attention, tells you to rest when you have been at the screen too long,
// and throws a stone at the glass when you do not listen. His words are in lines.js; the reel's rules in game.js.
import * as THREE from 'three';
import { FISH, RARITY, pick, weigh } from './fish.js';
import { createReelState, reelStep, nextBiteDelay, loadStats, recordCatch, localDay } from './game.js';
import { LINES } from './lines.js';
import * as sfx from './sfx.js';
import * as voice from './voice.js';

const KEY = 'fad.v1';
const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
const fmtKg = (kg) => kg < 1 ? `${Math.round(kg * 1000)} g` : `${kg.toFixed(2)} kg`;
const rnd = (a, b) => a + Math.random() * (b - a);
const now = () => performance.now() / 1000;

// records kept by the Mac app (handed back at start as window.__fadSaved) and in the page's own storage
const store = {
  getItem(k) { if (k === KEY && window.__fadSaved) return JSON.stringify(window.__fadSaved); try { return localStorage.getItem(k); } catch { return null; } },
  setItem(k, v) { try { localStorage.setItem(k, v); } catch {} window.webkit?.messageHandlers?.fad?.postMessage(JSON.stringify({ save: { [k]: v } })); },
};

export function createDeskGame({ man, camera, layout, demo = false, post = () => {}, control = () => {} }) {
  const ui = document.getElementById('ui');
  const bubble = el('div', 'bubble', '<svg viewBox="0 0 44 44"><circle class="ring" cx="22" cy="22" r="19"/></svg><b>!</b>'); bubble.hidden = true;
  const gauge = el('div', 'gauge', '<div class="bar"><i class="zone"></i><i class="needle"></i></div><div class="land"><i></i></div><span>Hold on him to reel</span>'); gauge.hidden = true;
  const say = el('div', 'say'); say.hidden = true;
  const card = el('div', 'card'); card.hidden = true;
  const book = el('div', 'book'); book.hidden = true;
  // his controls, by his head while the mouse is on him: his voice, all sound, send him home, and the full menu
  const chip = el('div', 'chip', '<button data-k="voice" title="His voice">🗣️</button><button data-k="sound" title="Sound">🔊</button>' +
    '<button data-k="hide" title="Send him home">🏠</button><button data-k="menu" title="More">⋯</button>'); chip.hidden = true;
  ui.append(bubble, gauge, say, card, book, chip);
  let chipUntil = 0; const st = { voice: true, sound: true };
  const paintChip = () => { chip.querySelector('[data-k=voice]').classList.toggle('off', !st.voice); chip.querySelector('[data-k=sound]').classList.toggle('off', !st.sound); };
  chip.addEventListener('click', (e) => { const k = e.target.closest('button')?.dataset.k; if (k) { e.stopPropagation(); control(k); } });
  addEventListener('contextmenu', (e) => { e.preventDefault(); control('menu'); });   // a right-click on him: the full menu
  const needle = gauge.querySelector('.needle'), landBar = gauge.querySelector('.land i'), ring = bubble.querySelector('.ring');

  let stats = loadStats(store); stats.paid = (() => { try { return +(JSON.parse(store.getItem(KEY) || '{}')?.paid) || 0; } catch { return 0; } })();
  const save = () => store.setItem(KEY, JSON.stringify(stats));
  const g = { cardAt: 0, state: 'idle', fish: null, reel: null, holding: false, timer: 0, biteAt: 0, first: true, puff: 0, cardUntil: 0,
    lastCatch: now(), lastGrumble: now(), lastTouch: now(), lastAttention: now(), nextChatter: now() + (demo ? rnd(25, 40) : rnd(150, 300)), screenMin: 0, warnedAt: 0 };
  post({ today: stats.today });

  // ---- where things are on screen
  const v = new THREE.Vector3();
  const toScreen = (p) => { v.copy(p).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; };
  const head = () => toScreen(man.headPos(new THREE.Vector3()).add(new THREE.Vector3(0, 0.42, 0)));
  const place = (e, p, dx = 0, dy = 0) => { e.style.transform = `translate(${Math.round(p.x + dx)}px, ${Math.round(p.y + dy)}px)`; };
  // beside his head on the right, or on the left when the right edge of the screen is too near; always inside the screen
  const beside = (e, p, gap, dy) => { const w = e.offsetWidth, h = e.offsetHeight; let x = p.x + gap; if (x + w > innerWidth - 8) x = p.x - gap - w;
    e.style.transform = `translate(${Math.round(Math.max(8, x))}px, ${Math.round(Math.max(8, Math.min(innerHeight - h - 8, p.y + dy - h / 2)))}px)`; };

  // ---- what he says: a bubble by his head, now and then with a button under it
  const used = {};
  function line(kind) {
    const list = LINES[kind] || ['…']; let i; do { i = Math.floor(Math.random() * list.length); } while (list.length > 1 && i === used[kind]);
    used[kind] = i; return list[i];
  }
  // the bubble has an x: it closes the bubble and stops his voice (he will talk again later anyway)
  const shut = () => { clearTimeout(say._t); say.hidden = true; voice.stop(); };
  function talk(text, { ms = 3400, button = null, onButton = null } = {}) {
    say.innerHTML = ''; say.append(el('span', '', text.replace(/[<>&]/g, '')));
    if (button) { const b = el('button', '', button); b.onclick = (e) => { e.stopPropagation(); onButton?.(); }; say.append(b); say.classList.add('ask'); } else say.classList.remove('ask');
    const x = el('button', 'x', '×'); x.setAttribute('aria-label', 'Close'); x.onclick = (e) => { e.stopPropagation(); shut(); }; say.append(x);
    say.hidden = false; say.classList.remove('in'); void say.offsetWidth; say.classList.add('in');
    clearTimeout(say._t); if (ms !== Infinity) say._t = setTimeout(shut, ms);
    // his recorded voice for the line, if there is one: the bubble stays up until he has finished saying it
    const shown = say._n = (say._n || 0) + 1;
    voice.say(text).then(d => { if (d && ms !== Infinity && say._n === shown && !say.hidden) { clearTimeout(say._t); say._t = setTimeout(shut, Math.max(ms, d * 1000 + 500)); } });
  }
  const askMoney = (text) => talk(text, { ms: Infinity, button: 'Give him $5', onButton: pay });
  function pay() {
    sfx.play('cash'); stats.paid = (stats.paid || 0) + 5; save(); g.lastTouch = now(); man.giveMoney(); shut();
  }

  // ---- what he does tells us what to show and play
  man.onCast = () => sfx.play('plop', { rate: rnd(0.9, 1.1) });
  man.emit = (name, data) => {
    switch (name) {
      case 'noBeer': talk(line('noBeer')); break;
      case 'askMoney': askMoney(line('askMoney')); break;
      case 'nag': askMoney(line('stillWaiting')); post({ shake: true }); break;
      case 'thanks': talk(line('moneyThanks'), { ms: 2600 }); break;
      case 'back': talk(line('backWithBeer')); break;
      case 'doze': sfx.loop('snore'); break;
      case 'step': sfx.play(Math.random() < 0.5 ? 'step1' : 'step2', { rate: rnd(0.85, 1.15), gain: data ? 1.3 : 1 }); break;
      case 'creak': sfx.play('creak', { rate: rnd(0.85, 1.1) }); break;
      case 'canOpen': sfx.play('canopen'); break;
      case 'gulp': sfx.play('gulp', { rate: rnd(0.9, 1.05) }); break;
      case 'whoosh': sfx.play('whoosh'); break;
      case 'bigSplash': sfx.play('bigsplash'); break;
      case 'fart': sfx.play('fart' + (1 + Math.floor(Math.random() * 3)), { rate: rnd(0.9, 1.1) }); setTimeout(() => talk(line('fart'), { ms: 3000 }), 1000); break;
      case 'wake': sfx.stop('snore'); break;
      case 'burp': sfx.play('burp', { rate: rnd(0.85, 1.15) }); setTimeout(() => talk(line('burp'), { ms: 2600 }), 700); break;
      case 'shake': post({ shake: true }); break;
      case 'stoneHit': crack(toScreen(data)); sfx.play('crack'); post({ shake: true }); setTimeout(() => talk(line('stone')), 500); break;
      case 'junk': talk(line('caughtJunk')); break;
      case 'dance': sfx.loop('banjo'); setTimeout(() => talk(line('caughtFish'), { ms: 3000 }), 600); break;
      case 'danced': sfx.stop('banjo', 1.2); break;
      case 'climbed': talk(line('pulledIn')); break;
    }
  };

  // ---- bites, on the wall clock so they still come when nothing is drawn
  function schedule() {
    clearTimeout(g.timer); g.timer = 0; if (g.state !== 'idle') return;
    g.timer = setTimeout(bite, nextBiteDelay(g.first, demo)); g.first = false;
  }
  man.onSeated = () => { if (g.state === 'idle' || g.state === 'after') { g.state = 'idle'; schedule(); } if (!store.getItem('fad.hinted')) hint(); };
  function hint() {                                       // the first time he settles: how to play, once
    store.setItem('fad.hinted', '1');
    card.innerHTML = '<span class="rar">How to play</span><h2>He fishes, you work</h2><p>When a <b style="color:var(--bobber)">!</b> pops up, put the mouse on him and hold to reel. Let go when the needle runs red.</p><small>Drag him anywhere along the Dock</small>';
    g.cardAt = performance.now() + 1500; g.cardUntil = g.cardAt + 11000;
  }
  function bite() {
    clearTimeout(g.timer); g.timer = 0;                   // there is only ever one bite timer
    if (g.paused) return;                                 // sent home: the 2 s check schedules again when he is back
    if (g.state !== 'idle' || man.phase !== 'seated') { g.timer = setTimeout(bite, 5000); return; }
    g.fish = pick(); g.state = 'bite'; g.biteAt = performance.now(); g.reel = createReelState();
    sfx.stop('snore', 0.1); man.bite(); shut(); bubble.hidden = false; bubble.classList.remove('go'); void bubble.offsetWidth; bubble.classList.add('go');
    sfx.play('bell'); post({ bite: true, shake: true });
  }
  function startFight() { g.state = 'fight'; bubble.hidden = true; gauge.hidden = false; g.lastTouch = now(); post({ bite: false }); }
  function end(kind) {
    gauge.hidden = true; bubble.hidden = true; g.holding = false; sfx.stop('reel', 0.15); post({ bite: false });
    const f = g.fish; g.fish = null; g.state = 'after';
    if (kind === 'landed') {
      const kg = weigh(f), prev = stats.book[f.id]; const paid = stats.paid; stats = recordCatch(stats, f, kg, localDay()); stats.paid = paid; save();
      post({ today: stats.today }); sfx.play('splash'); man.land(f, kg); g.lastCatch = now();
      card.innerHTML = `<span class="rar ${f.rarity}">${RARITY[f.rarity]}</span><h2>${f.name}</h2><p>${fmtKg(kg)}</p>` +
        (!prev ? '<p class="new">New in your fish book!</p>' : kg > prev.best ? '<p class="new">Biggest yet!</p>' : '') + `<small>${stats.today} today</small>`;
      g.cardAt = performance.now() + 1900; g.cardUntil = g.cardAt + 7000;
    } else if (kind === 'escaped') { man.escape(); talk(line('gotAway')); }
    else {
      stats.lost = (stats.lost || 0) + 1; save(); man.lose();
      talk(kind === 'snapped' ? line('snapped') : line('ignoredBite'), { ms: 2400 });
    }
  }

  // ---- his moods between bites: only from his chair, while nothing else is going on
  function moods() {
    const day = localDay(); if (stats.day !== day) { stats.day = day; stats.today = 0; save(); post({ today: 0 }); }
    if (g.paused) return;
    if (g.state === 'idle' && man.phase === 'seated' && !g.timer) schedule();
    if (g.state !== 'idle' || man.phase !== 'seated' || !say.hidden || !book.hidden) return;
    const t = now(), D = demo;
    // the screen: rest after 50 minutes of work (3 in the demo); a stone if you are still at it 10 minutes later
    if (g.screenMin >= (D ? 3 : 50) && !g.warnedAt) { g.warnedAt = g.screenMin; man.act('talk'); talk(line('takeBreak'), { ms: 4200 }); return; }
    if (g.warnedAt && g.screenMin >= g.warnedAt + (D ? 1.5 : 10)) { g.warnedAt = g.screenMin; man.act('stone'); return; }
    if (t - g.lastCatch > (D ? 120 : 1200) && t - g.lastGrumble > (D ? 90 : 720)) { g.lastGrumble = t; man.act('noFish'); talk(line('noFish'), { ms: 3800 }); return; }
    if (t - g.lastTouch > (D ? 100 : 1500) && t - g.lastAttention > (D ? 100 : 1500)) { g.lastAttention = t; man.act('attention'); talk(line('attention')); return; }
    if (t > g.nextChatter && !man.dozing) {
      g.nextChatter = t + (D ? rnd(25, 45) : rnd(180, 480));
      if (Math.random() < 0.55) { man.act('scold'); talk(line('scold')); } else { man.act('talk'); talk(line('nonsense')); }
    }
  }
  setInterval(moods, 2000);

  // ---- where his stone hits: the glass cracks, then heals
  function crack(p) {
    const n = 9, rays = Array.from({ length: n }, (_, i) => {
      const a = i / n * Math.PI * 2 + rnd(-0.25, 0.25), len = rnd(50, 120); let d = 'M0 0';
      for (let k = 1; k <= 4; k++) { const r = len * k / 4, b = a + rnd(-0.22, 0.22); d += ` L${(Math.cos(b) * r).toFixed(1)} ${(Math.sin(b) * r).toFixed(1)}`; }
      return `<path d="${d}"/>`;
    }).join('');
    const rings = [22, 46].map(r => `<path d="${Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2, rr = r * rnd(0.85, 1.15); return `${i ? 'L' : 'M'}${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)}`; }).join(' ')}Z"/>`).join('');
    const c = el('div', 'crack', `<svg viewBox="-130 -130 260 260" width="260" height="260">${rays}${rings}</svg>`);
    c.style.left = `${p.x - 130}px`; c.style.top = `${p.y - 130}px`; ui.appendChild(c); setTimeout(() => c.remove(), 5200);
  }

  // ---- touch: hold on him to reel; a click pokes him; a drag moves him along the edge
  let drag = null;
  addEventListener('pointerdown', (e) => {
    sfx.unlock();
    if (e.target.closest?.('.book, .card, .say button, .chip')) return;
    if (g.state === 'bite') startFight();
    if (g.state === 'fight') { g.holding = true; sfx.loop('reel'); return; }
    drag = { x: e.clientX, spot: layout().spot, moved: false };
  });
  addEventListener('pointermove', (e) => {
    chipUntil = performance.now() + 2500; if (chip.hidden) { chip.hidden = false; paintChip(); }    // the mouse is on him
    if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) drag.moved = true;
    if (drag.moved && man.phase === 'seated') layout({ spot: Math.min(0.93, Math.max(0.07, drag.spot + dx / innerWidth)) });
  });
  const release = () => {
    g.holding = false; sfx.stop('reel', 0.15);
    if (drag?.moved) store.setItem('fad.spot', String(layout().spot));
    else if (drag && g.state === 'idle' && man.phase === 'seated') { g.lastTouch = now(); const was = man.dozing; sfx.stop('snore', 0.1); man.act('poke'); talk(line(was ? 'wake' : 'poke')); }
    drag = null;
  };
  addEventListener('pointerup', release); addEventListener('pointercancel', release); addEventListener('blur', release);
  addEventListener('keydown', (e) => { if (e.code === 'Space') { if (g.state === 'bite') startFight(); if (g.state === 'fight') g.holding = true; } if (e.key === 'Escape') book.hidden = true; });
  addEventListener('keyup', (e) => { if (e.code === 'Space') g.holding = false; });
  card.addEventListener('click', () => { card.hidden = true; });

  // ---- the fish book
  function openBook() {
    const found = FISH.filter(f => stats.book[f.id]).length;
    book.innerHTML = `<header><h2>Fish book</h2><span>${found} of ${FISH.length} found · ${stats.total} caught · ${stats.lost || 0} rods lost · $${stats.paid || 0} spent on his beer</span><button class="x" aria-label="Close">×</button></header>` +
      `<div class="grid">${FISH.map(f => { const b = stats.book[f.id]; return `<div class="cell ${b ? '' : 'unknown'}"><svg viewBox="0 0 60 30"><path d="M8 15c8-11 30-12 40 0-10 12-32 11-40 0z" fill="${b ? f.colour : '#2b2622'}"/><path d="M48 15l10-8v16z" fill="${b ? f.colour : '#2b2622'}"/>${b ? '<circle cx="16" cy="13" r="2" fill="#1b1612"/>' : ''}</svg>` +
      `<b>${b ? f.name : '???'}</b><small>${b ? `${RARITY[f.rarity]} · ${b.n} · best ${fmtKg(b.best)}` : RARITY[f.rarity]}</small></div>`; }).join('')}</div>`;
    book.querySelector('.x').onclick = () => { book.hidden = true; };
    book.hidden = false;
  }

  // ---- the little things over his head: z z z when he dozes, notes when he hums
  function puff(dt) {
    g.puff -= dt; if (g.puff > 0 || !man.mood || man.mood === 'sip' || g.state !== 'idle') return;
    g.puff = man.mood === 'doze' ? 1.1 : 0.8;
    const p = el('span', man.mood === 'doze' ? 'puff zz' : 'puff note', man.mood === 'doze' ? 'z' : (Math.random() < 0.5 ? '♪' : '♫'));
    const h = head(); p.style.left = `${h.x + 18 + Math.random() * 10}px`; p.style.top = `${h.y + 30}px`; ui.appendChild(p); setTimeout(() => p.remove(), 2200);
  }

  const saved = parseFloat(store.getItem('fad.spot')); if (saved > 0 && saved < 1) layout({ spot: saved });
  return {
    get state() { return g.state; },
    voice: (on) => voice.setOn(on),
    // the switches as the Mac app holds them, shown on his controls
    setSwitches(o) { Object.assign(st, o); voice.setOn(st.voice); paintChip(); },
    get switches() { return { ...st }; },
    // sent home: no bites, no moods, no sound until he is back
    pause(p) { g.paused = !!p; if (p) { clearTimeout(g.timer); g.timer = 0; shut(); for (const n of ['snore', 'banjo', 'reel']) sfx.stop(n, 0.1); chip.hidden = true; } },
    openBook, bite: () => { if (g.state === 'idle') bite(); },      // from the menu bar: never while a fish is already on
    screen(min) { g.screenMin = min; if (min < 1) g.warnedAt = 0; },        // minutes at the screen without a 5 minute break (from the Mac app)
    act(kind) { return man.act(kind); },
    landNow() { if (g.state === 'bite') startFight(); if (g.state === 'fight') g.reel.progress = 0.999; },   // for checks and the video
    update(dt) {
      const h = head();
      if (g.state === 'bite') {
        const left = 1 - (performance.now() - g.biteAt) / 10000; ring.style.strokeDashoffset = String(119.4 * (1 - Math.max(0, left)));
        place(bubble, h, -22, -62);
        if (left <= 0) end('ignored');
      } else if (g.state === 'fight') {
        g.reel = reelStep(g.reel, dt, g.holding, g.fish); man.reel(g.reel.tension, g.reel.progress); sfx.rate('reel', 0.8 + g.reel.tension * 0.6);
        needle.style.left = `${g.reel.tension * 100}%`; landBar.style.width = `${g.reel.progress * 100}%`;
        gauge.classList.toggle('danger', g.reel.tension > 0.88); gauge.classList.toggle('holding', g.holding);
        place(gauge, h, -90, -46);
        if (g.reel.status !== 'reeling') end(g.reel.status);
      }
      if (!say.hidden) beside(say, h, 18, -10);
      if (!chip.hidden) { if (performance.now() > chipUntil && !chip.matches(':hover')) chip.hidden = true; else place(chip, h, -chip.offsetWidth - 34, 4); }
      if (g.cardAt && performance.now() > g.cardAt) { card.hidden = false; g.cardAt = 0; }
      if (!card.hidden) { beside(card, { x: h.x + (h.x > 480 ? -170 : 100), y: h.y + 40 }, h.x > 480 ? -300 : 20, 0); if (performance.now() > g.cardUntil) card.hidden = true; }
      if (g.state === 'after' && man.phase === 'seated') { g.state = 'idle'; schedule(); }
      puff(dt);
    },
    // what the mouse may touch besides him: the visible cards and bubbles, and a wide space around him while a fish is on
    rects() {
      const out = [];
      for (const e of [bubble, gauge, card, book, say, chip]) if (!e.hidden) { const r = e.getBoundingClientRect(); out.push([r.left - 4, r.top - 4, r.width + 8, r.height + 8]); }
      if (g.state === 'fight' || g.state === 'bite') { const p = head(), top = p.y - 120, dock = innerHeight - layout().floor; out.push([p.x - 220, top, 440, Math.max(0, dock - top)]); }
      return out;
    },
  };
}
