#!/usr/bin/env python3
"""Film the real Mac app for the trailer: records the screen with the Dock, launches the app with --demo, and walks him
through every moment with real mouse moves and clicks (Hammerspoon) and cues dropped into /tmp/fad-cmd.js.
The app logs every sound and line it plays to /tmp/fad-events.log (with --demo), so the edit can rebuild the audio.

    python3 tools/film.py [--screen 4] [--fps 30] [--mbps 12]

Writes design/launch/film/take-<time>.mkv, the events log next to it and takes.log (wall-clock marks for each moment).
Every wait has a time limit; a step that times out is logged and the run carries on to the next moment.
"""
import argparse, json, os, shutil, subprocess, sys, time, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / 'mac/build/Fish All Day.app/Contents/MacOS/FishAllDay'
LOG, CMD = pathlib.Path('/tmp/fad-events.log'), pathlib.Path('/tmp/fad-cmd.js')
SCREEN_H = 956          # the laptop screen in points (top-left origin, as Hammerspoon counts)

HELPER = """
window.__where = (tag) => { const D = window.__desk, T = D.THREE, box = new T.Box3(); D.man.bounds(box);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new T.Vector3(x, y, z).project(D.camera); const sx = (p.x + 1) / 2 * D.L.w, sy = (1 - p.y) / 2 * D.L.h;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
  const b = document.querySelector('.say button:not(.x)'), r = b && b.getClientRects().length ? b.getBoundingClientRect() : null;
  window.__fadLog('where', tag, [x0, y0, x1 - x0, y1 - y0].map(Math.round), r ? [r.x, r.y, r.width, r.height].map(Math.round) : null,
    innerWidth, innerHeight, D.game ? D.game.state : null); };
"""

marks = []
t0 = time.time()
def mark(note):
    marks.append((round(time.time(), 3), note)); print(f'{time.time() - t0:7.1f}s  {note}', flush=True)

def hs(lua):
    return subprocess.run(['timeout', '20', 'hs', '-c', lua], capture_output=True, text=True).stdout.strip()

def cue(js, wait=4.0):
    end = time.time() + wait
    while CMD.exists() and time.time() < end: time.sleep(0.05)
    CMD.write_text(js)

def events():
    if not LOG.exists(): return []
    out = []
    for line in LOG.read_text().splitlines():
        try: out.append(json.loads(line))
        except Exception: pass
    return out

def wait_for(pred, timeout, since=None):
    """the first event after `since` (an index) that pred accepts, or None after timeout seconds"""
    since = len(events()) if since is None else since
    end = time.time() + timeout
    while time.time() < end:
        ev = events()
        for e in ev[since:]:
            if pred(e): return e
        time.sleep(0.15)
    return None

def where(tag, timeout=4):
    n = len(events()); cue(f"window.__where({json.dumps(tag)})")
    return wait_for(lambda e: e[1] == 'where' and e[2] == tag, timeout, n)

def to_screen(px, py, inner_h):
    return px, SCREEN_H - inner_h + py

def move(x, y, dur=0.8):
    n = max(8, int(dur * 60))
    hs(f"local a=hs.mouse.absolutePosition(); local n={n}; for i=1,n do local t=i/n; t=t*t*(3-2*t); "
       f"hs.mouse.absolutePosition({{x=a.x+({x}-a.x)*t, y=a.y+({y}-a.y)*t}}); hs.timer.usleep(16000) end; return 'ok'")

def click(x, y):
    hs(f"hs.eventtap.leftClick({{x={x},y={y}}}); return 'ok'")

def press(x, y, down=True):
    kind = 'leftMouseDown' if down else 'leftMouseUp'
    hs(f"hs.eventtap.event.newMouseEvent(hs.eventtap.event.types.{kind},{{x={x},y={y}}}):post(); return 'ok'")

def him(tag):
    w = where(tag)
    if not w: mark(f'{tag}: no position'); return None
    (x, y, ww, hh), inner_h = w[3], w[6]
    return to_screen(x + ww * 0.5, y + hh * 0.45, inner_h)

def is_kind(*names):
    return lambda e: e[1] in ('sfx', 'loop') and any(e[2].startswith(n) for n in names)

