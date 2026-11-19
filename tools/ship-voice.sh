#!/bin/zsh
# The final dialogue, voiced and shipped: lines.js, his clips (ElevenLabs, sailor voice), the Mac app, the website.
# tools/ship-voice.sh [design/voice/dialogue.json]     about 6 minutes; stops at the first failure
set -e
cd "${0:A:h}/.."
J=${1:-design/voice/dialogue.json}
step() { print "\n== $1  ($(date +%H:%M:%S))"; }
step "lines.js from $J";        node tools/dialogue-to-lines.mjs "$J"
step "voicing (2 at a time; the plan allows 3)";   python3 tools/voice-lines.py --lines "$J" --jobs 2 --check 2>&1 | grep -v Warning
step "clips no line uses any more -> design/voice/unused"
python3 - <<'PY'
import json, pathlib, shutil
d = pathlib.Path('web/public/assets/voice'); keep = set(json.loads((d / 'index.json').read_text())['_lines'])
u = pathlib.Path('design/voice/unused'); n = 0
for f in d.glob('*.mp3'):
    if f.stem not in keep: u.mkdir(parents=True, exist_ok=True); shutil.move(str(f), u / f.name); n += 1
print(f'{len(keep)} clips kept, {n} moved')
PY
if lsof -iTCP:5180 -sTCP:LISTEN >/dev/null 2>&1; then step "voice check on the page"; node tools/check/desk-voice.mjs; fi
step "Mac app";                 mac/build.sh dmg | tail -2
step "website deploy";          site/build.sh deploy | tail -2
step "live check";              node tools/check/site-live.mjs https://fishallday.pages.dev/ | tail -5
step "commit";                  git add web/src/lines.js web/public/assets/voice "$J" && git commit -q -m "His voice: the final dialogue, voiced" && git log --oneline -1
