import os
import csv
from datetime import datetime

from Imports.state import state

from googleapiclient.errors import HttpError

from bionix_db.bionixdb import ACTION_BY_NAME

NUM_IMUS = 2  # keep in sync with bluetoothHandler.py / rest of the stack


def _open_writer(folder, experiment, number_id, timestamp, modality, header):
    filename = os.path.join(
        folder, f"recording_{experiment}_{modality}_{number_id}_{timestamp}.csv"
    )
    file_handle = open(filename, "w", newline="")
    writer = csv.writer(file_handle)
    writer.writerow(header)
    return filename, file_handle, writer


def start_recording(experiment, number_id):
    folder = "tests"
    os.makedirs(folder, exist_ok=True)

    experiment_clean = experiment.replace(" ", "_")
    timestamp = datetime.now().strftime('%Y-%b-%d_%H-%M-%S')

    emg_header = ["timestamp", "emg1", "emg2"]
    emg_filename, state.emg_csv_file, state.emg_csv_writer = _open_writer(
        folder, experiment_clean, number_id, timestamp, "emg", emg_header
    )

    imu_header = ["timestamp"]
    for i in range(NUM_IMUS):
        for axis in ("ax", "ay", "az", "gx", "gy", "gz"):
            imu_header.append(f"imu{i + 1}_{axis}")
    imu_filename, state.imu_csv_file, state.imu_csv_writer = _open_writer(
        folder, experiment_clean, number_id, timestamp, "imu", imu_header
    )

    camera_header = [
        "timestamp", "marker_id", "pos_x", "pos_y",
        "velocity", "acceleration", "hip_angle", "knee_angle",
    ]
    camera_filename, state.camera_csv_file, state.camera_csv_writer = _open_writer(
        folder, experiment_clean, number_id, timestamp, "camera", camera_header
    )

    state.is_recording = True
    state.recording_files = {
        "emg": emg_filename,
        "imu": imu_filename,
        "camera": camera_filename,
    }
    # Stashed so stop_recording() can build state.last_recording without the
    # route needing to pass experiment/number_id back in a second time.
    state.recording_action = experiment
    state.recording_pid = number_id

    print(f"Recording started: {emg_filename}, {imu_filename}, {camera_filename}")
    return state.recording_files


def stop_recording():
    state.is_recording = False

    for file_attr, writer_attr in (
        ("emg_csv_file", "emg_csv_writer"),
        ("imu_csv_file", "imu_csv_writer"),
        ("camera_csv_file", "camera_csv_writer"),
    ):
        file_handle = getattr(state, file_attr, None)
        if file_handle:
            file_handle.close()
        setattr(state, file_attr, None)
        setattr(state, writer_attr, None)

    _init_recording(
        getattr(state, "recording_action", None),
        getattr(state, "recording_pid", None),
        getattr(state, "recording_files", {}),
    )

    print("Recording stopped")


def _init_recording(action, pid, files):
    """Populates state.last_recording so /export and /record/discard can find the files."""
    state.last_recording = {
        "action": action,
        "pid": pid,
        "files": files,
    }


def write_emg_row(timestamp, emg1, emg2):
    """Call once per incoming line, from bluetoothHandler._process_line."""
    if not (state.is_recording and getattr(state, "emg_csv_writer", None)):
        return
    try:
        state.emg_csv_writer.writerow([timestamp, emg1, emg2])
        state.emg_csv_file.flush()
    except Exception as error:
        print(f"EMG CSV write error: {error}")


def write_imu_row(timestamp, imus):
    """imus: list of length NUM_IMUS, each a dict of ax/ay/az/gx/gy/gz or None."""
    if not (state.is_recording and getattr(state, "imu_csv_writer", None)):
        return
    try:
        row = [timestamp]
        for imu in imus:
            imu = imu or {}
            for axis in ("ax", "ay", "az", "gx", "gy", "gz"):
                row.append(imu.get(axis, ""))
        state.imu_csv_writer.writerow(row)
        state.imu_csv_file.flush()
    except Exception as error:
        print(f"IMU CSV write error: {error}")


def write_camera_row(timestamp, markers, angles):
    """markers: list of {'id','position':[x,y],'velocity','acceleration'}. angles: {'hip','knee'} or None."""
    if not (state.is_recording and getattr(state, "camera_csv_writer", None)):
        return
    try:
        hip = angles.get("hip") if angles else ""
        knee = angles.get("knee") if angles else ""

        if not markers:
            state.camera_csv_writer.writerow([timestamp, "", "", "", "", "", hip, knee])
        else:
            for m in markers:
                pos = m.get("position") or [None, None]
                state.camera_csv_writer.writerow([
                    timestamp, m.get("id"), pos[0], pos[1],
                    m.get("velocity"), m.get("acceleration"), hip, knee,
                ])
        state.camera_csv_file.flush()
    except Exception as error:
        print(f"Camera CSV write error: {error}")


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
    files = {modality: path for modality, path in state.last_recording["files"].items() if path}

    try:
        result = state.bionix_db.upload_session(pid=pid, action=action, **files)
    except PermissionError as error:
        return {'uploaded': False, 'error': str(error)}, 403
    except (FileNotFoundError, ValueError) as error:
        return {'uploaded': False, 'error': str(error)}, 400
    except HttpError as error:
        return {'uploaded': False, 'error': str(error)}, 502

    for path in files.values():
        if os.path.exists(path):
            os.remove(path)
    state.last_recording = None

    return {'uploaded': True, 'names': {modality: r['name'] for modality, r in result.items()}}, 200