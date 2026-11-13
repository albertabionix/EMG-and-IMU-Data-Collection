import os

from googleapiclient.errors import HttpError

from bionix_db import BionixDB
from Imports.state import state
from Imports.paths import FROZEN, data_dir

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
        db.authenticate_user(db.credentials_file, db.token_file, require_content_manager=True)
    except PermissionError as error:
        return {'authenticated': False, 'error': str(error)}, 403
    except HttpError as error:
        return {'authenticated': False, 'error': str(error)}, 502

    state.bionix_db = db
    return {
        'authenticated': True,
        'access': db.access.name,  # "CONTRIBUTOR" or "CONTENT_MANAGER"
    }, 200