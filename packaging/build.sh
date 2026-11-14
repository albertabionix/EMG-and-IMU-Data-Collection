#!/usr/bin/env bash
# Build the macOS app and its release zip:
#   dist/<APP_NAME>.app
#   dist/<App-Name>-macos-arm64.zip  (or -macos-intel.zip on an Intel Mac)
# APP_NAME comes from packaging/EMG-IMU.spec, the only place it's defined.
# Run from anywhere with the project venv active. See README "Building it yourself".
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_NAME="$(sed -n 's/^APP_NAME = "\(.*\)"$/\1/p' packaging/EMG-IMU.spec)"
[[ -n "$APP_NAME" ]] || { echo "Could not read APP_NAME from packaging/EMG-IMU.spec" >&2; exit 1; }
case "$(uname -m)" in
  arm64)  PLATFORM="macos-arm64" ;;
  x86_64) PLATFORM="macos-intel" ;;
  *)      PLATFORM="macos-$(uname -m)" ;;
esac
ZIP="dist/${APP_NAME// /-}-${PLATFORM}.zip"

echo "==> Building frontend"
(cd code/frontend && npm ci && npm run build)

echo "==> Installing build tools"
python -m pip install -r requirements.txt -r packaging/requirements-build.txt

echo "==> Packaging with PyInstaller"
python -m PyInstaller packaging/EMG-IMU.spec --noconfirm --clean \
  --distpath dist --workpath build/pyinstaller

echo "==> Zipping"
rm -f "$ZIP"
# ditto keeps the .app's symlinks and code signature intact (plain zip breaks them).
ditto -c -k --keepParent "dist/$APP_NAME.app" "$ZIP"

echo
echo "Done: $ROOT/dist/$APP_NAME.app"
echo "      $ROOT/$ZIP"
