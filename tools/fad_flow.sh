#!/bin/bash
# Fish All Day mockups through Flow, one job at a time, stop at the first failure.
# usage: fad_flow.sh "name|aspect|ref1,ref2" ...   (prompts in design/prompts/<name>.txt, pictures in design/flow/<name>/)
D=/Users/sid/Developer/Personal/desk-fishing-game/design
P=https://flow.google.com/project/a5a217e1-5a23-4de4-8709-78a99a223b59
cd ~/Developer/Personal/ai-video-workflow || exit 1
export FLOW_HEADED_PORT=34569 FLOW_BROWSE=$PWD/scripts/browse_headed.py
L=/tmp/fad-flow.log; echo "START $(date +%H:%M:%S)" | tee -a $L
manifest() { (cd $D && ls flow/*/*.jpg 2>/dev/null | python3 -c 'import sys,json; print(json.dumps([l.strip() for l in sys.stdin]))' > flow/manifest.json); }
for job in "$@"; do
  IFS="|" read -r a asp refs <<< "$job"; args=(); IFS=, read -ra rr <<< "$refs"; for r in "${rr[@]}"; do [ -n "$r" ] && args+=(--ref "$r"); done
  mkdir -p "$D/flow/$a"; t0=$(date +%s)
  if python3 scripts/flow_image.py "$P" "$D/prompts/$a.txt" "$D/flow/$a/$a" --aspect "$asp" --count 2 "${args[@]}" > "/tmp/fad-$a.log" 2>&1; then
    echo "OK $a $(( $(date +%s) - t0 )) s" | tee -a $L; manifest
  else
    echo "FAIL $a: $(tail -3 /tmp/fad-$a.log)" | tee -a $L; echo "STOPPED at first failure" | tee -a $L; exit 1
  fi
  sleep 20
done
sleep 40; manifest; echo "ALL DONE $(date +%H:%M:%S)" | tee -a $L
