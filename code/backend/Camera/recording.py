import os
import csv
from datetime import datetime

from Imports.state import state
from Imports.paths import recordings_dir

from googleapiclient.errors import HttpError

from bionix_db.bionixdb import ACTION_BY_NAME

import auth
from sensorPacket import NUM_IMUS, IMU_AXES, SAMPLE_RATE_HZ
from Camera.cv_processor import CVKAS_MARKER_IDS

# Per-marker CVKAS columns, suffixed with the marker id: pos_x_0, pos_y_0, ...
CVKAS_MARKER_FIELDS = ("pos_x", "pos_y", "velocity", "acceleration")


def _open_writer(folder, experiment, number_id, timestamp, modality, header):
    filename = os.path.join(
        folder, f"recording_{experiment}_{modality}_{number_id}_{timestamp}.csv"
    )
    file_handle = open(filename, "w", newline="")
    writer = csv.writer(file_handle)
    writer.writerow(header)
    return filename, file_handle, writer


def start_recording(experiment, exercise=None, number_id=None):
    folder = recordings_dir()

    experiment_clean = str(experiment or "unknown").replace(" ", "_")
    exercise_clean = str(exercise or "unknown").replace(" ", "_")
    base_name = f"{experiment_clean}_{exercise_clean}" if exercise_clean not in ("", "unknown") else experiment_clean
    timestamp = datetime.now().strftime('%Y-%b-%d_%H-%M-%S')

    # timestamp: when the computer received the sample (shared clock with CVKAS).
    # seq: the ESP32's sample number (1 per ms), the exact sample time on the
    # sensor's clock; gaps in seq are lost samples. See sensorPacket.py.
    emg_header = ["timestamp", "seq", "emg1", "emg2"]
    emg_filename, state.emg_csv_file, state.emg_csv_writer = _open_writer(
        folder, base_name, number_id, timestamp, "emg", emg_header
    )

    # One row per IMU reading (100 Hz), not per packet: no repeated values.
    imu_header = ["timestamp", "seq"]
    for i in range(NUM_IMUS):
        for axis in IMU_AXES:
            imu_header.append(f"imu{i + 1}_{axis}")
    imu_filename, state.imu_csv_file, state.imu_csv_writer = _open_writer(
        folder, base_name, number_id, timestamp, "imu", imu_header
    )

    # NOTE: modality string here must match BionixDB's MODALITY_FOLDERS / upload_session
    # kwarg names ("emg", "imu", "cvkas") — it used to be "camera", which broke export.
    # One row per camera frame, one column group per marker (see CVKAS_MARKER_IDS).
    # A marker not detected in a frame has blank columns in that row.
    cvkas_header = ["timestamp"]
    for marker_id in CVKAS_MARKER_IDS:
        cvkas_header += [f"{field}_{marker_id}" for field in CVKAS_MARKER_FIELDS]
    cvkas_header += ["hip_angle", "knee_angle"]
    cvkas_filename, state.cvkas_csv_file, state.cvkas_csv_writer = _open_writer(
        folder, base_name, number_id, timestamp, "cvkas", cvkas_header
    )

    _reset_sample_stats()
    state.is_recording = True
    state.exercise = exercise
    state.recording_files = {
        "emg": emg_filename,
        "imu": imu_filename,
        "cvkas": cvkas_filename,
    }
    # Stashed so stop_recording() can build state.last_recording without the
    # route needing to pass experiment/exercise/number_id back in a second time.
    state.recording_action = experiment
    state.recording_exercise = exercise
    state.recording_pid = number_id

    print(f"Recording started: {emg_filename}, {imu_filename}, {cvkas_filename}")
    return state.recording_files


def stop_recording():
    state.is_recording = False

    for file_attr, writer_attr in (
        ("emg_csv_file", "emg_csv_writer"),
        ("imu_csv_file", "imu_csv_writer"),
        ("cvkas_csv_file", "cvkas_csv_writer"),
    ):
        file_handle = getattr(state, file_attr, None)
        if file_handle:
            file_handle.close()
        setattr(state, file_attr, None)
        setattr(state, writer_attr, None)

    _init_recording(
        getattr(state, "recording_action", None),
        getattr(state, "recording_exercise", None),
        getattr(state, "recording_pid", None),
        getattr(state, "recording_files", {}),
    )

    stats = sample_summary()
    if stats["received"]:
        print(
            f"Recording stopped: {stats['received']} sensor samples received, "
            f"{stats['missing']} missing ({stats['missing_percent']}%)"
            + (f", sensor restarted {stats['restarts']}x" if stats["restarts"] else "")
        )
    else:
        print("Recording stopped (no sensor samples received)")
    return stats


# ---- Sensor sample accounting (lost samples show up as gaps in seq) ----

def _reset_sample_stats():
    state.sample_stats = {"first_seq": None, "last_seq": None, "received": 0, "missing": 0, "restarts": 0}


def note_sample(seq):
    """Call for every sensor packet received while recording."""
    st = getattr(state, "sample_stats", None)
    if st is None:
        _reset_sample_stats()
        st = state.sample_stats
    last = st["last_seq"]
    if last is None:
        st["first_seq"] = seq
    elif seq > last:
        st["missing"] += seq - last - 1
    else:
        st["restarts"] += 1  # seq went backwards: the ESP32 rebooted
    st["last_seq"] = seq
    st["received"] += 1


