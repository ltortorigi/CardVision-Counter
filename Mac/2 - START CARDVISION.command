#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPDIR="$ROOT/App"
NODEURL="https://nodejs.org/en/download"

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "CardVision needs Node.js 20 or newer."
  echo "Opening the official Node.js download page..."
  open "$NODEURL"
  echo
  echo "Install the LTS version of Node.js, then run:"
  echo "  1 - SETUP CARDVISION.command"
  echo "again."
  read -r -p "Press Return to close..."
  exit 1
fi

MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$MAJOR" -lt 20 ]; then
  echo "Your Node.js version is too old. CardVision needs Node.js 20 or newer."
  open "$NODEURL"
  read -r -p "Press Return to close..."
  exit 1
fi

cd "$APPDIR"

if [ ! -d node_modules ]; then
  echo "Installing CardVision files for first use..."
  npm install || {
    echo "Installation failed. Check your internet connection and try again."
    read -r -p "Press Return to close..."
    exit 1
  }
fi

npm start
