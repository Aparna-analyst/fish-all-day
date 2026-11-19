#!/bin/bash
# Builds "Fish All Day.app" into mac/build: the page (vite), the Swift shell, the bundle, an ad-hoc signature.
#   mac/build.sh          build
#   mac/build.sh run      build, quit a running copy, open the new one
#   mac/build.sh dmg      build, then a disk image to hand out: mac/build/Fish-All-Day.dmg (drag to Applications)
set -euo pipefail
cd "$(dirname "$0")"; HERE=$(pwd); APP="$HERE/build/Fish All Day.app"
(cd ../web && npx vite build --config vite.mac.config.js --logLevel warn)
rm -rf build/web/check
rm -rf "$APP"; mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc -O -swift-version 5 -target arm64-apple-macos13.0 main.swift -o "$APP/Contents/MacOS/FishAllDay" -framework AppKit -framework WebKit
cp Info.plist "$APP/Contents/Info.plist"
[ -f AppIcon.icns ] && cp AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"
cp -R build/web "$APP/Contents/Resources/web"
codesign --force --deep --sign - "$APP" >/dev/null
echo "built: $APP ($(du -sh "$APP" | cut -f1))"
if [ "${1:-}" = run ]; then
  pkill -x FishAllDay 2>/dev/null || true; sleep 0.5; open "$APP"
fi
if [ "${1:-}" = dmg ]; then
  S="$HERE/build/dmg"; rm -rf "$S" "$HERE/build/Fish-All-Day.dmg"; mkdir -p "$S"
  cp -R "$APP" "$S/"; ln -s /Applications "$S/Applications"
  hdiutil create -volname "Fish All Day" -srcfolder "$S" -ov -format UDZO "$HERE/build/Fish-All-Day.dmg" >/dev/null
  rm -rf "$S"; echo "disk image: $HERE/build/Fish-All-Day.dmg ($(du -sh "$HERE/build/Fish-All-Day.dmg" | cut -f1))"
fi
