#!/bin/sh
# Renders the icon source and builds resources/icon.icns plus the in-app copy.
set -e
cd "$(dirname "$0")/.."
npx electron resources/icon/render.cjs "$PWD/resources/icon.png"
SET="$(mktemp -d)/icon.iconset"
mkdir -p "$SET"
for s in 16 32 128 256 512; do
  sips -z $s $s resources/icon.png --out "$SET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s * 2)) $((s * 2)) resources/icon.png --out "$SET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o resources/icon.icns
cp resources/icon.png src/renderer/src/assets/icon.png
echo "resources/icon.icns aktualisiert"
