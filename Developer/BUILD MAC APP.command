#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPDIR="$ROOT/App"
NODEURL="https://nodejs.org/en/download"

if ! command -v node >/dev/null 2>&1; then
  open "$NODEURL"
  echo "Install Node.js 20+ LTS, then run this file again."
  read -r -p "Press Return to close..."
  exit 1
fi

cd "$APPDIR"
if [ ! -d node_modules ]; then npm ci || exit 1; fi
npx electron-builder --mac dmg || exit 1
echo
echo "Build output is in:"
echo "  $ROOT/Build Output"
read -r -p "Press Return to close..."
