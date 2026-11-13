# -*- mode: python ; coding: utf-8 -*-
#
# PyInstaller spec for the EMG-IMU Data Collection desktop app.
# Don't run this directly. Use packaging/build.sh (macOS) or packaging/build.ps1
# (Windows), which build the React frontend first. See README "Building the Executable".
#
# PyInstaller cannot cross-compile: run it on Windows to get the Windows app and on
# macOS to get the macOS app (or let the GitHub Actions workflow build both).

import os
import sys

from PyInstaller.utils.hooks import collect_data_files

APP_NAME = "EMG-IMU Data Collection"
BUNDLE_ID = "ca.albertabionix.emg-imu-data-collection"
VERSION = os.environ.get("APP_VERSION", "0.0.0")

ROOT = os.path.abspath(os.path.join(SPECPATH, ".."))
BACKEND = os.path.join(ROOT, "code", "backend")
FRONTEND_DIST = os.path.join(ROOT, "code", "frontend", "dist")
ICON_PNG = os.path.join(ROOT, "code", "frontend", "src", "assets", "bionix_logo.png")

if not os.path.exists(os.path.join(FRONTEND_DIST, "index.html")):
    raise SystemExit(
        "code/frontend/dist is missing. Run `npm run build` in code/frontend first "
        "(the build scripts in packaging/ do this for you)."
    )

a = Analysis(
    [os.path.join(BACKEND, "main.py")],
    pathex=[BACKEND],
    datas=[
        (FRONTEND_DIST, "frontend_dist"),   # served by Flask, see Imports/paths.py
        *collect_data_files("bionix_db"),   # bundled OAuth client (credentials.json)
    ],
    hiddenimports=[
        # Flask-SocketIO picks its async driver dynamically, so PyInstaller can't see it.
        "engineio.async_drivers.threading",
    ],
    excludes=["tkinter"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name=APP_NAME,
    console=False,          # no terminal window; output goes to app.log in the data folder
    icon=ICON_PNG,          # converted to .ico/.icns automatically (needs Pillow)
    upx=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    name=APP_NAME,
    upx=False,
)

if sys.platform == "darwin":
    app = BUNDLE(
        coll,
        name=f"{APP_NAME}.app",
        icon=ICON_PNG,
        bundle_identifier=BUNDLE_ID,
        version=VERSION,
        info_plist={
            "CFBundleShortVersionString": VERSION,
            "NSHighResolutionCapable": True,
            # Without these macOS silently denies (or kills the app on) camera/Bluetooth access.
            "NSCameraUsageDescription": "The camera is used for CVKAS marker tracking.",
            "NSBluetoothAlwaysUsageDescription": "Bluetooth is used to connect to the EMG/IMU sensors.",
        },
    )
