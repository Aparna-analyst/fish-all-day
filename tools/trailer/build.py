#!/usr/bin/env python3
"""Cut the trailer (script B): footage of the real app, the cartoon cards, and the app's own sounds and voice rebuilt
from the takes' event logs. Music and the final mix come after (free-audio mix.py).

    python3 tools/trailer/build.py      -> design/launch/trailer/cut.mp4 (picture + his lines and sounds) and cues.json
"""
import json, os, pathlib, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
FILM, TR = ROOT / 'design/launch/film', ROOT / 'design/launch/trailer'
CARDS, SEGS = TR / 'cards', TR / 'segs'
SFX, VOICE = ROOT / 'web/public/assets/sfx', ROOT / 'web/public/assets/voice'
SFX_GAIN = 1.5                                  # the app's effects against his voice, a touch louder for a trailer
SKIP = {'step1', 'step2'}                       # his footsteps are being replaced (the walking sound is not good yet)

def load(p): return [json.loads(l) for l in open(p) if l.strip()]
def rec_of(marks): return [w for w, n in json.load(open(marks)) if n == 'recording'][0]
TAKES = {   # video, events, wall-clock start of the video
    'catch': (FILM / 'catch-0534.mkv', load(FILM / 'catch-0534-events.log'), rec_of(FILM / 'catch-0534-marks.json') + 0.53),
    'rest': (FILM / 'rest-0545.mkv', load(FILM / 'rest-0545-events.log'), rec_of(FILM / 'rest-0545-marks.json') + 0.53),
}
MED = 'crop=1300:731:1640:1181,scale=1920:1080:flags=lanczos'      # him, his island, the Dock and his bubbles

# (kind, source, start, duration, caption, caption seconds); cards: (card, name, duration)
CUT = [
    ('foot', 'rest', 64.6, 4.4, 'cap-wind', 4.4),       # the fart, blamed on you
    ('card', 'intro', 2.0),
    ('wide', 'catch', 6.5, 4.5, 'cap-dock', 4.5),       # he walks in over the Dock
    ('card', 'useless1', 1.8),
    ('card', 'useless2', 1.8),
    ('foot', 'catch', 24.1, 6.7, 'cap-cheek', 4.3),     # asks for $5, the click, his thanks
    ('foot', 'catch', 49.3, 3.0, None, 0),              # back with a can: psst
    ('card', 'sporting', 1.6),
    ('foot', 'catch', 85.6, 4.0, 'cap-reel', 4.0),      # a bite: grab him, reel
    ('foot', 'catch', 89.6, 4.8, None, 0),              # landed, the dance
    ('foot', 'rest', 95.0, 5.3, 'cap-fish', 3.0),       # the fish pulls him in
    ('card', 'aholo', 3.6),
    ('card', 'break', 1.6),
    ('foot', 'rest', 111.7, 4.3, None, 0),              # the stone, the crack
    ('card', 'wild', 2.2),
    ('card', 'end', 3.6),
]

def ff(*a): subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=True)
ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-an']

