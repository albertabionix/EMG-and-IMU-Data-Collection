import os
import csv
from datetime import datetime

from Imports.state import state

from googleapiclient.errors import HttpError

from bionix_db.bionixdb import ACTION_BY_NAME
from Imports.state import state


def start_recording(experiment, number_id):
    folder = "tests"
    os.makedirs(folder, exist_ok=True)

    experiment = experiment.replace(" ", "_")
    timestamp = datetime.now().strftime('%Y-%b-%d_%H-%M-%S')
    filename = os.path.join(folder, f"recording_{experiment}_{number_id}_{timestamp}.csv")

    state.csv_file = open(filename, "w", newline="")
    state.csv_writer = csv.writer(state.csv_file)
    header = ["timestamp", "emg1", "emg2"]
    for i in range(3):
        for axis in ("ax", "ay", "az", "gx", "gy", "gz"):
            header.append(f"imu{i + 1}_{axis}")
    state.csv_writer.writerow(header)
    state.is_recording = True

    print(f"Recording started: {filename}")
    return filename


def stop_recording():
    state.is_recording = False
    if state.csv_file:
        state.csv_file.close()
        state.csv_file = None
        state.csv_writer = None
    print("Recording stopped")

def discard_recording():
    if state.last_recording is None:
        return False, 'No recording available to discard'

    for path in state.last_recording["files"].values():
        if path and os.path.exists(path):
            os.remove(path)
    state.last_recording = None
    print("Recording discarded")
    return True, None


def export_recording():
    """Returns (result_dict, http_status)."""
    if state.bionix_db is None:
        return {'uploaded': False, 'error': 'Not authenticated — click Authenticate first'}, 401

    if state.last_recording is None:
        return {'uploaded': False, 'error': 'No recording available to export'}, 400

    action = ACTION_BY_NAME.get(state.last_recording["action"])
    if action is None:
        return {'uploaded': False, 'error': f"Unknown action '{state.last_recording['action']}'"}, 400

    pid = _normalize_pid(state.last_recording["pid"])
    # Only the modalities actually recorded for this trial get uploaded — upload_session
    # skips any left as None and still assigns one shared trial number across the rest.
    files = {modality: path for modality, path in state.last_recording["files"].items() if path}

    try:
        result = state.bionix_db.upload_session(pid=pid, action=action, **files)
    except PermissionError as error:
        return {'uploaded': False, 'error': str(error)}, 403
    except (FileNotFoundError, ValueError) as error:
        return {'uploaded': False, 'error': str(error)}, 400
    except HttpError as error:
        return {'uploaded': False, 'error': str(error)}, 502

    # Upload succeeded — the local copies are now redundant with the Drive copies.
    for path in files.values():
        if os.path.exists(path):
            os.remove(path)
    state.last_recording = None

    return {'uploaded': True, 'names': {modality: r['name'] for modality, r in result.items()}}, 200