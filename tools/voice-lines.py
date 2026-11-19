#!/usr/bin/env python3
"""His voice: one clip per line of dialogue, for the desk app (web/src/voice.js plays them with his bubble).

    python3 tools/voice-lines.py --lines dialogue.json [--voice <ElevenLabs voice id>] [--only 3] [--jobs 4] [--check] [--out dir]
    python3 tools/voice-lines.py --lines web/src/lines.js

--lines: a JSON file ({"kind": ["line", ...]}, {"kind": {"when", "lines"}}, ["line", ...] or [{"text": ...}]) or lines.js.
Writes web/public/assets/voice/<key>.mp3 and index.json (key -> file, plus the text of each line for reference).
The key is the line's letters and digits in lower case, hashed as voice.js does, so the page finds the clip by text.
Swearing written as #@$%! is spoken around and bleeped in the gap. Lines already made are kept (delete to remake).
TTS: ElevenLabs eleven_v4 with his voice (a 1930s cartoon sailor designed with ElevenLabs voice design, saved to the account);
the key is read from ~/.config/elevenlabs/key and never printed.
Stops at the first failure (a rate limit, a refusal): never retries in a loop.
"""
import argparse, json, pathlib, re, shutil, subprocess, sys, tempfile, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'web/public/assets/voice'
KEYFILE = pathlib.Path.home() / '.config/elevenlabs/key'
VOICE = '3PWWtAZrOI7hgw5olZ6H'          # "Fish All Day old sailor" (designed sailor 2, picked 18 Nov)
MODEL = 'eleven_v4'
GRAWLIX = re.compile(r'[#@$%&*]{3,}')


def key_of(text):
    h = 2166136261
    for c in re.sub(r'[^a-z0-9]', '', text.lower()):
        h ^= ord(c); h = (h * 16777619) & 0xffffffff
    digits, out = '0123456789abcdefghijklmnopqrstuvwxyz', ''
    while True:
        h, r = divmod(h, 36); out = digits[r] + out
        if not h: return out


def read_lines(path):
    p = pathlib.Path(path)
    if p.suffix == '.js':
        src = subprocess.run(['node', '--input-type=module', '-e',
                              f'import("{p.resolve().as_uri()}").then(m => console.log(JSON.stringify(m.LINES)))'],
                             capture_output=True, text=True, check=True).stdout
        data = json.loads(src)
    else:
        data = json.loads(p.read_text())
    if isinstance(data, dict):           # {"kind": [...]} or design/voice/dialogue.json's {"kind": {"when", "lines"}}
        vals = [v.get('lines', []) if isinstance(v, dict) else v for k, v in data.items() if not k.startswith('_')]
        items = [t for v in vals for t in (v if isinstance(v, list) else [v])]
    else:
        items = data
    lines = [(x['text'] if isinstance(x, dict) else x).strip() for x in items]
    seen, out = set(), []
    for t in lines:
        if t and t not in seen: seen.add(t); out.append(t)
    return out


def ffmpeg(*a):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *a], check=True)


def speak(text, voice, tmp):
    out = pathlib.Path(tempfile.mkdtemp(dir=tmp)) / 'take.mp3'
    req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128', method='POST',
                                 data=json.dumps({'text': text, 'model_id': MODEL}).encode(),
                                 headers={'xi-api-key': KEYFILE.read_text().strip(), 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
    try:
        out.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'TTS failed for {text!r}: HTTP {e.code} {e.read().decode(errors="replace")[:300]}')
    return out