def main():
    SEGS.mkdir(parents=True, exist_ok=True)
    t, files, clips, cues = 0.0, [], [], []
    for i, s in enumerate(CUT):
        out = SEGS / f'{i:02d}.mp4'
        have = out.exists() and os.environ.get('REUSE')
        if s[0] == 'card':
            dur = s[2]
            if not have: ff('-loop', '1', '-t', str(dur), '-i', str(CARDS / f'{s[1]}.png'), '-vf', 'scale=1920:1080,fps=30', *ENC, str(out))
            cues.append({'t': round(t, 3), 'file': str(SFX / 'whoosh.mp3'), 'db': -12})
        else:
            kind, take, start, dur, cap, capdur = s
            video, events, t0 = TAKES[take]
            if kind == 'wide':      # the whole Mac screen, framed on the paper
                vf = (f'[0:v]scale=1340:-2:flags=lanczos,pad=iw+28:ih+28:14:14:color=0x1c1712[scr];[1:v][scr]overlay=(W-w)/2:H-h-36[bg]')
                inputs = ['-ss', str(start), '-t', str(dur), '-i', str(video), '-loop', '1', '-t', str(dur), '-i', str(CARDS / 'wide.png')]
            else:
                vf = f'[0:v]{MED}[bg]'
                inputs = ['-ss', str(start), '-t', str(dur), '-i', str(video)]
            if cap:
                inputs += ['-loop', '1', '-t', str(dur), '-i', str(CARDS / f'{cap}.png')]
                n = 2 if kind == 'wide' else 1
                vf += f";[bg][{n}:v]overlay=0:0:enable='lt(t,{capdur})'[v]"
            else:
                vf += ';[bg]null[v]'
            if not have: ff(*inputs, '-filter_complex', vf, '-map', '[v]', '-t', str(dur), *ENC, str(out))
            # his sounds and lines in this stretch, at their places in the cut
            for e in events:
                et = e[0] / 1000 - t0
                if e[1] == 'say':
                    if start - 0.6 <= et < start + dur - 0.3:
                        off = max(0.0, start - et)
                        clips.append({'file': str(VOICE / e[2]), 'at': round(t + max(0.0, et - start), 3), 'skip': round(off, 3),
                                      'max': round(start + dur + 0.4 - max(et, start), 3), 'gain': 1.0, 'rate': 1.0})
                elif e[1] in ('sfx', 'loop') and e[2] not in SKIP and start <= et < start + dur:
                    end = start + dur
                    if e[1] == 'loop':
                        stop = next((x[0] / 1000 - t0 for x in events if x[1] == 'stop' and x[2] == e[2] and x[0] / 1000 - t0 > et), end)
                        end = min(end, stop)
                    clips.append({'file': str(SFX / f'{e[2]}.mp3'), 'at': round(t + et - start, 3), 'skip': 0, 'max': round(end - et + 0.3, 3),
                                  'gain': round(e[3] * SFX_GAIN, 3), 'rate': e[4], 'loop': e[1] == 'loop'})
        files.append(out); t += s[2] if s[0] == 'card' else s[3]
    (SEGS / 'list.txt').write_text(''.join(f"file '{f}'\n" for f in files))
    ff('-f', 'concat', '-safe', '0', '-i', str(SEGS / 'list.txt'), '-c', 'copy', str(TR / 'picture.mp4'))
    # one track of his lines and the app's sounds
    ins, parts = [], []
    for k, c in enumerate(clips):
        ins += (['-stream_loop', '-1'] if c.get('loop') else []) + ['-i', c['file']]
        rate = f",asetrate=44100*{c['rate']},aresample=44100" if c['rate'] != 1 else ''
        parts.append(f"[{k}:a]aresample=44100,atrim=start={c['skip']}:duration={c['max']},asetpts=PTS-STARTPTS{rate},volume={c['gain']},adelay={int(c['at'] * 1000)}:all=1[a{k}]")
    mix = ';'.join(parts) + ';' + ''.join(f'[a{k}]' for k in range(len(clips))) + f'amix=inputs={len(clips)}:normalize=0:duration=longest,apad,atrim=duration={t:.3f}[out]'
    ff(*ins, '-filter_complex', mix, '-map', '[out]', '-ac', '2', '-ar', '44100', str(TR / 'dialogue.wav'))
    ff('-i', str(TR / 'picture.mp4'), '-i', str(TR / 'dialogue.wav'), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', str(TR / 'cut.mp4'))
    (TR / 'cues.json').write_text(json.dumps(cues, indent=1))
    (TR / 'clips.json').write_text(json.dumps(clips, indent=1))
    print(f'cut.mp4: {t:.1f} s, {len(files)} parts, {len(clips)} sounds and lines, {len(cues)} card whooshes')

if __name__ == '__main__':
    main()
