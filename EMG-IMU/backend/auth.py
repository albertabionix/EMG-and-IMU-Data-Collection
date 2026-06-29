from googleapiclient.errors import HttpError

from bionix_db import BionixDB
from state import state


def login():
    """
    Authenticate against Google Drive via BionixDB. force_reauth=True so every
    click of Authenticate opens a fresh Google login instead of silently reusing
    a cached token.json from a previous session.

    Returns (result_dict, http_status).
    """
    try:
        db = BionixDB(force_reauth=True)
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