def make(text, voice, tmp):
    parts = GRAWLIX.split(text)
    segs = []
    for i, part in enumerate(parts):
        words = part.strip(' ,')
        if re.search(r'[A-Za-z0-9]', words): segs.append(speak(words, voice, tmp))
        if i < len(parts) - 1:                                     # the swear word: a bleep
            b = pathlib.Path(tempfile.mkdtemp(dir=tmp)) / 'bleep.wav'
            ffmpeg('-f', 'lavfi', '-i', 'sine=frequency=1000:duration=0.42:sample_rate=24000',
                   '-af', 'volume=0.35,afade=t=in:d=0.02,afade=t=out:st=0.39:d=0.03', '-ac', '1', str(b))
            segs.append(b)
    # trim the silence each take starts and ends with, join, level to -16 LUFS, a small mp3
    trimmed = []
    for s in segs:
        t = s.with_name(s.stem + '-t.wav')
        ffmpeg('-i', str(s), '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,'
               'silenceremove=start_periods=1:start_threshold=-45dB,areverse', '-ar', '24000', '-ac', '1', str(t))
        trimmed.append(t)
    lst = pathlib.Path(tempfile.mkdtemp(dir=tmp)) / 'list.txt'
    lst.write_text(''.join(f"file '{t}'\n" for t in trimmed))
    out = OUT / f'{key_of(text)}.mp3'
    ffmpeg('-f', 'concat', '-safe', '0', '-i', str(lst), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,apad=pad_dur=0.08',
           '-ar', '24000', '-ac', '1', '-b:a', '64k', str(out))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lines', required=True); ap.add_argument('--voice', default=VOICE); ap.add_argument('--out')
    ap.add_argument('--only', type=int, default=0)
    ap.add_argument('--jobs', type=int, default=2); ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    global OUT
    if a.out: OUT = pathlib.Path(a.out).resolve()
    OUT.mkdir(parents=True, exist_ok=True)
    idx_path = OUT / 'index.json'
    idx = json.loads(idx_path.read_text()) if idx_path.exists() else {}
    if idx.get('_voice') and idx['_voice'] != a.voice:
        sys.exit(f"index.json was made with {idx['_voice']}; delete web/public/assets/voice to remake in {a.voice}")
    lines = read_lines(a.lines)
    if a.only: lines = lines[:a.only]
    todo = [t for t in lines if not (OUT / f'{key_of(t)}.mp3').exists()]
    print(f'{len(lines)} lines, {len(todo)} to make, voice {a.voice}')
    tmp = tempfile.mkdtemp()
    try:
        with ThreadPoolExecutor(a.jobs) as ex:
            futs = {t: ex.submit(make, t, a.voice, tmp) for t in todo}
            for t, f in futs.items():
                try: print('made', f.result().name, '|', t)
                except Exception as e:
                    print('STOPPED:', e); ex.shutdown(cancel_futures=True); break
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    idx = {'_voice': a.voice, '_lines': {}}
    for t in read_lines(a.lines):
        k = key_of(t)
        if (OUT / f'{k}.mp3').exists(): idx[k] = f'{k}.mp3'; idx['_lines'][k] = t
    idx_path.write_text(json.dumps(idx, indent=1, ensure_ascii=False))
    print(f'index: {len(idx["_lines"])} clips')
    if a.check:      # every word heard? (Whisper, in Hans's kit)
        hans = pathlib.Path.home() / 'Developer/Personal/hans/.venv/bin/python'
        code = ('import json,sys,re\nfrom mlx_audio.stt.utils import load_model\n'
                'm=load_model("mlx-community/whisper-large-v3-turbo-asr-fp16")\n'
                'w=lambda s: re.sub(r"[^a-z0-9 ]"," ",s.lower()).split()\n'
                'for k,t in json.loads(sys.argv[1]).items():\n'
                '  h=m.generate(sys.argv[2]+"/"+k+".mp3").text.strip(); r=w(t.replace("#@$%","")); hw=set(w(h))\n'
                '  miss=[x for x in r if x not in hw]\n'
                '  print(("OK   " if len(miss)<=max(1,len(r)//6) else "CHECK"), t, "|", h)\n')
        subprocess.run([str(hans), '-c', code, json.dumps(idx['_lines']), str(OUT)])


if __name__ == '__main__':
    main()
