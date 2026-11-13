"""
Filesystem locations that differ between running from source and running as a
packaged executable (PyInstaller).

- Read-only bundled resources (the built React frontend) live inside the bundle,
  under sys._MEIPASS when frozen.
- Anything the app *writes* (recordings, IMU calibration, the Google token) must
  not go inside the bundle: a macOS .app is read-only/signed and its working
  directory is "/" when launched from Finder. When frozen, writes go to
  ~/Documents/BionixDataCollection instead.

When running from source, paths are unchanged from before packaging support was
added (everything relative to code/backend/).
"""

import os
import sys

FROZEN = getattr(sys, "frozen", False)

# code/backend/
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def frontend_dist_dir():
    """Directory containing the built React app (index.html + assets/)."""
    if FROZEN:
        return os.path.join(sys._MEIPASS, "frontend_dist")
    return os.path.normpath(os.path.join(_BACKEND_DIR, "..", "frontend", "dist"))


def data_dir():
    """Writable per-user directory for app data."""
    if FROZEN:
        path = os.path.join(os.path.expanduser("~"), "Documents", "BionixDataCollection")
    else:
        path = _BACKEND_DIR
    os.makedirs(path, exist_ok=True)
    return path


def recordings_dir():
    """Where recording CSVs are written before export/discard."""
    path = os.path.join(data_dir(), "recordings" if FROZEN else "tests")
    os.makedirs(path, exist_ok=True)
    return path
