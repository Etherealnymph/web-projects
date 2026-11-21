#!/usr/bin/env bash
set -e
echo "============================================"
echo "  OpenCircuit EDA v2.1.0 Mac / Linux Builder"
echo "============================================"
npm install
npm install --save-dev electron electron-builder
npm run build
OS="$(uname -s)"
if [ "$OS" = "Darwin" ]; then
  npx electron-builder --mac dmg zip
else
  npx electron-builder --linux AppImage deb
fi
echo "[SUCCESS] Build completed! Output is in the release/ folder."
