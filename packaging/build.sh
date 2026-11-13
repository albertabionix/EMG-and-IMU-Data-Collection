#!/usr/bin/env bash
# Build the macOS app: dist/EMG-IMU Data Collection.app
# Run from anywhere with the project venv active. See README "Building the Executable".
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Building frontend"
(cd code/frontend && npm ci && npm run build)

echo "==> Installing build tools"
python -m pip install -r requirements.txt -r packaging/requirements-build.txt

echo "==> Packaging with PyInstaller"
python -m PyInstaller packaging/EMG-IMU.spec --noconfirm --clean \
  --distpath dist --workpath build/pyinstaller

echo
echo "Done: $ROOT/dist/EMG-IMU Data Collection.app"
