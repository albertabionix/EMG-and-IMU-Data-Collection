import json
import time

try:
    from serial import Serial, SerialException
except Exception as error:
    raise RuntimeError(
        "pyserial is not available (or a conflicting 'serial' module is being imported). "
        "Run: python -m pip uninstall -y serial ; python -m pip install pyserial"
    ) from error

from Runs.extensions import socketio
from Imports.state import state

# Keys we look for when extracting a single IMU reading from a parsed packet.
IMU_FIELDS = ("ax", "ay", "az", "gx", "gy", "gz")


def connect_serial():
    try:
        state.ser = Serial(state.comport, state.baud_rate, timeout=1)
        print(f"Connected to serial port {state.comport} at {state.baud_rate} baud")
        return True
    except SerialException as error:
        print(f"Serial connection failed on {state.comport}: {error}")
        state.ser = None
        return False


def _extract_imu_reading(obj):
    """Pull ax/ay/az/gx/gy/gz out of a dict, defaulting missing fields to None."""
    if not isinstance(obj, dict):
        return None
    if not any(key in obj for key in IMU_FIELDS):
        return None
    return {key: obj.get(key) for key in IMU_FIELDS}


def _extract_imus(parsed):
    """
    Normalize IMU data into a list of readings, regardless of whether the
    packet sent a single 'imu' object or a list under 'imus'.
    """
    if "imus" in parsed and isinstance(parsed["imus"], list):
        imus = [_extract_imu_reading(item) for item in parsed["imus"]]
        return [imu for imu in imus if imu is not None]

    if "imu" in parsed:
        single = _extract_imu_reading(parsed["imu"])
        return [single] if single else []

    # Some firmwares might flatten everything into the top-level object
    # (e.g. {"emg1":..., "ax":..., "ay":...}); treat that as one IMU.
    flattened = _extract_imu_reading(parsed)
    return [flattened] if flattened else []


def _flatten_imu_row(imus):
    """Flatten a list of IMU readings into CSV-friendly columns."""
    row = []
    for imu in imus:
        for key in IMU_FIELDS:
            row.append(imu.get(key, "") if imu else "")
    return row


def read_serial():
    while True:
        if state.ser is None or not state.ser.is_open:
            connect_serial()
            socketio.sleep(2)
            continue

        try:
            line = state.ser.readline().decode(errors="ignore").strip()
            if not line:
                socketio.sleep(0.01)
                continue

            try:
                parsed = json.loads(line)
            except json.JSONDecodeError:
                parsed = None

            payload = {"raw": line}

            if isinstance(parsed, dict):
                imus = _extract_imus(parsed)
                if imus:
                    payload["imus"] = imus

            socketio.emit("sensor_data", payload)

            if state.is_recording and state.csv_writer and isinstance(parsed, dict):
                try:
                    emg1 = parsed.get("emg1", "")
                    emg2 = parsed.get("emg2", "")
                    imus = _extract_imus(parsed)
                    row = [time.time(), emg1, emg2] + _flatten_imu_row(imus)
                    state.csv_writer.writerow(row)
                    state.csv_file.flush()
                except Exception as csv_error:
                    print(f"CSV write error: {csv_error}")

        except SerialException as error:
            print(f"Serial read error: {error}")
            try:
                state.ser.close()
            except Exception:
                pass
            state.ser = None
            socketio.sleep(2)
        except Exception as error:
            print(f"Unexpected serial loop error: {error}")
            socketio.sleep(1)