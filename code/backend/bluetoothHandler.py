import struct
import sys
import time
import serial
from serial import SerialException
from serial.tools import list_ports

from Runs.extensions import socketio
from Imports.state import state
import calibration
from Camera import recording

PACKET_FORMAT = "<HH 6h 6h"
PACKET_SIZE = struct.calcsize(PACKET_FORMAT)
RECONNECT_DELAY_S = 3

# Substring to look for when auto-detecting the paired device's serial port.
# Must match (part of) the name set in SerialBT.begin("...") on the ESP32.
DEVICE_NAME_HINT = "ESP32"


def _find_bluetooth_port():
    """
    Try state.comport first (lets /change-port or SERIAL_PORT env override
    everything). If that's unset/not found, scan available ports for one
    matching DEVICE_NAME_HINT.

    On macOS this looks for /dev/cu.* entries — prefer cu over tty since
    tty blocks until DCD is asserted, which some Bluetooth SPP stacks
    never raise, causing serial.Serial() to hang indefinitely.
    """
    candidates = list(list_ports.comports())
    by_device = {p.device: p for p in candidates}

    if state.comport and state.comport in by_device:
        return state.comport

    matches = [
        p.device for p in candidates
        if DEVICE_NAME_HINT.lower() in (p.description or "").lower()
        or DEVICE_NAME_HINT.lower() in (p.device or "").lower()
    ]

    if sys.platform == "darwin":
        # Prefer /dev/cu.* over /dev/tty.* if both show up for the same device
        matches = [m for m in matches if "/cu." in m] or matches

    if matches:
        return matches[0]

    return state.comport  # fall back to whatever was configured; will just fail loudly


def _process_packet(packet_bytes):
    unpacked = struct.unpack(PACKET_FORMAT, packet_bytes)
    emg1, emg2 = unpacked[:2]
    raw_imus = [
        dict(zip(("ax", "ay", "az", "gx", "gy", "gz"), unpacked[2:8])),
        dict(zip(("ax", "ay", "az", "gx", "gy", "gz"), unpacked[8:14])),
    ]

    calibration.process_sample(raw_imus)
    imus = raw_imus if calibration.is_calibrating() else calibration.apply_offsets(raw_imus)
    socketio.emit("sensor_data", {"emg1": emg1, "emg2": emg2, "imus": imus})

    if state.is_recording:
        now = time.time()
        recording.write_emg_row(now, emg1, emg2)
        recording.write_imu_row(now, raw_imus)


def read_ble():
    while True:
        ser = None
        port = _find_bluetooth_port()
        try:
            print(f"Connecting to Bluetooth Classic stream on {port}...")
            ser = serial.Serial(port, timeout=2.0)
            state.comport = port  # keep state in sync with what actually connected
            print(f"Bluetooth Classic connected on {port}.")
            state.ser = ser

            while ser.is_open:
                packet = ser.read(PACKET_SIZE)
                if len(packet) == PACKET_SIZE:
                    _process_packet(packet)
                else:
                    ser.reset_input_buffer()
        except SerialException as error:
            print(f"Bluetooth Classic connection failed on {port}: {error}")
        except Exception as error:
            print(f"Bluetooth Classic stream error: {error}")
        finally:
            state.ser = None
            if ser is not None:
                ser.close()
        socketio.sleep(RECONNECT_DELAY_S)


def main():
    """Run the Classic reader directly for a quick terminal test."""
    try:
        read_ble()
    except KeyboardInterrupt:
        print("\nClosing connection.")


if __name__ == "__main__":
    main()