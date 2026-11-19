#!/usr/bin/env python3
"""Reshoot at the raised height (his island on top of the Dock): fart, poke, scold, a bite ignored (pulled into the
water), the stone, another fart, then a while alone. Uses tools/film.py's helpers. python3 tools/film_rest.py"""
import json, shutil, subprocess, time, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import film as F

def main():
    out = F.ROOT / 'design/launch/film'; stamp = time.strftime('%H%M'); video = out / f'rest-{stamp}.mkv'
    for p in (F.LOG, F.CMD):
        if p.exists(): p.unlink()
    F.hs("hs.mouse.absolutePosition({x=1050,y=380}); return 'ok'")
    rec = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'avfoundation', '-capture_cursor', '1', '-framerate', '30', '-pixel_format', 'nv12',
                            '-i', '4:none', '-t', '420', '-c:v', 'h264_videotoolbox', '-b:v', '10M', str(video)], stdin=subprocess.PIPE)
    F.mark('recording'); time.sleep(2.5)
    app = subprocess.Popen([str(F.APP), '--demo'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); F.mark('app launched')
    try:
        time.sleep(1.5); F.cue('window.fad.layout({ floor: 96 })'); time.sleep(4.5); F.cue(F.HELPER)
        end = time.time() + 150; seated = False
        while time.time() < end and not seated:
            w = F.where('state')
            if w and w[4]:
                time.sleep(2); bx, by, bw, bh = w[4]; x, y = F.to_screen(bx + bw / 2, by + bh / 2, w[6])
                F.move(x, y, 1.0); time.sleep(0.3); F.click(x, y); F.mark('paid'); time.sleep(0.5); F.move(1050, 420, 1.0)
                F.wait_for(F.is_kind('canopen'), 100); time.sleep(5)
            seated = bool(F.wait_for(F.is_kind('gulp', 'canopen', 'fart', 'snore'), 3))
        F.mark('seated' if seated else 'seated: TIMEOUT'); time.sleep(3)
        F.mark('fart' if F.act('fart', F.is_kind('fart')) else 'fart: not seated'); time.sleep(7)
        p = F.him('poke')
        if p: F.move(*p, 0.9); time.sleep(0.25); F.click(*p); F.mark('poked'); time.sleep(0.5); F.move(1000, 430, 1.0)
        time.sleep(6)
        F.mark('scold' if F.act('scold', lambda e: e[1] == 'say') else 'scold: not seated'); time.sleep(8)
        n = len(F.events()); F.cue('window.fad.bite()')
        if F.wait_for(F.is_kind('bell'), 8, n):
            F.mark('bite ignored'); F.mark('pulled in' if F.wait_for(F.is_kind('bigsplash'), 25) else 'pulled in: TIMEOUT'); time.sleep(24)
        F.mark('stone' if F.act('stone', F.is_kind('whoosh')) else 'stone: not seated'); time.sleep(10)
        F.mark('fart 2' if F.act('fart', F.is_kind('fart')) else 'fart 2: not seated'); time.sleep(8)
        F.mark('alone'); time.sleep(30)
    finally:
        F.mark('stop')
        try: rec.stdin.write(b'q'); rec.stdin.flush(); rec.wait(20)
        except Exception: rec.terminate()
        app.terminate()
        if F.LOG.exists(): shutil.copy(F.LOG, out / f'rest-{stamp}-events.log')
        (out / f'rest-{stamp}-marks.json').write_text(json.dumps(F.marks, indent=1))
        print('video', video)

if __name__ == '__main__':
    main()