def sample_summary():
    """{"received", "missing", "missing_percent", "restarts", "duration_s"}"""
    st = getattr(state, "sample_stats", None) or {}
    received, missing = st.get("received", 0), st.get("missing", 0)
    expected = received + missing
    return {
        "received": received,
        "missing": missing,
        "missing_percent": round(100 * missing / expected, 2) if expected else 0.0,
        "restarts": st.get("restarts", 0),
        "duration_s": round(expected / SAMPLE_RATE_HZ, 3),
    }


def _normalize_pid(pid):
    """Normalize a raw pid value (from the recording form/state) into the shape
    BionixDB._format_pid() expects: either an int, or an already-formatted
    'pNNN' string. Handles plain digit strings ("1", "12") and loose 'p'-prefixed
    strings ("p1", "P001", " p12 ") by coercing them to the zero-padded form.
    """
    if isinstance(pid, int):
        return pid

    if pid is None:
        raise ValueError("Recording has no participant ID (pid) set — cannot export.")

    pid_str = str(pid).strip()
    if not pid_str:
        raise ValueError("Recording has an empty participant ID (pid) — cannot export.")

    if pid_str.isdigit():
        return int(pid_str)

    if pid_str.lower().startswith("p") and pid_str[1:].isdigit():
        return f"p{int(pid_str[1:]):03d}"

    raise ValueError(
        f"Could not parse participant ID '{pid}' — expected a number (e.g. 1) "
        "or 'pNNN' format (e.g. p001)."
    )


def _init_recording(action, exercise, pid, files):
    """Populates state.last_recording so /export and /record/discard can find the files."""
    state.exercise = exercise
    state.last_recording = {
        "action": action,
        "exercise": exercise,
        "pid": pid,
        "files": files,
    }


def write_emg_row(timestamp, seq, emg1, emg2):
    """Call once per sensor packet, from bluetoothHandler._process_packet."""
    if not (state.is_recording and getattr(state, "emg_csv_writer", None)):
        return
    try:
        state.emg_csv_writer.writerow([timestamp, seq, emg1, emg2])
        state.emg_csv_file.flush()
    except Exception as error:
        print(f"EMG CSV write error: {error}")


def write_imu_row(timestamp, seq, imus):
    """Call only for packets with a fresh IMU reading.

    imus: list of length NUM_IMUS, each a dict of ax/ay/az/gx/gy/gz, or None for
    an IMU that wasn't read on this sample (left blank in the CSV)."""
    if not (state.is_recording and getattr(state, "imu_csv_writer", None)):
        return
    try:
        row = [timestamp, seq]
        for imu in imus:
            imu = imu or {}
            for axis in IMU_AXES:
                row.append(imu.get(axis, ""))
        state.imu_csv_writer.writerow(row)
        state.imu_csv_file.flush()
    except Exception as error:
        print(f"IMU CSV write error: {error}")


def _blank_if_none(value):
    return "" if value is None else value


def write_cvkas_row(timestamp, markers, angles):
    """Write one row for a camera frame.

    markers: list of {'id', 'position': [x, y], 'speed', 'acceleration_magnitude', ...}.
    angles: {'hip', 'knee'} or None.

    velocity_<id> and acceleration_<id> are the magnitudes (pixels/s, pixels/s^2)
    of the Kalman-filtered marker motion; positions are in full-resolution pixels.
    """
    if not (state.is_recording and getattr(state, "cvkas_csv_writer", None)):
        return
    try:
        by_id = {m.get("id"): m for m in markers or []}
        row = [timestamp]
        for marker_id in CVKAS_MARKER_IDS:
            m = by_id.get(marker_id)
            if m is None:
                row += [""] * len(CVKAS_MARKER_FIELDS)
                continue
            pos = m.get("position") or ["", ""]
            row += [
                pos[0], pos[1],
                _blank_if_none(m.get("speed")),
                _blank_if_none(m.get("acceleration_magnitude")),
            ]
        row += [
            _blank_if_none(angles.get("hip")) if angles else "",
            _blank_if_none(angles.get("knee")) if angles else "",
        ]
        state.cvkas_csv_writer.writerow(row)
        state.cvkas_csv_file.flush()
    except Exception as error:
        print(f"CVKAS CSV write error: {error}")


def discard_recording():
    if state.last_recording is None:
        return False, 'No recording available to discard'

    for path in state.last_recording["files"].values():
        if path and os.path.exists(path):
            os.remove(path)
    state.last_recording = None
    print("Recording discarded")
    return True, None


def export_recording(local=False):
    """Returns (result_dict, http_status)."""
    if state.last_recording is None:
        return {'uploaded': False, 'saved': False, 'error': 'No recording available to export'}, 400

    if local:
        files = {
            modality: path
            for modality, path in state.last_recording["files"].items()
            if path
        }
        state.last_recording = None
        return {'saved': True, 'files': files}, 200

    blocked = auth.upload_block_reason()
    if blocked:
        # uploadDisabled tells the frontend to save locally instead.
        return {'uploaded': False, 'uploadDisabled': True, 'error': blocked}, 403

    if state.bionix_db is None:
        return {'uploaded': False, 'error': 'Not authenticated — click Authenticate first'}, 401

    action = ACTION_BY_NAME.get(state.last_recording["action"])
    if action is None:
        return {'uploaded': False, 'error': f"Unknown action '{state.last_recording['action']}'"}, 400

    pid = _normalize_pid(state.last_recording["pid"])
    exercise = state.last_recording.get("exercise")
    files = {modality: path for modality, path in state.last_recording["files"].items() if path}

    try:
        result = state.bionix_db.upload_session(pid=pid, action=action, exercise=exercise, **files)
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