import os

from googleapiclient.errors import HttpError

from bionix_db import BionixDB
from Imports.state import state
from Imports.paths import FROZEN, data_dir
from Imports import developers

# From source this stays relative to the working directory (unchanged behaviour);
# in the packaged app it must live in the writable per-user data folder.
TOKEN_FILE = os.path.join(data_dir(), "token.json") if FROZEN else "token.json"


def login():
    """
    Authenticate against Google Drive via BionixDB. force_reauth=True so every
    click of Authenticate opens a fresh Google login instead of silently reusing
    a cached token.json from a previous session.

    Returns (result_dict, http_status).
    """
    try:
        db = BionixDB(token_file=TOKEN_FILE, force_reauth=True)
    except PermissionError as error:
        return {'authenticated': False, 'error': str(error)}, 403
    except HttpError as error:
        return {'authenticated': False, 'error': str(error)}, 502

    # Signed in and a member of the Shared Drive; now check upload rights.
    try:
        db.authenticate_user(db.credentials_file, db.token_file, require_content_manager=True)
        access = db.access.name  # "CONTENT_MANAGER"
    except PermissionError as error:
        email = _signed_in_email(db)
        if not developers.is_developer(email):
            return {'authenticated': False, 'error': str(error)}, 403
        # Developer allowlist (developers.json): full app access, no uploads.
        print(f"Authenticated as {email} with DEVELOPER access (uploads disabled)")
        access = "DEVELOPER"
    except HttpError as error:
        return {'authenticated': False, 'error': str(error)}, 502

    state.bionix_db = db
    state.auth_access = access
    return {'authenticated': True, 'access': access}, 200


def _signed_in_email(db):
    try:
        about = db.service.about().get(fields="user(emailAddress)").execute()
        return about.get("user", {}).get("emailAddress")
    except Exception:
        return None


def upload_block_reason():
    """Why uploads to Google Drive are disabled this session, or None if allowed."""
    if state.simulation_available:
        return "Simulated sensor mode: uploading to Google Drive is disabled."
    if state.auth_access == "DEVELOPER":
        return "Developer account: uploading to Google Drive is disabled."
    return None