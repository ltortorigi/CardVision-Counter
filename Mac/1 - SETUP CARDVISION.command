#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPDIR="$ROOT/App"
NODEURL="https://nodejs.org/en/download"

clear
echo "====================================================="
echo "              CARDVISION MAC SETUP"
echo "====================================================="
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo
  echo "CardVision needs Node.js 20 or newer."
  echo "The official Node.js download page will open now."
  echo "Install the LTS version, then run this setup again."
  open "$NODEURL"
  read -r -p "Press Return to close..."
  exit 1
fi

MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$MAJOR" -lt 20 ]; then
  echo "Your Node.js version is too old."
  echo "Opening the official Node.js download page..."
  open "$NODEURL"
  read -r -p "Press Return to close..."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found. Reinstall Node.js LTS from:"
  echo "$NODEURL"
  open "$NODEURL"
  read -r -p "Press Return to close..."
  exit 1
fi

cd "$APPDIR"

echo "Installing the locked CardVision dependencies..."
npm ci || {
  echo "Installation failed. Check your internet connection and Node.js installation."
  read -r -p "Press Return to close..."
  exit 1
}

echo
echo "====================================================="
echo "                 SETUP COMPLETE"
echo "====================================================="
echo
echo "Go back to the Mac folder and double-click:"
echo
echo "  CardVision Counter.app"
echo
echo "It has the BLACK / SILVER poker-chip icon."
echo
echo "If macOS blocks it the first time:"
echo "  Right-click CardVision Counter.app -> Open -> Open"
echo
read -r -p "Press Return to close..."
