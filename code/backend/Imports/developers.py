"""
Developer allowlist: Google accounts that may use the app without CONTENT_MANAGER
access on the Alberta Bionix Shared Drive.

Developers can use the whole app (sensor, camera, recording, saving locally) but
can never upload to Google Drive. This only unlocks the app's UI: Drive itself
still refuses uploads from accounts without an organizer/fileOrganizer role, so
someone editing this file can't gain upload rights.

Developers must still be members of the Shared Drive (any role), because login
goes through BionixDB.

Emails are read from both of these files (either may be missing):
  - code/backend/developers.json             (in the repo; bundled into the app)
  - <data folder>/developers.json            (per-machine; not in the repo)
    The data folder is ~/Documents/BionixDataCollection for the packaged app,
    or code/backend/ when running from source.

Format:
  {"developers": ["someone@gmail.com", "another@ualberta.ca"]}
"""

import json
import os
import sys

from Imports.paths import FROZEN, data_dir

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _files():
    bundled = os.path.join(sys._MEIPASS if FROZEN else _BACKEND_DIR, "developers.json")
    local = os.path.join(data_dir(), "developers.json")
    return [bundled] if bundled == local else [bundled, local]


def developer_emails():
    emails = set()
    for path in _files():
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except FileNotFoundError:
            continue
        except (OSError, ValueError) as error:
            print(f"Ignoring unreadable developer list {path}: {error}")
            continue
        for email in data.get("developers", []):
            if isinstance(email, str) and email.strip():
                emails.add(email.strip().lower())
    return emails


def is_developer(email):
    return bool(email) and email.strip().lower() in developer_emails()
