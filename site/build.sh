#!/bin/bash
# Builds the landing site into site/dist: the page, its media and icons, him (desk.html, built from web/), the Mac download.
#   site/build.sh            build        site/build.sh deploy     build, then publish to Cloudflare Pages (project fishallday)
set -euo pipefail
cd "$(dirname "$0")"; rm -rf dist; mkdir -p dist
(cd ../web && npx vite build --config vite.site.config.js --logLevel warn)
rm -rf dist/desk/check
cp index.html dist/; cp -R public/. dist/
DMG=../mac/build/Fish-All-Day.dmg; [ -f "$DMG" ] && cp "$DMG" dist/ || echo "no disk image yet: run mac/build.sh dmg"
printf '/Fish-All-Day.dmg\n  Content-Type: application/x-apple-diskimage\n  Content-Disposition: attachment; filename="Fish-All-Day.dmg"\n/desk/*\n  X-Robots-Tag: noindex\n' > dist/_headers
echo "built: $(du -sh dist | cut -f1)"
if [ "${1:-}" = deploy ]; then npx -y wrangler@latest pages deploy dist --project-name fishallday --branch main --commit-dirty=true; fi
