#!/bin/bash
# batch-images.sh <list.txt> [parallel=3]  : each line "name|prompt"; runs Aholo's image tool, at most N at once
D=/Users/sid/Developer/Personal/desk-fishing-game; cd $D/tools || exit 1
L=$(mktemp); grep -v '^\s*$' "$1" > "$L"; export L
one() { line=$(sed -n "${1}p" "$L"); name="${line%%|*}"; f=$(mktemp); printf '%s' "${line#*|}" > "$f"
  node aholo-image.mjs "$name" "${REF:--}" "$f" > "/tmp/fad-$name.log" 2>&1; tail -1 "/tmp/fad-$name.log"; ./live.sh "Picture done: $name" >/dev/null; rm -f "$f"; }
export -f one
seq 1 $(wc -l < "$L") | xargs -P "${2:-3}" -I{} bash -c 'one {}'
rm -f "$L"; echo "BATCH DONE"
