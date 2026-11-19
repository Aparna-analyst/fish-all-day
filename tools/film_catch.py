#!/usr/bin/env python3
"""A short extra take for the trailer: two fish reeled in and landed (he dances). Uses tools/film.py's helpers.
python3 tools/film_catch.py"""
import json, shutil, subprocess, time, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import film as F

def main():
    out = F.ROOT / 'design/launch/film'; stamp = time.strftime('%H%M'); video = out / f'catch-{stamp}.mkv'
    for p in (F.LOG, F.CMD):
        if p.exists(): p.unlink()
    F.hs("hs.mouse.absolutePosition({x=1050,y=380}); return 'ok'")
    rec = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'avfoundation', '-capture_cursor', '1', '-framerate', '30', '-pixel_format', 'nv12',
                            '-i', '4:none', '-t', '400', '-c:v', 'h264_videotoolbox', '-b:v', '10M', str(video)], stdin=subprocess.PIPE)
    F.mark('recording'); time.sleep(2.5)
    app = subprocess.Popen([str(F.APP), '--demo'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); F.mark('app launched')
    try:
        time.sleep(1.5); F.cue('window.fad.layout({ floor: 96 })'); time.sleep(4.5); F.cue(F.HELPER)   # his island sits on top of the Dock, not over its icons
        end = time.time() + 150; seated = False
        while time.time() < end and not seated:
            w = F.where('state')
            if w and w[4]:                                   # broke again: pay him
                time.sleep(2); bx, by, bw, bh = w[4]; x, y = F.to_screen(bx + bw / 2, by + bh / 2, w[6])
                F.move(x, y, 1.0); time.sleep(0.3); F.click(x, y); F.mark('paid'); time.sleep(0.5); F.move(1050, 420, 1.0)
                F.wait_for(F.is_kind('canopen'), 100); time.sleep(6)
            seated = bool(F.wait_for(F.is_kind('gulp', 'canopen', 'fart', 'snore'), 3))
        F.mark('seated' if seated else 'seated: TIMEOUT'); time.sleep(4)
        for i in (1, 2):
            n = len(F.events()); F.cue('window.fad.bite()')
            if not F.wait_for(F.is_kind('bell'), 8, n):
                F.mark(f'bite {i}: no bell'); time.sleep(6); continue
            F.mark(f'bite {i}'); time.sleep(1.6)
            p = F.him(f'reel{i}')
            if not p: continue
            F.move(*p, 0.6); F.press(*p, True); F.mark(f'reeling {i}'); time.sleep(0.5)
            F.cue('window.fad.land()')
            landed = F.wait_for(F.is_kind('splash'), 6)
            time.sleep(0.3); F.press(*p, False); F.mark(f'landed {i}' if landed else f'land {i}: TIMEOUT')
            time.sleep(0.4); F.move(1050, 400, 1.2); time.sleep(14)
    finally:
        F.mark('stop')
        try: rec.stdin.write(b'q'); rec.stdin.flush(); rec.wait(20)
        except Exception: rec.terminate()
        app.terminate()
        if F.LOG.exists(): shutil.copy(F.LOG, out / f'catch-{stamp}-events.log')
        (out / f'catch-{stamp}-marks.json').write_text(json.dumps(F.marks, indent=1))
        print('video', video)

if __name__ == '__main__':
    main()
