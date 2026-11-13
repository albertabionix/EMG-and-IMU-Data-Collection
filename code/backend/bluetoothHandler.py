import struct
import time
import serial
from serial import SerialException

from Runs.extensions import socketio
from Imports.state import state
import calibration
from Camera import recording

PACKET_FORMAT = "<HH 6h 6h"
PACKET_SIZE = struct.calcsize(PACKET_FORMAT)
RECONNECT_DELAY_S = 3

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
        port = state.comport
        if not port:
            # Nothing chosen or detected yet; wait for the user to pick a port.
            socketio.sleep(1)
            continue
        try:
            print(f"Connecting to Bluetooth Classic stream on {port}...")
            ser = serial.Serial(port, timeout=2.0)
            print(f"Bluetooth Classic connected on {port}.")
            state.ser = ser

            # Leave the loop when the port is changed in the UI so we reconnect
            # to the new one (checked at least every read timeout).
            while ser.is_open and state.comport == port:
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
        if state.comport == port:  # failed or dropped; switching ports retries immediately
            socketio.sleep(RECONNECT_DELAY_S)

def main():
    """Run the Classic reader directly for a quick terminal test."""
    try:
        read_ble()
    except KeyboardInterrupt:
        print("\nClosing connection.")

if __name__ == "__main__":
    main()
