# Imports/calibration.py

import json
import os
import time

from Runs.extensions import socketio

CALIBRATION_FILE = os.path.join(os.path.dirname(__file__), "imu_calibration.json")
CALIBRATION_DURATION_S = 5.0
NUM_IMUS = 2
GYRO_FIELDS = ("gx", "gy", "gz")

# Per-IMU gyro offsets, e.g. [{"gx": 0.0, "gy": 0.0, "gz": 0.0}, {...}]
_offsets = [{"gx": 0.0, "gy": 0.0, "gz": 0.0} for _ in range(NUM_IMUS)]

# Calibration-in-progress state
_calibrating = False
_calib_end_time = None
_samples = None  # list (per imu) of lists of dicts collected during calibration


def _empty_sample_buffers():
    return [[] for _ in range(NUM_IMUS)]


def load_offsets():
    """Load saved offsets from disk on startup, if present."""
    global _offsets
    if os.path.exists(CALIBRATION_FILE):
        try:
            with open(CALIBRATION_FILE, "r") as f:
                saved = json.load(f)
            if isinstance(saved, list) and len(saved) == NUM_IMUS:
                _offsets = saved
                print(f"Loaded IMU calibration offsets: {_offsets}")
        except Exception as error:
            print(f"Failed to load calibration file: {error}")


def _save_offsets():
    try:
        with open(CALIBRATION_FILE, "w") as f:
            json.dump(_offsets, f, indent=2)
    except Exception as error:
        print(f"Failed to save calibration file: {error}")


def is_calibrating():
    return _calibrating


def start_calibration(duration=CALIBRATION_DURATION_S):
    """
    Begin a calibration window. Call this from a socket event handler
    (e.g. @socketio.on("calibrate_imu")) triggered by the frontend button.
    Device must be held still for the full duration.
    """
    global _calibrating, _calib_end_time, _samples

    if _calibrating:
        return  # already running, ignore duplicate triggers

    _calibrating = True
    _calib_end_time = time.time() + duration
    _samples = _empty_sample_buffers()

    print(f"IMU calibration started, hold still for {duration}s...")
    socketio.emit("calibration_status", {
        "status": "started",
        "duration": duration,
    })


def process_sample(imus):
    """
    Call this from _process_line() with the extracted imus list for every
    incoming packet. While calibrating, buffers gyro samples instead of
    letting them through normally. Returns True if the packet was consumed
    by calibration (caller should skip normal emit/CSV for this packet).
    """
    global _calibrating, _samples

    if not _calibrating:
        return False

    for i, imu in enumerate(imus):
        if imu is None:
            continue
        if all(imu.get(k) is not None for k in GYRO_FIELDS):
            _samples[i].append({k: imu[k] for k in GYRO_FIELDS})

    if time.time() >= _calib_end_time:
        _finish_calibration()

    return True


def _finish_calibration():
    global _calibrating, _offsets, _samples

    new_offsets = []
    for i in range(NUM_IMUS):
        collected = _samples[i]
        if not collected:
            # No samples for this IMU (disconnected slot) - keep previous offset
            new_offsets.append(_offsets[i])
            continue

        avg = {
            k: sum(s[k] for s in collected) / len(collected)
            for k in GYRO_FIELDS
        }
        new_offsets.append(avg)

    _offsets = new_offsets
    _save_offsets()
    _calibrating = False

    print(f"IMU calibration complete: {_offsets}")
    socketio.emit("calibration_status", {
        "status": "complete",
        "offsets": _offsets,
    })


def apply_offsets(imus):
    """
    Subtract the calibrated gyro offset from each IMU reading.
    Call this before emitting/writing any packet once calibration
    is not in progress.
    """
    corrected = []
    for i, imu in enumerate(imus):
        if imu is None:
            corrected.append(None)
            continue

        offset = _offsets[i] if i < len(_offsets) else {"gx": 0.0, "gy": 0.0, "gz": 0.0}
        fixed = dict(imu)
        for k in GYRO_FIELDS:
            if fixed.get(k) is not None:
                try:
                    fixed[k] = fixed[k] - offset.get(k, 0.0)
                except TypeError:
                    pass  # leave non-numeric values untouched
        corrected.append(fixed)

    return corrected