def act(kind, expect, tries=6):
    for _ in range(tries):
        n = len(events()); cue(f"window.fad.act({json.dumps(kind)})")
        if wait_for(expect, 4, n): return True
        time.sleep(2)
    return False


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--screen', default='4'); ap.add_argument('--fps', default='30')
    ap.add_argument('--mbps', default='10'); ap.add_argument('--max', default='780')
    a = ap.parse_args()
    out = ROOT / 'design/launch/film'; out.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime('%H%M'); video = out / f'take-{stamp}.mkv'
    for p in (LOG, CMD):
        if p.exists(): p.unlink()
    hs("hs.mouse.absolutePosition({x=1050,y=380}); return 'ok'")
    rec = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'avfoundation', '-capture_cursor', '1', '-framerate', a.fps, '-pixel_format', 'nv12',
                            '-i', f'{a.screen}:none', '-t', a.max, '-c:v', 'h264_videotoolbox', '-b:v', f'{a.mbps}M', '-maxrate', f'{a.mbps}M', '-bufsize', f'{int(a.mbps) * 2}M', str(video)],
                           stdin=subprocess.PIPE)
    mark('recording'); time.sleep(2.5)
    app = subprocess.Popen([str(APP), '--demo'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    mark('app launched')
    try:
        time.sleep(6); cue(HELPER)
        # 1. he walks in, sits, finds the cooler empty and asks for $5: wait for the pay button
        btn = None; end = time.time() + 150
        while time.time() < end:
            w = where('pay?')
            if w and w[4]: btn = w; break
            time.sleep(2)
        if btn:
            mark('asks for money'); time.sleep(3.0)
            bx, by, bw, bh = btn[4]; x, y = to_screen(bx + bw / 2, by + bh / 2, btn[6])
            move(x, y, 1.1); time.sleep(0.35); click(x, y); mark('paid')
            time.sleep(0.6); move(1050, 420, 1.2)
            mark('back with beer' if wait_for(is_kind('canopen'), 100) else 'back with beer: TIMEOUT')
            time.sleep(9)
        else:
            mark('no pay button: TIMEOUT')
        # 2. a fart, blamed on you
        mark('fart' if act('fart', is_kind('fart')) else 'fart: not seated'); time.sleep(7)
        # 3. poke him
        p = him('poke')
        if p: move(*p, 0.9); time.sleep(0.25); click(*p); mark('poked'); time.sleep(0.5); move(1000, 430, 1.0)
        time.sleep(6)
        # 4. a bite: grab him and hold to reel until he lands it
        n = len(events()); cue('window.fad.bite()')
        if wait_for(is_kind('bell'), 6, n):
            mark('bite'); time.sleep(1.8)
            p = him('reel')
            if p:
                move(*p, 0.6); press(*p, True); mark('reeling')
                landed = wait_for(is_kind('splash'), 30)
                press(*p, False); mark('landed' if landed else 'reel: TIMEOUT')
                time.sleep(0.5); move(1050, 400, 1.2)
        else:
            mark('bite: no bell')
        time.sleep(12)
        # 5. a while of him alone: sips, hums, farts, dozes; one scold
        mark('alone'); time.sleep(25)
        mark('scold' if act('scold', lambda e: e[1] == 'say') else 'scold: not seated'); time.sleep(20)
        # 6. a bite ignored: the fish pulls him into the water and he climbs out
        n = len(events()); cue('window.fad.bite()')
        if wait_for(is_kind('bell'), 6, n):
            mark('bite ignored')
            mark('pulled in' if wait_for(is_kind('bigsplash'), 25) else 'pulled in: TIMEOUT')
            time.sleep(22)
        # 7. a stone: you have worked too long
        mark('stone' if act('stone', is_kind('whoosh')) else 'stone: not seated'); time.sleep(10)
        # 8. one more catch, and more of him alone
        n = len(events()); cue('window.fad.bite()')
        if wait_for(is_kind('bell'), 6, n):
            mark('bite 2'); time.sleep(1.5)
            p = him('reel2')
            if p:
                move(*p, 0.6); press(*p, True); landed = wait_for(is_kind('splash'), 30); press(*p, False)
                mark('landed 2' if landed else 'reel 2: TIMEOUT'); time.sleep(0.5); move(1050, 400, 1.2)
        time.sleep(12); mark('alone 2'); time.sleep(40)
    finally:
        mark('stop')
        try: rec.stdin.write(b'q'); rec.stdin.flush(); rec.wait(20)
        except Exception: rec.terminate()
        app.terminate()
        if LOG.exists(): shutil.copy(LOG, out / f'take-{stamp}-events.log')
        (out / f'take-{stamp}-marks.json').write_text(json.dumps(marks, indent=1))
        print('video', video, 'events', len(events()))


if __name__ == '__main__':
    main()
