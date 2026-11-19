#!/bin/bash
# live.sh "<what is happening now>"  : updates the live page's Now line and its picture lists
D=/Users/sid/Developer/Personal/desk-fishing-game/design; cd $D || exit 1
python3 - "$1" <<'PY'
import json, sys, glob, os, time
d = '/Users/sid/Developer/Personal/desk-fishing-game/design'
st = os.path.join(d, 'status.json')
s = json.load(open(st)) if os.path.exists(st) else {'log': []}
if sys.argv[1]:
    s['now'] = sys.argv[1]; s['log'] = ([time.strftime('%H:%M') + '  ' + sys.argv[1]] + s.get('log', []))[:30]
s['aholo'] = sorted(p[len(d)+1:] for e in ('png', 'jpg', 'jpeg', 'webp') for p in glob.glob(f'{d}/aholo/*/*.{e}'))
json.dump(s, open(st, 'w'))
PY
ls flow/*/*.jpg 2>/dev/null | python3 -c 'import sys,json; print(json.dumps([l.strip() for l in sys.stdin]))' > flow/manifest.json
